from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ExpenseBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Title or description of the expense")
    category: str = Field(default="OTHER", max_length=100, description="Expense category (e.g. LAB_SUPPLIES, UTILITIES, etc.)")
    amount: Decimal = Field(..., gt=0, description="Expense amount in currency units")
    expense_date: date = Field(..., description="Date of the expense (YYYY-MM-DD)")
    payment_method: str = Field(default="CASH", max_length=50, description="Payment method used (e.g. CASH, UPI, CARD, BANK_TRANSFER, CHEQUE)")
    vendor_name: Optional[str] = Field(None, max_length=255, description="Vendor or payee name")
    receipt_number: Optional[str] = Field(None, max_length=100, description="Receipt / Invoice / Voucher reference number")
    notes: Optional[str] = Field(None, description="Additional notes or remarks")


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    amount: Optional[Decimal] = Field(None, gt=0)
    expense_date: Optional[date] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    vendor_name: Optional[str] = Field(None, max_length=255)
    receipt_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class ExpenseResponse(ExpenseBase):
    id: str
    lab_id: str
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategoryBreakdownItem(BaseModel):
    category: str
    category_label: str
    total_amount: Decimal
    percentage: float
    count: int


class PaymentMethodBreakdownItem(BaseModel):
    payment_method: str
    total_amount: Decimal
    count: int


class DailyBreakdownItem(BaseModel):
    date: str
    total_amount: Decimal
    count: int


class ExpenseSummaryResponse(BaseModel):
    period: str  # 'daily', 'monthly', or 'custom'
    start_date: str
    end_date: str
    total_amount: Decimal
    expense_count: int
    average_expense: Decimal
    categories_breakdown: List[CategoryBreakdownItem]
    payment_methods_breakdown: List[PaymentMethodBreakdownItem]
    daily_breakdown: List[DailyBreakdownItem]
    expenses: List[ExpenseResponse]


class CategoryPresetItem(BaseModel):
    key: str
    label: str
    description: Optional[str] = None
