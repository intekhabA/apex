from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_lab_staff, require_lab_admin
from app.models.user import User
from app.models.expense import Expense
from app.schemas.common import APIResponse, MessageResponse, PaginationMeta
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    ExpenseSummaryResponse,
    CategoryPresetItem,
)
from app.services.expense_service import (
    resolve_period_dates,
    get_expenses_summary,
    CATEGORY_PRESETS,
)

router = APIRouter(prefix="/expenses", tags=["Daily Expenses"])


@router.get("/categories/presets", response_model=APIResponse[List[CategoryPresetItem]])
async def get_expense_categories_presets(
    current_user: User = Depends(require_lab_staff),
):
    """Returns standard laboratory expense categories and descriptors."""
    presets = [CategoryPresetItem(**item) for item in CATEGORY_PRESETS]
    return APIResponse(
        success=True,
        message="Expense categories retrieved successfully.",
        data=presets,
    )


@router.get("/summary", response_model=APIResponse[ExpenseSummaryResponse])
async def get_expense_summary(
    period: str = Query("daily", description="Period filter: 'daily', 'monthly', or 'custom'"),
    date_val: Optional[str] = Query(None, alias="date", description="Target date for daily basis (YYYY-MM-DD)"),
    month_val: Optional[str] = Query(None, alias="month", description="Target month for monthly basis (YYYY-MM)"),
    start_date: Optional[str] = Query(None, description="Start date for date range (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for date range (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    search: Optional[str] = Query(None, description="Search query in title, vendor, receipt # or notes"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """
    Get aggregated financial expense summary and itemized expenses
    filtered on daily, monthly, or custom date range.
    """
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    start_d, end_d = resolve_period_dates(
        period=period,
        date_val=date_val,
        month_val=month_val,
        start_date_val=start_date,
        end_date_val=end_date,
    )

    summary = await get_expenses_summary(
        db=db,
        lab_id=current_user.lab_id,
        period=period,
        start_date=start_d,
        end_date=end_d,
        category=category,
        payment_method=payment_method,
        search=search,
    )

    return APIResponse(
        success=True,
        message="Expense summary retrieved successfully.",
        data=summary,
    )


@router.get("", response_model=APIResponse[List[ExpenseResponse]])
async def list_expenses(
    period: Optional[str] = Query(None, description="Optional period: 'daily', 'monthly', or 'custom'"),
    date_val: Optional[str] = Query(None, alias="date", description="Specific date for daily filter (YYYY-MM-DD)"),
    month_val: Optional[str] = Query(None, alias="month", description="Specific month for monthly filter (YYYY-MM)"),
    start_date: Optional[str] = Query(None, description="Filter start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter end date (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    search: Optional[str] = Query(None, description="Search term for title, vendor, receipt number, notes"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Page size"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """List laboratory expenses with optional period (daily, monthly, date range) and criteria filters."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    query = select(Expense).options(selectinload(Expense.created_by))
    count_query = select(func.count(Expense.id))

    if current_user.lab_id:
        query = query.where(Expense.lab_id == current_user.lab_id)
        count_query = count_query.where(Expense.lab_id == current_user.lab_id)

    # Date / Period conditions
    if period:
        start_d, end_d = resolve_period_dates(
            period=period,
            date_val=date_val,
            month_val=month_val,
            start_date_val=start_date,
            end_date_val=end_date,
        )
        date_cond = and_(Expense.expense_date >= start_d, Expense.expense_date <= end_d)
        query = query.where(date_cond)
        count_query = count_query.where(date_cond)
    else:
        if start_date:
            try:
                sd = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
                query = query.where(Expense.expense_date >= sd)
                count_query = count_query.where(Expense.expense_date >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
                query = query.where(Expense.expense_date <= ed)
                count_query = count_query.where(Expense.expense_date <= ed)
            except ValueError:
                pass

    if category:
        query = query.where(Expense.category == category.strip())
        count_query = count_query.where(Expense.category == category.strip())

    if payment_method:
        query = query.where(Expense.payment_method == payment_method.strip().upper())
        count_query = count_query.where(Expense.payment_method == payment_method.strip().upper())

    if search:
        term = f"%{search.strip()}%"
        search_cond = or_(
            Expense.title.ilike(term),
            Expense.vendor_name.ilike(term),
            Expense.receipt_number.ilike(term),
            Expense.notes.ilike(term),
            Expense.category.ilike(term),
        )
        query = query.where(search_cond)
        count_query = count_query.where(search_cond)

    total_count_res = await db.execute(count_query)
    total_count = total_count_res.scalar() or 0

    offset = (page - 1) * limit
    query = query.order_by(Expense.expense_date.desc(), Expense.created_at.desc()).offset(offset).limit(limit)
    res = await db.execute(query)
    records = res.scalars().all()

    items = []
    for r in records:
        created_name = None
        if r.created_by:
            name_parts = [r.created_by.first_name or "", r.created_by.last_name or ""]
            created_name = " ".join([p for p in name_parts if p]).strip() or r.created_by.email

        items.append(
            ExpenseResponse(
                id=str(r.id),
                lab_id=str(r.lab_id),
                title=r.title,
                category=r.category,
                amount=r.amount,
                expense_date=r.expense_date,
                payment_method=r.payment_method,
                vendor_name=r.vendor_name,
                receipt_number=r.receipt_number,
                notes=r.notes,
                created_by_id=str(r.created_by_id) if r.created_by_id else None,
                created_by_name=created_name,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )

    total_pages = (total_count + limit - 1) // limit if limit > 0 else 1

    return APIResponse(
        success=True,
        message=f"Retrieved {len(items)} expenses.",
        data=items,
        meta=PaginationMeta(
            page=page,
            limit=limit,
            total=total_count,
            total_pages=total_pages,
        ),
    )


@router.post("", response_model=APIResponse[ExpenseResponse], status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Record a new daily laboratory expense."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    expense = Expense(
        lab_id=current_user.lab_id,
        title=payload.title.strip(),
        category=payload.category.strip(),
        amount=payload.amount,
        expense_date=payload.expense_date,
        payment_method=payload.payment_method.strip().upper(),
        vendor_name=payload.vendor_name.strip() if payload.vendor_name else None,
        receipt_number=payload.receipt_number.strip() if payload.receipt_number else None,
        notes=payload.notes.strip() if payload.notes else None,
        created_by_id=current_user.id,
    )

    db.add(expense)
    await db.commit()
    await db.refresh(expense)

    created_name = " ".join([p for p in [current_user.first_name, current_user.last_name] if p]).strip() or current_user.email

    response_data = ExpenseResponse(
        id=str(expense.id),
        lab_id=str(expense.lab_id),
        title=expense.title,
        category=expense.category,
        amount=expense.amount,
        expense_date=expense.expense_date,
        payment_method=expense.payment_method,
        vendor_name=expense.vendor_name,
        receipt_number=expense.receipt_number,
        notes=expense.notes,
        created_by_id=str(expense.created_by_id) if expense.created_by_id else None,
        created_by_name=created_name,
        created_at=expense.created_at,
        updated_at=expense.updated_at,
    )

    return APIResponse(
        success=True,
        message="Expense recorded successfully.",
        data=response_data,
    )


@router.get("/{expense_id}", response_model=APIResponse[ExpenseResponse])
async def get_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve details of a single expense."""
    query = select(Expense).options(selectinload(Expense.created_by)).where(Expense.id == expense_id)
    if current_user.lab_id:
        query = query.where(Expense.lab_id == current_user.lab_id)

    res = await db.execute(query)
    expense = res.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found.")

    created_name = None
    if expense.created_by:
        created_name = " ".join([p for p in [expense.created_by.first_name, expense.created_by.last_name] if p]).strip()

    return APIResponse(
        success=True,
        message="Expense details retrieved.",
        data=ExpenseResponse(
            id=str(expense.id),
            lab_id=str(expense.lab_id),
            title=expense.title,
            category=expense.category,
            amount=expense.amount,
            expense_date=expense.expense_date,
            payment_method=expense.payment_method,
            vendor_name=expense.vendor_name,
            receipt_number=expense.receipt_number,
            notes=expense.notes,
            created_by_id=str(expense.created_by_id) if expense.created_by_id else None,
            created_by_name=created_name,
            created_at=expense.created_at,
            updated_at=expense.updated_at,
        ),
    )


@router.put("/{expense_id}", response_model=APIResponse[ExpenseResponse])
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Update an existing expense record."""
    query = select(Expense).options(selectinload(Expense.created_by)).where(Expense.id == expense_id)
    if current_user.lab_id:
        query = query.where(Expense.lab_id == current_user.lab_id)

    res = await db.execute(query)
    expense = res.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found.")

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if field == "payment_method" and val is not None:
            setattr(expense, field, str(val).strip().upper())
        elif field in ("title", "category") and val is not None:
            setattr(expense, field, str(val).strip())
        elif field in ("vendor_name", "receipt_number", "notes") and val is not None:
            setattr(expense, field, str(val).strip() if val else None)
        else:
            setattr(expense, field, val)

    await db.commit()
    await db.refresh(expense)

    created_name = None
    if expense.created_by:
        created_name = " ".join([p for p in [expense.created_by.first_name, expense.created_by.last_name] if p]).strip()

    return APIResponse(
        success=True,
        message="Expense updated successfully.",
        data=ExpenseResponse(
            id=str(expense.id),
            lab_id=str(expense.lab_id),
            title=expense.title,
            category=expense.category,
            amount=expense.amount,
            expense_date=expense.expense_date,
            payment_method=expense.payment_method,
            vendor_name=expense.vendor_name,
            receipt_number=expense.receipt_number,
            notes=expense.notes,
            created_by_id=str(expense.created_by_id) if expense.created_by_id else None,
            created_by_name=created_name,
            created_at=expense.created_at,
            updated_at=expense.updated_at,
        ),
    )


@router.delete("/{expense_id}", response_model=APIResponse[MessageResponse])
async def delete_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Delete an expense record."""
    query = select(Expense).where(Expense.id == expense_id)
    if current_user.lab_id:
        query = query.where(Expense.lab_id == current_user.lab_id)

    res = await db.execute(query)
    expense = res.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense record not found.")

    await db.delete(expense)
    await db.commit()

    return APIResponse(
        success=True,
        message="Expense deleted successfully.",
        data=MessageResponse(message="Expense record has been deleted."),
    )
