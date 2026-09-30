from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.result import ResultFlagEnum
from app.models.report import ReportStatus


class ParameterValueInput(BaseModel):
    parameter_id: str
    numeric_value: Optional[Decimal] = None
    text_value: Optional[str] = None
    technician_comment: Optional[str] = None


class ResultEntryPayload(BaseModel):
    values: List[ParameterValueInput]
    submit_for_review: bool = False  # If true, transitions report from DRAFT to PENDING_REVIEW


class ResultValueResponse(BaseModel):
    id: str
    parameter_id: str
    parameter_name: str
    parameter_code: str
    numeric_value: Optional[Decimal] = None
    text_value: Optional[str] = None
    unit: Optional[str] = None
    reference_range_display: Optional[str] = None
    flag: ResultFlagEnum
    technician_comment: Optional[str] = None

    class Config:
        from_attributes = True


class ResultSheetResponse(BaseModel):
    report_id: str
    report_id_display: str
    lab_id: str
    booking_id: str
    patient_id: str
    patient_name: str
    patient_gender: str
    patient_age_years: int
    test_id: str
    test_name: str
    test_code: str
    sample_id: Optional[str] = None
    sample_id_display: Optional[str] = None
    status: ReportStatus
    values: List[ResultValueResponse] = []
    created_at: datetime
    updated_at: datetime


class PendingWorklistResponse(BaseModel):
    report_id: str
    report_id_display: str
    booking_id: str
    booking_id_display: str
    patient_name: str
    patient_id_display: str
    test_name: str
    test_code: str
    sample_type: str
    status: ReportStatus
    created_at: datetime
