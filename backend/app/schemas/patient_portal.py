from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.booking import BookingResponse
from app.schemas.report import ReportListItemResponse
from app.schemas.invoice import InvoiceResponse


class PatientProfileResponse(BaseModel):
    id: str
    patient_id_display: str
    first_name: str
    last_name: str
    full_name: str
    gender: str
    age_years: int
    age_months: int
    phone: str
    email: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    laboratory_name: Optional[str] = None

    class Config:
        from_attributes = True


class PatientDashboardResponse(BaseModel):
    profile: Optional[PatientProfileResponse] = None
    total_bookings: int
    completed_reports: int
    total_invoiced: Decimal
    total_paid: Decimal
    outstanding_balance: Decimal
    recent_bookings: List[BookingResponse] = []
    recent_reports: List[ReportListItemResponse] = []
    recent_invoices: List[InvoiceResponse] = []
