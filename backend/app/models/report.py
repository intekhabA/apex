import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, JSON, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"
    FINAL = "FINAL"
    CANCELLED = "CANCELLED"


class Report(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "reports"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="RESTRICT"), nullable=False, index=True)
    booking_id = Column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="RESTRICT"), nullable=False, index=True)
    sample_id = Column(String(36), ForeignKey("samples.id", ondelete="SET NULL"), nullable=True)
    report_id_display = Column(String(32), nullable=False)  # e.g. "REP-2026-000001"
    status = Column(SQLEnum(ReportStatus), default=ReportStatus.DRAFT, nullable=False, index=True)
    current_version = Column(Integer, default=1, nullable=False)
    is_immutable = Column(Boolean, default=False, nullable=False)  # True once status == FINAL
    verification_token = Column(String(64), unique=True, nullable=True, index=True)
    pdf_file_url = Column(Text, nullable=True)
    hmac_digest = Column(String(128), nullable=True)

    # Narrative/Imaging sections
    clinical_history = Column(Text, nullable=True)
    imaging_findings = Column(Text, nullable=True)
    imaging_impression = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)

    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("lab_id", "report_id_display", name="uq_report_lab_display"),
    )

    result_values = relationship("TestResultValue", back_populates="report", cascade="all, delete-orphan")
    versions = relationship("ReportVersion", back_populates="report", cascade="all, delete-orphan", order_by="ReportVersion.version_number")
    attachments = relationship("ReportAttachment", back_populates="report", cascade="all, delete-orphan")
    booking = relationship("Booking")
    patient = relationship("Patient")
    test = relationship("Test")
    sample = relationship("Sample")


class ReportVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "report_versions"

    report_id = Column(String(36), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    snapshot_payload_json = Column(JSON, nullable=False)
    amendment_reason = Column(Text, nullable=False)
    amended_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    amended_by_name = Column(String(150), nullable=True)
    pdf_snapshot_url = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("report_id", "version_number", name="uq_report_version"),
    )

    report = relationship("Report", back_populates="versions")


class ReportAttachment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "report_attachments"

    report_id = Column(String(36), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    storage_path = Column(Text, nullable=False)
    caption = Column(Text, nullable=True)
    uploaded_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    report = relationship("Report", back_populates="attachments")
