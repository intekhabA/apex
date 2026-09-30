from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_lab_staff
from app.core.security import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.test import Test, TestParameter, TestReferenceRange
from app.models.sample import Sample
from app.models.booking import Booking
from app.models.report import Report, ReportStatus
from app.models.result import TestResultValue, ResultFlagEnum
from app.schemas.common import APIResponse
from app.schemas.result import (
    ResultEntryPayload,
    ResultSheetResponse,
    ResultValueResponse,
    PendingWorklistResponse,
)
from app.services.calculation_engine import evaluate_parameter_result
from app.services.audit_service import audit_log

router = APIRouter(prefix="/results", tags=["Results Entry & Calculation Engine"])


@router.get("/pending", response_model=APIResponse[List[PendingWorklistResponse]])
async def list_pending_results(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve worklist of diagnostic tests awaiting laboratory result entry."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    query = (
        select(Report)
        .options(
            selectinload(Report.booking),
            selectinload(Report.test),
        )
        .where(Report.status.in_([ReportStatus.DRAFT, ReportStatus.PENDING_REVIEW]))
    )

    if current_user.lab_id:
        query = query.where(Report.lab_id == current_user.lab_id)

    query = query.order_by(desc(Report.created_at))
    res = await db.execute(query)
    reports = res.scalars().all()

    # Pre-fetch patients
    patient_ids = [r.patient_id for r in reports]
    patients_map = {}
    if patient_ids:
        p_res = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        for p in p_res.scalars().all():
            patients_map[p.id] = p

    output = []
    for r in reports:
        patient = patients_map.get(r.patient_id)
        output.append(
            PendingWorklistResponse(
                report_id=str(r.id),
                report_id_display=r.report_id_display,
                booking_id=str(r.booking_id),
                booking_id_display=r.booking.booking_id_display if r.booking else "",
                patient_name=patient.full_name if patient else "Unknown",
                patient_id_display=patient.patient_id_display if patient else "",
                test_name=r.test.name if r.test else "",
                test_code=r.test.code if r.test else "",
                sample_type=r.test.sample_type.value if r.test else "",
                status=r.status,
                created_at=r.created_at,
            )
        )

    return APIResponse(success=True, message=f"Retrieved {len(output)} pending reports.", data=output)


