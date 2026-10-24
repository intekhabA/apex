import os
import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import require_lab_staff, verify_tenant_access
from app.models.user import User
from app.models.laboratory import Laboratory
from app.models.patient import Patient
from app.models.booking import Booking, PaymentStatus as BookingPaymentStatus
from app.models.invoice import Invoice, Payment, PaymentMethod
from app.models.notification import NotificationEventType, NotificationChannel
from app.schemas.common import APIResponse, MessageResponse, paginate_meta
from app.schemas.invoice import (
    InvoiceResponse,
    PaymentResponse,
    PaymentCreate,
)
from app.services.sequence_service import generate_receipt_id
from app.services.pdf_engine import generate_payment_receipt_pdf
from app.services.notification_service import NotificationService
from app.services.storage_service import storage_service

router = APIRouter(prefix="/invoices", tags=["Billing & Invoices"])


@router.get("", response_model=APIResponse[List[InvoiceResponse]])
async def list_invoices(
    payment_status: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1, description="Page number"),
    limit: Optional[int] = Query(20, ge=1, le=500, description="Items per page"),
    all: bool = Query(False, description="Fetch all without pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve laboratory billing invoices with payment ledger."""
    query = (
        select(Invoice)
        .options(
            selectinload(Invoice.booking),
            selectinload(Invoice.patient),
            selectinload(Invoice.payments).selectinload(Payment.received_by_user),
        )
    )
    count_query = select(func.count(Invoice.id))

    if current_user.role.value != "SUPER_ADMIN":
        query = query.where(Invoice.lab_id == current_user.lab_id)
        count_query = count_query.where(Invoice.lab_id == current_user.lab_id)

    if payment_status:
        query = query.where(Invoice.payment_status == payment_status)
        count_query = count_query.where(Invoice.payment_status == payment_status)
    if patient_id:
        query = query.where(Invoice.patient_id == patient_id)
        count_query = count_query.where(Invoice.patient_id == patient_id)

    if search:
        term = f"%{search.strip()}%"
        search_cond = or_(
            Invoice.invoice_id_display.ilike(term),
            Patient.first_name.ilike(term),
            Patient.last_name.ilike(term),
            Patient.patient_id_display.ilike(term),
            Booking.booking_id_display.ilike(term),
        )
        query = query.outerjoin(Invoice.patient).outerjoin(Invoice.booking).where(search_cond)
        count_query = count_query.outerjoin(Invoice.patient).outerjoin(Invoice.booking).where(search_cond)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(desc(Invoice.created_at))
    if not all and limit:
        query = query.offset((page - 1) * limit).limit(limit)

    res = await db.execute(query)
    invoices = res.scalars().all()

    output = []
    for inv in invoices:
        p_name = inv.patient.full_name if inv.patient else "Patient"
        p_id_disp = inv.patient.patient_id_display if inv.patient else ""
        bk_disp = inv.booking.booking_id_display if inv.booking else ""

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
                booking_id_display=bk_disp,
                patient_id=str(inv.patient_id),
                patient_name=p_name,
                patient_id_display=p_id_disp,
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

    effective_limit = limit if (not all and limit) else (total or 20)
    meta = paginate_meta(page=page, limit=effective_limit, total=total)

    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} invoices.",
        data=output,
        meta=meta,
    )


