from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.sample import SampleStatus


class SampleTrackingEventResponse(BaseModel):
    id: str
    sample_id: str
    from_status: Optional[str] = None
    to_status: str
    performed_by: Optional[str] = None
    performer_name: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SampleResponse(BaseModel):
    id: str
    lab_id: str
    booking_id: str
    patient_id: str
    sample_id_display: str
    sample_type: str
    sample_container: Optional[str] = None
    status: SampleStatus
    collected_at: Optional[datetime] = None
    collected_by: Optional[str] = None
    received_at: Optional[datetime] = None
    received_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    barcode_value: Optional[str] = None
    events: List[SampleTrackingEventResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class SampleCollectRequest(BaseModel):
    sample_id: str
    sample_container: Optional[str] = None
    barcode_value: Optional[str] = None
    remarks: Optional[str] = None


class SampleReceiveRequest(BaseModel):
    sample_id: str
    remarks: Optional[str] = None


class SampleRejectRequest(BaseModel):
    sample_id: str
    rejection_reason: str = Field(..., min_length=3, max_length=500)
    remarks: Optional[str] = None
