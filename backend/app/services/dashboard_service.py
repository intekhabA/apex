import datetime
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.models.laboratory import Laboratory
from app.models.user import User
from app.models.patient import Patient
from app.models.test import Test, TestCategory
from app.models.booking import Booking, BookingItem
from app.models.sample import Sample, SampleStatus
from app.models.report import Report, ReportStatus
from app.models.invoice import Invoice, Payment
from app.schemas.booking import BookingResponse, BookingItemResponse
from app.schemas.report import ReportListItemResponse
from app.schemas.dashboard import (
    LabDashboardResponse,
    SuperAdminDashboardResponse,
    DailyTrendPoint,
    StatusCount,
    LabPerformanceMetric,
    CategoryDistribution,
)


class DashboardService:
    @staticmethod
    async def get_lab_dashboard_data(db: AsyncSession, lab_id: str) -> LabDashboardResponse:
        today = datetime.date.today()

        # 1. Bookings Metrics
        total_bookings = (
            await db.execute(
                select(func.count(Booking.id)).where(Booking.lab_id == lab_id)
            )
        ).scalar() or 0

        today_bookings = (
            await db.execute(
                select(func.count(Booking.id)).where(
                    Booking.lab_id == lab_id, Booking.booking_date == today
                )
            )
        ).scalar() or 0

        # 2. Samples Metrics
        samples_res = await db.execute(
            select(Sample.status, func.count(Sample.id))
            .where(Sample.lab_id == lab_id)
            .group_by(Sample.status)
        )
        sample_counts_raw = samples_res.all()
        sample_counts_dict = {
            (s.value if hasattr(s, "value") else str(s)): cnt
            for s, cnt in sample_counts_raw
        }
        sample_status_breakdown = [
            StatusCount(status=st, count=cnt)
            for st, cnt in sample_counts_dict.items()
        ]
        samples_pending = sample_counts_dict.get(SampleStatus.REGISTERED.value, 0)
        samples_in_lab = (
            sample_counts_dict.get(SampleStatus.COLLECTED.value, 0)
            + sample_counts_dict.get(SampleStatus.RECEIVED.value, 0)
            + sample_counts_dict.get(SampleStatus.PROCESSING.value, 0)
        )

        # 3. Reports Metrics
        reports_res = await db.execute(
            select(Report.status, func.count(Report.id))
            .where(Report.lab_id == lab_id)
            .group_by(Report.status)
        )
        report_counts_raw = reports_res.all()
        report_counts_dict = {
            (r.value if hasattr(r, "value") else str(r)): cnt
            for r, cnt in report_counts_raw
        }
        report_status_breakdown = [
            StatusCount(status=st, count=cnt)
            for st, cnt in report_counts_dict.items()
        ]
        reports_draft = (
            report_counts_dict.get(ReportStatus.DRAFT.value, 0)
            + report_counts_dict.get(ReportStatus.PENDING_REVIEW.value, 0)
            + report_counts_dict.get(ReportStatus.APPROVED.value, 0)
        )
        reports_completed = report_counts_dict.get(ReportStatus.FINAL.value, 0)

        # 4. Financial Metrics
        total_rev_res = (
            await db.execute(
                select(func.coalesce(func.sum(Invoice.paid_amount), 0)).where(
                    Invoice.lab_id == lab_id
                )
            )
        ).scalar() or Decimal("0.00")
        revenue_total = Decimal(str(total_rev_res))

        bal_res = (
            await db.execute(
                select(func.coalesce(func.sum(Invoice.balance_amount), 0)).where(
                    Invoice.lab_id == lab_id
                )
            )
        ).scalar() or Decimal("0.00")
        outstanding_receivables = Decimal(str(bal_res))

        # Today's payments
        today_start = datetime.datetime.combine(today, datetime.time.min)
        today_end = datetime.datetime.combine(today, datetime.time.max)
        today_pay_res = (
            await db.execute(
                select(func.coalesce(func.sum(Payment.amount), 0)).where(
                    Payment.lab_id == lab_id,
                    Payment.created_at >= today_start,
                    Payment.created_at <= today_end,
                )
            )
        ).scalar() or Decimal("0.00")
        revenue_today = Decimal(str(today_pay_res))

        # 5. Last 7 Days Daily Trends
        daily_trends: List[DailyTrendPoint] = []
        for i in range(6, -1, -1):
            day = today - datetime.timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            d_start = datetime.datetime.combine(day, datetime.time.min)
            d_end = datetime.datetime.combine(day, datetime.time.max)

            b_cnt = (
                await db.execute(
                    select(func.count(Booking.id)).where(
                        Booking.lab_id == lab_id, Booking.booking_date == day
                    )
                )
            ).scalar() or 0

            p_sum = (
                await db.execute(
                    select(func.coalesce(func.sum(Payment.amount), 0)).where(
                        Payment.lab_id == lab_id,
                        Payment.created_at >= d_start,
                        Payment.created_at <= d_end,
                    )
                )
            ).scalar() or Decimal("0.00")

            daily_trends.append(
                DailyTrendPoint(
                    date=day.strftime("%d %b"),
                    bookings=b_cnt,
                    revenue=Decimal(str(p_sum)),
                )
            )

        # 6. Recent 5 Bookings
        recent_bks_res = await db.execute(
            select(Booking)
            .options(selectinload(Booking.patient), selectinload(Booking.items))
            .where(Booking.lab_id == lab_id)
            .order_by(desc(Booking.created_at))
            .limit(5)
        )
        recent_bookings_entities = recent_bks_res.scalars().all()
        recent_bookings = [
            BookingResponse(
                id=str(b.id),
                lab_id=str(b.lab_id),
                patient_id=str(b.patient_id),
                booking_id_display=b.booking_id_display,
                booking_date=b.booking_date,
                appointment_date=b.appointment_date,
                appointment_time=b.appointment_time,
                referring_doctor=b.referring_doctor,
                status=b.status,
                payment_status=b.payment_status,
                subtotal_amount=b.subtotal_amount,
                discount_amount=b.discount_amount,
                tax_amount=b.tax_amount,
                grand_total=b.grand_total,
                paid_amount=b.paid_amount,
                balance_amount=b.balance_amount,
                clinical_notes=b.clinical_notes,
                created_at=b.created_at,
                updated_at=b.updated_at,
                items=[
                    BookingItemResponse(
                        id=str(it.id),
                        item_type=it.item_type,
                        test_id=str(it.test_id) if it.test_id else None,
                        package_id=str(it.package_id) if it.package_id else None,
                        item_name=it.item_name,
                        unit_price=it.unit_price,
                        discount_amount=it.discount_amount,
                        final_price=it.final_price,
                    )
                    for it in b.items
                ],
            )
            for b in recent_bookings_entities
        ]

        # 7. Recent 5 Reports
        recent_reps_res = await db.execute(
            select(Report)
            .options(
                selectinload(Report.patient),
                selectinload(Report.test),
                selectinload(Report.booking),
            )
            .where(Report.lab_id == lab_id)
            .order_by(desc(Report.created_at))
            .limit(5)
        )
        recent_reps_entities = recent_reps_res.scalars().all()
        recent_reports = [
            ReportListItemResponse(
                id=str(r.id),
                report_id_display=r.report_id_display,
                booking_id=str(r.booking_id),
                booking_id_display=r.booking.booking_id_display if r.booking else "",
                patient_id=str(r.patient_id),
                patient_name=r.patient.full_name if r.patient else "Patient",
                patient_id_display=r.patient.patient_id_display if r.patient else "",
                test_id=str(r.test_id),
                test_name=r.test.name if r.test else "Diagnostic Test",
                test_code=r.test.code if r.test else "",
                sample_type=r.test.sample_type.value if r.test and r.test.sample_type else "SERUM",
                status=r.status,
                current_version=r.current_version,
                is_immutable=r.is_immutable,
                pdf_file_url=r.pdf_file_url,
                approved_by_name=None,
                finalized_at=r.finalized_at,
                created_at=r.created_at,
            )
            for r in recent_reps_entities
        ]

        return LabDashboardResponse(
            today_bookings_count=today_bookings,
            total_bookings_count=total_bookings,
            samples_pending_collection=samples_pending,
            samples_in_lab=samples_in_lab,
            reports_draft=reports_draft,
            reports_completed=reports_completed,
            revenue_today=revenue_today,
            revenue_total=revenue_total,
            outstanding_receivables=outstanding_receivables,
            sample_status_breakdown=sample_status_breakdown,
            report_status_breakdown=report_status_breakdown,
            daily_trends=daily_trends,
            recent_bookings=recent_bookings,
            recent_reports=recent_reports,
        )

    @staticmethod
    async def get_super_admin_dashboard_data(db: AsyncSession) -> SuperAdminDashboardResponse:
        today = datetime.date.today()

        total_labs = (
            await db.execute(
                select(func.count(Laboratory.id)).where(Laboratory.deleted_at.is_(None))
            )
        ).scalar() or 0

        active_labs = (
            await db.execute(
                select(func.count(Laboratory.id)).where(
                    Laboratory.is_active == True, Laboratory.deleted_at.is_(None)
                )
            )
        ).scalar() or 0

        total_users = (
            await db.execute(
                select(func.count(User.id)).where(User.deleted_at.is_(None))
            )
        ).scalar() or 0

        total_patients = (
            await db.execute(
                select(func.count(Patient.id)).where(Patient.deleted_at.is_(None))
            )
        ).scalar() or 0

        total_tests = (
            await db.execute(
                select(func.count(Test.id)).where(Test.deleted_at.is_(None))
            )
        ).scalar() or 0

        total_bookings = (
            await db.execute(select(func.count(Booking.id)))
        ).scalar() or 0

        total_rev_res = (
            await db.execute(
                select(func.coalesce(func.sum(Invoice.paid_amount), 0))
            )
        ).scalar() or Decimal("0.00")
        total_revenue = Decimal(str(total_rev_res))

        total_reports_completed = (
            await db.execute(
                select(func.count(Report.id)).where(Report.status == ReportStatus.FINAL)
            )
        ).scalar() or 0

        # Lab performance metrics
        labs_res = await db.execute(
            select(Laboratory).where(Laboratory.deleted_at.is_(None)).order_by(Laboratory.created_at.asc())
        )
        all_labs = labs_res.scalars().all()

        lab_performance = []
        for lab in all_labs:
            l_bks = (
                await db.execute(
                    select(func.count(Booking.id)).where(Booking.lab_id == lab.id)
                )
            ).scalar() or 0
            l_rev = (
                await db.execute(
                    select(func.coalesce(func.sum(Invoice.paid_amount), 0)).where(
                        Invoice.lab_id == lab.id
                    )
                )
            ).scalar() or Decimal("0.00")
            lab_performance.append(
                LabPerformanceMetric(
                    lab_id=str(lab.id),
                    lab_name=lab.name,
                    lab_code=lab.code,
                    is_active=lab.is_active,
                    total_bookings=l_bks,
                    total_revenue=Decimal(str(l_rev)),
                )
            )

        # Test category distribution
        cats_res = await db.execute(
            select(TestCategory.name, func.count(Test.id))
            .join(Test, Test.category_id == TestCategory.id)
            .group_by(TestCategory.name)
        )
        category_distribution = [
            CategoryDistribution(category_name=c_name, test_count=c_cnt)
            for c_name, c_cnt in cats_res.all()
        ]

        # 7-day platform trends
        daily_trends = []
        for i in range(6, -1, -1):
            day = today - datetime.timedelta(days=i)
            d_start = datetime.datetime.combine(day, datetime.time.min)
            d_end = datetime.datetime.combine(day, datetime.time.max)

            b_cnt = (
                await db.execute(
                    select(func.count(Booking.id)).where(Booking.booking_date == day)
                )
            ).scalar() or 0

            p_sum = (
                await db.execute(
                    select(func.coalesce(func.sum(Payment.amount), 0)).where(
                        Payment.created_at >= d_start, Payment.created_at <= d_end
                    )
                )
            ).scalar() or Decimal("0.00")

            daily_trends.append(
                DailyTrendPoint(
                    date=day.strftime("%d %b"),
                    bookings=b_cnt,
                    revenue=Decimal(str(p_sum)),
                )
            )

        return SuperAdminDashboardResponse(
            total_laboratories=total_labs,
            active_laboratories=active_labs,
            total_users=total_users,
            total_patients=total_patients,
            total_tests=total_tests,
            total_bookings=total_bookings,
            total_revenue=total_revenue,
            total_reports_completed=total_reports_completed,
            lab_performance=lab_performance,
            category_distribution=category_distribution,
            daily_trends=daily_trends,
        )
