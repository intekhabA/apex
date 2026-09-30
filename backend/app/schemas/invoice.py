from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.invoice import PaymentMethod


class PaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    payment_method: PaymentMethod = PaymentMethod.CASH
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    invoice_id: str
    lab_id: str
    payment_method: PaymentMethod
    amount: Decimal
    transaction_reference: Optional[str] = None
    receipt_id_display: str
    received_by_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: str
    lab_id: str
    booking_id: str
    booking_id_display: str
    patient_id: str
    patient_name: str
    patient_id_display: str
    invoice_id_display: str
    invoice_date: date
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    payment_status: str
    pdf_url: Optional[str] = None
    notes: Optional[str] = None
    payments: List[PaymentResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
