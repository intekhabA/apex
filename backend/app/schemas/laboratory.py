from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field


class LaboratoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=32)
    legal_name: Optional[str] = None
    registration_number: Optional[str] = None
    tax_identifier: Optional[str] = None
    email: EmailStr
    phone: str
    website: Optional[str] = None
    address_street: str
    city: str
    state: str
    postal_code: str
    country: str = "India"
    logo_url: Optional[str] = None
    subscription_plan: str = "STANDARD"


class LaboratoryCreate(LaboratoryBase):
    initial_admin_first_name: str = "Lab"
    initial_admin_last_name: str = "Admin"
    initial_admin_email: EmailStr
    initial_admin_password: str = Field(..., min_length=8)


class LaboratoryUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    registration_number: Optional[str] = None
    tax_identifier: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    subscription_plan: Optional[str] = None


class LaboratoryResponse(LaboratoryBase):
    id: str
    is_active: bool
    subscription_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LaboratorySettingsUpdate(BaseModel):
    report_header_html: Optional[str] = None
    report_footer_html: Optional[str] = None
    report_disclaimer: Optional[str] = None
    currency_code: Optional[str] = None
    currency_symbol: Optional[str] = None
    default_tax_rate: Optional[Decimal] = None
    enable_qr_verification: Optional[bool] = None
    primary_color_hex: Optional[str] = None
    secondary_color_hex: Optional[str] = None
    default_signatory_name: Optional[str] = None
    default_signatory_designation: Optional[str] = None
    default_signatory_degrees: Optional[str] = None
    default_signatory_reg_no: Optional[str] = None
    default_signatory_signature_url: Optional[str] = None
    notify_on_booking: Optional[bool] = None
    notify_on_sample_collected: Optional[bool] = None
    notify_on_report_finalized: Optional[bool] = None
    notify_on_payment_received: Optional[bool] = None
    notification_channel_default: Optional[str] = None


class LaboratorySettingsResponse(LaboratorySettingsUpdate):
    id: str
    lab_id: str
    notify_on_booking: bool = True
    notify_on_sample_collected: bool = True
    notify_on_report_finalized: bool = True
    notify_on_payment_received: bool = True
    notification_channel_default: str = "EMAIL"

    class Config:
        from_attributes = True


class LaboratoryStatusUpdate(BaseModel):
    is_active: bool


class LaboratoryDetailResponse(LaboratoryResponse):
    settings: Optional[LaboratorySettingsResponse] = None
    staff_count: int = 0


