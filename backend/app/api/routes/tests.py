from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_super_admin, require_lab_admin
from app.core.security import get_current_user
from app.models.user import User
from app.models.test import (
    TestCategory,
    Test,
    TestParameter,
    TestReferenceRange,
    LabTestPrice,
    TestPackage,
    TestPackageItem,
)
from app.schemas.common import APIResponse, MessageResponse
from app.schemas.test import (
    TestCategoryCreate,
    TestCategoryUpdate,
    TestCategoryResponse,
    TestCreate,
    TestUpdate,
    TestResponse,
    TestParameterCreate,
    TestParameterResponse,
    ReferenceRangeCreate,
    ReferenceRangeResponse,
    LabTestPriceCreate,
    LabTestPriceResponse,
    TestPackageCreate,
    TestPackageResponse,
    TestPackageItemResponse,
)

router = APIRouter(prefix="/tests", tags=["Test Catalog, Parameters & Pricing"])


# =========================================================================
# 1. Test Categories
# =========================================================================

@router.get("/categories", response_model=APIResponse[List[TestCategoryResponse]])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all diagnostic test categories ordered by display hierarchy."""
    res = await db.execute(
        select(TestCategory)
        .where(TestCategory.is_active == True)
        .order_by(TestCategory.display_order.asc(), TestCategory.name.asc())
    )
    categories = res.scalars().all()
    return APIResponse(
        success=True,
        message=f"Retrieved {len(categories)} categories.",
        data=[TestCategoryResponse.model_validate(c) for c in categories],
    )


@router.post("/categories", response_model=APIResponse[TestCategoryResponse], status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: TestCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Create a new diagnostic category in the master catalog (Super Admin only)."""
    existing = await db.execute(
        select(TestCategory).where(
            or_(TestCategory.code == payload.code.upper(), TestCategory.name == payload.name)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with code '{payload.code.upper()}' or name '{payload.name}' already exists.",
        )

    cat = TestCategory(
        code=payload.code.upper(),
        name=payload.name,
        description=payload.description,
        display_order=payload.display_order,
        is_active=payload.is_active,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)

    return APIResponse(
        success=True,
        message=f"Test category '{cat.name}' created.",
        data=TestCategoryResponse.model_validate(cat),
    )


@router.put("/categories/{category_id}", response_model=APIResponse[TestCategoryResponse])
async def update_category(
    category_id: str,
    payload: TestCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update a test category (Super Admin only)."""
    res = await db.execute(select(TestCategory).where(TestCategory.id == category_id))
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(cat, field, val)

    await db.commit()
    await db.refresh(cat)
    return APIResponse(
        success=True,
        message=f"Category '{cat.name}' updated.",
        data=TestCategoryResponse.model_validate(cat),
    )


# =========================================================================
# 2. Diagnostic Packages & Bundles (Must precede /{test_id} route)
# =========================================================================

@router.get("/packages", response_model=APIResponse[List[TestPackageResponse]])
async def list_packages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve bundled health checkup test packages."""
    res = await db.execute(
        select(TestPackage)
        .options(selectinload(TestPackage.items))
        .where(TestPackage.is_active == True)
    )
    packages = res.scalars().all()

    # Pre-fetch test codes and names for items
    all_test_ids = [item.test_id for pkg in packages for item in pkg.items]
    tests_map = {}
    if all_test_ids:
        test_res = await db.execute(select(Test).where(Test.id.in_(all_test_ids)))
        for t in test_res.scalars().all():
            tests_map[t.id] = t

    output = []
    for pkg in packages:
        items_resp = [
            TestPackageItemResponse(
                test_id=it.test_id,
                test_name=tests_map.get(it.test_id).name if it.test_id in tests_map else None,
                test_code=tests_map.get(it.test_id).code if it.test_id in tests_map else None,
                test_price=tests_map.get(it.test_id).default_price if it.test_id in tests_map else None,
            )
            for it in pkg.items
        ]
        output.append(
            TestPackageResponse(
                id=str(pkg.id),
                code=pkg.code,
                name=pkg.name,
                description=pkg.description,
                price=pkg.price,
                discount_percentage=pkg.discount_percentage,
                is_active=pkg.is_active,
                items=items_resp,
                created_at=pkg.created_at,
            )
        )

    return APIResponse(success=True, message=f"Retrieved {len(output)} packages.", data=output)


@router.post("/packages", response_model=APIResponse[TestPackageResponse], status_code=status.HTTP_201_CREATED)
async def create_package(
    payload: TestPackageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Create a diagnostic wellness bundle/package with multiple included tests."""
    pkg = TestPackage(
        code=payload.code.upper(),
        name=payload.name,
        description=payload.description,
        price=payload.price,
        discount_percentage=payload.discount_percentage,
        is_active=True,
    )
    db.add(pkg)
    await db.flush()

    items = []
    for tid in payload.test_ids:
        item = TestPackageItem(package_id=pkg.id, test_id=tid)
        db.add(item)
        items.append(item)

    await db.commit()
    await db.refresh(pkg)

    return APIResponse(
        success=True,
        message=f"Health package '{pkg.name}' created.",
        data=TestPackageResponse(
            id=str(pkg.id),
            code=pkg.code,
            name=pkg.name,
            description=pkg.description,
            price=pkg.price,
            discount_percentage=pkg.discount_percentage,
            is_active=pkg.is_active,
            items=[TestPackageItemResponse(test_id=tid) for tid in payload.test_ids],
            created_at=pkg.created_at,
        ),
    )


# =========================================================================
# 3. Dynamic Lab Pricing Overrides
# =========================================================================

@router.get("/pricing/overrides", response_model=APIResponse[List[LabTestPriceResponse]])
async def list_lab_pricing_overrides(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """List laboratory custom price overrides for the current laboratory."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    res = await db.execute(
        select(LabTestPrice).where(LabTestPrice.lab_id == current_user.lab_id)
    )
    overrides = res.scalars().all()
    return APIResponse(
        success=True,
        message=f"Retrieved {len(overrides)} pricing overrides.",
        data=[LabTestPriceResponse.model_validate(p) for p in overrides],
    )


@router.put("/pricing/override", response_model=APIResponse[LabTestPriceResponse])
async def set_lab_test_price_override(
    payload: LabTestPriceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Set or update laboratory custom pricing for a diagnostic test (Gate Check requirement)."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    # Verify test exists
    test_res = await db.execute(select(Test).where(Test.id == payload.test_id))
    test = test_res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found.")

    res = await db.execute(
        select(LabTestPrice).where(
            LabTestPrice.lab_id == current_user.lab_id,
            LabTestPrice.test_id == payload.test_id,
        )
    )
    pricing = res.scalar_one_or_none()

    if pricing:
        pricing.custom_price = payload.custom_price
        pricing.discount_percentage = payload.discount_percentage
        pricing.is_available = payload.is_available
    else:
        pricing = LabTestPrice(
            lab_id=current_user.lab_id,
            test_id=payload.test_id,
            custom_price=payload.custom_price,
            discount_percentage=payload.discount_percentage,
            is_available=payload.is_available,
        )
        db.add(pricing)

    await db.commit()
    await db.refresh(pricing)

    return APIResponse(
        success=True,
        message=f"Custom price for '{test.name}' set to {pricing.custom_price}.",
        data=LabTestPriceResponse.model_validate(pricing),
    )


@router.delete("/pricing/override/{test_id}", response_model=APIResponse[MessageResponse])
async def remove_lab_price_override(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Reset test price to global master catalog default."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    await db.execute(
        delete(LabTestPrice).where(
            LabTestPrice.lab_id == current_user.lab_id,
            LabTestPrice.test_id == test_id,
        )
    )
    await db.commit()

    return APIResponse(
        success=True,
        message="Custom price override removed. Test reverted to global catalog price.",
        data=MessageResponse(message="Price reverted to default."),
    )


# =========================================================================
# 4. Master Test Catalog
# =========================================================================

@router.get("", response_model=APIResponse[List[TestResponse]])
async def list_tests(
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search by test code or name"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List diagnostic tests with lab-specific custom price resolution."""
    query = (
        select(Test)
        .options(
            selectinload(Test.category),
            selectinload(Test.parameters).selectinload(TestParameter.reference_ranges),
        )
        .where(Test.is_active == True)
    )

    if category_id:
        query = query.where(Test.category_id == category_id)

    if search:
        term = f"%{search}%"
        query = query.where(or_(Test.name.ilike(term), Test.code.ilike(term), Test.short_name.ilike(term)))

    query = query.order_by(Test.name.asc())
    res = await db.execute(query)
    tests = res.scalars().all()

    # Pre-fetch custom pricing overrides for current user's laboratory
    lab_prices = {}
    if current_user.lab_id:
        price_res = await db.execute(
            select(LabTestPrice).where(LabTestPrice.lab_id == current_user.lab_id)
        )
        for lp in price_res.scalars().all():
            lab_prices[lp.test_id] = lp.custom_price

    output = []
    for t in tests:
        eff_price = lab_prices.get(t.id, t.default_price)
        t_resp = TestResponse(
            id=str(t.id),
            category_id=str(t.category_id),
            category_name=t.category.name if t.category else None,
            code=t.code,
            name=t.name,
            short_name=t.short_name,
            test_type=t.test_type,
            sample_type=t.sample_type,
            sample_container=t.sample_container,
            preparation_instructions=t.preparation_instructions,
            turnaround_hours=t.turnaround_hours,
            default_price=t.default_price,
            effective_price=eff_price,
            is_active=t.is_active,
            parameters=[
                TestParameterResponse(
                    id=str(p.id),
                    test_id=str(p.test_id),
                    code=p.code,
                    name=p.name,
                    short_name=p.short_name,
                    unit=p.unit,
                    result_type=p.result_type,
                    decimal_precision=p.decimal_precision,
                    display_order=p.display_order,
                    options_json=p.options_json,
                    reference_ranges=[
                        ReferenceRangeResponse(
                            id=str(rr.id),
                            parameter_id=str(rr.parameter_id),
                            gender=rr.gender,
                            age_min_years=rr.age_min_years,
                            age_max_years=rr.age_max_years,
                            min_value=rr.min_value,
                            max_value=rr.max_value,
                            critical_low=rr.critical_low,
                            critical_high=rr.critical_high,
                            text_normal_value=rr.text_normal_value,
                            display_range_string=rr.display_range_string,
                        )
                        for rr in p.reference_ranges
                    ],
                )
                for p in t.parameters
            ],
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        output.append(t_resp)

    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} tests.",
        data=output,
    )


@router.post("", response_model=APIResponse[TestResponse], status_code=status.HTTP_201_CREATED)
async def create_test(
    payload: TestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Create a new diagnostic test in the master catalog with optional sub-parameters (Super Admin only)."""
    existing = await db.execute(select(Test).where(Test.code == payload.code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Test with code '{payload.code.upper()}' already exists.",
        )

    test = Test(
        category_id=payload.category_id,
        code=payload.code.upper(),
        name=payload.name,
        short_name=payload.short_name or payload.code.upper(),
        test_type=payload.test_type,
        sample_type=payload.sample_type,
        sample_container=payload.sample_container,
        preparation_instructions=payload.preparation_instructions,
        turnaround_hours=payload.turnaround_hours,
        default_price=payload.default_price,
        is_active=payload.is_active,
    )
    db.add(test)
    await db.flush()

    # Create nested sub-parameters if provided
    if payload.parameters:
        for p_idx, p_data in enumerate(payload.parameters, start=1):
            param = TestParameter(
                test_id=test.id,
                code=p_data.code.upper(),
                name=p_data.name,
                short_name=p_data.short_name or p_data.code.upper(),
                unit=p_data.unit,
                result_type=p_data.result_type,
                decimal_precision=p_data.decimal_precision,
                display_order=p_data.display_order or p_idx,
                options_json=p_data.options_json,
            )
            db.add(param)
            await db.flush()

            if p_data.reference_ranges:
                for rr_data in p_data.reference_ranges:
                    rr = TestReferenceRange(
                        parameter_id=param.id,
                        gender=rr_data.gender,
                        age_min_years=rr_data.age_min_years,
                        age_max_years=rr_data.age_max_years,
                        min_value=rr_data.min_value,
                        max_value=rr_data.max_value,
                        critical_low=rr_data.critical_low,
                        critical_high=rr_data.critical_high,
                        text_normal_value=rr_data.text_normal_value,
                        display_range_string=rr_data.display_range_string,
                    )
                    db.add(rr)

    await db.commit()

    # Re-fetch with eager loaded relationships
    res = await db.execute(
        select(Test)
        .options(
            selectinload(Test.category),
            selectinload(Test.parameters).selectinload(TestParameter.reference_ranges),
        )
        .where(Test.id == test.id)
    )
    created_test = res.scalar_one()

    return APIResponse(
        success=True,
        message=f"Diagnostic test '{created_test.name}' successfully cataloged.",
        data=TestResponse(
            id=str(created_test.id),
            category_id=str(created_test.category_id),
            category_name=created_test.category.name if created_test.category else None,
            code=created_test.code,
            name=created_test.name,
            short_name=created_test.short_name,
            test_type=created_test.test_type,
            sample_type=created_test.sample_type,
            sample_container=created_test.sample_container,
            preparation_instructions=created_test.preparation_instructions,
            turnaround_hours=created_test.turnaround_hours,
            default_price=created_test.default_price,
            effective_price=created_test.default_price,
            is_active=created_test.is_active,
            parameters=[
                TestParameterResponse(
                    id=str(p.id),
                    test_id=str(p.test_id),
                    code=p.code,
                    name=p.name,
                    short_name=p.short_name,
                    unit=p.unit,
                    result_type=p.result_type,
                    decimal_precision=p.decimal_precision,
                    display_order=p.display_order,
                    options_json=p.options_json,
                    reference_ranges=[
                        ReferenceRangeResponse(
                            id=str(rr.id),
                            parameter_id=str(rr.parameter_id),
                            gender=rr.gender,
                            age_min_years=rr.age_min_years,
                            age_max_years=rr.age_max_years,
                            min_value=rr.min_value,
                            max_value=rr.max_value,
                            critical_low=rr.critical_low,
                            critical_high=rr.critical_high,
                            text_normal_value=rr.text_normal_value,
                            display_range_string=rr.display_range_string,
                        )
                        for rr in p.reference_ranges
                    ],
                )
                for p in created_test.parameters
            ],
            created_at=created_test.created_at,
            updated_at=created_test.updated_at,
        ),
    )


@router.get("/{test_id}", response_model=APIResponse[TestResponse])
async def get_test(
    test_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full test definition with sub-parameters and reference intervals."""
    res = await db.execute(
        select(Test)
        .options(
            selectinload(Test.category),
            selectinload(Test.parameters).selectinload(TestParameter.reference_ranges),
        )
        .where(Test.id == test_id)
    )
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found.")

    # Calculate effective price for current lab
    eff_price = t.default_price
    if current_user.lab_id:
        lp_res = await db.execute(
            select(LabTestPrice).where(LabTestPrice.lab_id == current_user.lab_id, LabTestPrice.test_id == test_id)
        )
        lp = lp_res.scalar_one_or_none()
        if lp:
            eff_price = lp.custom_price

    resp = TestResponse(
        id=str(t.id),
        category_id=str(t.category_id),
        category_name=t.category.name if t.category else None,
        code=t.code,
        name=t.name,
        short_name=t.short_name,
        test_type=t.test_type,
        sample_type=t.sample_type,
        sample_container=t.sample_container,
        preparation_instructions=t.preparation_instructions,
        turnaround_hours=t.turnaround_hours,
        default_price=t.default_price,
        effective_price=eff_price,
        is_active=t.is_active,
        parameters=[
            TestParameterResponse(
                id=str(p.id),
                test_id=str(p.test_id),
                code=p.code,
                name=p.name,
                short_name=p.short_name,
                unit=p.unit,
                result_type=p.result_type,
                decimal_precision=p.decimal_precision,
                display_order=p.display_order,
                options_json=p.options_json,
                reference_ranges=[
                    ReferenceRangeResponse(
                        id=str(rr.id),
                        parameter_id=str(rr.parameter_id),
                        gender=rr.gender,
                        age_min_years=rr.age_min_years,
                        age_max_years=rr.age_max_years,
                        min_value=rr.min_value,
                        max_value=rr.max_value,
                        critical_low=rr.critical_low,
                        critical_high=rr.critical_high,
                        text_normal_value=rr.text_normal_value,
                        display_range_string=rr.display_range_string,
                    )
                    for rr in p.reference_ranges
                ],
            )
            for p in t.parameters
        ],
        created_at=t.created_at,
        updated_at=t.updated_at,
    )

    return APIResponse(success=True, message="Test details retrieved.", data=resp)


@router.put("/{test_id}", response_model=APIResponse[TestResponse])
async def update_test(
    test_id: str,
    payload: TestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update diagnostic test in master catalog (Super Admin only)."""
    res = await db.execute(
        select(Test)
        .options(
            selectinload(Test.category),
            selectinload(Test.parameters).selectinload(TestParameter.reference_ranges),
        )
        .where(Test.id == test_id)
    )
    test = res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(test, field, val)

    await db.commit()
    await db.refresh(test)

    # Re-query test with relationships loaded
    res = await db.execute(
        select(Test)
        .options(
            selectinload(Test.category),
            selectinload(Test.parameters).selectinload(TestParameter.reference_ranges),
        )
        .where(Test.id == test_id)
    )
    updated_test = res.scalar_one()

    return APIResponse(
        success=True,
        message=f"Test '{updated_test.name}' updated successfully.",
        data=TestResponse(
            id=str(updated_test.id),
            category_id=str(updated_test.category_id),
            category_name=updated_test.category.name if updated_test.category else None,
            code=updated_test.code,
            name=updated_test.name,
            short_name=updated_test.short_name,
            test_type=updated_test.test_type,
            sample_type=updated_test.sample_type,
            sample_container=updated_test.sample_container,
            preparation_instructions=updated_test.preparation_instructions,
            turnaround_hours=updated_test.turnaround_hours,
            default_price=updated_test.default_price,
            effective_price=updated_test.default_price,
            is_active=updated_test.is_active,
            parameters=[
                TestParameterResponse(
                    id=str(p.id),
                    test_id=str(p.test_id),
                    code=p.code,
                    name=p.name,
                    short_name=p.short_name,
                    unit=p.unit,
                    result_type=p.result_type,
                    decimal_precision=p.decimal_precision,
                    display_order=p.display_order,
                    options_json=p.options_json,
                    reference_ranges=[
                        ReferenceRangeResponse(
                            id=str(rr.id),
                            parameter_id=str(rr.parameter_id),
                            gender=rr.gender,
                            age_min_years=rr.age_min_years,
                            age_max_years=rr.age_max_years,
                            min_value=rr.min_value,
                            max_value=rr.max_value,
                            critical_low=rr.critical_low,
                            critical_high=rr.critical_high,
                            text_normal_value=rr.text_normal_value,
                            display_range_string=rr.display_range_string,
                        )
                        for rr in p.reference_ranges
                    ],
                )
                for p in updated_test.parameters
            ],
            created_at=updated_test.created_at,
            updated_at=updated_test.updated_at,
        ),
    )


@router.post("/{test_id}/parameters", response_model=APIResponse[TestParameterResponse], status_code=status.HTTP_201_CREATED)
async def add_parameter_to_test(
    test_id: str,
    payload: TestParameterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Add a new sub-analyte parameter to a test in master catalog (Super Admin only)."""
    test_res = await db.execute(select(Test).where(Test.id == test_id))
    if not test_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found.")

    param = TestParameter(
        test_id=test_id,
        code=payload.code.upper(),
        name=payload.name,
        short_name=payload.short_name or payload.code.upper(),
        unit=payload.unit,
        result_type=payload.result_type,
        decimal_precision=payload.decimal_precision,
        display_order=payload.display_order,
        options_json=payload.options_json,
    )
    db.add(param)
    await db.flush()

    ranges = []
    if payload.reference_ranges:
        for rr_data in payload.reference_ranges:
            rr = TestReferenceRange(
                parameter_id=param.id,
                gender=rr_data.gender,
                age_min_years=rr_data.age_min_years,
                age_max_years=rr_data.age_max_years,
                min_value=rr_data.min_value,
                max_value=rr_data.max_value,
                critical_low=rr_data.critical_low,
                critical_high=rr_data.critical_high,
                text_normal_value=rr_data.text_normal_value,
                display_range_string=rr_data.display_range_string,
            )
            db.add(rr)
            ranges.append(rr)

    await db.commit()
    await db.refresh(param)

    return APIResponse(
        success=True,
        message=f"Parameter '{param.name}' added to test.",
        data=TestParameterResponse(
            id=str(param.id),
            test_id=str(param.test_id),
            code=param.code,
            name=param.name,
            short_name=param.short_name,
            unit=param.unit,
            result_type=param.result_type,
            decimal_precision=param.decimal_precision,
            display_order=param.display_order,
            options_json=param.options_json,
            reference_ranges=[
                ReferenceRangeResponse(
                    id=str(rr.id),
                    parameter_id=str(rr.parameter_id),
                    gender=rr.gender,
                    age_min_years=rr.age_min_years,
                    age_max_years=rr.age_max_years,
                    min_value=rr.min_value,
                    max_value=rr.max_value,
                    critical_low=rr.critical_low,
                    critical_high=rr.critical_high,
                    text_normal_value=rr.text_normal_value,
                    display_range_string=rr.display_range_string,
                )
                for rr in ranges
            ],
        ),
    )
