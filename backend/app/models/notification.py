import enum
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class NotificationEventType(str, enum.Enum):
    BOOKING_CREATED = "BOOKING_CREATED"
    SAMPLE_COLLECTED = "SAMPLE_COLLECTED"
    REPORT_FINALIZED = "REPORT_FINALIZED"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"


class NotificationChannel(str, enum.Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class NotificationLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notification_logs"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(SQLEnum(NotificationEventType), nullable=False, index=True)
    channel = Column(SQLEnum(NotificationChannel), default=NotificationChannel.EMAIL, nullable=False, index=True)
    recipient = Column(String(255), nullable=False)
    recipient_name = Column(String(150), nullable=False)
    subject = Column(String(255), nullable=True)
    message_body = Column(Text, nullable=False)
    status = Column(SQLEnum(NotificationStatus), default=NotificationStatus.SENT, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    laboratory = relationship("Laboratory")
