import pytest
from httpx import AsyncClient
from datetime import date
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase10_operational_dashboards_and_analytics_gate_check(
    client: AsyncClient, seed_test_data
):
    """Phase 10 Gate Check:
    1. Initial Lab 1 dashboard metrics baseline.
    2. Creating a new booking today increments today_bookings_count and updates revenue.
    3. Finalizing the report increments reports_completed counter in real-time.
    4. Super Admin dashboard aggregates platform-wide stats, lab growth, and revenue.
    5. Multi-tenant isolation: Lab 1 metrics do not leak into Lab 2 dashboard.
    6. Non-super-admin user attempting to access /api/admin/dashboard returns 403 Forbidden.
    """
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]
    lab2_admin = seed_test_data["lab2_admin"]

    super_token = create_access_token(
        data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email}
    )
    lab1_token = create_access_token(
        data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id}
    )
    lab2_token = create_access_token(
        data={"sub": lab2_admin.id, "role": lab2_admin.role.value, "email": lab2_admin.email, "lab_id": lab2_admin.lab_id}
    )

    # 1. Baseline Lab 1 Dashboard
    dash1_base = await client.get("/api/lab/dashboard", headers={"Authorization": f"Bearer {lab1_token}"})
    assert dash1_base.status_code == 200
    base_data = dash1_base.json()["data"]
    base_bookings = base_data["total_bookings_count"]
    base_today = base_data["today_bookings_count"]
    base_reports_completed = base_data["reports_completed"]
    base_revenue = float(base_data["revenue_total"])

    # 2. Setup Test & Patient
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "DASH_P10", "name": "Dashboard Panel P10", "display_order": 1, "is_active": True},
    )
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "GLU_P10",
            "name": "Glucose Random P10",
            "short_name": "GLU",
            "test_type": "BIOCHEMISTRY",
            "sample_type": "SERUM",
            "default_price": 300.00,
            "is_active": True,
        },
    )
    test_id = test_res.json()["data"]["id"]

    param_res = await client.post(
        f"/api/tests/{test_id}/parameters",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"name": "Glucose", "code": "GLU", "unit": "mg/dL", "display_order": 1},
    )
    param_id = param_res.json()["data"]["id"]

    p_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Rohan",
            "last_name": "Verma",
            "gender": "MALE",
            "age_years": 40,
            "phone": "+91 97777 66666",
            "city": "Bengaluru",
        },
    )
    patient_id = p_res.json()["data"]["id"]

    # 3. Create a Booking Today with Partial Payment
    today_str = date.today().isoformat()
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": today_str,
            "appointment_time": "10:30 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0.00,
            "tax_percentage": 0,
            "paid_amount": 200.00,
        },
    )
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["data"]["id"]

    # CRITICAL GATE CHECK 1: Real-time counter updates for Bookings & Revenue
    dash1_after_booking = await client.get("/api/lab/dashboard", headers={"Authorization": f"Bearer {lab1_token}"})
    assert dash1_after_booking.status_code == 200
    b_data = dash1_after_booking.json()["data"]

    assert b_data["total_bookings_count"] == base_bookings + 1
    assert b_data["today_bookings_count"] == base_today + 1
    assert float(b_data["revenue_total"]) == base_revenue + 200.00
    assert float(b_data["outstanding_receivables"]) >= 100.00
    assert len(b_data["recent_bookings"]) >= 1
    assert b_data["recent_bookings"][0]["id"] == booking_id

    # 4. Finalize Report
    worklist_res = await client.get("/api/results/pending", headers={"Authorization": f"Bearer {lab1_token}"})
    worklist = worklist_res.json()["data"]
    report_id = [r["report_id"] for r in worklist if r["booking_id"] == booking_id][0]

    await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 110.0}], "submit_for_review": True},
    )
    await client.post(f"/api/reports/{report_id}/approve", headers={"Authorization": f"Bearer {lab1_token}"})
    fin_res = await client.post(f"/api/reports/{report_id}/finalize", headers={"Authorization": f"Bearer {lab1_token}"})
    assert fin_res.status_code == 200

    # CRITICAL GATE CHECK 2: Real-time counter update for Completed Reports
    dash1_after_report = await client.get("/api/lab/dashboard", headers={"Authorization": f"Bearer {lab1_token}"})
    assert dash1_after_report.status_code == 200
    r_data = dash1_after_report.json()["data"]

    assert r_data["reports_completed"] == base_reports_completed + 1
    assert len(r_data["recent_reports"]) >= 1
    assert r_data["recent_reports"][0]["id"] == report_id

    # 5. Super Admin Global Analytics Verification
    super_dash = await client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {super_token}"})
    assert super_dash.status_code == 200
    s_data = super_dash.json()["data"]

    assert s_data["total_laboratories"] >= 2
    assert s_data["active_laboratories"] >= 2
    assert s_data["total_bookings"] >= 1
    assert float(s_data["total_revenue"]) >= 200.00
    assert s_data["total_reports_completed"] >= 1
    assert len(s_data["lab_performance"]) >= 2
    assert len(s_data["daily_trends"]) == 7

    # 6. Multi-Tenant Isolation: Lab 2 Dashboard must NOT reflect Lab 1's booking
    dash2 = await client.get("/api/lab/dashboard", headers={"Authorization": f"Bearer {lab2_token}"})
    assert dash2.status_code == 200
    dash2_data = dash2.json()["data"]
    assert dash2_data["total_bookings_count"] == 0
    assert float(dash2_data["revenue_total"]) == 0.00

    # 7. Role Security Guard: Lab staff cannot call /api/admin/dashboard
    unauth_admin_call = await client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {lab1_token}"})
    assert unauth_admin_call.status_code == 403
