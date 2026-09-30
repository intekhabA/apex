from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.report import ReportStatus


class ImagingReportUpdate(BaseModel):
    clinical_history: Optional[str] = None
    imaging_findings: Optional[str] = None
    imaging_impression: Optional[str] = None
    recommendations: Optional[str] = None
    submit_for_review: bool = False


class ImagingAttachmentResponse(BaseModel):
    id: str
    report_id: str
    file_name: str
    file_type: str
    file_size_bytes: int
    storage_path: str
    caption: Optional[str] = None
    uploaded_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImagingReportResponse(BaseModel):
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
    status: ReportStatus
    clinical_history: Optional[str] = None
    imaging_findings: Optional[str] = None
    imaging_impression: Optional[str] = None
    recommendations: Optional[str] = None
    attachments: List[ImagingAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime


class ImagingTemplateResponse(BaseModel):
    id: str
    name: str
    modality: str  # "USG", "X-RAY", "CT", "MRI"
    clinical_history_template: str
    findings_template: str
    impression_template: str
    recommendations_template: str
