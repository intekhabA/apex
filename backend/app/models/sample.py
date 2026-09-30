import enum
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class SampleStatus(str, enum.Enum):
    REGISTERED = "REGISTERED"
    COLLECTED = "COLLECTED"
    RECEIVED = "RECEIVED"
    PROCESSING = "PROCESSING"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"


class Sample(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "samples"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="RESTRICT"), nullable=False, index=True)
    booking_id = Column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    sample_id_display = Column(String(32), nullable=False)  # e.g. "SMP-2026-000001"
    sample_type = Column(String(50), nullable=False)
    sample_container = Column(String(100), nullable=True)
    status = Column(SQLEnum(SampleStatus), default=SampleStatus.REGISTERED, nullable=False, index=True)

    collected_at = Column(DateTime(timezone=True), nullable=True)
    collected_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    received_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    barcode_value = Column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("lab_id", "sample_id_display", name="uq_sample_lab_display"),
    )

    events = relationship("SampleTrackingEvent", back_populates="sample", cascade="all, delete-orphan", order_by="SampleTrackingEvent.created_at")
    patient = relationship("Patient")


class SampleTrackingEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sample_tracking_events"

    sample_id = Column(String(36), ForeignKey("samples.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    performed_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    performer_name = Column(String(150), nullable=True)
    remarks = Column(Text, nullable=True)

    sample = relationship("Sample", back_populates="events")
