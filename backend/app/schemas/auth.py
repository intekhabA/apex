from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserProfileResponse(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    medical_license_number: Optional[str] = None
    qualifications: Optional[str] = None
    signature_image_url: Optional[str] = None
    lab_id: Optional[str] = None
    lab_name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class LoginSuccessData(BaseModel):
    user: UserProfileResponse
    tokens: TokenResponse


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
