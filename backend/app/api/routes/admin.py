from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_super_admin
from app.core.security import get_password_hash
from app.models.laboratory import Laboratory, LaboratorySettings
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.test import Test
from app.schemas.common import APIResponse
from app.schemas.laboratory import (
    LaboratoryCreate,
    LaboratoryUpdate,
    LaboratoryResponse,
    LaboratoryDetailResponse,
    LaboratoryStatusUpdate,
    LaboratorySettingsResponse,
)
from app.schemas.user import UserResponse
from app.schemas.dashboard import SuperAdminDashboardResponse
from app.services.audit_service import AuditService
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/admin", tags=["Super Admin Platform Management"])


@router.get("/laboratories", response_model=APIResponse[List[LaboratoryResponse]])
async def list_laboratories(
    search: Optional[str] = Query(None, description="Search by name, code, city, or email"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List all onboarded diagnostic laboratories with filtering and search."""
    query = select(Laboratory).where(Laboratory.deleted_at.is_(None))

    if is_active is not None:
        query = query.where(Laboratory.is_active == is_active)

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Laboratory.name.ilike(term),
                Laboratory.code.ilike(term),
                Laboratory.city.ilike(term),
                Laboratory.email.ilike(term),
            )
        )

    query = query.order_by(Laboratory.created_at.desc())
    result = await db.execute(query)
    labs = result.scalars().all()

    return APIResponse(
        success=True,
        message=f"Retrieved {len(labs)} laboratories.",
        data=[LaboratoryResponse.model_validate(lab) for lab in labs],
    )


@router.post("/laboratories", response_model=APIResponse[LaboratoryResponse], status_code=status.HTTP_201_CREATED)
async def onboard_laboratory(
    request: Request,
    payload: LaboratoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Onboard a new laboratory: creates the lab entity, default settings, and initial Lab Admin user."""
    # 1. Validate laboratory code uniqueness
    existing_code = await db.execute(
        select(Laboratory).where(Laboratory.code == payload.code.upper(), Laboratory.deleted_at.is_(None))
    )
    if existing_code.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Laboratory with code '{payload.code.upper()}' already exists.",
        )

    # 2. Validate initial admin email uniqueness
    existing_user = await db.execute(
        select(User).where(User.email == payload.initial_admin_email, User.deleted_at.is_(None))
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.initial_admin_email}' already exists.",
        )

    # 3. Create Laboratory
    lab = Laboratory(
        code=payload.code.upper(),
        name=payload.name,
        legal_name=payload.legal_name or payload.name,
        registration_number=payload.registration_number,
        tax_identifier=payload.tax_identifier,
        email=payload.email,
        phone=payload.phone,
        website=payload.website,
        address_street=payload.address_street,
        city=payload.city,
        state=payload.state,
        postal_code=payload.postal_code,
        country=payload.country,
        logo_url=payload.logo_url,
        subscription_plan=payload.subscription_plan,
        is_active=True,
    )
    db.add(lab)
    await db.flush()

    # 4. Create Default Laboratory Settings
    settings = LaboratorySettings(
        lab_id=lab.id,
        report_disclaimer=(
            "This is an electronically generated diagnostic report. No physical signature is required. "
            "Results relate only to the specimen tested."
        ),
        currency_code="INR",
        currency_symbol="₹",
        default_tax_rate=0.00,
        enable_qr_verification=True,
        primary_color_hex="#0284c7",
        secondary_color_hex="#0f172a",
        default_signatory_name=f"{payload.initial_admin_first_name} {payload.initial_admin_last_name}",
        default_signatory_designation="Laboratory Director",
    )
    db.add(settings)

    # 5. Create Initial Lab Admin User
    admin_user = User(
        lab_id=lab.id,
        email=payload.initial_admin_email,
        hashed_password=get_password_hash(payload.initial_admin_password),
        first_name=payload.initial_admin_first_name,
        last_name=payload.initial_admin_last_name,
        phone=payload.phone,
        role=UserRole.LAB_ADMIN,
        is_active=True,
        is_verified=True,
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(lab)

    # 6. Audit Trail
    await AuditService.log_event(
        db=db,
        action="ONBOARD_LABORATORY",
        entity_name="laboratories",
        entity_id=lab.id,
        lab_id=lab.id,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        after_state={"code": lab.code, "name": lab.name, "admin_email": payload.initial_admin_email},
    )

    return APIResponse(
        success=True,
        message=f"Laboratory '{lab.name}' successfully onboarded with administrator '{admin_user.email}'.",
        data=LaboratoryResponse.model_validate(lab),
    )


@router.get("/laboratories/{lab_id}", response_model=APIResponse[LaboratoryDetailResponse])
async def get_laboratory(
    lab_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Retrieve detailed profile of a laboratory including settings and staff headcount."""
    res = await db.execute(
        select(Laboratory)
        .options(selectinload(Laboratory.settings))
        .where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None))
    )
    lab = res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    staff_count_res = await db.execute(
        select(func.count(User.id)).where(User.lab_id == lab_id, User.deleted_at.is_(None))
    )
    staff_count = staff_count_res.scalar() or 0

    detail = LaboratoryDetailResponse(
        id=str(lab.id),
        name=lab.name,
        code=lab.code,
        legal_name=lab.legal_name,
        registration_number=lab.registration_number,
        tax_identifier=lab.tax_identifier,
        email=lab.email,
        phone=lab.phone,
        website=lab.website,
        address_street=lab.address_street,
        city=lab.city,
        state=lab.state,
        postal_code=lab.postal_code,
        country=lab.country,
        logo_url=lab.logo_url,
        subscription_plan=lab.subscription_plan,
        subscription_expires_at=lab.subscription_expires_at,
        is_active=lab.is_active,
        created_at=lab.created_at,
        updated_at=lab.updated_at,
        settings=LaboratorySettingsResponse.model_validate(lab.settings) if lab.settings else None,
        staff_count=staff_count,
    )

    return APIResponse(
        success=True,
        message="Laboratory retrieved successfully.",
        data=detail,
    )


@router.put("/laboratories/{lab_id}", response_model=APIResponse[LaboratoryResponse])
async def update_laboratory(
    lab_id: str,
    payload: LaboratoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update profile and configuration of a laboratory."""
    res = await db.execute(
        select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None))
    )
    lab = res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(lab, field, val)

    await db.commit()
    await db.refresh(lab)

    return APIResponse(
        success=True,
        message=f"Laboratory '{lab.name}' updated successfully.",
        data=LaboratoryResponse.model_validate(lab),
    )


