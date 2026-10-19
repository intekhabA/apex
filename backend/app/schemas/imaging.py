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


class ImagingTemplateBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=100)
    modality: str = Field(..., description="USG, X-RAY, CT, MRI, ECG, OTHER")
    test_id: Optional[str] = None
    clinical_history_template: Optional[str] = None
    findings_template: str = Field(..., min_length=5)
    impression_template: Optional[str] = None
    recommendations_template: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class ImagingTemplateCreate(ImagingTemplateBase):
    pass


class ImagingTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=2, max_length=100)
    modality: Optional[str] = None
    test_id: Optional[str] = None
    clinical_history_template: Optional[str] = None
    findings_template: Optional[str] = None
    impression_template: Optional[str] = None
    recommendations_template: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class ImagingTemplateResponse(BaseModel):
    id: str
    code: str
    name: str
    modality: str  # "USG", "X-RAY", "CT", "MRI", "ECG", "OTHER"
    test_id: Optional[str] = None
    test_name: Optional[str] = None
    test_code: Optional[str] = None
    clinical_history_template: Optional[str] = ""
    findings_template: str
    impression_template: Optional[str] = ""
    recommendations_template: Optional[str] = ""
    is_active: bool = True
    display_order: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

