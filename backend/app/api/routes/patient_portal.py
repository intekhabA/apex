import os
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import require_patient
from app.models.user import User
from app.models.laboratory import Laboratory
from app.models.patient import Patient
from app.models.booking import Booking, BookingItem
from app.models.report import Report, ReportStatus, ReportVersion, ReportAttachment
from app.models.result import TestResultValue
from app.models.invoice import Invoice, Payment
from app.schemas.common import APIResponse
from app.schemas.booking import BookingResponse, BookingItemResponse
from app.schemas.report import (
    ReportListItemResponse,
    ReportDetailResponse,
    ReportVersionResponse,
)
from app.schemas.result import ResultValueResponse
from app.schemas.imaging import ImagingAttachmentResponse
from app.schemas.invoice import InvoiceResponse, PaymentResponse
from app.schemas.patient_portal import PatientProfileResponse, PatientDashboardResponse
from app.services.pdf_engine import generate_payment_receipt_pdf, generate_consolidated_booking_report_pdf


router = APIRouter(prefix="/patient-portal", tags=["Patient Self-Service Portal"])


async def get_patient_ids_and_records(db: AsyncSession, current_user: User) -> List[Patient]:
    """Retrieve all Patient entities matching the current authenticated patient."""
    conditions = [Patient.user_id == current_user.id]
    if current_user.email:
        conditions.append(Patient.email == current_user.email)
    if current_user.phone:
        conditions.append(Patient.phone == current_user.phone)

    from sqlalchemy import or_
    res = await db.execute(
        select(Patient).where(or_(*conditions)).order_by(Patient.created_at.desc())
    )
    patients = res.scalars().all()

    # Link user_id if matched by email or phone
    linked = False
    for p in patients:
        if not p.user_id:
            p.user_id = current_user.id
            linked = True
    if linked:
        await db.commit()

    return list(patients)


@router.get("/profile", response_model=APIResponse[Optional[PatientProfileResponse]])
async def get_patient_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Retrieve authenticated patient's profile details."""
    patients = await get_patient_ids_and_records(db, current_user)
    if not patients:
        return APIResponse(
            success=True,
            message="No patient profile found. Please contact the diagnostic laboratory.",
            data=None,
        )

    primary = patients[0]
    lab_name = None
    if primary.lab_id:
        lab_res = await db.execute(select(Laboratory).where(Laboratory.id == primary.lab_id))
        lab = lab_res.scalar_one_or_none()
        if lab:
            lab_name = lab.name

    profile = PatientProfileResponse(
        id=str(primary.id),
        patient_id_display=primary.patient_id_display,
        first_name=primary.first_name,
        last_name=primary.last_name,
        full_name=primary.full_name,
        gender=primary.gender.value,
        age_years=primary.age_years,
        age_months=primary.age_months or 0,
        phone=primary.phone,
        email=primary.email,
        blood_group=primary.blood_group,
        address=primary.address_street,
        emergency_contact_name=primary.emergency_contact_name,
        emergency_contact_phone=primary.emergency_contact_phone,
        laboratory_name=lab_name,
    )

    return APIResponse(success=True, message="Patient profile retrieved.", data=profile)


