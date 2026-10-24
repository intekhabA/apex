import os
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_super_admin
from app.core.security import get_password_hash
from app.core.constants import COMMON_TEST_CODES
from app.models.laboratory import Laboratory, LaboratorySettings
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.test import Test, TestCategory, LabTestPrice
from app.models.imaging_template import ImagingTemplate
from app.schemas.common import APIResponse, MessageResponse, paginate_meta
from app.schemas.laboratory import (
    LaboratoryCreate,
    LaboratoryUpdate,
    LaboratoryResponse,
    LaboratoryDetailResponse,
    LaboratoryStatusUpdate,
    LaboratorySettingsResponse,
    LaboratorySettingsUpdate,
)
from app.schemas.user import UserResponse
from app.schemas.dashboard import SuperAdminDashboardResponse
from app.schemas.test import (
    LabAssignTestsPayload,
    LabUnassignTestsPayload,
    LabTestAssignmentItem,
    LabTestAssignmentUpdate,
)
from app.schemas.imaging import (
    ImagingTemplateCreate,
    ImagingTemplateUpdate,
    ImagingTemplateResponse,
)
from app.services.audit_service import AuditService
from app.services.dashboard_service import DashboardService
from app.services.storage_service import storage_service


router = APIRouter(prefix="/admin", tags=["Super Admin Platform Management"])


