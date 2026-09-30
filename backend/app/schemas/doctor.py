import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr


class DoctorBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[str] = Field(None, max_length=255)
    specialization: Optional[str] = Field(None, max_length=100)
    clinic_hospital_name: Optional[str] = Field(None, max_length=200)
    default_commission_percentage: Decimal = Field(Decimal("10.00"), ge=0, le=100)
    is_active: bool = True


class DoctorCreate(DoctorBase):
    pass


class DoctorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    clinic_hospital_name: Optional[str] = None
    default_commission_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class DoctorResponse(DoctorBase):
    id: str
    lab_id: str
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class DoctorTestCommissionItem(BaseModel):
    test_id: str
    test_name: Optional[str] = None
    test_code: Optional[str] = None
    category_name: Optional[str] = None
    standard_price: Optional[Decimal] = None
    commission_percentage: Decimal = Field(..., ge=0, le=100)
    is_custom: bool = True


class DoctorCommissionOverridesUpdate(BaseModel):
    commissions: List[DoctorTestCommissionItem]


class CommissionTestBreakdownItem(BaseModel):
    test_id: Optional[str] = None
    test_name: str
    test_code: Optional[str] = None
    category_name: Optional[str] = None
    tests_count: int
    total_income: Decimal
    commission_percentage: Decimal  # Specific percentage applied for this test
    is_custom_percentage: bool
    commission_amount: Decimal


class CommissionPatientLedgerItem(BaseModel):
    booking_id: str
    booking_id_display: str
    booking_date: datetime.date
    patient_id: str
    patient_name: str
    patient_mrn: Optional[str] = None
    doctor_name: str
    test_id: Optional[str] = None
    test_name: str
    test_price: Decimal
    commission_percentage: Decimal
    commission_amount: Decimal
    payment_status: str


class DoctorSummaryItem(BaseModel):
    doctor_id: Optional[str] = None
    doctor_name: str
    specialization: Optional[str] = None
    phone: Optional[str] = None
    clinic_hospital_name: Optional[str] = None
    default_commission_percentage: Decimal
    total_income: Decimal
    total_commission: Decimal
    effective_percentage: Decimal
    total_tests: int
    total_patients: int
    total_bookings: int


class CommissionTrendItem(BaseModel):
    period_label: str
    total_income: Decimal
    total_commission: Decimal
    tests_count: int


class DoctorCommissionReportResponse(BaseModel):
    period_type: str  # "daily", "monthly", "custom"
    start_date: datetime.date
    end_date: datetime.date
    doctor_filter: Optional[str] = None
    doctor_id_filter: Optional[str] = None
    total_income: Decimal
    total_commission: Decimal
    effective_percentage: Decimal
    total_tests: int
    total_patients: int
    total_bookings: int
    doctors_summary: List[DoctorSummaryItem]
    test_breakdown: List[CommissionTestBreakdownItem]
    patient_ledger: List[CommissionPatientLedgerItem]
    trends: List[CommissionTrendItem]