@router.get("/dashboard", response_model=APIResponse[PatientDashboardResponse])
async def get_patient_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Retrieve personalized dashboard summary for the patient."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    if not p_ids:
        return APIResponse(
            success=True,
            message="No patient records found.",
            data=PatientDashboardResponse(
                profile=None,
                total_bookings=0,
                completed_reports=0,
                total_invoiced=Decimal("0.00"),
                total_paid=Decimal("0.00"),
                outstanding_balance=Decimal("0.00"),
                recent_bookings=[],
                recent_reports=[],
                recent_invoices=[],
            ),
        )

    # Fetch Bookings
    bk_res = await db.execute(
        select(Booking)
        .options(selectinload(Booking.patient), selectinload(Booking.items))
        .where(Booking.patient_id.in_(p_ids))
        .order_by(desc(Booking.created_at))
    )
    all_bookings = bk_res.scalars().all()

    # Fetch Finalized Reports
    rep_res = await db.execute(
        select(Report)
        .options(selectinload(Report.patient), selectinload(Report.test), selectinload(Report.booking))
        .where(Report.patient_id.in_(p_ids), Report.status == ReportStatus.FINAL)
        .order_by(desc(Report.finalized_at))
    )
    all_reports = rep_res.scalars().all()

    # Fetch Invoices
    inv_res = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.booking),
            selectinload(Invoice.patient),
            selectinload(Invoice.payments).selectinload(Payment.received_by_user),
        )
        .where(Invoice.patient_id.in_(p_ids))
        .order_by(desc(Invoice.created_at))
    )
    all_invoices = inv_res.scalars().all()

    # Financial sums
    total_invoiced = sum((inv.grand_total for inv in all_invoices), Decimal("0.00"))
    total_paid = sum((inv.paid_amount for inv in all_invoices), Decimal("0.00"))
    outstanding_balance = sum((inv.balance_amount for inv in all_invoices), Decimal("0.00"))

    # Recent bookings list
    recent_bookings = []
    for bk in all_bookings[:5]:
        items_dto = [
            BookingItemResponse(
                id=str(it.id),
                item_type=it.item_type,
                test_id=str(it.test_id) if it.test_id else None,
                package_id=str(it.package_id) if it.package_id else None,
                item_name=it.item_name,
                unit_price=it.unit_price,
                discount_amount=it.discount_amount,
                final_price=it.final_price,
            )
            for it in bk.items
        ]
        recent_bookings.append(
            BookingResponse(
                id=str(bk.id),
                lab_id=str(bk.lab_id),
                patient_id=str(bk.patient_id),
                booking_id_display=bk.booking_id_display,
                booking_date=bk.booking_date,
                appointment_date=bk.appointment_date,
                appointment_time=bk.appointment_time,
                referring_doctor=bk.referring_doctor,
                status=bk.status,
                payment_status=bk.payment_status,
                subtotal_amount=bk.subtotal_amount,
                discount_amount=bk.discount_amount,
                tax_amount=bk.tax_amount,
                grand_total=bk.grand_total,
                paid_amount=bk.paid_amount,
                balance_amount=bk.balance_amount,
                clinical_notes=bk.clinical_notes,
                created_at=bk.created_at,
                updated_at=bk.updated_at,
                items=items_dto,
            )
        )

    # Recent reports list
    recent_reports = [
        ReportListItemResponse(
            id=str(r.id),
            report_id_display=r.report_id_display,
            booking_id=str(r.booking_id),
            booking_id_display=r.booking.booking_id_display if r.booking else "",
            patient_id=str(r.patient_id),
            patient_name=r.patient.full_name if r.patient else "Patient",
            patient_id_display=r.patient.patient_id_display if r.patient else "",
            test_id=str(r.test_id),
            test_name=r.test.name if r.test else "Diagnostic Test",
            test_code=r.test.code if r.test else "",
            sample_type=r.test.sample_type.value if r.test and r.test.sample_type else "SERUM",
            status=r.status,
            current_version=r.current_version,
            is_immutable=r.is_immutable,
            pdf_file_url=f"/api/patient-portal/reports/{r.id}/download",
            approved_by_name=None,
            finalized_at=r.finalized_at,
            created_at=r.created_at,
        )
        for r in all_reports[:5]
    ]

    # Recent invoices
    recent_invoices = []
    for inv in all_invoices[:5]:
        pmts = [
            PaymentResponse(
                id=str(p.id),
                invoice_id=str(p.invoice_id),
                lab_id=str(p.lab_id),
                payment_method=p.payment_method,
                amount=p.amount,
                transaction_reference=p.transaction_reference,
                receipt_id_display=p.receipt_id_display,
                received_by_name=p.received_by_user.full_name if p.received_by_user else None,
                notes=p.notes,
                created_at=p.created_at,
            )
            for p in inv.payments
        ]
        recent_invoices.append(
            InvoiceResponse(
                id=str(inv.id),
                lab_id=str(inv.lab_id),
                booking_id=str(inv.booking_id),
                booking_id_display=inv.booking.booking_id_display if inv.booking else "",
                patient_id=str(inv.patient_id),
                patient_name=inv.patient.full_name if inv.patient else "Patient",
                patient_id_display=inv.patient.patient_id_display if inv.patient else "",
                invoice_id_display=inv.invoice_id_display,
                invoice_date=inv.invoice_date,
                subtotal=inv.subtotal,
                discount_amount=inv.discount_amount,
                tax_amount=inv.tax_amount,
                grand_total=inv.grand_total,
                paid_amount=inv.paid_amount,
                balance_amount=inv.balance_amount,
                payment_status=inv.payment_status,
                pdf_url=inv.pdf_url,
                notes=inv.notes,
                payments=pmts,
                created_at=inv.created_at,
                updated_at=inv.updated_at,
            )
        )

    # Profile info
    primary = patients[0]
    profile = PatientProfileResponse(
        id=str(primary.id),
        patient_id_display=primary.patient_id_display,
        first_name=primary.first_name,
        last_name=primary.last_name,
        full_name=primary.full_name,
        gender=primary.gender.value,
        age_years=primary.age_years,
        age_months=primary.age_months or 0,
        phone=primary.phone,
        email=primary.email,
        blood_group=primary.blood_group,
        address=primary.address_street,
        emergency_contact_name=primary.emergency_contact_name,
        emergency_contact_phone=primary.emergency_contact_phone,
        laboratory_name=None,
    )

    data = PatientDashboardResponse(
        profile=profile,
        total_bookings=len(all_bookings),
        completed_reports=len(all_reports),
        total_invoiced=total_invoiced,
        total_paid=total_paid,
        outstanding_balance=outstanding_balance,
        recent_bookings=recent_bookings,
        recent_reports=recent_reports,
        recent_invoices=recent_invoices,
    )

    return APIResponse(success=True, message="Patient dashboard retrieved.", data=data)


