from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = None
    role: UserRole
    medical_license_number: Optional[str] = None
    qualifications: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    lab_id: Optional[str] = None  # Injected or validated by backend dependency


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    medical_license_number: Optional[str] = None
    qualifications: Optional[str] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None
    signature_image_url: Optional[str] = None


class UserResponse(UserBase):
    id: str
    lab_id: Optional[str] = None
    avatar_url: Optional[str] = None
    signature_image_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool

