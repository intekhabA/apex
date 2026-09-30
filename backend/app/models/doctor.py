from sqlalchemy import Column, String, Numeric, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class Doctor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "doctors"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)
    phone = Column(String(32), nullable=True)
    email = Column(String(255), nullable=True)
    specialization = Column(String(100), nullable=True)
    clinic_hospital_name = Column(String(200), nullable=True)
    default_commission_percentage = Column(Numeric(5, 2), default=10.00, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    laboratory = relationship("Laboratory")
    test_commissions = relationship("DoctorTestCommission", back_populates="doctor", cascade="all, delete-orphan")


class DoctorTestCommission(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "doctor_test_commissions"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    test_id = Column(String(36), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True)
    commission_percentage = Column(Numeric(5, 2), nullable=False)

    doctor = relationship("Doctor", back_populates="test_commissions")
    test = relationship("Test")

    __table_args__ = (
        UniqueConstraint("doctor_id", "test_id", name="uq_doctor_test_commission"),
    )
