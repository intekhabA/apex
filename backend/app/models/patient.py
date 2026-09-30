import enum
from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class GenderEnum(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class Patient(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "patients"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    patient_id_display = Column(String(32), nullable=False)  # e.g. "PAT-2026-000001"
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    gender = Column(SQLEnum(GenderEnum), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    age_years = Column(Integer, nullable=False)
    age_months = Column(Integer, default=0)
    phone = Column(String(32), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    blood_group = Column(String(10), nullable=True)
    address_street = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    emergency_contact_name = Column(String(150), nullable=True)
    emergency_contact_phone = Column(String(32), nullable=True)
    referring_doctor = Column(String(200), nullable=True)
    clinical_notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("lab_id", "patient_id_display", name="uq_patient_lab_display"),
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
