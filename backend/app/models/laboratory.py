import enum
from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class SubscriptionPlan(str, enum.Enum):
    STARTER = "STARTER"
    STANDARD = "STANDARD"
    ENTERPRISE = "ENTERPRISE"


class Laboratory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "laboratories"

    code = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    legal_name = Column(String(255), nullable=True)
    registration_number = Column(String(100), nullable=True)
    tax_identifier = Column(String(100), nullable=True)
    email = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=False)
    website = Column(String(255), nullable=True)
    address_street = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    country = Column(String(100), default="India")
    logo_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    subscription_plan = Column(String(50), default="STANDARD")
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    settings = relationship("LaboratorySettings", back_populates="laboratory", uselist=False, cascade="all, delete-orphan")
    users = relationship("User", back_populates="laboratory", cascade="all, delete-orphan")


class LaboratorySettings(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "laboratory_settings"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=False, unique=True)
    report_header_html = Column(Text, nullable=True)
    report_footer_html = Column(Text, nullable=True)
    report_disclaimer = Column(
        Text,
        default="This is an electronically generated and authenticated diagnostic report. No physical signature is required. Results relate only to the specimen tested.",
        nullable=False
    )
    currency_code = Column(String(10), default="INR")
    currency_symbol = Column(String(5), default="₹")
    default_tax_rate = Column(Numeric(5, 2), default=0.00)
    enable_qr_verification = Column(Boolean, default=True)
    primary_color_hex = Column(String(7), default="#0284c7")
    secondary_color_hex = Column(String(7), default="#0f172a")

    default_signatory_name = Column(String(150), nullable=True)
    default_signatory_designation = Column(String(150), nullable=True)
    default_signatory_degrees = Column(String(150), nullable=True)
    default_signatory_reg_no = Column(String(100), nullable=True)
    default_signatory_signature_url = Column(Text, nullable=True)

    # Phase 11: Notification Preferences
    notify_on_booking = Column(Boolean, default=True)
    notify_on_sample_collected = Column(Boolean, default=True)
    notify_on_report_finalized = Column(Boolean, default=True)
    notify_on_payment_received = Column(Boolean, default=True)
    notification_channel_default = Column(String(20), default="EMAIL")

    laboratory = relationship("Laboratory", back_populates="settings")
