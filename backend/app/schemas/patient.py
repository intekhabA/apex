from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.patient import GenderEnum


class PatientBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    gender: GenderEnum
    date_of_birth: Optional[date] = None
    age_years: int = Field(..., ge=0, le=150)
    age_months: int = Field(default=0, ge=0, le=11)
    phone: str = Field(..., min_length=5, max_length=32)
    email: Optional[str] = None
    blood_group: Optional[str] = None
    address_street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    referring_doctor: Optional[str] = None
    clinical_notes: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[GenderEnum] = None
    date_of_birth: Optional[date] = None
    age_years: Optional[int] = None
    age_months: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    address_street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    referring_doctor: Optional[str] = None
    clinical_notes: Optional[str] = None


class PatientResponse(PatientBase):
    id: str
    lab_id: str
    patient_id_display: str
    full_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimelineEvent(BaseModel):
    event_type: str  # "PATIENT_REGISTERED", "BOOKING_CREATED", "SAMPLE_COLLECTED", "REPORT_FINALIZED", "PAYMENT_RECEIVED"
    title: str
    description: str
    timestamp: datetime
    metadata: Optional[dict] = None
