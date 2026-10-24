import os
import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import (
    require_lab_staff,
    RoleChecker,
    verify_tenant_access,
)
from app.core.security import get_current_user
from app.models.user import User
from app.models.laboratory import Laboratory
from app.models.patient import Patient
from app.models.test import Test
from app.models.booking import Booking
from app.models.report import Report, ReportStatus, ReportVersion, ReportAttachment
from app.models.result import TestResultValue
from app.schemas.common import APIResponse, MessageResponse, paginate_meta
from app.schemas.result import ResultValueResponse
from app.schemas.imaging import ImagingAttachmentResponse
from app.schemas.report import (
    ReportListItemResponse,
    ReportDetailResponse,
    ReportVersionResponse,
    ReportAmendPayload,
    PublicVerificationResponse,
)
from app.services.pdf_engine import (
    generate_medical_report_pdf,
    generate_report_hmac,
    mask_patient_name,
)
from app.models.notification import NotificationEventType, NotificationChannel
from app.services.notification_service import NotificationService
from app.services.audit_service import audit_log
from app.services.storage_service import storage_service

router = APIRouter(prefix="/reports", tags=["Medical Reports Workflow & PDF Engine"])

require_report_signer = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN", "PATHOLOGIST", "RADIOLOGIST"])


@router.get("", response_model=APIResponse[List[ReportListItemResponse]])
async def list_reports(
    status_filter: Optional[ReportStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    booking_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1, description="Page number"),
    limit: Optional[int] = Query(20, ge=1, le=500, description="Items per page"),
    all: bool = Query(False, description="Fetch all without pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """List medical diagnostic reports filtered by status, patient, or search query."""
    query = (
        select(Report)
        .options(
            selectinload(Report.booking),
            selectinload(Report.patient),
            selectinload(Report.test),
        )
    )
    count_query = select(func.count(Report.id))

    if current_user.role.value != "SUPER_ADMIN":
        query = query.where(Report.lab_id == current_user.lab_id)
        count_query = count_query.where(Report.lab_id == current_user.lab_id)

    if status_filter:
        query = query.where(Report.status == status_filter)
        count_query = count_query.where(Report.status == status_filter)
    if patient_id:
        query = query.where(Report.patient_id == patient_id)
        count_query = count_query.where(Report.patient_id == patient_id)
    if booking_id:
        query = query.where(Report.booking_id == booking_id)
        count_query = count_query.where(Report.booking_id == booking_id)

    if search:
        term = f"%{search.strip()}%"
        search_cond = or_(
            Report.report_id_display.ilike(term),
            Patient.first_name.ilike(term),
            Patient.last_name.ilike(term),
            Patient.patient_id_display.ilike(term),
            Test.name.ilike(term),
            Test.code.ilike(term),
        )
        query = query.outerjoin(Report.patient).outerjoin(Report.test).where(search_cond)
        count_query = count_query.outerjoin(Report.patient).outerjoin(Report.test).where(search_cond)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(desc(Report.created_at))
    if not all and limit:
        query = query.offset((page - 1) * limit).limit(limit)

    res = await db.execute(query)
    reports = res.scalars().all()

    # Pre-fetch approver users for this page
    approver_ids = [r.approved_by for r in reports if r.approved_by]
    approvers_map = {}
    if approver_ids:
        u_res = await db.execute(select(User).where(User.id.in_(approver_ids)))
        for u in u_res.scalars().all():
            approvers_map[u.id] = u.full_name

    output = []
    for r in reports:
        p_name = r.patient.full_name if r.patient else "Unknown"
        p_id_disp = r.patient.patient_id_display if r.patient else ""
        t_name = r.test.name if r.test else ""
        t_code = r.test.code if r.test else ""

        output.append(
            ReportListItemResponse(
                id=str(r.id),
                report_id_display=r.report_id_display,
                booking_id=str(r.booking_id),
                booking_id_display=r.booking.booking_id_display if r.booking else "",
                patient_id=str(r.patient_id),
                patient_name=p_name,
                patient_id_display=p_id_disp,
                test_id=str(r.test_id),
                test_name=t_name,
                test_code=t_code,
                sample_type=r.test.sample_type.value if r.test else "",
                status=r.status,
                current_version=r.current_version,
                is_immutable=r.is_immutable,
                pdf_file_url=r.pdf_file_url,
                approved_by_name=approvers_map.get(r.approved_by),
                finalized_at=r.finalized_at,
                created_at=r.created_at,
            )
        )

    effective_limit = limit if (not all and limit) else (total or 20)
    meta = paginate_meta(page=page, limit=effective_limit, total=total)

    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} reports.",
        data=output,
        meta=meta,
    )


@router.get("/verify/{token}", response_model=APIResponse[PublicVerificationResponse])
async def verify_report_public(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """PUBLIC verification endpoint to authenticate signed medical reports via QR code."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.patient),
            selectinload(Report.test),
        )
        .where(Report.verification_token == token)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid verification token. No authentic medical report found.",
        )

    # Fetch lab name
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == report.lab_id))
    lab = lab_res.scalar_one_or_none()
    lab_name = lab.name if lab else "TrustMyLab Diagnostics"

    patient_name = report.patient.full_name if report.patient else "Patient"
    patient_masked = mask_patient_name(patient_name)

    # HMAC digest verification
    expected_hmac = generate_report_hmac(
        secret_key=settings.SECRET_KEY,
        lab_id=report.lab_id,
        report_id=str(report.id),
        patient_id=report.patient_id,
        test_id=report.test_id,
        version=report.current_version,
        status=report.status.value,
    )
    is_valid = (report.hmac_digest == expected_hmac)

    truncated_hmac = f"{report.hmac_digest[:12]}...{report.hmac_digest[-8:]}" if report.hmac_digest else "N/A"

    return APIResponse(
        success=True,
        message="Medical report verified successfully against digital signature registry.",
        data=PublicVerificationResponse(
            is_valid=is_valid,
            verification_token=report.verification_token,
            report_id_display=report.report_id_display,
            lab_name=lab_name,
            patient_name_masked=patient_masked,
            patient_gender=report.patient.gender.value if report.patient else "N/A",
            patient_age_years=report.patient.age_years if report.patient else 0,
            test_name=report.test.name if report.test else "Diagnostic Test",
            test_code=report.test.code if report.test else "",
            status=report.status,
            version_number=report.current_version,
            finalized_at=report.finalized_at,
            hmac_digest_truncated=truncated_hmac,
            verified_at=datetime.utcnow(),
        ),
    )