@router.get("/bookings", response_model=APIResponse[List[BookingResponse]])
async def list_patient_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Retrieve all bookings/appointments for the authenticated patient."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    if not p_ids:
        return APIResponse(success=True, message="No bookings found.", data=[])

    res = await db.execute(
        select(Booking)
        .options(selectinload(Booking.patient), selectinload(Booking.items))
        .where(Booking.patient_id.in_(p_ids))
        .order_by(desc(Booking.created_at))
    )
    bookings = res.scalars().all()

    output = []
    for bk in bookings:
        items_dto = [
            BookingItemResponse(
                id=str(it.id),
                item_type=it.item_type,
                test_id=str(it.test_id) if it.test_id else None,
                package_id=str(it.package_id) if it.package_id else None,
                item_name=it.item_name,
                unit_price=it.unit_price,
                discount_amount=it.discount_amount,
                final_price=it.final_price,
            )
            for it in bk.items
        ]
        output.append(
            BookingResponse(
                id=str(bk.id),
                lab_id=str(bk.lab_id),
                patient_id=str(bk.patient_id),
                booking_id_display=bk.booking_id_display,
                booking_date=bk.booking_date,
                appointment_date=bk.appointment_date,
                appointment_time=bk.appointment_time,
                referring_doctor=bk.referring_doctor,
                status=bk.status,
                payment_status=bk.payment_status,
                subtotal_amount=bk.subtotal_amount,
                discount_amount=bk.discount_amount,
                tax_amount=bk.tax_amount,
                grand_total=bk.grand_total,
                paid_amount=bk.paid_amount,
                balance_amount=bk.balance_amount,
                clinical_notes=bk.clinical_notes,
                created_at=bk.created_at,
                updated_at=bk.updated_at,
                items=items_dto,
            )
        )

    return APIResponse(success=True, message=f"Retrieved {len(output)} bookings.", data=output)


@router.get("/reports", response_model=APIResponse[List[ReportListItemResponse]])
async def list_patient_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Retrieve all finalized medical reports for the authenticated patient."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    if not p_ids:
        return APIResponse(success=True, message="No reports found.", data=[])

    res = await db.execute(
        select(Report)
        .options(selectinload(Report.patient), selectinload(Report.test), selectinload(Report.booking))
        .where(Report.patient_id.in_(p_ids), Report.status == ReportStatus.FINAL)
        .order_by(desc(Report.finalized_at))
    )
    reports = res.scalars().all()

    output = [
        ReportListItemResponse(
            id=str(r.id),
            report_id_display=r.report_id_display,
            booking_id=str(r.booking_id),
            booking_id_display=r.booking.booking_id_display if r.booking else "",
            patient_id=str(r.patient_id),
            patient_name=r.patient.full_name if r.patient else "Patient",
            patient_id_display=r.patient.patient_id_display if r.patient else "",
            test_id=str(r.test_id),
            test_name=r.test.name if r.test else "Diagnostic Test",
            test_code=r.test.code if r.test else "",
            sample_type=r.test.sample_type.value if r.test and r.test.sample_type else "SERUM",
            status=r.status,
            current_version=r.current_version,
            is_immutable=r.is_immutable,
            pdf_file_url=f"/api/patient-portal/reports/{r.id}/download",
            approved_by_name=None,
            finalized_at=r.finalized_at,
            created_at=r.created_at,
        )
        for r in reports
    ]

    return APIResponse(success=True, message=f"Retrieved {len(output)} finalized reports.", data=output)


