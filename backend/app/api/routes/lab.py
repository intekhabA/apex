import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_lab_admin, require_lab_staff, verify_tenant_access
from app.core.security import get_password_hash
from app.models.laboratory import Laboratory, LaboratorySettings
from app.models.user import User, UserRole
from app.schemas.common import APIResponse
from app.schemas.laboratory import (
    LaboratoryResponse,
    LaboratoryUpdate,
    LaboratorySettingsResponse,
    LaboratorySettingsUpdate,
)
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserStatusUpdate
from app.schemas.dashboard import LabDashboardResponse
from app.services.audit_service import AuditService
from app.services.dashboard_service import DashboardService
from app.services.storage_service import storage_service

router = APIRouter(prefix="/lab", tags=["Laboratory Management & Settings"])


@router.get("/profile", response_model=APIResponse[LaboratoryResponse])
async def get_lab_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve profile and branding details of the active laboratory."""
    if not current_user.lab_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current account is not associated with any laboratory.",
        )

    res = await db.execute(
        select(Laboratory).where(Laboratory.id == current_user.lab_id, Laboratory.deleted_at.is_(None))
    )
    lab = res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    return APIResponse(
        success=True,
        message="Laboratory profile retrieved successfully.",
        data=LaboratoryResponse.model_validate(lab),
    )


@router.put("/profile", response_model=APIResponse[LaboratoryResponse])
async def update_lab_profile(
    payload: LaboratoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Update active laboratory details (contact, address, branding)."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    res = await db.execute(
        select(Laboratory).where(Laboratory.id == current_user.lab_id, Laboratory.deleted_at.is_(None))
    )
    lab = res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    # Lab Admin cannot change their own subscription plan or active status through this endpoint
    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("subscription_plan", None)
    update_data.pop("is_active", None)

    for field, val in update_data.items():
        setattr(lab, field, val)

    await db.commit()
    await db.refresh(lab)

    return APIResponse(
        success=True,
        message="Laboratory profile updated successfully.",
        data=LaboratoryResponse.model_validate(lab),
    )


@router.get("/settings", response_model=APIResponse[LaboratorySettingsResponse])
async def get_lab_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve laboratory configuration, report headers, signatories, and disclaimers."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    res = await db.execute(
        select(LaboratorySettings).where(LaboratorySettings.lab_id == current_user.lab_id)
    )
    settings = res.scalar_one_or_none()
    if not settings:
        # Create default settings if not yet existing
        settings = LaboratorySettings(lab_id=current_user.lab_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return APIResponse(
        success=True,
        message="Laboratory settings retrieved.",
        data=LaboratorySettingsResponse.model_validate(settings),
    )


@router.put("/settings", response_model=APIResponse[LaboratorySettingsResponse])
async def update_lab_settings(
    payload: LaboratorySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Configure report templates, signatory credentials, tax rates, and disclaimers."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    res = await db.execute(
        select(LaboratorySettings).where(LaboratorySettings.lab_id == current_user.lab_id)
    )
    settings = res.scalar_one_or_none()
    if not settings:
        settings = LaboratorySettings(lab_id=current_user.lab_id)
        db.add(settings)

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(settings, field, val)

    await db.commit()
    await db.refresh(settings)

    return APIResponse(
        success=True,
        message="Laboratory settings updated successfully.",
        data=LaboratorySettingsResponse.model_validate(settings),
    )


@router.post("/signature", response_model=APIResponse[LaboratorySettingsResponse])
async def upload_lab_default_signature(
    file: UploadFile = File(...),
    current_user: User = Depends(require_lab_admin),
    db: AsyncSession = Depends(get_db),
):
    """Upload laboratory certified signatory signature image."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    contents = await file.read()
    if len(contents) > 3 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Signature image must be under 3 MB.")

    res = await db.execute(select(LaboratorySettings).where(LaboratorySettings.lab_id == current_user.lab_id))
    settings = res.scalar_one_or_none()
    if not settings:
        settings = LaboratorySettings(lab_id=current_user.lab_id)
        db.add(settings)

    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        ext = ".png"

    rel_path = f"signatures/labs/{current_user.lab_id}/default_signatory{ext}"
    stored_path = await storage_service.save_file_bytes(
        file_bytes=contents,
        rel_path=rel_path,
        content_type=file.content_type or "image/png",
    )
    settings.default_signatory_signature_url = stored_path
    await db.commit()
    await db.refresh(settings)

    return APIResponse(
        success=True,
        message="Laboratory certified signatory signature uploaded successfully.",
        data=LaboratorySettingsResponse.model_validate(settings),
    )