@router.get("/{report_id}", response_model=APIResponse[ReportDetailResponse])
async def get_report_detail(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve complete report detail including results, narrative, attachments, and versions."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.booking),
            selectinload(Report.patient),
            selectinload(Report.test),
            selectinload(Report.result_values),
            selectinload(Report.attachments),
            selectinload(Report.versions),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    verify_tenant_access(current_user, report.lab_id)

    # Fetch lab
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == report.lab_id))
    lab = lab_res.scalar_one_or_none()

    # Approver name
    approver_name = None
    if report.approved_by:
        u_res = await db.execute(select(User).where(User.id == report.approved_by))
        u = u_res.scalar_one_or_none()
        if u:
            approver_name = u.full_name

    vals_out = [
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
        for v in report.result_values
    ]

    atts_out = [
        ImagingAttachmentResponse(
            id=str(a.id),
            report_id=str(a.report_id),
            file_name=a.file_name,
            file_type=a.file_type,
            file_size_bytes=a.file_size_bytes,
            storage_path=a.storage_path,
            caption=a.caption,
            uploaded_by=a.uploaded_by,
            created_at=a.created_at,
        )
        for a in report.attachments
    ]

    vers_out = [
        ReportVersionResponse(
            id=str(ver.id),
            version_number=ver.version_number,
            amendment_reason=ver.amendment_reason,
            amended_by_name=ver.amended_by_name,
            pdf_snapshot_url=ver.pdf_snapshot_url,
            created_at=ver.created_at,
        )
        for ver in report.versions
    ]

    return APIResponse(
        success=True,
        message="Report details retrieved.",
        data=ReportDetailResponse(
            id=str(report.id),
            report_id_display=report.report_id_display,
            lab_id=str(report.lab_id),
            lab_name=lab.name if lab else "Diagnostic Lab",
            booking_id=str(report.booking_id),
            booking_id_display=report.booking.booking_id_display if report.booking else "",
            patient_id=str(report.patient_id),
            patient_name=report.patient.full_name if report.patient else "Patient",
            patient_gender=report.patient.gender.value if report.patient else "",
            patient_age_years=report.patient.age_years if report.patient else 0,
            test_id=str(report.test_id),
            test_name=report.test.name if report.test else "",
            test_code=report.test.code if report.test else "",
            status=report.status,
            current_version=report.current_version,
            is_immutable=report.is_immutable,
            verification_token=report.verification_token,
            pdf_file_url=report.pdf_file_url,
            hmac_digest=report.hmac_digest,
            clinical_history=report.clinical_history,
            imaging_findings=report.imaging_findings,
            imaging_impression=report.imaging_impression,
            recommendations=report.recommendations,
            approved_by_name=approver_name,
            approved_at=report.approved_at,
            finalized_at=report.finalized_at,
            result_values=vals_out,
            attachments=atts_out,
            versions=vers_out,
            created_at=report.created_at,
            updated_at=report.updated_at,
        ),
    )


