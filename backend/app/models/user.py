import enum
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base, UUIDMixin, TimestampMixin


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    LAB_ADMIN = "LAB_ADMIN"
    LAB_ASSISTANT = "LAB_ASSISTANT"
    PATHOLOGIST = "PATHOLOGIST"
    RADIOLOGIST = "RADIOLOGIST"
    RECEPTIONIST = "RECEPTIONIST"
    PATIENT = "PATIENT"


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    lab_id = Column(String(36), ForeignKey("laboratories.id", ondelete="CASCADE"), nullable=True, index=True)
    role = Column(SQLEnum(UserRole), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(32), nullable=True)
    avatar_url = Column(Text, nullable=True)
    medical_license_number = Column(String(100), nullable=True)
    qualifications = Column(String(255), nullable=True)
    signature_image_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    laboratory = relationship("Laboratory", back_populates="users")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