@router.patch("/laboratories/{lab_id}/status", response_model=APIResponse[LaboratoryResponse])
async def update_laboratory_status(
    lab_id: str,
    payload: LaboratoryStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Activate or suspend laboratory tenant access."""
    res = await db.execute(
        select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None))
    )
    lab = res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    lab.is_active = payload.is_active
    await db.commit()
    await db.refresh(lab)

    status_str = "activated" if payload.is_active else "suspended"
    return APIResponse(
        success=True,
        message=f"Laboratory '{lab.name}' has been {status_str}.",
        data=LaboratoryResponse.model_validate(lab),
    )


@router.get("/laboratories/{lab_id}/staff", response_model=APIResponse[List[UserResponse]])
async def list_laboratory_staff(
    lab_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List all staff users assigned to a specific laboratory."""
    res = await db.execute(
        select(User).where(User.lab_id == lab_id, User.deleted_at.is_(None)).order_by(User.created_at.desc())
    )
    staff = res.scalars().all()

    return APIResponse(
        success=True,
        message=f"Retrieved {len(staff)} staff members for laboratory.",
        data=[UserResponse.model_validate(u) for u in staff],
    )


@router.get("/dashboard", response_model=APIResponse[SuperAdminDashboardResponse])
async def get_super_admin_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Aggregate comprehensive global KPIs, lab growth, and revenue analytics for Super Admin overview."""
    data = await DashboardService.get_super_admin_dashboard_data(db)
    return APIResponse(
        success=True,
        message="Super admin dashboard KPIs retrieved successfully.",
        data=data,
    )