@router.post("/{report_id}/approve", response_model=APIResponse[ReportDetailResponse])
async def approve_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_report_signer),
):
    """Doctor / Pathologist / Radiologist digital sign-off and approval of medical report."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.booking),
            selectinload(Report.patient),
            selectinload(Report.test),
            selectinload(Report.result_values),
            selectinload(Report.attachments),
            selectinload(Report.versions),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    verify_tenant_access(current_user, report.lab_id)

    if report.status == ReportStatus.FINAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is already finalized and locked.",
        )

    report.status = ReportStatus.APPROVED
    report.approved_by = current_user.id
    report.approved_at = datetime.utcnow()

    await db.commit()
    await db.refresh(report)

    return await get_report_detail(report_id=report_id, db=db, current_user=current_user)


async def render_and_persist_report_pdf(
    report: Report,
    lab: Laboratory,
    db: AsyncSession,
    override_show_header_status: Optional[bool] = None,
    override_show_qr_side_text: Optional[bool] = None,
) -> str:
    lab_settings = lab.settings

    signatory = None
    if report.approved_by:
        u_res = await db.execute(select(User).where(User.id == report.approved_by))
        signatory = u_res.scalar_one_or_none()

    sig_source = None
    if signatory:
        sig_source = signatory.signature_image_url
    if not sig_source and lab_settings:
        sig_source = lab_settings.default_signatory_signature_url

    signatory_title = (
        "Consultant Radiologist"
        if (signatory and getattr(signatory.role, "value", str(signatory.role)) == "RADIOLOGIST")
        else (lab_settings.default_signatory_designation if lab_settings and lab_settings.default_signatory_designation else "Consultant Pathologist")
    )
    signatory_degrees = (signatory.qualifications if signatory else "") or (lab_settings.default_signatory_degrees if lab_settings else "")
    signatory_reg_no = (signatory.medical_license_number if signatory else "") or (lab_settings.default_signatory_reg_no if lab_settings else "")
    approved_by_name = (signatory.full_name if signatory else (lab_settings.default_signatory_name if lab_settings else "Authorized Laboratory Pathologist")) or "Authorized Laboratory Pathologist"

    pdf_filename = f"report_v{report.current_version}.pdf"
    rel_pdf_path = f"reports/{report.id}/{pdf_filename}"
    output_pdf_path = storage_service.get_local_staging_path(rel_pdf_path)
    qr_verification_url = f"{settings.APP_URL}/verify/{report.verification_token}"

    show_header_status = override_show_header_status
    if show_header_status is None and lab_settings:
        show_header_status = lab_settings.show_report_header_status if lab_settings.show_report_header_status is not None else True
    elif show_header_status is None:
        show_header_status = True

    show_qr_side_text = override_show_qr_side_text
    if show_qr_side_text is None and lab_settings:
        show_qr_side_text = lab_settings.show_qr_side_text if lab_settings.show_qr_side_text is not None else True
    elif show_qr_side_text is None:
        show_qr_side_text = True

    enable_qr = lab_settings.enable_qr_verification if (lab_settings and lab_settings.enable_qr_verification is not None) else True

    lab_info = {
        "name": lab.name,
        "address": f"{lab.address_street or ''}, {lab.city or ''} {lab.state or ''}",
        "phone": lab.phone or "N/A",
        "email": lab.email or "N/A",
        "license": lab.registration_number or "Accredited Medical Laboratory",
        "enable_qr_verification": enable_qr,
        "show_report_header_status": show_header_status,
        "show_qr_side_text": show_qr_side_text,
        "primary_color_hex": lab_settings.primary_color_hex if lab_settings else "#0284c7",
    }
    patient_info = {
        "name": report.patient.full_name if report.patient else "Patient",
        "id_display": report.patient.patient_id_display if report.patient else "N/A",
        "age": report.patient.age_years if report.patient else 0,
        "gender": report.patient.gender.value if report.patient else "N/A",
        "booking_id_display": (report.booking.booking_id_display if report.booking else "") or "N/A",
        "referred_by": (report.booking.referring_doctor if (report.booking and report.booking.referring_doctor) else "") or "Self / Dr. Consultation",
    }
    test_info = {
        "name": report.test.name if report.test else "Diagnostic Test",
        "code": report.test.code if report.test else "",
    }
    report_info_dict = {
        "report_id_display": report.report_id_display,
        "status": report.status.value,
        "version": report.current_version,
        "date": report.finalized_at.strftime("%d-%b-%Y %I:%M %p") if report.finalized_at else "N/A",
        "finalized_at": report.finalized_at.strftime("%d-%b-%Y %I:%M %p") if report.finalized_at else "N/A",
        "approved_by_name": approved_by_name,
        "signatory_title": signatory_title,
        "signatory_degrees": signatory_degrees,
        "signatory_reg_no": signatory_reg_no,
        "signature_image": sig_source,
        "show_header_status": show_header_status,
        "show_qr_side_text": show_qr_side_text,
        "enable_qr_verification": enable_qr,
    }
    result_vals_dict = [
        {
            "parameter_name": v.parameter_name,
            "numeric_value": v.numeric_value,
            "text_value": v.text_value,
            "unit": v.unit,
            "reference_range_display": v.reference_range_display,
            "flag": v.flag.value,
        }
        for v in (report.result_values or [])
    ]
    narrative_dict = {
        "clinical_history": report.clinical_history,
        "imaging_findings": report.imaging_findings,
        "imaging_impression": report.imaging_impression,
        "recommendations": report.recommendations,
    }

    # Render PDF through ReportLab Engine
    generate_medical_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        test_info=test_info,
        report_info=report_info_dict,
        result_values=result_vals_dict,
        narrative_info=narrative_dict,
        qr_url=qr_verification_url,
        hmac_digest=report.hmac_digest or "",
        output_path=output_pdf_path,
    )
    await storage_service.persist_file(output_pdf_path, rel_pdf_path, content_type="application/pdf")
    return rel_pdf_path


@router.post("/{report_id}/finalize", response_model=APIResponse[ReportDetailResponse])
async def finalize_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_report_signer),
):
    """Finalize report: Generates tamper-proof HMAC hash, QR verification token, and seals PDF."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.booking),
            selectinload(Report.patient),
            selectinload(Report.test),
            selectinload(Report.result_values),
            selectinload(Report.attachments),
            selectinload(Report.versions),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    verify_tenant_access(current_user, report.lab_id)

    if report.status == ReportStatus.FINAL and report.is_immutable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is already finalized and sealed.",
        )

    # Fetch Laboratory Details and Settings
    lab_res = await db.execute(
        select(Laboratory)
        .options(selectinload(Laboratory.settings))
        .where(Laboratory.id == report.lab_id)
    )
    lab = lab_res.scalar_one()

    # Generate or reuse verification token
    if not report.verification_token:
        report.verification_token = secrets.token_urlsafe(32)

    report.status = ReportStatus.FINAL
    report.is_immutable = True
    report.finalized_at = datetime.utcnow()
    if not report.approved_by:
        report.approved_by = current_user.id
        report.approved_at = datetime.utcnow()

    # Compute HMAC digital signature
    report.hmac_digest = generate_report_hmac(
        secret_key=settings.SECRET_KEY,
        lab_id=report.lab_id,
        report_id=str(report.id),
        patient_id=report.patient_id,
        test_id=report.test_id,
        version=report.current_version,
        status=report.status.value,
    )

    rel_pdf_path = await render_and_persist_report_pdf(report, lab, db)
    report.pdf_file_url = f"/api/reports/{report.id}/download"

    await db.commit()
    await db.refresh(report)

    # Phase 11: Notification Dispatch Event
    if report.patient and (report.patient.email or report.patient.phone):
        recipient = report.patient.email or report.patient.phone
        recipient_name = report.patient.full_name
        verification_link = f"/verify/{report.verification_token}"
        await NotificationService.dispatch_event(
            db=db,
            lab_id=str(report.lab_id),
            event_type=NotificationEventType.REPORT_FINALIZED,
            recipient=recipient,
            recipient_name=recipient_name,
            template_params={
                "patient_name": recipient_name,
                "test_name": report.test.name if report.test else "Diagnostic Test",
                "report_id_display": report.report_id_display,
                "lab_name": lab.name,
                "verification_url": verification_link,
            },
            channel=NotificationChannel.EMAIL if report.patient.email else NotificationChannel.SMS,
        )

    return await get_report_detail(report_id=report_id, db=db, current_user=current_user)


