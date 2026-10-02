import os
import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import require_lab_staff, require_lab_admin, verify_tenant_access
from app.core.security import get_current_user
from app.models.user import User
from app.models.laboratory import Laboratory
from app.models.patient import Patient
from app.models.test import Test, LabTestPrice, TestPackage
from app.models.booking import Booking, BookingItem, BookingStatus, PaymentStatus
from app.models.sample import Sample, SampleTrackingEvent, SampleStatus
from app.models.report import Report, ReportStatus
from app.models.invoice import Invoice, Payment, PaymentMethod
from app.models.notification import NotificationEventType, NotificationChannel
from app.services.pdf_engine import generate_consolidated_booking_report_pdf
from app.services.storage_service import storage_service
from app.schemas.common import APIResponse, MessageResponse
from app.schemas.booking import (
    BookingCreate,
    BookingResponse,
    BookingStatusUpdate,
    BookingItemResponse,
)
from app.services.sequence_service import (
    generate_booking_id,
    generate_sample_id,
    generate_report_id,
    generate_invoice_id,
    generate_receipt_id,
)
from app.services.audit_service import audit_log
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/bookings", tags=["Bookings & Orders"])


def map_booking_to_response(b: Booking) -> BookingResponse:
    p = b.patient
    return BookingResponse(
        id=str(b.id),
        lab_id=str(b.lab_id),
        patient_id=str(b.patient_id),
        patient_name=p.full_name if p else None,
        patient_id_display=p.patient_id_display if p else None,
        patient_phone=p.phone if p else None,
        patient_gender=p.gender.value if p and p.gender else None,
        patient_age_years=p.age_years if p else None,
        booking_id_display=b.booking_id_display,
        booking_date=b.booking_date,
        appointment_date=b.appointment_date,
        appointment_time=b.appointment_time,
        referring_doctor=b.referring_doctor,
        status=b.status,
        payment_status=b.payment_status,
        subtotal_amount=b.subtotal_amount,
        discount_amount=b.discount_amount,
        tax_amount=b.tax_amount,
        grand_total=b.grand_total,
        paid_amount=b.paid_amount,
        balance_amount=b.balance_amount,
        clinical_notes=b.clinical_notes,
        items=[
            BookingItemResponse(
                id=str(item.id),
                item_type=item.item_type,
                test_id=str(item.test_id) if item.test_id else None,
                package_id=str(item.package_id) if item.package_id else None,
                item_name=item.item_name,
                unit_price=item.unit_price,
                discount_amount=item.discount_amount,
                final_price=item.final_price,
            )
            for item in b.items
        ],
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


@router.get("", response_model=APIResponse[List[BookingResponse]])
async def list_bookings(
    status_filter: Optional[BookingStatus] = Query(None, alias="status"),
    patient_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by booking ID, patient name/ID, phone, or referring doctor"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """List diagnostic bookings with status, patient, and search filters."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    query = (
        select(Booking)
        .options(
            selectinload(Booking.items),
            selectinload(Booking.patient),
        )
    )
    if current_user.lab_id:
        query = query.where(Booking.lab_id == current_user.lab_id)

    if status_filter:
        query = query.where(Booking.status == status_filter)

    if patient_id:
        query = query.where(Booking.patient_id == patient_id)

    if search:
        term = f"%{search}%"
        query = query.outerjoin(Booking.patient).where(
            or_(
                Booking.booking_id_display.ilike(term),
                Booking.referring_doctor.ilike(term),
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.patient_id_display.ilike(term),
                Patient.phone.ilike(term),
            )
        )

    query = query.order_by(desc(Booking.created_at))
    res = await db.execute(query)
    bookings = res.scalars().all()

    return APIResponse(
        success=True,
        message=f"Retrieved {len(bookings)} bookings.",
        data=[map_booking_to_response(b) for b in bookings],
    )



@router.post("", response_model=APIResponse[BookingResponse], status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Create test order booking, compute taxes/discounts, and auto-accession specimen records."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    # 1. Verify Patient
    p_res = await db.execute(select(Patient).where(Patient.id == payload.patient_id))
    patient = p_res.scalar_one_or_none()
    if not patient or patient.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found in this laboratory.")

    # 2. Process Items and calculate prices
    booking_items_to_create = []
    subtotal = Decimal("0.00")
    sample_types_needed = set()
    ordered_tests = []

    for item_in in payload.items:
        if item_in.item_type == "TEST":
            t_res = await db.execute(select(Test).where(Test.id == item_in.test_id))
            test = t_res.scalar_one_or_none()
            if not test:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test {item_in.test_id} not found.")

            ordered_tests.append(test)
            # Resolve lab custom price
            lp_res = await db.execute(
                select(LabTestPrice).where(
                    LabTestPrice.lab_id == current_user.lab_id,
                    LabTestPrice.test_id == test.id,
                )
            )
            lp = lp_res.scalar_one_or_none()
            price = Decimal(str(lp.custom_price)) if lp else Decimal(str(test.default_price))

            booking_items_to_create.append({
                "item_type": "TEST",
                "test_id": test.id,
                "package_id": None,
                "item_name": test.name,
                "unit_price": price,
                "discount_amount": Decimal("0.00"),
                "final_price": price,
            })
            subtotal += price
            if test.sample_type.value != "IMAGING":
                sample_types_needed.add((test.sample_type.value, test.sample_container))

        elif item_in.item_type == "PACKAGE":
            pkg_res = await db.execute(
                select(TestPackage)
                .options(selectinload(TestPackage.items))
                .where(TestPackage.id == item_in.package_id)
            )
            pkg = pkg_res.scalar_one_or_none()
            if not pkg:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Package {item_in.package_id} not found.")

            price = Decimal(str(pkg.price))
            booking_items_to_create.append({
                "item_type": "PACKAGE",
                "test_id": None,
                "package_id": pkg.id,
                "item_name": pkg.name,
                "unit_price": price,
                "discount_amount": Decimal("0.00"),
                "final_price": price,
            })
            subtotal += price

            # Collect sample types for included tests
            included_ids = [it.test_id for it in pkg.items]
            if included_ids:
                tests_res = await db.execute(select(Test).where(Test.id.in_(included_ids)))
                for t in tests_res.scalars().all():
                    ordered_tests.append(t)
                    if t.sample_type.value != "IMAGING":
                        sample_types_needed.add((t.sample_type.value, t.sample_container))

    # 3. Calculate Financials
    discount = Decimal(str(payload.discount_amount))
    taxable = max(Decimal("0.00"), subtotal - discount)
    tax_rate = Decimal(str(payload.tax_percentage)) / Decimal("100.00")
    tax_amount = (taxable * tax_rate).quantize(Decimal("0.01"))
    grand_total = (taxable + tax_amount).quantize(Decimal("0.01"))
    paid_amount = Decimal(str(payload.paid_amount)).quantize(Decimal("0.01"))
    balance_amount = max(Decimal("0.00"), grand_total - paid_amount)

    if paid_amount >= grand_total:
        payment_status = PaymentStatus.PAID
    elif paid_amount > 0:
        payment_status = PaymentStatus.PARTIAL
    else:
        payment_status = PaymentStatus.PENDING

    # 4. Generate Sequential Booking ID
    booking_id_display = await generate_booking_id(db, current_user.lab_id)

    booking = Booking(
        lab_id=current_user.lab_id,
        patient_id=patient.id,
        booking_id_display=booking_id_display,
        booking_date=datetime.date.today(),
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        referring_doctor=payload.referring_doctor or patient.referring_doctor,
        status=payload.status or BookingStatus.CONFIRMED,
        payment_status=payment_status,
        subtotal_amount=subtotal,
        discount_amount=discount,
        tax_amount=tax_amount,
        grand_total=grand_total,
        paid_amount=paid_amount,
        balance_amount=balance_amount,
        clinical_notes=payload.clinical_notes,
        created_by=current_user.id,
    )
    db.add(booking)
    await db.flush()

    for item_dict in booking_items_to_create:
        item = BookingItem(
            booking_id=booking.id,
            test_id=item_dict["test_id"],
            package_id=item_dict["package_id"],
            item_type=item_dict["item_type"],
            item_name=item_dict["item_name"],
            unit_price=item_dict["unit_price"],
            discount_amount=item_dict["discount_amount"],
            final_price=item_dict["final_price"],
        )
        db.add(item)

    # 5. Auto-Accession Samples for each required specimen
    created_samples_by_type = {}
    for s_type, s_container in sample_types_needed:
        sample_id_display = await generate_sample_id(db, current_user.lab_id)
        sample = Sample(
            lab_id=current_user.lab_id,
            booking_id=booking.id,
            patient_id=patient.id,
            sample_id_display=sample_id_display,
            sample_type=s_type,
            sample_container=s_container,
            status=SampleStatus.REGISTERED,
            barcode_value=sample_id_display,
        )
        db.add(sample)
        await db.flush()
        created_samples_by_type[s_type] = sample

        event = SampleTrackingEvent(
            sample_id=sample.id,
            from_status=None,
            to_status=SampleStatus.REGISTERED.value,
            performed_by=current_user.id,
            performer_name=current_user.full_name,
            remarks="Specimen accessioned upon booking creation.",
        )
        db.add(event)

    # 6. Auto-Create DRAFT Report records for each ordered test
    seen_test_ids = set()
    deduped_tests = []
    for t in ordered_tests:
        if t.id not in seen_test_ids:
            seen_test_ids.add(t.id)
            deduped_tests.append(t)
    ordered_tests = deduped_tests

    for t_obj in ordered_tests:
        report_id_display = await generate_report_id(db, current_user.lab_id)
        matched_sample = created_samples_by_type.get(t_obj.sample_type.value)
        report = Report(
            lab_id=current_user.lab_id,
            booking_id=booking.id,
            patient_id=patient.id,
            test_id=t_obj.id,
            sample_id=matched_sample.id if matched_sample else None,
            report_id_display=report_id_display,
            status=ReportStatus.DRAFT,
            current_version=1,
            is_immutable=False,
            created_by=current_user.id,
        )
        db.add(report)
        await db.flush()

    # 7. Auto-Generate Tax Invoice linked to Booking
    invoice_id_display = await generate_invoice_id(db, current_user.lab_id)
    invoice = Invoice(
        lab_id=current_user.lab_id,
        booking_id=booking.id,
        patient_id=patient.id,
        invoice_id_display=invoice_id_display,
        invoice_date=booking.booking_date,
        subtotal=booking.subtotal_amount,
        discount_amount=booking.discount_amount,
        tax_amount=booking.tax_amount,
        grand_total=booking.grand_total,
        paid_amount=booking.paid_amount,
        balance_amount=booking.balance_amount,
        payment_status=booking.payment_status.value,
        notes=booking.clinical_notes,
    )
    db.add(invoice)
    await db.flush()

    # Record initial payment receipt if paid_amount > 0
    if booking.paid_amount > 0:
        receipt_id_display = await generate_receipt_id(db, current_user.lab_id)
        init_payment = Payment(
            invoice_id=invoice.id,
            lab_id=current_user.lab_id,
            payment_method=PaymentMethod.CASH,
            amount=booking.paid_amount,
            receipt_id_display=receipt_id_display,
            received_by=current_user.id,
            notes="Initial deposit paid on booking accession.",
        )
        db.add(init_payment)

    await db.commit()

    # Re-fetch with loaded items and patient
    res = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.items),
            selectinload(Booking.patient),
        )
        .where(Booking.id == booking.id)
    )
    created_booking = res.scalar_one()

    await audit_log(
        db=db,
        action="CREATE_BOOKING",
        entity_name="Booking",
        entity_id=created_booking.id,
        user=current_user,
        after_state={
            "booking_id_display": created_booking.booking_id_display,
            "grand_total": str(created_booking.grand_total),
        },
    )

    # Phase 11: Notification Dispatch for Booking Created
    if patient and (patient.email or patient.phone):
        recipient = patient.email or patient.phone
        await NotificationService.dispatch_event(
            db=db,
            lab_id=str(current_user.lab_id),
            event_type=NotificationEventType.BOOKING_CREATED,
            recipient=recipient,
            recipient_name=patient.full_name,
            template_params={
                "patient_name": patient.full_name,
                "booking_id_display": created_booking.booking_id_display,
                "lab_name": "DiagnoLab",
                "appointment_date": str(created_booking.appointment_date or created_booking.booking_date),
                "appointment_time": str(created_booking.appointment_time or "Scheduled"),
            },
            channel=NotificationChannel.EMAIL if patient.email else NotificationChannel.SMS,
        )

    return APIResponse(
        success=True,
        message=f"Order {created_booking.booking_id_display} created successfully.",
        data=map_booking_to_response(created_booking),
    )