@router.get("/reports/{report_id}", response_model=APIResponse[ReportDetailResponse])
async def get_patient_report_detail(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Retrieve detailed finalized medical report with clinical values and digital verification."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.patient),
            selectinload(Report.test),
            selectinload(Report.booking),
            selectinload(Report.result_values),
            selectinload(Report.versions),
            selectinload(Report.attachments),
        )
        .where(Report.id == report_id)
    )
    report = res.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical report not found.")

    # Strict Patient Isolation Gate Check: If report doesn't belong to current patient, 403 Forbidden!
    if str(report.patient_id) not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only access your own medical reports.",
        )

    # Patients can only access reports once marked FINAL
    if report.status != ReportStatus.FINAL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This medical report is currently undergoing clinical review and is not yet released.",
        )

    # Fetch lab name
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == report.lab_id))
    lab = lab_res.scalar_one_or_none()
    lab_name = lab.name if lab else "DiagnoLab Diagnostics"

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

    data = ReportDetailResponse(
        id=str(report.id),
        report_id_display=report.report_id_display,
        lab_id=str(report.lab_id),
        lab_name=lab_name,
        booking_id=str(report.booking_id),
        booking_id_display=report.booking.booking_id_display if report.booking else "",
        patient_id=str(report.patient_id),
        patient_name=report.patient.full_name if report.patient else "Patient",
        patient_gender=report.patient.gender.value if report.patient else "N/A",
        patient_age_years=report.patient.age_years if report.patient else 0,
        test_id=str(report.test_id),
        test_name=report.test.name if report.test else "Diagnostic Test",
        test_code=report.test.code if report.test else "",
        status=report.status,
        current_version=report.current_version,
        is_immutable=report.is_immutable,
        verification_token=report.verification_token,
        pdf_file_url=f"/api/patient-portal/reports/{report.id}/download",
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
    )

    return APIResponse(success=True, message="Medical report details retrieved.", data=data)


@router.get("/reports/{report_id}/download")
async def download_patient_report_pdf(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Download official signed PDF report for authenticated patient with strict ownership verification."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    res = await db.execute(select(Report).where(Report.id == report_id))
    report = res.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    # Strict Ownership Check: Must belong to authenticated patient!
    if str(report.patient_id) not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only download your own medical reports.",
        )

    pdf_filename = f"report_v{report.current_version}.pdf"
    pdf_path = os.path.join(settings.STORAGE_LOCAL_ROOT, "reports", str(report.id), pdf_filename)

    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF document has not been generated for this report yet.",
        )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{report.report_id_display}_v{report.current_version}.pdf",
    )


