from sqlalchemy import Column, String, DateTime, Text, JSON
from app.core.database import Base, UUIDMixin, TimestampMixin


class AuditLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    lab_id = Column(String(36), nullable=True, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    user_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    entity_name = Column(String(100), nullable=False, index=True)
    entity_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    before_state_json = Column(JSON, nullable=True)
    after_state_json = Column(JSON, nullable=True)