@router.get("/{booking_id}", response_model=APIResponse[BookingResponse])
async def get_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve booking order with strict tenant isolation."""
    res = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.items),
            selectinload(Booking.patient),
        )
        .where(Booking.id == booking_id)
    )
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    if current_user.role.value != "SUPER_ADMIN" and b.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    return APIResponse(
        success=True,
        message="Booking retrieved.",
        data=map_booking_to_response(b),
    )


@router.patch("/{booking_id}/status", response_model=APIResponse[BookingResponse])
async def update_booking_status(
    booking_id: str,
    payload: BookingStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Advance or update booking status."""
    res = await db.execute(
        select(Booking)
        .where(Booking.id == booking_id)
    )
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    if current_user.role.value != "SUPER_ADMIN" and b.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    b.status = payload.status
    await db.commit()

    res = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.items),
            selectinload(Booking.patient),
        )
        .where(Booking.id == booking_id)
    )
    b = res.scalar_one()

    return APIResponse(
        success=True,
        message=f"Booking status updated to {b.status.value}.",
        data=map_booking_to_response(b),
    )


@router.delete("/{booking_id}", response_model=APIResponse[MessageResponse])
async def cancel_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Cancel booking order if not completed."""
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    if current_user.role.value != "SUPER_ADMIN" and b.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    if b.status == BookingStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed booking.",
        )

    b.status = BookingStatus.CANCELLED
    await db.commit()

    return APIResponse(
        success=True,
        message=f"Booking {b.booking_id_display} marked as CANCELLED.",
        data=MessageResponse(message="Booking cancelled."),
    )


@router.get("/{booking_id}/reports/pdf")
async def download_booking_reports_pdf(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Generates and downloads a consolidated medical diagnostic report PDF containing all reports for a single booking."""
    # 1. Fetch booking with patient
    b_res = await db.execute(
        select(Booking)
        .options(selectinload(Booking.patient))
        .where(Booking.id == booking_id)
    )
    booking = b_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    verify_tenant_access(current_user, booking.lab_id)

    # 2. Fetch Laboratory details and settings
    lab_res = await db.execute(
        select(Laboratory)
        .options(selectinload(Laboratory.settings))
        .where(Laboratory.id == booking.lab_id)
    )
    lab = lab_res.scalar_one_or_none()
    lab_settings = lab.settings if lab else None

    # 3. Fetch all reports for this booking with related test, sample, and result_values
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

    # 4. Prepare data payloads
    lab_info = {
        "name": lab.name if lab else "DiagnoLab Diagnostic Services",
        "address": f"{lab.address_street or ''}, {lab.city or ''} {lab.state or ''}" if lab else "Medical Center Way",
        "phone": lab.phone if lab else "N/A",
        "email": lab.email if lab else "N/A",
        "license": lab.registration_number if lab else "ISO 15189 / NABL Certified",
        "default_signatory_name": lab_settings.default_signatory_name if lab_settings else None,
        "default_signatory_designation": lab_settings.default_signatory_designation if lab_settings else None,
        "default_signatory_degrees": lab_settings.default_signatory_degrees if lab_settings else None,
        "default_signatory_reg_no": lab_settings.default_signatory_reg_no if lab_settings else None,
        "default_signatory_signature_url": lab_settings.default_signatory_signature_url if lab_settings else None,
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

    rel_pdf_path = f"bookings/{booking.id}/consolidated_report.pdf"
    output_pdf_path = storage_service.get_local_staging_path(rel_pdf_path)
    qr_url = f"{settings.APP_URL}/verify/{primary_token}" if primary_token else f"{settings.APP_URL}/bookings"

    generate_consolidated_booking_report_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        booking_info=booking_info,
        reports_data=reports_data,
        qr_url=qr_url,
        output_path=output_pdf_path,
    )
    await storage_service.persist_file(output_pdf_path, rel_pdf_path, content_type="application/pdf")

    return await storage_service.get_file_response(
        rel_path=rel_pdf_path,
        filename=f"Booking_{booking.booking_id_display}_All_Reports.pdf",
        media_type="application/pdf",
    )