@router.get("/{report_id}/download")
async def download_report_pdf(
    report_id: str,
    show_header_status: Optional[bool] = Query(None),
    show_qr_side_text: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Download the official signed and sealed PDF report."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.booking),
            selectinload(Report.patient),
            selectinload(Report.test),
            selectinload(Report.result_values),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    verify_tenant_access(current_user, report.lab_id)

    pdf_filename = f"report_v{report.current_version}.pdf"
    rel_pdf_path = f"reports/{report.id}/{pdf_filename}"

    if report.status == ReportStatus.FINAL:
        lab_res = await db.execute(
            select(Laboratory)
            .options(selectinload(Laboratory.settings))
            .where(Laboratory.id == report.lab_id)
        )
        lab = lab_res.scalar_one_or_none()
        if lab:
            rel_pdf_path = await render_and_persist_report_pdf(
                report=report,
                lab=lab,
                db=db,
                override_show_header_status=show_header_status,
                override_show_qr_side_text=show_qr_side_text,
            )

    if not await storage_service.file_exists(rel_pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF document has not been generated for this report yet. Please finalize the report.",
        )

    return await storage_service.get_file_response(
        rel_path=rel_pdf_path,
        filename=f"{report.report_id_display}_v{report.current_version}.pdf",
        media_type="application/pdf",
    )


@router.post("/{report_id}/amend", response_model=APIResponse[ReportDetailResponse])
async def amend_report(
    report_id: str,
    payload: ReportAmendPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_report_signer),
):
    """Create a versioned amendment (e.g. v2.0) preserving the prior immutable report snapshot."""
    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.booking),
            selectinload(Report.patient),
            selectinload(Report.test),
            selectinload(Report.result_values),
            selectinload(Report.attachments),
            selectinload(Report.versions),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    verify_tenant_access(current_user, report.lab_id)

    if report.status != ReportStatus.FINAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only finalized reports require formal versioned amendments.",
        )

    # 1. Create a Snapshot of Version 1
    snapshot_payload = {
        "version_number": report.current_version,
        "finalized_at": report.finalized_at.isoformat() if report.finalized_at else None,
        "hmac_digest": report.hmac_digest,
        "approved_by": report.approved_by,
        "clinical_history": report.clinical_history,
        "imaging_findings": report.imaging_findings,
        "imaging_impression": report.imaging_impression,
        "recommendations": report.recommendations,
        "result_values": [
            {
                "parameter_id": str(v.parameter_id),
                "parameter_name": v.parameter_name,
                "numeric_value": float(v.numeric_value) if v.numeric_value is not None else None,
                "text_value": v.text_value,
                "flag": v.flag.value,
                "reference_range_display": v.reference_range_display,
            }
            for v in report.result_values
        ],
    }

    prior_pdf_path = f"/api/reports/{report.id}/download"

    version_record = ReportVersion(
        report_id=report.id,
        version_number=report.current_version,
        snapshot_payload_json=snapshot_payload,
        amendment_reason=payload.amendment_reason,
        amended_by=current_user.id,
        amended_by_name=current_user.full_name,
        pdf_snapshot_url=prior_pdf_path,
    )
    db.add(version_record)

    # 2. Increment Version & unlock for amendment
    report.current_version += 1
    report.status = ReportStatus.DRAFT
    report.is_immutable = False
    report.finalized_at = None
    report.hmac_digest = None
    report.pdf_file_url = None

    await db.commit()
    await db.refresh(report)

    return await get_report_detail(report_id=report_id, db=db, current_user=current_user)
