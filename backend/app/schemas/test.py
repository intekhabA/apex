from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.test import SampleTypeEnum, TestTypeEnum, ResultValueTypeEnum


# ==========================================
# Category Schemas
# ==========================================

class TestCategoryBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class TestCategoryCreate(TestCategoryBase):
    pass


class TestCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class TestCategoryResponse(TestCategoryBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Reference Range Schemas
# ==========================================

class ReferenceRangeBase(BaseModel):
    gender: Optional[str] = None  # "MALE", "FEMALE", or None for any
    age_min_years: int = 0
    age_max_years: int = 150
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    critical_low: Optional[Decimal] = None
    critical_high: Optional[Decimal] = None
    text_normal_value: Optional[str] = None
    display_range_string: str = Field(..., min_length=1, max_length=100)


class ReferenceRangeCreate(ReferenceRangeBase):
    pass


class ReferenceRangeResponse(ReferenceRangeBase):
    id: str
    parameter_id: str

    class Config:
        from_attributes = True


# ==========================================
# Parameter Schemas
# ==========================================

class TestParameterBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    short_name: Optional[str] = None
    unit: Optional[str] = None
    result_type: ResultValueTypeEnum = ResultValueTypeEnum.NUMBER
    decimal_precision: int = 2
    display_order: int = 0
    options_json: Optional[Any] = None


class TestParameterCreate(TestParameterBase):
    reference_ranges: Optional[List[ReferenceRangeCreate]] = None


class TestParameterResponse(TestParameterBase):
    id: str
    test_id: str
    reference_ranges: List[ReferenceRangeResponse] = []

    class Config:
        from_attributes = True


# ==========================================
# Test Schemas
# ==========================================

class TestBase(BaseModel):
    category_id: str
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=255)
    short_name: Optional[str] = None
    test_type: TestTypeEnum = TestTypeEnum.PATHOLOGY
    sample_type: SampleTypeEnum
    sample_container: Optional[str] = None
    preparation_instructions: Optional[str] = None
    turnaround_hours: int = 24
    default_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    is_active: bool = True


class TestCreate(TestBase):
    parameters: Optional[List[TestParameterCreate]] = None


class TestUpdate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None
    test_type: Optional[TestTypeEnum] = None
    sample_type: Optional[SampleTypeEnum] = None
    sample_container: Optional[str] = None
    preparation_instructions: Optional[str] = None
    turnaround_hours: Optional[int] = None
    default_price: Optional[Decimal] = None
    is_active: Optional[bool] = None


class TestResponse(TestBase):
    id: str
    category_name: Optional[str] = None
    effective_price: Optional[Decimal] = None  # Lab custom price if set, else default_price
    parameters: List[TestParameterResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Pricing Override Schemas
# ==========================================

class LabTestPriceCreate(BaseModel):
    test_id: str
    custom_price: Decimal = Field(..., ge=0)
    discount_percentage: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    is_available: bool = True


class LabTestPriceResponse(BaseModel):
    id: str
    lab_id: str
    test_id: str
    custom_price: Decimal
    discount_percentage: Decimal
    is_available: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Package Schemas
# ==========================================

class TestPackageItemResponse(BaseModel):
    test_id: str
    test_name: Optional[str] = None
    test_code: Optional[str] = None
    test_price: Optional[Decimal] = None


class TestPackageCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    price: Decimal = Field(..., ge=0)
    discount_percentage: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    test_ids: List[str]


class TestPackageResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    price: Decimal
    discount_percentage: Decimal
    is_active: bool
    items: List[TestPackageItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
