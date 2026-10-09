import calendar
import datetime
from decimal import Decimal
from typing import List, Optional, Tuple, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.models.expense import Expense, ExpenseCategory
from app.models.user import User
from app.schemas.expense import (
    ExpenseResponse,
    ExpenseSummaryResponse,
    CategoryBreakdownItem,
    PaymentMethodBreakdownItem,
    DailyBreakdownItem,
    CategoryPresetItem,
)

CATEGORY_PRESETS: List[Dict[str, str]] = [
    {
        "key": "LAB_SUPPLIES",
        "label": "Lab Supplies & Reagents",
        "description": "Reagents, test kits, vacuum tubes, needles, swabs, lab consumables",
    },
    {
        "key": "EQUIPMENT",
        "label": "Equipment & Maintenance",
        "description": "Machine AMC, servicing, calibrations, spare parts",
    },
    {
        "key": "UTILITIES",
        "label": "Utilities & Bills",
        "description": "Electricity, water, high-speed broadband, telephony",
    },
    {
        "key": "RENT",
        "label": "Rent & Facility",
        "description": "Lab premises rent, maintenance dues, property charges",
    },
    {
        "key": "SALARIES",
        "label": "Staff Wages & Allowances",
        "description": "Daily wages, visiting consultant fees, incentives, overtime",
    },
    {
        "key": "REFRESHMENTS",
        "label": "Pantry & Refreshments",
        "description": "Staff tea, coffee, meals, patient water and refreshments",
    },
    {
        "key": "LOGISTICS",
        "label": "Logistics & Courier",
        "description": "Sample courier, phlebotomist fuel, specimen transit",
    },
    {
        "key": "STATIONERY",
        "label": "Printing & Stationery",
        "description": "Medical report paper, barcode labels, thermal rolls, printer toner",
    },
    {
        "key": "MARKETING",
        "label": "Marketing & Promotion",
        "description": "Brochures, doctor referral folders, local awareness campaigns",
    },
    {
        "key": "MAINTENANCE",
        "label": "Repairs & Housekeeping",
        "description": "Sanitization, biomedical waste disposal, plumbing, electrical repairs",
    },
    {
        "key": "OTHER",
        "label": "Miscellaneous / Other",
        "description": "General petty cash and unclassified laboratory expenses",
    },
]

CATEGORY_LABELS = {p["key"]: p["label"] for p in CATEGORY_PRESETS}


def get_category_label(key: str) -> str:
    return CATEGORY_LABELS.get(key, key.replace("_", " ").title())


def resolve_period_dates(
    period: str,
    date_val: Optional[str] = None,
    month_val: Optional[str] = None,
    start_date_val: Optional[str] = None,
    end_date_val: Optional[str] = None,
) -> Tuple[datetime.date, datetime.date]:
    """
    Parses and returns (start_date, end_date) based on selected period:
    - daily: specific date (defaults to today) -> start = end = date
    - monthly: specific month YYYY-MM (defaults to current month) -> 1st to last day
    - custom: custom start_date to end_date (defaults to last 30 days)
    """
    today = datetime.date.today()

    if period == "daily":
        if date_val:
            try:
                target_date = datetime.datetime.strptime(date_val.strip(), "%Y-%m-%d").date()
            except ValueError:
                target_date = today
        else:
            target_date = today
        return target_date, target_date

    elif period == "monthly":
        if month_val:
            try:
                dt = datetime.datetime.strptime(month_val.strip(), "%Y-%m")
                year, month = dt.year, dt.month
            except ValueError:
                year, month = today.year, today.month
        else:
            year, month = today.year, today.month

        start_date = datetime.date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = datetime.date(year, month, last_day)
        return start_date, end_date

    else:  # "custom" or any other
        if start_date_val:
            try:
                start_date = datetime.datetime.strptime(start_date_val.strip(), "%Y-%m-%d").date()
            except ValueError:
                start_date = today - datetime.timedelta(days=30)
        else:
            start_date = today - datetime.timedelta(days=30)

        if end_date_val:
            try:
                end_date = datetime.datetime.strptime(end_date_val.strip(), "%Y-%m-%d").date()
            except ValueError:
                end_date = today
        else:
            end_date = today

        # Ensure start_date <= end_date
        if start_date > end_date:
            start_date, end_date = end_date, start_date

        return start_date, end_date


