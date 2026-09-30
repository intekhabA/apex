from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.booking import BookingResponse
from app.schemas.report import ReportListItemResponse


class DailyTrendPoint(BaseModel):
    date: str
    bookings: int
    revenue: Decimal


class StatusCount(BaseModel):
    status: str
    count: int


class LabDashboardResponse(BaseModel):
    today_bookings_count: int
    total_bookings_count: int
    samples_pending_collection: int
    samples_in_lab: int
    reports_draft: int
    reports_completed: int
    revenue_today: Decimal
    revenue_total: Decimal
    outstanding_receivables: Decimal
    sample_status_breakdown: List[StatusCount] = []
    report_status_breakdown: List[StatusCount] = []
    daily_trends: List[DailyTrendPoint] = []
    recent_bookings: List[BookingResponse] = []
    recent_reports: List[ReportListItemResponse] = []


class LabPerformanceMetric(BaseModel):
    lab_id: str
    lab_name: str
    lab_code: str
    is_active: bool
    total_bookings: int
    total_revenue: Decimal


class CategoryDistribution(BaseModel):
    category_name: str
    test_count: int


class SuperAdminDashboardResponse(BaseModel):
    total_laboratories: int
    active_laboratories: int
    total_users: int
    total_patients: int
    total_tests: int
    total_bookings: int
    total_revenue: Decimal
    total_reports_completed: int
    lab_performance: List[LabPerformanceMetric] = []
    category_distribution: List[CategoryDistribution] = []
    daily_trends: List[DailyTrendPoint] = []
