import os
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, verify_password
from app.models.user import User
from app.models.laboratory import Laboratory
from app.schemas.common import APIResponse, MessageResponse
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserProfileResponse,
    LoginSuccessData,
    ChangePasswordRequest,
)
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.storage_service import storage_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=APIResponse[LoginSuccessData])
async def login(
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with user credentials and obtain JWT tokens."""
    data = await AuthService.authenticate_user(db, payload)

    # Log successful login in audit trail
    await AuditService.log_event(
        db=db,
        action="USER_LOGIN",
        entity_name="users",
        entity_id=data.user.id,
        lab_id=data.user.lab_id,
        user_id=data.user.id,
        user_email=data.user.email,
        user_role=data.user.role.value if hasattr(data.user.role, "value") else str(data.user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return APIResponse(
        success=True,
        message="Authentication successful.",
        data=data,
    )


@router.post("/refresh", response_model=APIResponse[TokenResponse])
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Obtain a new access token using a valid refresh token."""
    tokens = await AuthService.refresh_access_token(db, payload.refresh_token)
    return APIResponse(
        success=True,
        message="Access token rotated successfully.",
        data=tokens,
    )


@router.get("/me", response_model=APIResponse[UserProfileResponse])
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve currently authenticated user profile and laboratory context."""
    lab_name = None
    if current_user.lab_id:
        res = await db.execute(select(Laboratory).where(Laboratory.id == current_user.lab_id))
        lab = res.scalar_one_or_none()
        if lab:
            lab_name = lab.name

    user_profile = UserProfileResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=current_user.full_name,
        role=current_user.role,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        medical_license_number=current_user.medical_license_number,
        qualifications=current_user.qualifications,
        signature_image_url=current_user.signature_image_url,
        lab_id=str(current_user.lab_id) if current_user.lab_id else None,
        lab_name=lab_name,
        is_active=current_user.is_active,
    )

    return APIResponse(
        success=True,
        message="Profile retrieved successfully.",
        data=user_profile,
    )


@router.post("/change-password", response_model=APIResponse[MessageResponse])
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user password verifying previous password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password verification failed.",
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    return APIResponse(
        success=True,
        message="Password updated successfully.",
        data=MessageResponse(message="Password successfully changed."),
    )


@router.post("/logout", response_model=APIResponse[MessageResponse])
async def logout(
    current_user: User = Depends(get_current_user),
):
    """Invalidate client session."""
    return APIResponse(
        success=True,
        message="Logout successful.",
        data=MessageResponse(message="Session terminated."),
    )


@router.post("/signature", response_model=APIResponse[UserProfileResponse])
async def upload_user_signature(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload personal human signature image for doctor / pathologist diagnostic reports."""
    contents = await file.read()
    if len(contents) > 3 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signature image must be under 3 MB.",
        )

    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        ext = ".png"

    rel_path = f"signatures/users/{current_user.id}/signature{ext}"
    stored_path = await storage_service.save_file_bytes(
        file_bytes=contents,
        rel_path=rel_path,
        content_type=file.content_type or "image/png",
    )
    current_user.signature_image_url = stored_path
    await db.commit()
    await db.refresh(current_user)

    return await get_me(current_user=current_user, db=db)


@router.delete("/signature", response_model=APIResponse[UserProfileResponse])
async def delete_user_signature(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove custom signature and revert back to system default signature."""
    if current_user.signature_image_url:
        try:
            await storage_service.delete_file(current_user.signature_image_url)
        except Exception:
            pass
        current_user.signature_image_url = None
        await db.commit()
        await db.refresh(current_user)

    return await get_me(current_user=current_user, db=db)