async def get_expenses_summary(
    db: AsyncSession,
    lab_id: Optional[str],
    period: str,
    start_date: datetime.date,
    end_date: datetime.date,
    category: Optional[str] = None,
    payment_method: Optional[str] = None,
    search: Optional[str] = None,
) -> ExpenseSummaryResponse:
    """
    Generates full financial expense summary and itemized records for a laboratory
    across daily, monthly, or custom date ranges.
    """
    stmt = (
        select(Expense)
        .options(selectinload(Expense.created_by))
        .where(
            and_(
                Expense.expense_date >= start_date,
                Expense.expense_date <= end_date,
            )
        )
    )

    if lab_id:
        stmt = stmt.where(Expense.lab_id == lab_id)

    if category:
        stmt = stmt.where(Expense.category == category.strip())

    if payment_method:
        stmt = stmt.where(Expense.payment_method == payment_method.strip().upper())

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Expense.title.ilike(term),
                Expense.vendor_name.ilike(term),
                Expense.receipt_number.ilike(term),
                Expense.notes.ilike(term),
                Expense.category.ilike(term),
            )
        )

    stmt = stmt.order_by(Expense.expense_date.desc(), Expense.created_at.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    # Calculate overall metrics
    total_amount = sum((Decimal(str(r.amount)) for r in records), Decimal("0.00"))
    expense_count = len(records)
    avg_expense = (
        (total_amount / Decimal(expense_count)).quantize(Decimal("0.01"))
        if expense_count > 0
        else Decimal("0.00")
    )

    # Category Breakdown
    cat_amounts: Dict[str, Decimal] = {}
    cat_counts: Dict[str, int] = {}
    for r in records:
        cat = r.category or "OTHER"
        amt = Decimal(str(r.amount))
        cat_amounts[cat] = cat_amounts.get(cat, Decimal("0.00")) + amt
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    categories_breakdown: List[CategoryBreakdownItem] = []
    for cat, amt in sorted(cat_amounts.items(), key=lambda x: x[1], reverse=True):
        pct = float((amt / total_amount) * 100) if total_amount > 0 else 0.0
        categories_breakdown.append(
            CategoryBreakdownItem(
                category=cat,
                category_label=get_category_label(cat),
                total_amount=amt,
                percentage=round(pct, 1),
                count=cat_counts[cat],
            )
        )

    # Payment Method Breakdown
    pm_amounts: Dict[str, Decimal] = {}
    pm_counts: Dict[str, int] = {}
    for r in records:
        pm = (r.payment_method or "CASH").upper()
        amt = Decimal(str(r.amount))
        pm_amounts[pm] = pm_amounts.get(pm, Decimal("0.00")) + amt
        pm_counts[pm] = pm_counts.get(pm, 0) + 1

    payment_methods_breakdown: List[PaymentMethodBreakdownItem] = [
        PaymentMethodBreakdownItem(
            payment_method=pm,
            total_amount=amt,
            count=pm_counts[pm],
        )
        for pm, amt in sorted(pm_amounts.items(), key=lambda x: x[1], reverse=True)
    ]

    # Daily Breakdown
    daily_amounts: Dict[str, Decimal] = {}
    daily_counts: Dict[str, int] = {}
    for r in records:
        d_str = r.expense_date.isoformat()
        amt = Decimal(str(r.amount))
        daily_amounts[d_str] = daily_amounts.get(d_str, Decimal("0.00")) + amt
        daily_counts[d_str] = daily_counts.get(d_str, 0) + 1

    daily_breakdown: List[DailyBreakdownItem] = [
        DailyBreakdownItem(
            date=d_str,
            total_amount=amt,
            count=daily_counts[d_str],
        )
        for d_str, amt in sorted(daily_amounts.items(), key=lambda x: x[0])
    ]

    # Map expense response items
    expense_items: List[ExpenseResponse] = []
    for r in records:
        created_name = None
        if r.created_by:
            name_parts = [r.created_by.first_name or "", r.created_by.last_name or ""]
            created_name = " ".join([p for p in name_parts if p]).strip() or r.created_by.email

        expense_items.append(
            ExpenseResponse(
                id=str(r.id),
                lab_id=str(r.lab_id),
                title=r.title,
                category=r.category,
                amount=Decimal(str(r.amount)),
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

    return ExpenseSummaryResponse(
        period=period,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        total_amount=total_amount,
        expense_count=expense_count,
        average_expense=avg_expense,
        categories_breakdown=categories_breakdown,
        payment_methods_breakdown=payment_methods_breakdown,
        daily_breakdown=daily_breakdown,
        expenses=expense_items,
    )