@router.get("/{invoice_id}", response_model=APIResponse[InvoiceResponse])
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve detailed billing invoice with complete ledger of recorded payments."""
    res = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.booking),
            selectinload(Invoice.patient),
            selectinload(Invoice.payments).selectinload(Payment.received_by_user),
        )
        .where(Invoice.id == invoice_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    verify_tenant_access(current_user, inv.lab_id)

    # Query fresh payments directly from database
    pmts_res = await db.execute(
        select(Payment)
        .options(selectinload(Payment.received_by_user))
        .where(Payment.invoice_id == invoice_id)
        .order_by(Payment.created_at.asc())
    )
    payments_list = pmts_res.scalars().all()

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
        for p in payments_list
    ]

    return APIResponse(
        success=True,
        message="Invoice details retrieved.",
        data=InvoiceResponse(
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
        ),
    )


@router.post("/{invoice_id}/payments", response_model=APIResponse[InvoiceResponse])
async def record_invoice_payment(
    invoice_id: str,
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Record a partial or full payment on an invoice, update balance, and issue a receipt."""
    res = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.booking),
            selectinload(Invoice.patient),
            selectinload(Invoice.payments).selectinload(Payment.received_by_user),
        )
        .where(Invoice.id == invoice_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    verify_tenant_access(current_user, inv.lab_id)

    if inv.balance_amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already fully paid. Outstanding balance is 0.",
        )

    pay_amount = Decimal(str(payload.amount)).quantize(Decimal("0.01"))
    if pay_amount > inv.balance_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({pay_amount}) exceeds outstanding invoice balance ({inv.balance_amount}).",
        )

    # Generate sequential receipt ID
    receipt_id_display = await generate_receipt_id(db, inv.lab_id)

    payment = Payment(
        invoice_id=inv.id,
        lab_id=inv.lab_id,
        payment_method=payload.payment_method,
        amount=pay_amount,
        transaction_reference=payload.transaction_reference,
        receipt_id_display=receipt_id_display,
        received_by=current_user.id,
        notes=payload.notes,
    )
    db.add(payment)

    # Update invoice financials
    inv.paid_amount = (Decimal(str(inv.paid_amount)) + pay_amount).quantize(Decimal("0.01"))
    inv.balance_amount = max(Decimal("0.00"), Decimal(str(inv.grand_total)) - inv.paid_amount).quantize(Decimal("0.01"))
    inv.payment_status = "PAID" if inv.balance_amount == Decimal("0.00") else "PARTIAL"

    # Synchronize parent booking
    if inv.booking:
        inv.booking.paid_amount = inv.paid_amount
        inv.booking.balance_amount = inv.balance_amount
        inv.booking.payment_status = (
            BookingPaymentStatus.PAID if inv.balance_amount == Decimal("0.00") else BookingPaymentStatus.PARTIAL
        )

    await db.commit()

    # Phase 11: Notification Dispatch for Payment Received
    if inv.patient and (inv.patient.email or inv.patient.phone):
        await NotificationService.dispatch_event(
            db=db,
            lab_id=str(inv.lab_id),
            event_type=NotificationEventType.PAYMENT_RECEIVED,
            recipient=inv.patient.email or inv.patient.phone,
            recipient_name=inv.patient.full_name,
            template_params={
                "patient_name": inv.patient.full_name,
                "amount": str(pay_amount),
                "invoice_id_display": inv.invoice_id_display,
                "receipt_id_display": receipt_id_display,
            },
            channel=NotificationChannel.EMAIL if inv.patient.email else NotificationChannel.SMS,
        )

    return await get_invoice(invoice_id=invoice_id, db=db, current_user=current_user)


IST_TZ = datetime.timezone(datetime.timedelta(hours=5, minutes=30), name="IST")


