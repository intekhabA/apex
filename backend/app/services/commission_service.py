import datetime
from decimal import Decimal
from typing import List, Dict, Optional, Tuple, Set
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.models.laboratory import Laboratory
from app.models.doctor import Doctor, DoctorTestCommission
from app.models.booking import Booking, BookingItem, BookingStatus
from app.models.patient import Patient
from app.models.test import Test
from app.schemas.doctor import (
    DoctorSummaryItem,
    CommissionTestBreakdownItem,
    CommissionPatientLedgerItem,
    CommissionTrendItem,
    DoctorCommissionReportResponse,
)


async def ensure_doctors_from_bookings(db: AsyncSession, lab_id: str):
    """
    Auto-discovers referring doctors from historical bookings and ensures they have
    a registered Doctor record so custom test commission overrides can be configured.
    """
    # 1. Get existing doctors in lab
    res = await db.execute(select(Doctor).where(Doctor.lab_id == lab_id))
    existing_doctors = res.scalars().all()
    existing_names = {d.name.strip().lower(): d for d in existing_doctors}

    # 2. Get distinct referring doctors from bookings
    query = (
        select(Booking.referring_doctor)
        .where(
            and_(
                Booking.lab_id == lab_id,
                Booking.referring_doctor.isnot(None),
                Booking.referring_doctor != "",
            )
        )
        .distinct()
    )
    res = await db.execute(query)
    referring_names = res.scalars().all()

    created_any = False
    for raw_name in referring_names:
        if not raw_name:
            continue
        cleaned = raw_name.strip()
        if not cleaned or cleaned.lower() in ["self", "self / dr. consultation", "none", "n/a"]:
            continue
        if cleaned.lower() not in existing_names:
            new_doc = Doctor(
                lab_id=lab_id,
                name=cleaned,
                default_commission_percentage=Decimal("10.00"),
                is_active=True,
            )
            db.add(new_doc)
            existing_names[cleaned.lower()] = new_doc
            created_any = True

    if created_any:
        await db.commit()