@router.delete("/signature", response_model=APIResponse[LaboratorySettingsResponse])
async def delete_lab_default_signature(
    current_user: User = Depends(require_lab_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove laboratory custom signature and revert back to system default signature."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    res = await db.execute(select(LaboratorySettings).where(LaboratorySettings.lab_id == current_user.lab_id))
    settings = res.scalar_one_or_none()
    if settings and settings.default_signatory_signature_url:
        try:
            await storage_service.delete_file(settings.default_signatory_signature_url)
        except Exception:
            pass
        settings.default_signatory_signature_url = None
        await db.commit()
        await db.refresh(settings)

    return APIResponse(
        success=True,
        message="Laboratory signatory signature reset to default.",
        data=LaboratorySettingsResponse.model_validate(settings) if settings else LaboratorySettingsResponse(id="", lab_id=current_user.lab_id),
    )



@router.get("/users", response_model=APIResponse[List[UserResponse]])
async def list_lab_staff(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """List all staff users belonging strictly to the current authenticated laboratory."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    res = await db.execute(
        select(User)
        .where(User.lab_id == current_user.lab_id, User.deleted_at.is_(None))
        .order_by(User.created_at.desc())
    )
    staff = res.scalars().all()

    return APIResponse(
        success=True,
        message=f"Retrieved {len(staff)} staff members.",
        data=[UserResponse.model_validate(u) for u in staff],
    )


@router.post("/users", response_model=APIResponse[UserResponse], status_code=status.HTTP_201_CREATED)
async def create_lab_staff(
    request: Request,
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Provision a new staff user (Pathologist, Radiologist, Assistant, Receptionist) within this lab."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    # Lab Admin cannot create Super Admin accounts
    if payload.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Laboratory administrators cannot provision Super Admin platform roles.",
        )

    # Check email uniqueness
    existing_user = await db.execute(
        select(User).where(User.email == payload.email, User.deleted_at.is_(None))
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists.",
        )

    # Force tenancy scoping to caller's laboratory
    new_user = User(
        lab_id=current_user.lab_id,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        role=payload.role,
        medical_license_number=payload.medical_license_number,
        qualifications=payload.qualifications,
        is_active=True,
        is_verified=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Audit logging
    await AuditService.log_event(
        db=db,
        action="CREATE_STAFF_USER",
        entity_name="users",
        entity_id=new_user.id,
        lab_id=current_user.lab_id,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        after_state={"user_id": new_user.id, "email": new_user.email, "role": str(new_user.role)},
    )

    return APIResponse(
        success=True,
        message=f"Staff member '{new_user.full_name}' provisioned successfully.",
        data=UserResponse.model_validate(new_user),
    )


@router.get("/users/{user_id}", response_model=APIResponse[UserResponse])
async def get_lab_staff_member(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Retrieve details of a specific staff user within the current laboratory."""
    res = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff user not found.")

    verify_tenant_access(current_user, user.lab_id)

    return APIResponse(
        success=True,
        message="Staff member retrieved.",
        data=UserResponse.model_validate(user),
    )


@router.put("/users/{user_id}", response_model=APIResponse[UserResponse])
async def update_lab_staff_member(
    user_id: str,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Update profile and permissions for a staff member within the current laboratory."""
    res = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff user not found.")

    verify_tenant_access(current_user, user.lab_id)

    # Disallow escalating to SUPER_ADMIN
    if payload.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign Super Admin platform role.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(user, field, val)

    await db.commit()
    await db.refresh(user)

    return APIResponse(
        success=True,
        message=f"Staff user '{user.full_name}' updated successfully.",
        data=UserResponse.model_validate(user),
    )


@router.patch("/users/{user_id}/status", response_model=APIResponse[UserResponse])
async def update_lab_staff_status(
    user_id: str,
    payload: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Activate or deactivate a staff member's workstation access."""
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own administrative account.",
        )

    res = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff user not found.")

    verify_tenant_access(current_user, user.lab_id)

    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)

    action_str = "activated" if payload.is_active else "deactivated"
    return APIResponse(
        success=True,
        message=f"Staff user '{user.full_name}' has been {action_str}.",
        data=UserResponse.model_validate(user),
    )


@router.get("/dashboard", response_model=APIResponse[LabDashboardResponse])
async def get_lab_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve operational KPIs, sample throughput, pending reports, and daily financial metrics for the active laboratory."""
    if not current_user.lab_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current account is not associated with any active laboratory.",
        )

    data = await DashboardService.get_lab_dashboard_data(db, current_user.lab_id)
    return APIResponse(
        success=True,
        message="Laboratory operational dashboard metrics retrieved.",
        data=data,
    )
