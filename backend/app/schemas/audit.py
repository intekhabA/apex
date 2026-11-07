from typing import Optional, Any, Dict
from datetime import datetime, timezone
from pydantic import BaseModel, field_serializer


class AuditLogResponse(BaseModel):
    id: str
    lab_id: Optional[str] = None
    lab_name: Optional[str] = None
    lab_timezone: Optional[str] = "Asia/Kolkata"
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    entity_name: str
    entity_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    before_state_json: Optional[Dict[str, Any]] = None
    after_state_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    formatted_time: Optional[str] = None

    @field_serializer("created_at")
    def serialize_created_at(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