@router.get("/{report_id}", response_model=APIResponse[ResultSheetResponse])
async def get_result_entry_sheet(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve structured result entry worksheet with biological reference ranges."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.test).selectinload(Test.parameters).selectinload(TestParameter.reference_ranges),
            selectinload(Report.result_values),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.role.value != "SUPER_ADMIN" and report.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    # Fetch Patient
    p_res = await db.execute(select(Patient).where(Patient.id == report.patient_id))
    patient = p_res.scalar_one()

    # Map existing saved values by parameter_id
    saved_values_map = {val.parameter_id: val for val in report.result_values}

    # Build response for all parameters
    values_output = []
    for param in report.test.parameters:
        existing_val = saved_values_map.get(param.id)

        # Evaluate reference range display string for this patient
        _, ref_range_display = evaluate_parameter_result(None, param, patient)
        if existing_val and existing_val.reference_range_display:
            ref_range_display = existing_val.reference_range_display

        values_output.append(
            ResultValueResponse(
                id=str(existing_val.id) if existing_val else "",
                parameter_id=str(param.id),
                parameter_name=param.name,
                parameter_code=param.code,
                numeric_value=existing_val.numeric_value if existing_val else None,
                text_value=existing_val.text_value if existing_val else None,
                unit=param.unit,
                reference_range_display=ref_range_display,
                flag=existing_val.flag if existing_val else ResultFlagEnum.NORMAL,
                technician_comment=existing_val.technician_comment if existing_val else None,
            )
        )

    return APIResponse(
        success=True,
        message="Result sheet retrieved.",
        data=ResultSheetResponse(
            report_id=str(report.id),
            report_id_display=report.report_id_display,
            lab_id=str(report.lab_id),
            booking_id=str(report.booking_id),
            patient_id=str(patient.id),
            patient_name=patient.full_name,
            patient_gender=patient.gender.value,
            patient_age_years=patient.age_years,
            test_id=str(report.test.id),
            test_name=report.test.name,
            test_code=report.test.code,
            sample_id=str(report.sample_id) if report.sample_id else None,
            status=report.status,
            values=values_output,
            created_at=report.created_at,
            updated_at=report.updated_at,
        ),
    )


@router.put("/{report_id}/values", response_model=APIResponse[ResultSheetResponse])
async def save_result_values(
    report_id: str,
    payload: ResultEntryPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Save/update analyte values and auto-calculate biological reference flags (LOW, NORMAL, HIGH, CRITICAL)."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.test).selectinload(Test.parameters).selectinload(TestParameter.reference_ranges),
            selectinload(Report.result_values),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if current_user.role.value != "SUPER_ADMIN" and report.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    if report.is_immutable or report.status == ReportStatus.FINAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a finalized medical report.",
        )

    # Fetch Patient for age/gender comparison
    p_res = await db.execute(select(Patient).where(Patient.id == report.patient_id))
    patient = p_res.scalar_one()

    # Parameter map
    params_map = {str(param.id): param for param in report.test.parameters}
    existing_vals_map = {val.parameter_id: val for val in report.result_values}

    for item in payload.values:
        param = params_map.get(str(item.parameter_id))
        if not param:
            continue

        # Evaluate Flag and Reference Range using Calculation Engine
        flag, range_display = evaluate_parameter_result(
            value=item.numeric_value,
            parameter=param,
            patient=patient,
        )

        existing_val = existing_vals_map.get(param.id)
        if existing_val:
            existing_val.numeric_value = item.numeric_value
            existing_val.text_value = item.text_value
            existing_val.flag = flag
            existing_val.reference_range_display = range_display
            existing_val.technician_comment = item.technician_comment
        else:
            new_val = TestResultValue(
                report_id=report.id,
                parameter_id=param.id,
                parameter_name=param.name,
                parameter_code=param.code,
                numeric_value=item.numeric_value,
                text_value=item.text_value,
                unit=param.unit,
                reference_range_display=range_display,
                flag=flag,
                technician_comment=item.technician_comment,
            )
            db.add(new_val)

    if payload.submit_for_review and report.status == ReportStatus.DRAFT:
        report.status = ReportStatus.PENDING_REVIEW

    await db.commit()

    # Query fresh result values and report
    val_res = await db.execute(
        select(TestResultValue)
        .where(TestResultValue.report_id == report_id)
        .order_by(TestResultValue.created_at.asc())
    )
    result_values = val_res.scalars().all()

    return APIResponse(
        success=True,
        message=f"Results saved successfully for {report.test.name}.",
        data=ResultSheetResponse(
            report_id=str(report.id),
            report_id_display=report.report_id_display,
            lab_id=str(report.lab_id),
            booking_id=str(report.booking_id),
            patient_id=str(patient.id),
            patient_name=patient.full_name,
            patient_gender=patient.gender.value,
            patient_age_years=patient.age_years,
            test_id=str(report.test.id),
            test_name=report.test.name,
            test_code=report.test.code,
            sample_id=str(report.sample_id) if report.sample_id else None,
            status=report.status,
            values=[
                ResultValueResponse(
                    id=str(v.id),
                    parameter_id=str(v.parameter_id),
                    parameter_name=v.parameter_name,
                    parameter_code=v.parameter_code,
                    numeric_value=v.numeric_value,
                    text_value=v.text_value,
                    unit=v.unit,
                    reference_range_display=v.reference_range_display,
                    flag=v.flag,
                    technician_comment=v.technician_comment,
                )
                for v in result_values
            ],
            created_at=report.created_at,
            updated_at=report.updated_at,
        ),
    )
