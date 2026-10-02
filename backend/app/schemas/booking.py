from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.booking import BookingStatus, PaymentStatus


class BookingItemCreate(BaseModel):
    item_type: str = Field(..., pattern="^(TEST|PACKAGE)$")
    test_id: Optional[str] = None
    package_id: Optional[str] = None


class BookingItemResponse(BaseModel):
    id: str
    item_type: str
    test_id: Optional[str] = None
    package_id: Optional[str] = None
    item_name: str
    unit_price: Decimal
    discount_amount: Decimal
    final_price: Decimal

    class Config:
        from_attributes = True


class BookingCreate(BaseModel):
    patient_id: str
    appointment_date: date
    appointment_time: Optional[str] = None
    referring_doctor: Optional[str] = None
    clinical_notes: Optional[str] = None
    status: Optional[BookingStatus] = BookingStatus.CONFIRMED
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    tax_percentage: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    items: List[BookingItemCreate] = Field(..., min_length=1)


class BookingStatusUpdate(BaseModel):
    status: BookingStatus


class BookingResponse(BaseModel):
    id: str
    lab_id: str
    patient_id: str
    patient_name: Optional[str] = None
    patient_id_display: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_gender: Optional[str] = None
    patient_age_years: Optional[int] = None
    booking_id_display: str
    booking_date: date
    appointment_date: date
    appointment_time: Optional[str] = None
    referring_doctor: Optional[str] = None
    status: BookingStatus
    payment_status: PaymentStatus

    subtotal_amount: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    paid_amount: Decimal
    balance_amount: Decimal

    clinical_notes: Optional[str] = None
    items: List[BookingItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

