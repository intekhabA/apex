import os
import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
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
from app.schemas.common import APIResponse, MessageResponse
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
        .order_by(desc(Invoice.created_at))
    )

    if current_user.role.value != "SUPER_ADMIN":
        query = query.where(Invoice.lab_id == current_user.lab_id)

    if payment_status:
        query = query.where(Invoice.payment_status == payment_status)
    if patient_id:
        query = query.where(Invoice.patient_id == patient_id)

    res = await db.execute(query)
    invoices = res.scalars().all()

    output = []
    for inv in invoices:
        p_name = inv.patient.full_name if inv.patient else "Patient"
        p_id_disp = inv.patient.patient_id_display if inv.patient else ""
        bk_disp = inv.booking.booking_id_display if inv.booking else ""

        if search:
            s = search.lower()
            if not (
                s in inv.invoice_id_display.lower()
                or s in p_name.lower()
                or s in p_id_disp.lower()
                or s in bk_disp.lower()
            ):
                continue

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

    return APIResponse(success=True, message=f"Retrieved {len(output)} invoices.", data=output)


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


@router.get("/{invoice_id}/receipt")
async def download_payment_receipt(
    invoice_id: str,
    payment_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Generate and download official PDF payment receipt for an invoice."""
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

    if not inv.payments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payments recorded on this invoice to generate a receipt.",
        )

    target_payment = None
    if payment_id:
        target_payment = next((p for p in inv.payments if str(p.id) == payment_id), None)
    if not target_payment:
        target_payment = inv.payments[-1]  # latest payment

    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == inv.lab_id))
    lab = lab_res.scalar_one()

    receipt_filename = f"{target_payment.receipt_id_display}.pdf"
    rel_receipt_path = f"receipts/{inv.id}/{receipt_filename}"
    output_pdf_path = storage_service.get_local_staging_path(rel_receipt_path)

    lab_info = {
        "name": lab.name,
        "address": f"{lab.address_street or ''}, {lab.city or ''} {lab.state or ''}",
        "phone": lab.phone or "N/A",
        "license": lab.registration_number or "Accredited Laboratory",
    }
    patient_info = {
        "name": inv.patient.full_name if inv.patient else "Patient",
        "id_display": inv.patient.patient_id_display if inv.patient else "N/A",
        "booking_id_display": inv.booking.booking_id_display if inv.booking else "N/A",
    }
    payment_info = {
        "receipt_id_display": target_payment.receipt_id_display,
        "amount": target_payment.amount,
        "payment_method": target_payment.payment_method.value,
        "transaction_reference": target_payment.transaction_reference,
        "received_by_name": target_payment.received_by_user.full_name if target_payment.received_by_user else "Cashier",
        "date": target_payment.created_at.strftime("%d-%b-%Y %I:%M %p"),
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
    await storage_service.persist_file(output_pdf_path, rel_receipt_path, content_type="application/pdf")

    return await storage_service.get_file_response(
        rel_path=rel_receipt_path,
        filename=receipt_filename,
        media_type="application/pdf",
    )
