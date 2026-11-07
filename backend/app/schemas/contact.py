from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr, Field, field_serializer


class ContactQueryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Visitor's full name")
    email: EmailStr = Field(..., description="Contact email address")
    phone: Optional[str] = Field(None, max_length=50, description="Contact phone number")
    organization_name: Optional[str] = Field(None, max_length=200, description="Company or laboratory name")
    service_interested: Optional[str] = Field(
        "Diagnostic Center LIMS",
        max_length=100,
        description="Clinical service or product of interest",
    )
    subject: str = Field(..., min_length=2, max_length=255, description="Brief subject of inquiry")
    message: str = Field(..., min_length=5, description="Full details of query or requirements")
    # Anti-spam & Bot Protection Security fields
    website_trap: Optional[str] = Field(None, description="Honeypot field for catching automated spam bots")
    client_time_ms: Optional[int] = Field(None, description="Elapsed time in milliseconds taken on the client form")
    challenge_answer: Optional[str] = Field(None, description="User's answer to the security math challenge")
    challenge_token: Optional[str] = Field(None, description="HMAC token corresponding to the security question")


class ContactQueryUpdateStatus(BaseModel):
    status: str = Field(..., description="NEW, CONTACTED, RESOLVED, or SPAM")
    admin_notes: Optional[str] = None


class ContactQueryResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    organization_name: Optional[str] = None
    service_interested: Optional[str] = None
    subject: str
    message: str
    status: str
    admin_notes: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    formatted_time: Optional[str] = None

    @field_serializer("created_at")
    def serialize_created_at(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True


class ContactPublicInfoResponse(BaseModel):
    support_email: str = Field(..., description="Public support email displayed on contact page")
    contact_phone: str = Field(..., description="Public helpline / contact number displayed on contact page")
    office_address: Optional[str] = Field(None, description="Physical office / laboratory headquarters address")
    working_hours: Optional[str] = Field(None, description="Operating hours and response SLA")
    challenge_question: Optional[str] = Field(None, description="Human verification math challenge question")
    challenge_token: Optional[str] = Field(None, description="HMAC-signed verification token")


class ContactSettingsResponse(BaseModel):
    id: Optional[str] = None
    recipient_email: str
    support_email: str
    contact_phone: str
    office_address: Optional[str] = None
    working_hours: Optional[str] = None
    notification_subject_template: str
    notification_body_template: str
    auto_reply_enabled: bool
    auto_reply_subject_template: str
    auto_reply_body_template: str
    available_placeholders: List[str] = [
        "{user_name}",
        "{user_email}",
        "{user_phone}",
        "{organization_name}",
        "{service_interested}",
        "{subject}",
        "{message}",
        "{submitted_at}",
    ]

    class Config:
        from_attributes = True


class ContactSettingsUpdate(BaseModel):
    recipient_email: Optional[EmailStr] = None
    support_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    office_address: Optional[str] = None
    working_hours: Optional[str] = None
    notification_subject_template: Optional[str] = None
    notification_body_template: Optional[str] = None
    auto_reply_enabled: Optional[bool] = None
    auto_reply_subject_template: Optional[str] = None
    auto_reply_body_template: Optional[str] = None
