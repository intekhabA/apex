import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_lab_staff, require_lab_admin
from app.models.user import User
from app.models.doctor import Doctor, DoctorTestCommission
from app.models.test import Test
from app.schemas.common import APIResponse, MessageResponse
from app.schemas.doctor import (
    DoctorCreate,
    DoctorUpdate,
    DoctorResponse,
    DoctorTestCommissionItem,
    DoctorCommissionOverridesUpdate,
    DoctorCommissionReportResponse,
)
from app.services.commission_service import (
    get_doctor_commission_report,
    ensure_doctors_from_bookings,
)

router = APIRouter(tags=["Doctor Commissions & Management"])


# ============================================================================
# DOCTOR MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/doctors", response_model=APIResponse[List[DoctorResponse]])
async def list_doctors(
    search: Optional[str] = Query(None, description="Search by name, phone, or specialization"),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """List all referring doctors registered in the laboratory."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    # Auto sync historical doctors
    if current_user.lab_id:
        await ensure_doctors_from_bookings(db, current_user.lab_id)

    query = select(Doctor)
    if current_user.lab_id:
        query = query.where(Doctor.lab_id == current_user.lab_id)

    if is_active is not None:
        query = query.where(Doctor.is_active == is_active)

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            Doctor.name.ilike(term)
            | Doctor.phone.ilike(term)
            | Doctor.specialization.ilike(term)
            | Doctor.clinic_hospital_name.ilike(term)
        )

    query = query.order_by(Doctor.name.asc())
    res = await db.execute(query)
    doctors = res.scalars().all()

    return APIResponse(
        success=True,
        message=f"Retrieved {len(doctors)} doctors.",
        data=[DoctorResponse.model_validate(d) for d in doctors],
    )


@router.post("/doctors", response_model=APIResponse[DoctorResponse], status_code=status.HTTP_201_CREATED)
async def create_doctor(
    payload: DoctorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Register a new referring doctor with their baseline commission percentage."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    # Check duplicate name
    existing_res = await db.execute(
        select(Doctor).where(
            and_(
                Doctor.lab_id == current_user.lab_id,
                Doctor.name == payload.name.strip(),
            )
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A doctor with name '{payload.name}' already exists in this laboratory.",
        )

    doctor = Doctor(
        lab_id=current_user.lab_id,
        name=payload.name.strip(),
        code=payload.code,
        phone=payload.phone,
        email=payload.email,
        specialization=payload.specialization,
        clinic_hospital_name=payload.clinic_hospital_name,
        default_commission_percentage=payload.default_commission_percentage,
        is_active=payload.is_active,
    )
    db.add(doctor)
    await db.commit()
    await db.refresh(doctor)

    return APIResponse(
        success=True,
        message="Doctor registered successfully.",
        data=DoctorResponse.model_validate(doctor),
    )


@router.get("/doctors/{doctor_id}", response_model=APIResponse[DoctorResponse])
async def get_doctor_detail(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve doctor profile details."""
    query = select(Doctor).where(Doctor.id == doctor_id)
    if current_user.lab_id:
        query = query.where(Doctor.lab_id == current_user.lab_id)

    res = await db.execute(query)
    doctor = res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    return APIResponse(
        success=True,
        message="Doctor profile retrieved.",
        data=DoctorResponse.model_validate(doctor),
    )


@router.put("/doctors/{doctor_id}", response_model=APIResponse[DoctorResponse])
async def update_doctor(
    doctor_id: str,
    payload: DoctorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Update doctor profile and baseline commission rate."""
    query = select(Doctor).where(Doctor.id == doctor_id)
    if current_user.lab_id:
        query = query.where(Doctor.lab_id == current_user.lab_id)

    res = await db.execute(query)
    doctor = res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(doctor, key, value)

    await db.commit()
    await db.refresh(doctor)

    return APIResponse(
        success=True,
        message="Doctor profile updated.",
        data=DoctorResponse.model_validate(doctor),
    )


@router.delete("/doctors/{doctor_id}", response_model=APIResponse[MessageResponse])
async def delete_doctor(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Deactivate or remove a referring doctor."""
    query = select(Doctor).where(Doctor.id == doctor_id)
    if current_user.lab_id:
        query = query.where(Doctor.lab_id == current_user.lab_id)

    res = await db.execute(query)
    doctor = res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    # Soft delete / deactivate
    doctor.is_active = False
    await db.commit()

    return APIResponse(
        success=True,
        message="Doctor deactivated successfully.",
        data=MessageResponse(message="Doctor record deactivated."),
    )


# ============================================================================
# DOCTOR TEST-SPECIFIC COMMISSION OVERRIDES ("THE HACK")
# ============================================================================

@router.get("/doctors/{doctor_id}/commissions", response_model=APIResponse[List[DoctorTestCommissionItem]])
async def get_doctor_test_commissions(
    doctor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """
    Get the complete test commission matrix for a specific doctor.
    Lists all active tests in the lab, showing the doctor's specific percentage
    for each test (or fallback to doctor's default percentage if no override exists).
    """
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    # Verify doctor
    doc_res = await db.execute(select(Doctor).where(Doctor.id == doctor_id, Doctor.lab_id == current_user.lab_id))
    doctor = doc_res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    # Fetch all active tests
    tests_res = await db.execute(
        select(Test)
        .options(selectinload(Test.category))
        .where(Test.is_active == True)
        .order_by(Test.name.asc())
    )
    all_tests = tests_res.scalars().all()

    # Fetch existing overrides
    ov_res = await db.execute(
        select(DoctorTestCommission).where(
            DoctorTestCommission.doctor_id == doctor_id,
            DoctorTestCommission.lab_id == current_user.lab_id,
        )
    )
    overrides_map = {str(ov.test_id): ov.commission_percentage for ov in ov_res.scalars().all()}

    result: List[DoctorTestCommissionItem] = []
    for t in all_tests:
        test_id_str = str(t.id)
        is_custom = test_id_str in overrides_map
        pct = overrides_map.get(test_id_str, doctor.default_commission_percentage)

        result.append(
            DoctorTestCommissionItem(
                test_id=test_id_str,
                test_name=t.name,
                test_code=t.code,
                category_name=t.category.name if t.category else "General",
                standard_price=t.default_price,
                commission_percentage=pct,
                is_custom=is_custom,
            )
        )

    return APIResponse(
        success=True,
        message=f"Retrieved commission matrix for {doctor.name}.",
        data=result,
    )


@router.put("/doctors/{doctor_id}/commissions", response_model=APIResponse[MessageResponse])
async def update_doctor_test_commissions(
    doctor_id: str,
    payload: DoctorCommissionOverridesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """
    Save test-specific commission percentages for a doctor.
    Each test can have its own distinct percentage (the key requirement!).
    """
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    # Verify doctor
    doc_res = await db.execute(select(Doctor).where(Doctor.id == doctor_id, Doctor.lab_id == current_user.lab_id))
    doctor = doc_res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    # Remove existing overrides and insert new ones
    existing_ov = await db.execute(
        select(DoctorTestCommission).where(
            DoctorTestCommission.doctor_id == doctor_id,
            DoctorTestCommission.lab_id == current_user.lab_id,
        )
    )
    for ov in existing_ov.scalars().all():
        await db.delete(ov)

    # Insert updated overrides
    for item in payload.commissions:
        if item.commission_percentage is not None:
            new_ov = DoctorTestCommission(
                lab_id=current_user.lab_id,
                doctor_id=doctor_id,
                test_id=item.test_id,
                commission_percentage=item.commission_percentage,
            )
            db.add(new_ov)

    await db.commit()

    return APIResponse(
        success=True,
        message=f"Commission percentages updated successfully for {doctor.name}.",
        data=MessageResponse(message=f"Configured {len(payload.commissions)} test commission rules."),
    )


# ============================================================================
# COMMISSION REPORTING & ANALYTICS (DAILY, MONTHLY, DATE RANGE)
# ============================================================================

@router.get("/commissions/report", response_model=APIResponse[DoctorCommissionReportResponse])
async def get_commissions_report(
    period: str = Query("monthly", description="Filter period: 'daily', 'monthly', or 'custom'"),
    date_val: Optional[str] = Query(None, alias="date", description="Specific date for daily filter (YYYY-MM-DD)"),
    month_val: Optional[str] = Query(None, alias="month", description="Specific month for monthly filter (YYYY-MM)"),
    start_date: Optional[str] = Query(None, description="Start date for custom filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom filter (YYYY-MM-DD)"),
    doctor_id: Optional[str] = Query(None, description="Filter by specific doctor ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """
    Generate Doctor Commission Breakdown Report.
    Supports filtering by Daily, Monthly, or Custom Date Range, as well as by Doctor.
    Displays:
    - Total Billed Income from referred tests
    - Doctor Commission Amount
    - Effective overall percentage
    - Number of patient tests & unique patients
    - Test-wise breakdown highlighting distinct commission percentages per test for the same doctor!
    - Itemized patient/booking ledger
    - Daily/monthly trend distribution
    """
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    today = datetime.date.today()

    if period == "daily":
        if date_val:
            try:
                calc_start = datetime.datetime.strptime(date_val, "%Y-%m-%d").date()
            except ValueError:
                calc_start = today
        else:
            calc_start = today
        calc_end = calc_start

    elif period == "monthly":
        if month_val:
            try:
                dt = datetime.datetime.strptime(month_val, "%Y-%m")
                calc_start = datetime.date(dt.year, dt.month, 1)
            except ValueError:
                calc_start = datetime.date(today.year, today.month, 1)
        else:
            calc_start = datetime.date(today.year, today.month, 1)

        # End of the month
        if calc_start.month == 12:
            calc_end = datetime.date(calc_start.year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            calc_end = datetime.date(calc_start.year, calc_start.month + 1, 1) - datetime.timedelta(days=1)

    else:  # "custom"
        try:
            calc_start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else (today - datetime.timedelta(days=30))
        except ValueError:
            calc_start = today - datetime.timedelta(days=30)

        try:
            calc_end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else today
        except ValueError:
            calc_end = today

    report = await get_doctor_commission_report(
        db=db,
        lab_id=current_user.lab_id,
        period_type=period,
        start_date=calc_start,
        end_date=calc_end,
        doctor_id=doctor_id,
    )

    return APIResponse(
        success=True,
        message="Doctor commission report generated.",
        data=report,
    )