def format_datetime_ist(dt: Optional[datetime.datetime]) -> str:
    """Format datetime in Indian Standard Time (IST, UTC+05:30)."""
    if not dt:
        dt = datetime.datetime.now(datetime.timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(IST_TZ).strftime("%d-%b-%Y %I:%M %p")


@router.get("/{invoice_id}/receipt")
async def download_payment_receipt(
    invoice_id: str,
    payment_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Generate and download official PDF payment receipt matching print format for an invoice."""
    res = await db.execute(
        select(Invoice)
        .options(
            selectinload(Invoice.booking).selectinload(Booking.items),
            selectinload(Invoice.patient),
            selectinload(Invoice.payments).selectinload(Payment.received_by_user),
        )
        .where(Invoice.id == invoice_id)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    verify_tenant_access(current_user, inv.lab_id)

    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == inv.lab_id))
    lab = lab_res.scalar_one()

    if inv.payments:
        target_payment = None
        if payment_id:
            target_payment = next((p for p in inv.payments if str(p.id) == payment_id), None)
        if not target_payment:
            target_payment = inv.payments[-1]  # latest payment

        receipt_filename = f"{target_payment.receipt_id_display}.pdf"
        rel_receipt_path = f"receipts/{inv.id}/{receipt_filename}"
        output_pdf_path = storage_service.get_local_staging_path(rel_receipt_path)

        payment_info = {
            "receipt_id_display": target_payment.receipt_id_display,
            "amount": target_payment.amount,
            "payment_method": target_payment.payment_method.value if hasattr(target_payment.payment_method, "value") else str(target_payment.payment_method),
            "transaction_reference": target_payment.transaction_reference,
            "received_by_name": target_payment.received_by_user.full_name if target_payment.received_by_user else "Cashier",
            "date": format_datetime_ist(target_payment.created_at),
        }
    else:
        receipt_filename = f"BILL-{inv.invoice_id_display}.pdf"
        rel_receipt_path = f"receipts/{inv.id}/{receipt_filename}"
        output_pdf_path = storage_service.get_local_staging_path(rel_receipt_path)

        payment_info = {
            "receipt_id_display": f"BILL-{inv.invoice_id_display}",
            "amount": Decimal("0.00"),
            "payment_method": "BALANCE DUE",
            "transaction_reference": "Diagnostic Booking Slip",
            "received_by_name": current_user.full_name if current_user else "Reception Desk",
            "date": format_datetime_ist(inv.created_at),
        }

    lab_info = {
        "name": lab.name,
        "address": f"{lab.address_street or ''}, {lab.city or ''} {lab.state or ''}",
        "phone": lab.phone or "N/A",
        "license": lab.registration_number or "Accredited Laboratory",
    }

    patient_gender = (
        inv.patient.gender.value
        if (inv.patient and hasattr(inv.patient.gender, "value"))
        else (str(inv.patient.gender) if inv.patient and inv.patient.gender else None)
    )
    patient_age = inv.patient.age_years if inv.patient else None
    patient_phone = inv.patient.phone if inv.patient else "N/A"
    referring_doctor = (
        (inv.booking.referring_doctor if inv.booking and inv.booking.referring_doctor else None)
        or (inv.patient.referring_doctor if inv.patient and inv.patient.referring_doctor else None)
        or "Self / Walk-in"
    )

    patient_info = {
        "name": inv.patient.full_name if inv.patient else "Patient",
        "id_display": inv.patient.patient_id_display if inv.patient else "N/A",
        "gender": patient_gender,
        "age": patient_age,
        "phone": patient_phone,
        "booking_id_display": inv.booking.booking_id_display if inv.booking else "N/A",
        "referring_doctor": referring_doctor,
    }
    invoice_summary = {
        "invoice_id_display": inv.invoice_id_display,
        "subtotal": float(inv.subtotal),
        "discount_amount": float(inv.discount_amount),
        "tax_amount": float(inv.tax_amount),
        "grand_total": float(inv.grand_total),
        "paid_amount": float(inv.paid_amount),
        "balance_amount": float(inv.balance_amount),
        "payment_status": inv.payment_status,
    }

    # Extract itemized investigations from booking
    items_data = []
    if inv.booking and inv.booking.items:
        items_data = [
            {
                "name": it.item_name,
                "type": it.item_type,
                "price": float(it.final_price if it.final_price is not None else it.unit_price),
            }
            for it in inv.booking.items
        ]
    elif inv.booking:
        items_data = [
            {
                "name": f"Diagnostic Order Services ({inv.booking.booking_id_display})",
                "type": "ORDER",
                "price": float(inv.subtotal),
            }
        ]

    generate_payment_receipt_pdf(
        lab_info=lab_info,
        patient_info=patient_info,
        payment_info=payment_info,
        invoice_summary=invoice_summary,
        output_path=output_pdf_path,
        items=items_data,
    )
    await storage_service.persist_file(output_pdf_path, rel_receipt_path, content_type="application/pdf")

    return await storage_service.get_file_response(
        rel_path=rel_receipt_path,
        filename=receipt_filename,
        media_type="application/pdf",
    )
