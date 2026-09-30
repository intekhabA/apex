import enum
from sqlalchemy import Column, String, Date, DateTime, Numeric, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    UPI = "UPI"
    BANK_TRANSFER = "BANK_TRANSFER"
    ONLINE = "ONLINE"
    OTHER = "OTHER"


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="RESTRICT"), nullable=False, index=True)
    booking_id = Column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id_display = Column(String(32), nullable=False)  # e.g. "INV-2026-000001"
    invoice_date = Column(Date, nullable=False)

    subtotal = Column(Numeric(12, 2), default=0.00, nullable=False)
    discount_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    tax_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    grand_total = Column(Numeric(12, 2), default=0.00, nullable=False)
    paid_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    balance_amount = Column(Numeric(12, 2), default=0.00, nullable=False)
    payment_status = Column(String(20), default="PENDING", nullable=False)
    pdf_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("lab_id", "invoice_id_display", name="uq_invoice_lab_display"),
    )

    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan", order_by="Payment.created_at")
    booking = relationship("Booking")
    patient = relationship("Patient")
    laboratory = relationship("Laboratory")


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="RESTRICT"), nullable=False, index=True)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    transaction_reference = Column(String(100), nullable=True)  # UPI Ref / Card Txn ID
    receipt_id_display = Column(String(32), nullable=False)    # e.g. "REC-2026-000001"
    received_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    invoice = relationship("Invoice", back_populates="payments")
    received_by_user = relationship("User")