@router.get("/bookings/{booking_id}/reports/pdf")
async def download_patient_booking_reports_pdf(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Download consolidated PDF report containing all test panels for a booking for authenticated patient."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    b_res = await db.execute(
        select(Booking)
        .options(selectinload(Booking.patient))
        .where(Booking.id == booking_id)
    )
    booking = b_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    if str(booking.patient_id) not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only download reports for your own bookings.",
        )

    # Fetch Laboratory
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == booking.lab_id))
    lab = lab_res.scalar_one_or_none()

    # Fetch Reports
    rep_res = await db.execute(
        select(Report)
        .options(
            selectinload(Report.test),
            selectinload(Report.sample),
            selectinload(Report.result_values),
        )
        .where(Report.booking_id == booking.id)
        .order_by(Report.created_at)
    )
    reports = rep_res.scalars().all()
    if not reports:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No diagnostic reports found for this booking order.",
        )

    lab_info = {
        "name": lab.name if lab else "DiagnoLab Diagnostic Services",
        "address": f"{lab.address_street or ''}, {lab.city or ''} {lab.state or ''}" if lab else "Medical Center Way",
        "phone": lab.phone if lab else "N/A",
        "email": lab.email if lab else "N/A",
        "license": lab.registration_number if lab else "ISO 15189 / NABL Certified",
    }
    patient = booking.patient
    patient_info = {
        "name": patient.full_name if patient else "Patient",
        "id_display": patient.patient_id_display if patient else "N/A",
        "age": patient.age_years if patient else 0,
        "gender": patient.gender.value if patient else "N/A",
        "phone": patient.phone if patient else "N/A",
        "email": patient.email if patient else "N/A",
        "referred_by": booking.referring_doctor or (patient.referring_doctor if patient else "Self / Dr. Consultation"),
    }
    booking_info = {
        "booking_id_display": booking.booking_id_display,
        "appointment_date": str(booking.appointment_date or booking.booking_date),
        "appointment_time": booking.appointment_time or "",
        "status": booking.status.value,
        "clinical_notes": booking.clinical_notes or "",
    }

    reports_data = []
    primary_token = None
    for r in reports:
        if r.verification_token and not primary_token:
            primary_token = r.verification_token

        approver_name = "Authorized Signatory"
        if r.approved_by:
            u_res = await db.execute(select(User).where(User.id == r.approved_by))
            approver = u_res.scalar_one_or_none()
            if approver:
                approver_name = approver.full_name

        vals = [
            {
                "parameter_name": v.parameter_name,
                "numeric_value": v.numeric_value,
                "text_value": v.text_value,
                "unit": v.unit,
                "reference_range_display": v.reference_range_display,
                "flag": v.flag.value if v.flag else "NORMAL",
            }
            for v in r.result_values
        ]
        reports_data.append({
            "report_id_display": r.report_id_display,
            "status": r.status.value,
            "version": r.current_version,
            "finalized_at": r.finalized_at.strftime("%d-%b-%Y %I:%M %p") if r.finalized_at else "Pending review",
            "approved_by_name": approver_name,
            "test_name": r.test.name if r.test else "Diagnostic Investigation",
            "test_code": r.test.code if r.test else "",
            "test_type": r.test.test_type.value if r.test else "PATHOLOGY",
            "sample_id_display": r.sample.sample_id_display if r.sample else "N/A",
            "sample_type": r.sample.sample_type if r.sample else "N/A",
            "sample_container": r.sample.sample_container if r.sample else "Standard Tube",
            "result_values": vals,
            "narrative_info": {
                "clinical_history": r.clinical_history,
                "imaging_findings": r.imaging_findings,
                "imaging_impression": r.imaging_impression,
                "recommendations": r.recommendations,
            },
        })

    pdf_dir = os.path.join(settings.STORAGE_LOCAL_ROOT, "bookings", str(booking.id))
    pdf_path = os.path.join(pdf_dir, "consolidated_report.pdf")
    qr_url = f"{settings.APP_URL}/verify/{primary_token}" if primary_token else f"{settings.APP_URL}/bookings"

    generate_consolidated_booking_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        booking_info=booking_info,
        reports_data=reports_data,
        qr_url=qr_url,
        output_path=pdf_path,
    )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"Booking_{booking.booking_id_display}_All_Reports.pdf",
    )


