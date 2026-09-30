from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from app.models.notification import NotificationEventType, NotificationChannel, NotificationStatus


class NotificationLogResponse(BaseModel):
    id: str
    lab_id: str
    event_type: NotificationEventType
    channel: NotificationChannel
    recipient: str
    recipient_name: str
    subject: Optional[str] = None
    message_body: str
    status: NotificationStatus
    error_message: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationDispatchRequest(BaseModel):
    event_type: NotificationEventType
    channel: NotificationChannel = NotificationChannel.EMAIL
    recipient: str
    recipient_name: str
    subject: Optional[str] = None
    template_params: Dict[str, Any] = {}
