from typing import Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    lab_id: Optional[str] = None
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

    class Config:
        from_attributes = True