@router.get("/invoices", response_model=APIResponse[List[InvoiceResponse]])
async def list_patient_invoices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Retrieve all invoices and payment history for authenticated patient."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    if not p_ids:
        return APIResponse(success=True, message="No invoices found.", data=[])

    res = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.booking),
            selectinload(Invoice.patient),
            selectinload(Invoice.payments).selectinload(Payment.received_by_user),
        )
        .where(Invoice.patient_id.in_(p_ids))
        .order_by(desc(Invoice.created_at))
    )
    invoices = res.scalars().all()

    output = []
    for inv in invoices:
        pmts = [
            PaymentResponse(
                id=str(p.id),
                invoice_id=str(p.invoice_id),
                lab_id=str(p.lab_id),
                payment_method=p.payment_method,
                amount=p.amount,
                transaction_reference=p.transaction_reference,
                receipt_id_display=p.receipt_id_display,
                received_by_name=p.received_by_user.full_name if p.received_by_user else None,
                notes=p.notes,
                created_at=p.created_at,
            )
            for p in inv.payments
        ]
        output.append(
            InvoiceResponse(
                id=str(inv.id),
                lab_id=str(inv.lab_id),
                booking_id=str(inv.booking_id),
                booking_id_display=inv.booking.booking_id_display if inv.booking else "",
                patient_id=str(inv.patient_id),
                patient_name=inv.patient.full_name if inv.patient else "Patient",
                patient_id_display=inv.patient.patient_id_display if inv.patient else "",
                invoice_id_display=inv.invoice_id_display,
                invoice_date=inv.invoice_date,
                subtotal=inv.subtotal,
                discount_amount=inv.discount_amount,
                tax_amount=inv.tax_amount,
                grand_total=inv.grand_total,
                paid_amount=inv.paid_amount,
                balance_amount=inv.balance_amount,
                payment_status=inv.payment_status,
                pdf_url=inv.pdf_url,
                notes=inv.notes,
                payments=pmts,
                created_at=inv.created_at,
                updated_at=inv.updated_at,
            )
        )

    return APIResponse(success=True, message=f"Retrieved {len(output)} invoices.", data=output)


@router.get("/invoices/{invoice_id}/receipt")
async def download_patient_invoice_receipt(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
):
    """Download PDF payment receipt for authenticated patient."""
    patients = await get_patient_ids_and_records(db, current_user)
    p_ids = [str(p.id) for p in patients]

    res = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.booking),
            selectinload(Invoice.patient),
            selectinload(Invoice.laboratory),
            selectinload(Invoice.payments).selectinload(Payment.received_by_user),
        )
        .where(Invoice.id == invoice_id)
    )
    inv = res.scalar_one_or_none()

    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    # Strict Ownership Check: Must belong to authenticated patient!
    if str(inv.patient_id) not in p_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only download receipts for your own invoices.",
        )

    if not inv.payments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payments recorded on this invoice to generate a receipt.",
        )

    target_payment = inv.payments[-1]

    receipt_filename = f"{target_payment.receipt_id_display}.pdf"
    receipt_dir = os.path.join(settings.STORAGE_LOCAL_ROOT, "receipts", str(inv.id))
    os.makedirs(receipt_dir, exist_ok=True)
    output_pdf_path = os.path.join(receipt_dir, receipt_filename)

    lab = inv.laboratory
    lab_info = {
        "name": lab.name if lab else "DiagnoLab Diagnostics",
        "address": f"{lab.address_street or ''}, {lab.city or ''} {lab.state or ''}" if lab else "Medical Diagnostic Center",
        "phone": (lab.phone or "N/A") if lab else "N/A",
        "license": (lab.registration_number or "Accredited Laboratory") if lab else "Accredited Laboratory",
    }
    patient_info = {
        "name": inv.patient.full_name if inv.patient else "Patient",
        "id_display": inv.patient.patient_id_display if inv.patient else "N/A",
        "booking_id_display": inv.booking.booking_id_display if inv.booking else "N/A",
    }
    payment_info = {
        "receipt_id_display": target_payment.receipt_id_display,
        "amount": target_payment.amount,
        "payment_method": target_payment.payment_method.value if hasattr(target_payment.payment_method, "value") else str(target_payment.payment_method),
        "transaction_reference": target_payment.transaction_reference,
        "received_by_name": target_payment.received_by_user.full_name if target_payment.received_by_user else "Cashier",
        "date": target_payment.created_at.strftime("%d-%b-%Y %I:%M %p") if target_payment.created_at else "N/A",
    }
    invoice_summary = {
        "invoice_id_display": inv.invoice_id_display,
        "grand_total": inv.grand_total,
        "paid_amount": inv.paid_amount,
        "balance_amount": inv.balance_amount,
        "payment_status": inv.payment_status,
    }

    generate_payment_receipt_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        payment_info=payment_info,
        invoice_summary=invoice_summary,
        output_path=output_pdf_path,
    )

    return FileResponse(
        path=output_pdf_path,
        media_type="application/pdf",
        filename=f"Receipt_{inv.invoice_id_display}.pdf",
    )
