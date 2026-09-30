from datetime import datetime, timezone
from typing import Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User
from app.models.laboratory import Laboratory
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.schemas.auth import LoginRequest, TokenResponse, UserProfileResponse, LoginSuccessData


class AuthService:
    @staticmethod
    async def authenticate_user(db: AsyncSession, login_data: LoginRequest) -> LoginSuccessData:
        result = await db.execute(
            select(User).where(User.email == login_data.email.lower(), User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact your laboratory administrator.",
            )

        # Update last login timestamp
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)

        # Lookup laboratory name if tenant user
        lab_name = None
        if user.lab_id:
            lab_res = await db.execute(select(Laboratory).where(Laboratory.id == user.lab_id))
            lab = lab_res.scalar_one_or_none()
            if lab:
                if not lab.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your laboratory account is currently suspended. Please contact platform support.",
                    )
                lab_name = lab.name

        # Create JWT payload
        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "lab_id": str(user.lab_id) if user.lab_id else None,
            "lab_name": lab_name,
        }

        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token(token_payload)

        user_profile = UserProfileResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            full_name=user.full_name,
            role=user.role,
            phone=user.phone,
            avatar_url=user.avatar_url,
            medical_license_number=user.medical_license_number,
            qualifications=user.qualifications,
            signature_image_url=user.signature_image_url,
            lab_id=str(user.lab_id) if user.lab_id else None,
            lab_name=lab_name,
            is_active=user.is_active,
        )

        tokens = TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=3600,
        )

        return LoginSuccessData(user=user_profile, tokens=tokens)

    @staticmethod
    async def refresh_access_token(db: AsyncSession, refresh_token_str: str) -> TokenResponse:
        payload = decode_token(refresh_token_str)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type: Expected refresh token.",
            )

        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User inactive or does not exist.",
            )

        lab_name = None
        if user.lab_id:
            lab_res = await db.execute(select(Laboratory).where(Laboratory.id == user.lab_id))
            lab = lab_res.scalar_one_or_none()
            if lab:
                lab_name = lab.name

        new_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "lab_id": str(user.lab_id) if user.lab_id else None,
            "lab_name": lab_name,
        }

        new_access_token = create_access_token(new_payload)
        new_refresh_token = create_refresh_token(new_payload)

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=3600,
        )
