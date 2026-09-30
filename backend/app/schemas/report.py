from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.report import ReportStatus
from app.schemas.result import ResultValueResponse
from app.schemas.imaging import ImagingAttachmentResponse


class ReportVersionResponse(BaseModel):
    id: str
    version_number: int
    amendment_reason: str
    amended_by_name: Optional[str] = None
    pdf_snapshot_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportListItemResponse(BaseModel):
    id: str
    report_id_display: str
    booking_id: str
    booking_id_display: str
    patient_id: str
    patient_name: str
    patient_id_display: str
    test_id: str
    test_name: str
    test_code: str
    sample_type: str
    status: ReportStatus
    current_version: int
    is_immutable: bool
    pdf_file_url: Optional[str] = None
    approved_by_name: Optional[str] = None
    finalized_at: Optional[datetime] = None
    created_at: datetime


class ReportDetailResponse(BaseModel):
    id: str
    report_id_display: str
    lab_id: str
    lab_name: str
    booking_id: str
    booking_id_display: str
    patient_id: str
    patient_name: str
    patient_gender: str
    patient_age_years: int
    test_id: str
    test_name: str
    test_code: str
    status: ReportStatus
    current_version: int
    is_immutable: bool
    verification_token: Optional[str] = None
    pdf_file_url: Optional[str] = None
    hmac_digest: Optional[str] = None
    clinical_history: Optional[str] = None
    imaging_findings: Optional[str] = None
    imaging_impression: Optional[str] = None
    recommendations: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
    result_values: List[ResultValueResponse] = []
    attachments: List[ImagingAttachmentResponse] = []
    versions: List[ReportVersionResponse] = []
    created_at: datetime
    updated_at: datetime


class ReportAmendPayload(BaseModel):
    amendment_reason: str = Field(..., min_length=5, max_length=1000)


class PublicVerificationResponse(BaseModel):
    is_valid: bool
    verification_token: str
    report_id_display: str
    lab_name: str
    patient_name_masked: str
    patient_gender: str
    patient_age_years: int
    test_name: str
    test_code: str
    status: ReportStatus
    version_number: int
    finalized_at: Optional[datetime] = None
    hmac_digest_truncated: str
    verified_at: datetime