@router.get("/laboratories", response_model=APIResponse[List[LaboratoryResponse]])
async def list_laboratories(
    search: Optional[str] = Query(None, description="Search by name, code, city, or email"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: Optional[int] = Query(20, ge=1, le=500, description="Items per page"),
    all: bool = Query(False, description="Fetch all without pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List all onboarded diagnostic laboratories with filtering and search."""
    query = select(Laboratory).where(Laboratory.deleted_at.is_(None))
    count_query = select(func.count(Laboratory.id)).where(Laboratory.deleted_at.is_(None))

    if is_active is not None:
        query = query.where(Laboratory.is_active == is_active)
        count_query = count_query.where(Laboratory.is_active == is_active)

    if search:
        term = f"%{search}%"
        search_filter = or_(
            Laboratory.name.ilike(term),
            Laboratory.code.ilike(term),
            Laboratory.city.ilike(term),
            Laboratory.email.ilike(term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(Laboratory.created_at.desc())
    if not all and limit:
        query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    labs = result.scalars().all()

    effective_limit = limit if (not all and limit) else (total or 20)
    meta = paginate_meta(page=page, limit=effective_limit, total=total)

    return APIResponse(
        success=True,
        message=f"Retrieved {len(labs)} laboratories.",
        data=[LaboratoryResponse.model_validate(lab) for lab in labs],
        meta=meta,
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
        show_report_header_status=True,
        show_qr_side_text=True,
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

    # 6. Assign Default Common Diagnostic Tests to the Lab
    common_tests_res = await db.execute(
        select(Test).where(Test.code.in_(COMMON_TEST_CODES), Test.is_active == True)
    )
    for ct in common_tests_res.scalars().all():
        db.add(
            LabTestPrice(
                lab_id=lab.id,
                test_id=ct.id,
                custom_price=ct.default_price,
                discount_percentage=Decimal("0.00"),
                is_available=True,
            )
        )

    await db.commit()
    await db.refresh(lab)

    # 7. Audit Trail
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


@router.get("/laboratories/{lab_id}/settings", response_model=APIResponse[LaboratorySettingsResponse])
async def get_laboratory_settings_superadmin(
    lab_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Retrieve full configuration and report settings of a laboratory for Super Admin."""
    res = await db.execute(select(LaboratorySettings).where(LaboratorySettings.lab_id == lab_id))
    settings = res.scalar_one_or_none()
    if not settings:
        settings = LaboratorySettings(lab_id=lab_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return APIResponse(
        success=True,
        message="Laboratory settings retrieved.",
        data=LaboratorySettingsResponse.model_validate(settings),
    )


@router.put("/laboratories/{lab_id}/settings", response_model=APIResponse[LaboratorySettingsResponse])
async def update_laboratory_settings_superadmin(
    lab_id: str,
    payload: LaboratorySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update laboratory report formatting, header/QR toggles, and specifications by Super Admin."""
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    res = await db.execute(select(LaboratorySettings).where(LaboratorySettings.lab_id == lab_id))
    settings = res.scalar_one_or_none()
    if not settings:
        settings = LaboratorySettings(lab_id=lab_id)
        db.add(settings)

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(settings, field, val)

    await db.commit()
    await db.refresh(settings)

    return APIResponse(
        success=True,
        message=f"Settings for laboratory '{lab.name}' updated successfully.",
        data=LaboratorySettingsResponse.model_validate(settings),
    )


@router.post("/laboratories/{lab_id}/letterhead", response_model=APIResponse[LaboratorySettingsResponse])
async def upload_laboratory_letterhead_superadmin(
    lab_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Upload custom background letterhead image for a laboratory by Super Admin."""
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Letterhead image must be under 10 MB.")

    res = await db.execute(select(LaboratorySettings).where(LaboratorySettings.lab_id == lab_id))
    settings = res.scalar_one_or_none()
    if not settings:
        settings = LaboratorySettings(lab_id=lab_id)
        db.add(settings)

    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        ext = ".png"

    rel_path = f"letterheads/labs/{lab_id}/letterhead{ext}"
    stored_path = await storage_service.save_file_bytes(
        file_bytes=contents,
        rel_path=rel_path,
        content_type=file.content_type or "image/png",
    )
    settings.letterhead_image_url = stored_path
    settings.use_letterhead_background = True
    await db.commit()
    await db.refresh(settings)

    return APIResponse(
        success=True,
        message=f"Letterhead image for '{lab.name}' uploaded successfully.",
        data=LaboratorySettingsResponse.model_validate(settings),
    )


@router.delete("/laboratories/{lab_id}/letterhead", response_model=APIResponse[LaboratorySettingsResponse])
async def delete_laboratory_letterhead_superadmin(
    lab_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Remove custom background letterhead image for a laboratory by Super Admin."""
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    res = await db.execute(select(LaboratorySettings).where(LaboratorySettings.lab_id == lab_id))
    settings = res.scalar_one_or_none()
    if settings and settings.letterhead_image_url:
        try:
            await storage_service.delete_file(settings.letterhead_image_url)
        except Exception:
            pass
        settings.letterhead_image_url = None
        await db.commit()
        await db.refresh(settings)

    return APIResponse(
        success=True,
        message=f"Letterhead image for '{lab.name}' removed successfully.",
        data=LaboratorySettingsResponse.model_validate(settings) if settings else None,
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


# =========================================================================
# Laboratory Test Catalog Assignment & Custom Pricing (Super Admin)
# =========================================================================

@router.get("/laboratories/{lab_id}/tests", response_model=APIResponse[List[LabTestAssignmentItem]])
async def list_laboratory_assigned_tests(
    lab_id: str,
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Filter by test code or name"),
    assigned_only: Optional[bool] = Query(None, description="Filter by assignment status: True=assigned, False=unassigned"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List diagnostic tests with lab assignment status and custom pricing for Super Admin management."""
    # Verify laboratory exists
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    # 1. Fetch all active catalog tests
    test_query = (
        select(Test)
        .options(selectinload(Test.category))
        .where(Test.is_active == True)
    )
    if category_id:
        test_query = test_query.where(Test.category_id == category_id)
    if search:
        term = f"%{search}%"
        test_query = test_query.where(or_(Test.name.ilike(term), Test.code.ilike(term), Test.short_name.ilike(term)))

    test_query = test_query.order_by(Test.name.asc())
    tests_res = await db.execute(test_query)
    tests = tests_res.scalars().all()

    # 2. Fetch all assignments/overrides for this lab
    lp_res = await db.execute(select(LabTestPrice).where(LabTestPrice.lab_id == lab_id))
    lp_map = {lp.test_id: lp for lp in lp_res.scalars().all()}

    output = []
    for t in tests:
        lp = lp_map.get(t.id)
        is_assigned = lp is not None
        if assigned_only is not None and is_assigned != assigned_only:
            continue

        item = LabTestAssignmentItem(
            id=str(lp.id) if lp else str(t.id),
            test_id=str(t.id),
            code=t.code,
            name=t.name,
            short_name=t.short_name,
            category_id=str(t.category_id),
            category_name=t.category.name if t.category else None,
            test_type=t.test_type,
            sample_type=t.sample_type,
            sample_container=t.sample_container,
            turnaround_hours=t.turnaround_hours,
            default_price=t.default_price,
            custom_price=lp.custom_price if lp else None,
            discount_percentage=lp.discount_percentage if lp else Decimal("0.00"),
            is_assigned=is_assigned,
            is_available=lp.is_available if lp else True,
            is_common=t.code in COMMON_TEST_CODES,
        )
        output.append(item)

    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} test items for laboratory '{lab.name}'.",
        data=output,
    )


@router.post("/laboratories/{lab_id}/tests/assign", response_model=APIResponse[dict])
async def assign_tests_to_laboratory(
    lab_id: str,
    payload: LabAssignTestsPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Assign one or more diagnostic tests to a laboratory (Super Admin only)."""
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    if not payload.test_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No test IDs provided.")

    # Fetch tests to assign
    tests_res = await db.execute(select(Test).where(Test.id.in_(payload.test_ids)))
    tests = {t.id: t for t in tests_res.scalars().all()}

    # Fetch existing assignments
    existing_res = await db.execute(
        select(LabTestPrice).where(LabTestPrice.lab_id == lab_id, LabTestPrice.test_id.in_(payload.test_ids))
    )
    existing_map = {lp.test_id: lp for lp in existing_res.scalars().all()}

    new_count = 0
    updated_count = 0

    for tid, test in tests.items():
        price = payload.custom_price if payload.custom_price is not None else test.default_price
        if tid in existing_map:
            lp = existing_map[tid]
            lp.is_available = True
            if payload.custom_price is not None:
                lp.custom_price = payload.custom_price
            updated_count += 1
        else:
            db.add(
                LabTestPrice(
                    lab_id=lab_id,
                    test_id=tid,
                    custom_price=price,
                    discount_percentage=Decimal("0.00"),
                    is_available=True,
                )
            )
            new_count += 1

    await db.commit()

    return APIResponse(
        success=True,
        message=f"Successfully assigned {new_count} tests ({updated_count} re-activated) to '{lab.name}'.",
        data={"assigned_count": new_count + updated_count, "new_count": new_count},
    )


@router.post("/laboratories/{lab_id}/tests/unassign", response_model=APIResponse[dict])
async def unassign_tests_from_laboratory(
    lab_id: str,
    payload: LabUnassignTestsPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Unassign one or more diagnostic tests from a laboratory (Super Admin only)."""
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    if not payload.test_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No test IDs provided.")

    del_res = await db.execute(
        delete(LabTestPrice).where(
            LabTestPrice.lab_id == lab_id,
            LabTestPrice.test_id.in_(payload.test_ids),
        )
    )
    await db.commit()

    return APIResponse(
        success=True,
        message=f"Successfully unassigned tests from '{lab.name}'.",
        data={"unassigned_count": del_res.rowcount},
    )


@router.post("/laboratories/{lab_id}/tests/assign-common", response_model=APIResponse[dict])
async def assign_common_tests_to_laboratory(
    lab_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Assign all default common diagnostic tests to a laboratory (Super Admin only)."""
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    # Find common tests
    common_res = await db.execute(
        select(Test).where(Test.code.in_(COMMON_TEST_CODES), Test.is_active == True)
    )
    common_tests = common_res.scalars().all()

    existing_res = await db.execute(
        select(LabTestPrice.test_id).where(LabTestPrice.lab_id == lab_id)
    )
    existing_ids = set(existing_res.scalars().all())

    assigned_count = 0
    for ct in common_tests:
        if ct.id not in existing_ids:
            db.add(
                LabTestPrice(
                    lab_id=lab_id,
                    test_id=ct.id,
                    custom_price=ct.default_price,
                    discount_percentage=Decimal("0.00"),
                    is_available=True,
                )
            )
            assigned_count += 1

    await db.commit()

    return APIResponse(
        success=True,
        message=f"Assigned {assigned_count} common tests to '{lab.name}' (Total common tests: {len(common_tests)}).",
        data={"newly_assigned": assigned_count, "total_common": len(common_tests)},
    )


@router.put("/laboratories/{lab_id}/tests/{test_id}", response_model=APIResponse[LabTestAssignmentItem])
async def update_laboratory_test_assignment(
    lab_id: str,
    test_id: str,
    payload: LabTestAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update custom pricing, discount, or availability for an assigned test in a laboratory."""
    lab_res = await db.execute(select(Laboratory).where(Laboratory.id == lab_id, Laboratory.deleted_at.is_(None)))
    lab = lab_res.scalar_one_or_none()
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found.")

    test_res = await db.execute(
        select(Test).options(selectinload(Test.category)).where(Test.id == test_id)
    )
    test = test_res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found.")

    lp_res = await db.execute(
        select(LabTestPrice).where(LabTestPrice.lab_id == lab_id, LabTestPrice.test_id == test_id)
    )
    lp = lp_res.scalar_one_or_none()

    if not lp:
        # Create assignment if updating
        custom_price = payload.custom_price if payload.custom_price is not None else test.default_price
        lp = LabTestPrice(
            lab_id=lab_id,
            test_id=test_id,
            custom_price=custom_price,
            discount_percentage=payload.discount_percentage if payload.discount_percentage is not None else Decimal("0.00"),
            is_available=payload.is_available if payload.is_available is not None else True,
        )
        db.add(lp)
    else:
        if payload.custom_price is not None:
            lp.custom_price = payload.custom_price
        if payload.discount_percentage is not None:
            lp.discount_percentage = payload.discount_percentage
        if payload.is_available is not None:
            lp.is_available = payload.is_available

    await db.commit()
    await db.refresh(lp)

    return APIResponse(
        success=True,
        message=f"Updated test assignment for '{test.name}'.",
        data=LabTestAssignmentItem(
            id=str(lp.id),
            test_id=str(test.id),
            code=test.code,
            name=test.name,
            short_name=test.short_name,
            category_id=str(test.category_id),
            category_name=test.category.name if test.category else None,
            test_type=test.test_type,
            sample_type=test.sample_type,
            sample_container=test.sample_container,
            turnaround_hours=test.turnaround_hours,
            default_price=test.default_price,
            custom_price=lp.custom_price,
            discount_percentage=lp.discount_percentage,
            is_assigned=True,
            is_available=lp.is_available,
            is_common=test.code in COMMON_TEST_CODES,
        ),
    )


# =========================================================================
# IMAGING & RADIOLOGY REPORTING TEMPLATES (SUPER ADMIN)
# =========================================================================

@router.get("/imaging-templates", response_model=APIResponse[List[ImagingTemplateResponse]])
async def list_admin_imaging_templates(
    search: Optional[str] = Query(None, description="Search by name, code, or findings"),
    modality: Optional[str] = Query(None, description="Filter by modality (USG, X-RAY, CT, MRI, etc.)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List all imaging templates across the platform for Super Admin management."""
    from app.api.routes.imaging import ensure_imaging_templates_seeded
    await ensure_imaging_templates_seeded(db)

    query = select(ImagingTemplate).options(selectinload(ImagingTemplate.test)).order_by(
        ImagingTemplate.display_order.asc(), ImagingTemplate.name.asc()
    )

    if modality:
        query = query.where(ImagingTemplate.modality == modality.upper())
    if is_active is not None:
        query = query.where(ImagingTemplate.is_active == is_active)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                ImagingTemplate.name.ilike(term),
                ImagingTemplate.code.ilike(term),
                ImagingTemplate.findings_template.ilike(term),
                ImagingTemplate.impression_template.ilike(term),
            )
        )

    res = await db.execute(query)
    templates = res.scalars().all()

    data = [
        ImagingTemplateResponse(
            id=str(t.id),
            code=t.code,
            name=t.name,
            modality=t.modality,
            test_id=str(t.test_id) if t.test_id else None,
            test_name=t.test.name if t.test else None,
            test_code=t.test.code if t.test else None,
            clinical_history_template=t.clinical_history_template or "",
            findings_template=t.findings_template,
            impression_template=t.impression_template or "",
            recommendations_template=t.recommendations_template or "",
            is_active=t.is_active,
            display_order=t.display_order,
            lab_id=str(t.lab_id) if t.lab_id else None,
            is_custom=bool(t.lab_id),
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in templates
    ]

    return APIResponse(
        success=True,
        message=f"Retrieved {len(data)} imaging templates.",
        data=data,
    )


@router.post("/imaging-templates", response_model=APIResponse[ImagingTemplateResponse], status_code=status.HTTP_201_CREATED)
async def create_imaging_template(
    payload: ImagingTemplateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Create a new standardized clinical imaging / radiology reporting template."""
    code_clean = payload.code.strip().upper()
    existing_res = await db.execute(
        select(ImagingTemplate).where(func.upper(ImagingTemplate.code) == code_clean)
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An imaging template with code '{code_clean}' already exists.",
        )

    test_obj = None
    if payload.test_id:
        test_res = await db.execute(select(Test).where(Test.id == payload.test_id))
        test_obj = test_res.scalar_one_or_none()
        if not test_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Linked test with ID '{payload.test_id}' not found.",
            )

    template = ImagingTemplate(
        code=code_clean,
        name=payload.name.strip(),
        modality=payload.modality.strip().upper(),
        test_id=payload.test_id,
        clinical_history_template=payload.clinical_history_template,
        findings_template=payload.findings_template,
        impression_template=payload.impression_template,
        recommendations_template=payload.recommendations_template,
        is_active=payload.is_active,
        display_order=payload.display_order,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    await AuditService.log_event(
        db=db,
        action="CREATE_IMAGING_TEMPLATE",
        entity_name="imaging_templates",
        entity_id=str(template.id),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        after_state={"code": template.code, "name": template.name, "modality": template.modality},
    )

    return APIResponse(
        success=True,
        message=f"Imaging template '{template.name}' created successfully.",
        data=ImagingTemplateResponse(
            id=str(template.id),
            code=template.code,
            name=template.name,
            modality=template.modality,
            test_id=str(template.test_id) if template.test_id else None,
            test_name=test_obj.name if test_obj else None,
            test_code=test_obj.code if test_obj else None,
            clinical_history_template=template.clinical_history_template or "",
            findings_template=template.findings_template,
            impression_template=template.impression_template or "",
            recommendations_template=template.recommendations_template or "",
            is_active=template.is_active,
            display_order=template.display_order,
            lab_id=str(template.lab_id) if template.lab_id else None,
            is_custom=bool(template.lab_id),
            created_at=template.created_at,
            updated_at=template.updated_at,
        ),
    )


@router.get("/imaging-templates/{template_id}", response_model=APIResponse[ImagingTemplateResponse])
async def get_imaging_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Retrieve details of a single imaging template."""
    res = await db.execute(
        select(ImagingTemplate)
        .options(selectinload(ImagingTemplate.test))
        .where(or_(ImagingTemplate.id == template_id, ImagingTemplate.code == template_id))
    )
    template = res.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging template not found.")

    return APIResponse(
        success=True,
        message="Imaging template retrieved.",
        data=ImagingTemplateResponse(
            id=str(template.id),
            code=template.code,
            name=template.name,
            modality=template.modality,
            test_id=str(template.test_id) if template.test_id else None,
            test_name=template.test.name if template.test else None,
            test_code=template.test.code if template.test else None,
            clinical_history_template=template.clinical_history_template or "",
            findings_template=template.findings_template,
            impression_template=template.impression_template or "",
            recommendations_template=template.recommendations_template or "",
            is_active=template.is_active,
            display_order=template.display_order,
            lab_id=str(template.lab_id) if template.lab_id else None,
            is_custom=bool(template.lab_id),
            created_at=template.created_at,
            updated_at=template.updated_at,
        ),
    )


@router.put("/imaging-templates/{template_id}", response_model=APIResponse[ImagingTemplateResponse])
async def update_imaging_template(
    template_id: str,
    payload: ImagingTemplateUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update an existing imaging reporting template."""
    res = await db.execute(
        select(ImagingTemplate)
        .options(selectinload(ImagingTemplate.test))
        .where(or_(ImagingTemplate.id == template_id, ImagingTemplate.code == template_id))
    )
    template = res.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging template not found.")

    if payload.code is not None:
        code_clean = payload.code.strip().upper()
        if code_clean != template.code.upper():
            existing = await db.execute(
                select(ImagingTemplate).where(
                    func.upper(ImagingTemplate.code) == code_clean,
                    ImagingTemplate.id != template.id,
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Another template with code '{code_clean}' already exists.",
                )
            template.code = code_clean

    test_obj = template.test
    if payload.test_id is not None:
        if payload.test_id == "":
            template.test_id = None
            test_obj = None
        else:
            test_res = await db.execute(select(Test).where(Test.id == payload.test_id))
            test_obj = test_res.scalar_one_or_none()
            if not test_obj:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked test not found.")
            template.test_id = payload.test_id

    if payload.name is not None:
        template.name = payload.name.strip()
    if payload.modality is not None:
        template.modality = payload.modality.strip().upper()
    if payload.clinical_history_template is not None:
        template.clinical_history_template = payload.clinical_history_template
    if payload.findings_template is not None:
        template.findings_template = payload.findings_template
    if payload.impression_template is not None:
        template.impression_template = payload.impression_template
    if payload.recommendations_template is not None:
        template.recommendations_template = payload.recommendations_template
    if payload.is_active is not None:
        template.is_active = payload.is_active
    if payload.display_order is not None:
        template.display_order = payload.display_order

    await db.commit()
    await db.refresh(template)

    await AuditService.log_event(
        db=db,
        action="UPDATE_IMAGING_TEMPLATE",
        entity_name="imaging_templates",
        entity_id=str(template.id),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        after_state={"code": template.code, "name": template.name, "modality": template.modality},
    )

    return APIResponse(
        success=True,
        message=f"Imaging template '{template.name}' updated successfully.",
        data=ImagingTemplateResponse(
            id=str(template.id),
            code=template.code,
            name=template.name,
            modality=template.modality,
            test_id=str(template.test_id) if template.test_id else None,
            test_name=test_obj.name if test_obj else None,
            test_code=test_obj.code if test_obj else None,
            clinical_history_template=template.clinical_history_template or "",
            findings_template=template.findings_template,
            impression_template=template.impression_template or "",
            recommendations_template=template.recommendations_template or "",
            is_active=template.is_active,
            display_order=template.display_order,
            lab_id=str(template.lab_id) if template.lab_id else None,
            is_custom=bool(template.lab_id),
            created_at=template.created_at,
            updated_at=template.updated_at,
        ),
    )


@router.delete("/imaging-templates/{template_id}", response_model=MessageResponse)
async def delete_imaging_template(
    template_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Delete an imaging reporting template."""
    res = await db.execute(
        select(ImagingTemplate).where(or_(ImagingTemplate.id == template_id, ImagingTemplate.code == template_id))
    )
    template = res.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imaging template not found.")

    template_name = template.name
    template_id_str = str(template.id)

    await db.delete(template)
    await db.commit()

    await AuditService.log_event(
        db=db,
        action="DELETE_IMAGING_TEMPLATE",
        entity_name="imaging_templates",
        entity_id=template_id_str,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        after_state={"name": template_name},
    )

    return MessageResponse(
        success=True,
        message=f"Imaging template '{template_name}' has been deleted.",
    )