async def get_doctor_commission_report(
    db: AsyncSession,
    lab_id: str,
    period_type: str,  # "daily", "monthly", "custom"
    start_date: datetime.date,
    end_date: datetime.date,
    doctor_id: Optional[str] = None,
) -> DoctorCommissionReportResponse:
    # 1. Ensure referring doctors exist in DB
    await ensure_doctors_from_bookings(db, lab_id)

    # 2. Load all doctors for this lab
    doc_res = await db.execute(select(Doctor).where(Doctor.lab_id == lab_id))
    all_doctors = doc_res.scalars().all()
    doctor_by_id: Dict[str, Doctor] = {str(d.id): d for d in all_doctors}
    doctor_by_name: Dict[str, Doctor] = {d.name.strip().lower(): d for d in all_doctors}

    target_doctor: Optional[Doctor] = None
    if doctor_id and doctor_id in doctor_by_id:
        target_doctor = doctor_by_id[doctor_id]

    # 3. Load test-specific commission overrides
    override_query = select(DoctorTestCommission).where(DoctorTestCommission.lab_id == lab_id)
    if target_doctor:
        override_query = override_query.where(DoctorTestCommission.doctor_id == target_doctor.id)
    override_res = await db.execute(override_query)
    overrides = override_res.scalars().all()

    # doctor_id -> test_id -> commission_percentage
    test_overrides: Dict[str, Dict[str, Decimal]] = defaultdict(dict)
    for ov in overrides:
        test_overrides[str(ov.doctor_id)][str(ov.test_id)] = ov.commission_percentage

    # 4. Query bookings in range
    booking_query = (
        select(Booking)
        .options(
            selectinload(Booking.items),
            selectinload(Booking.patient),
        )
        .where(
            and_(
                Booking.lab_id == lab_id,
                Booking.booking_date >= start_date,
                Booking.booking_date <= end_date,
                Booking.status != BookingStatus.CANCELLED,
            )
        )
        .order_by(desc(Booking.booking_date), desc(Booking.created_at))
    )

    b_res = await db.execute(booking_query)
    bookings = b_res.scalars().all()

    # Fetch tests to get category names and test codes
    test_res = await db.execute(select(Test).options(selectinload(Test.category)))
    tests_list = test_res.scalars().all()
    test_meta: Dict[str, Tuple[str, str, str]] = {}  # test_id -> (name, code, category_name)
    for t in tests_list:
        test_meta[str(t.id)] = (
            t.name,
            t.code or "",
            t.category.name if getattr(t, "category", None) else "General",
        )

    # 5. Process Bookings and calculate itemized commissions
    total_income = Decimal("0.00")
    total_commission = Decimal("0.00")
    total_tests_count = 0
    unique_patients: Set[str] = set()
    unique_bookings: Set[str] = set()

    # Aggregators
    # doctor_key -> stats
    doctor_stats: Dict[str, Dict] = defaultdict(
        lambda: {
            "doctor_id": None,
            "doctor_name": "",
            "specialization": None,
            "phone": None,
            "clinic_hospital_name": None,
            "default_percentage": Decimal("10.00"),
            "income": Decimal("0.00"),
            "commission": Decimal("0.00"),
            "tests_count": 0,
            "patients": set(),
            "bookings": set(),
        }
    )

    # test_key -> stats
    test_breakdown_map: Dict[str, Dict] = defaultdict(
        lambda: {
            "test_id": None,
            "test_name": "",
            "test_code": "",
            "category_name": "General",
            "tests_count": 0,
            "total_income": Decimal("0.00"),
            "total_commission": Decimal("0.00"),
            "percentages": [],
            "has_custom": False,
        }
    )

    # date_str -> stats
    trends_map: Dict[str, Dict] = defaultdict(
        lambda: {
            "income": Decimal("0.00"),
            "commission": Decimal("0.00"),
            "tests_count": 0,
        }
    )

    patient_ledger: List[CommissionPatientLedgerItem] = []

    for b in bookings:
        raw_ref = (b.referring_doctor or "").strip()
        if not raw_ref:
            continue
        if raw_ref.lower() in ["self", "self / dr. consultation", "none", "n/a"]:
            continue

        # Match doctor
        matched_doc = doctor_by_name.get(raw_ref.lower())
        doc_id = str(matched_doc.id) if matched_doc else None
        doc_name = matched_doc.name if matched_doc else raw_ref
        default_pct = matched_doc.default_commission_percentage if matched_doc else Decimal("10.00")

        # If filtered by doctor, skip non-matching
        if target_doctor:
            if doc_id != str(target_doctor.id) and doc_name.lower() != target_doctor.name.strip().lower():
                continue

        doc_key = doc_id or doc_name.lower()
        d_stat = doctor_stats[doc_key]
        d_stat["doctor_id"] = doc_id
        d_stat["doctor_name"] = doc_name
        if matched_doc:
            d_stat["specialization"] = matched_doc.specialization
            d_stat["phone"] = matched_doc.phone
            d_stat["clinic_hospital_name"] = matched_doc.clinic_hospital_name
            d_stat["default_percentage"] = matched_doc.default_commission_percentage

        unique_bookings.add(str(b.id))
        d_stat["bookings"].add(str(b.id))

        if b.patient_id:
            unique_patients.add(str(b.patient_id))
            d_stat["patients"].add(str(b.patient_id))

        p_name = b.patient.full_name if b.patient else "Unknown Patient"
        p_mrn = b.patient.patient_id_display if b.patient else None

        for item in b.items:
            # Skip if not test item (e.g. general fee if any)
            item_price = Decimal(str(item.final_price or item.unit_price or 0))
            if item_price <= Decimal("0.00"):
                continue

            test_id_str = str(item.test_id) if item.test_id else None
            item_name = item.item_name

            # Determine commission percentage:
            # CHECK THE "HACK": Does this specific test have a custom percentage for this doctor?
            applied_pct = default_pct
            is_custom = False

            if doc_id and test_id_str and doc_id in test_overrides:
                if test_id_str in test_overrides[doc_id]:
                    applied_pct = test_overrides[doc_id][test_id_str]
                    is_custom = True

            item_comm = round((item_price * applied_pct) / Decimal("100.00"), 2)

            # Accumulate global
            total_income += item_price
            total_commission += item_comm
            total_tests_count += 1

            # Accumulate doctor
            d_stat["income"] += item_price
            d_stat["commission"] += item_comm
            d_stat["tests_count"] += 1

            # Accumulate test breakdown
            test_key = test_id_str or item_name.strip().lower()
            t_stat = test_breakdown_map[test_key]
            t_stat["test_id"] = test_id_str
            t_stat["test_name"] = item_name
            if test_id_str and test_id_str in test_meta:
                meta_name, meta_code, meta_cat = test_meta[test_id_str]
                t_stat["test_code"] = meta_code
                t_stat["category_name"] = meta_cat
            t_stat["tests_count"] += 1
            t_stat["total_income"] += item_price
            t_stat["total_commission"] += item_comm
            t_stat["percentages"].append(applied_pct)
            if is_custom:
                t_stat["has_custom"] = True

            # Accumulate trends
            if period_type == "monthly":
                trend_key = b.booking_date.strftime("%Y-%m")
            else:
                trend_key = b.booking_date.strftime("%Y-%m-%d")

            trends_map[trend_key]["income"] += item_price
            trends_map[trend_key]["commission"] += item_comm
            trends_map[trend_key]["tests_count"] += 1

            # Add to ledger
            patient_ledger.append(
                CommissionPatientLedgerItem(
                    booking_id=str(b.id),
                    booking_id_display=b.booking_id_display,
                    booking_date=b.booking_date,
                    patient_id=str(b.patient_id),
                    patient_name=p_name,
                    patient_mrn=p_mrn,
                    doctor_name=doc_name,
                    test_id=test_id_str,
                    test_name=item_name,
                    test_price=item_price,
                    commission_percentage=applied_pct,
                    commission_amount=item_comm,
                    payment_status=b.payment_status.value if hasattr(b.payment_status, "value") else str(b.payment_status),
                )
            )

    # Effective overall percentage
    effective_pct = (
        round((total_commission / total_income) * Decimal("100.00"), 2)
        if total_income > Decimal("0.00")
        else Decimal("0.00")
    )

    # Format doctors summary list
    doctors_summary: List[DoctorSummaryItem] = []
    for d in doctor_stats.values():
        d_income = d["income"]
        d_comm = d["commission"]
        d_eff = round((d_comm / d_income) * Decimal("100.00"), 2) if d_income > 0 else Decimal("0.00")
        doctors_summary.append(
            DoctorSummaryItem(
                doctor_id=d["doctor_id"],
                doctor_name=d["doctor_name"],
                specialization=d["specialization"],
                phone=d["phone"],
                clinic_hospital_name=d["clinic_hospital_name"],
                default_commission_percentage=d["default_percentage"],
                total_income=d_income,
                total_commission=d_comm,
                effective_percentage=d_eff,
                total_tests=d["tests_count"],
                total_patients=len(d["patients"]),
                total_bookings=len(d["bookings"]),
            )
        )
    doctors_summary.sort(key=lambda x: x.total_commission, reverse=True)

    # Format test breakdown list
    test_breakdown: List[CommissionTestBreakdownItem] = []
    for t in test_breakdown_map.values():
        # Representative percentage
        pct_list = t["percentages"]
        avg_pct = round(sum(pct_list) / Decimal(len(pct_list)), 2) if pct_list else Decimal("0.00")
        test_breakdown.append(
            CommissionTestBreakdownItem(
                test_id=t["test_id"],
                test_name=t["test_name"],
                test_code=t["test_code"] or None,
                category_name=t["category_name"],
                tests_count=t["tests_count"],
                total_income=t["total_income"],
                commission_percentage=avg_pct,
                is_custom_percentage=t["has_custom"],
                commission_amount=t["total_commission"],
            )
        )
    test_breakdown.sort(key=lambda x: x.commission_amount, reverse=True)

    # Format trends list
    trends: List[CommissionTrendItem] = [
        CommissionTrendItem(
            period_label=key,
            total_income=val["income"],
            total_commission=val["commission"],
            tests_count=val["tests_count"],
        )
        for key, val in sorted(trends_map.items())
    ]

    return DoctorCommissionReportResponse(
        period_type=period_type,
        start_date=start_date,
        end_date=end_date,
        doctor_filter=target_doctor.name if target_doctor else None,
        doctor_id_filter=str(target_doctor.id) if target_doctor else None,
        total_income=total_income,
        total_commission=total_commission,
        effective_percentage=effective_pct,
        total_tests=total_tests_count,
        total_patients=len(unique_patients),
        total_bookings=len(unique_bookings),
        doctors_summary=doctors_summary,
        test_breakdown=test_breakdown,
        patient_ledger=patient_ledger,
        trends=trends,
    )
