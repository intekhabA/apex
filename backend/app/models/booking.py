import enum
from sqlalchemy import Column, String, Integer, Date, Time, Text, Numeric, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    SAMPLE_COLLECTED = "SAMPLE_COLLECTED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    REFUNDED = "REFUNDED"


class Booking(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "bookings"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="RESTRICT"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    booking_id_display = Column(String(32), nullable=False)  # e.g. "BK-2026-000001"
    booking_date = Column(Date, nullable=False)
    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(String(10), nullable=True)  # "09:30 AM"
    referring_doctor = Column(String(200), nullable=True)
    status = Column(SQLEnum(BookingStatus), default=BookingStatus.PENDING, nullable=False, index=True)
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)

    subtotal_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    discount_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    tax_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    grand_total = Column(Numeric(12, 2), default=0.00, nullable=False)
    paid_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    balance_amount = Column(Numeric(12, 2), default=0.00, nullable=False)

    clinical_notes = Column(Text, nullable=True)
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("lab_id", "booking_id_display", name="uq_booking_lab_display"),
    )

    items = relationship("BookingItem", back_populates="booking", cascade="all, delete-orphan")
    patient = relationship("Patient")


class BookingItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "booking_items"

    booking_id = Column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="RESTRICT"), nullable=True)
    package_id = Column(String(36), ForeignKey("test_packages.id", ondelete="RESTRICT"), nullable=True)
    item_type = Column(String(20), nullable=False)  # "TEST" or "PACKAGE"
    item_name = Column(String(255), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0.00)
    final_price = Column(Numeric(10, 2), nullable=False)

    booking = relationship("Booking", back_populates="items")
