import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, get_password_hash
from app.models.user import User, UserRole


@pytest.mark.asyncio
async def test_phase9_patient_self_service_portal_gate_check(
    client: AsyncClient, db_session: AsyncSession, seed_test_data
):
    """Phase 9 Gate Check:
    1. Independent patient user authentication with role PATIENT.
    2. Patient can query their own profile, appointments, billing invoices, and finalized reports.
    3. Direct 1-click download of finalized PDF report and invoice receipt.
    4. CRITICAL GATE CHECK (Patient Isolation):
       - Patient A attempting to view Patient B's report details returns 403 Forbidden.
       - Patient A attempting to download Patient B's report PDF returns 403 Forbidden.
       - Patient A attempting to download Patient B's receipt PDF returns 403 Forbidden.
       - Non-patient staff user calling /patient-portal returns 403 Forbidden.
    """
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]

    super_token = create_access_token(
        data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email}
    )
    lab1_token = create_access_token(
        data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id}
    )

    # Step 1: Create Test & Parameter
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "PATH_P9", "name": "Pathology P9", "display_order": 1, "is_active": True},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "CHO_P9",
            "name": "Cholesterol Total P9",
            "short_name": "CHO",
            "test_type": "BIOCHEMISTRY",
            "sample_type": "SERUM",
            "default_price": 500.00,
            "is_active": True,
        },
    )
    assert test_res.status_code == 201
    test_id = test_res.json()["data"]["id"]

    param_res = await client.post(
        f"/api/tests/{test_id}/parameters",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "name": "Cholesterol Total",
            "code": "CHO_TOT",
            "unit": "mg/dL",
            "display_order": 1,
        },
    )
    assert param_res.status_code == 201
    param_id = param_res.json()["data"]["id"]

    # Step 2: Register Two Distinct Patients in Lab 1
    # Patient A
    pA_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Anita",
            "last_name": "Roy",
            "gender": "FEMALE",
            "age_years": 32,
            "phone": "+91 98888 11111",
            "email": "anita.roy@example.com",
            "blood_group": "B_POSITIVE",
            "city": "Mumbai",
        },
    )
    assert pA_res.status_code == 201
    patient_a_id = pA_res.json()["data"]["id"]

    # Patient B
    pB_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Bikram",
            "last_name": "Singh",
            "gender": "MALE",
            "age_years": 45,
            "phone": "+91 98888 22222",
            "email": "bikram.singh@example.com",
            "blood_group": "O_POSITIVE",
            "city": "Pune",
        },
    )
    assert pB_res.status_code == 201
    patient_b_id = pB_res.json()["data"]["id"]

    # Step 3: Create User Accounts with role PATIENT
    user_patient_a = User(
        id="user-patient-a-uuid-9999",
        lab_id=lab1_admin.lab_id,
        email="anita.roy@example.com",
        phone="+91 98888 11111",
        hashed_password=get_password_hash("PatientA@123"),
        first_name="Anita",
        last_name="Roy",
        role=UserRole.PATIENT,
        is_active=True,
    )
    user_patient_b = User(
        id="user-patient-b-uuid-8888",
        lab_id=lab1_admin.lab_id,
        email="bikram.singh@example.com",
        phone="+91 98888 22222",
        hashed_password=get_password_hash("PatientB@123"),
        first_name="Bikram",
        last_name="Singh",
        role=UserRole.PATIENT,
        is_active=True,
    )
    db_session.add_all([user_patient_a, user_patient_b])
    await db_session.commit()

    patient_a_token = create_access_token(
        data={"sub": user_patient_a.id, "role": user_patient_a.role.value, "email": user_patient_a.email}
    )
    patient_b_token = create_access_token(
        data={"sub": user_patient_b.id, "role": user_patient_b.role.value, "email": user_patient_b.email}
    )

    # Step 4: Create Bookings for Both Patients
    # Booking A
    bkA_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_a_id,
            "appointment_date": "2026-10-10",
            "appointment_time": "10:00 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 50.00,
            "tax_percentage": 0,
            "paid_amount": 450.00,
        },
    )
    assert bkA_res.status_code == 201
    booking_a_id = bkA_res.json()["data"]["id"]

    # Booking B
    bkB_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_b_id,
            "appointment_date": "2026-10-11",
            "appointment_time": "11:00 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0.00,
            "tax_percentage": 0,
            "paid_amount": 500.00,
        },
    )
    assert bkB_res.status_code == 201
    booking_b_id = bkB_res.json()["data"]["id"]

    # Find generated reports
    worklist_res = await client.get("/api/results/pending", headers={"Authorization": f"Bearer {lab1_token}"})
    assert worklist_res.status_code == 200
    worklist = worklist_res.json()["data"]

    report_a_id = [r["report_id"] for r in worklist if r["booking_id"] == booking_a_id][0]
    report_b_id = [r["report_id"] for r in worklist if r["booking_id"] == booking_b_id][0]

    # Enter Results and Finalize Report A
    await client.put(
        f"/api/results/{report_a_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 180.0}], "submit_for_review": True},
    )
    await client.post(f"/api/reports/{report_a_id}/approve", headers={"Authorization": f"Bearer {lab1_token}"})
    fin_a = await client.post(f"/api/reports/{report_a_id}/finalize", headers={"Authorization": f"Bearer {lab1_token}"})
    assert fin_a.status_code == 200

    # Enter Results and Finalize Report B
    await client.put(
        f"/api/results/{report_b_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 240.0}], "submit_for_review": True},
    )
    await client.post(f"/api/reports/{report_b_id}/approve", headers={"Authorization": f"Bearer {lab1_token}"})
    fin_b = await client.post(f"/api/reports/{report_b_id}/finalize", headers={"Authorization": f"Bearer {lab1_token}"})
    assert fin_b.status_code == 200

    # Step 5: Verify Patient A Self-Service Endpoints
    # 5.1 Profile
    prof_res = await client.get("/api/patient-portal/profile", headers={"Authorization": f"Bearer {patient_a_token}"})
    assert prof_res.status_code == 200
    assert prof_res.json()["data"]["first_name"] == "Anita"
    assert prof_res.json()["data"]["phone"] == "+91 98888 11111"

    # 5.2 Dashboard
    dash_res = await client.get("/api/patient-portal/dashboard", headers={"Authorization": f"Bearer {patient_a_token}"})
    assert dash_res.status_code == 200
    dash_data = dash_res.json()["data"]
    assert dash_data["total_bookings"] == 1
    assert dash_data["completed_reports"] == 1
    assert len(dash_data["recent_reports"]) == 1
    assert dash_data["recent_reports"][0]["id"] == report_a_id

    # 5.3 Bookings
    bks_res = await client.get("/api/patient-portal/bookings", headers={"Authorization": f"Bearer {patient_a_token}"})
    assert bks_res.status_code == 200
    assert len(bks_res.json()["data"]) == 1
    assert bks_res.json()["data"][0]["id"] == booking_a_id

    # 5.4 Reports
    reps_res = await client.get("/api/patient-portal/reports", headers={"Authorization": f"Bearer {patient_a_token}"})
    assert reps_res.status_code == 200
    assert len(reps_res.json()["data"]) == 1
    assert reps_res.json()["data"][0]["id"] == report_a_id

    # 5.5 Report Detail
    rep_det_res = await client.get(
        f"/api/patient-portal/reports/{report_a_id}",
        headers={"Authorization": f"Bearer {patient_a_token}"},
    )
    assert rep_det_res.status_code == 200
    assert rep_det_res.json()["data"]["status"] == "FINAL"
    assert float(rep_det_res.json()["data"]["result_values"][0]["numeric_value"]) == 180.0

    # 5.6 1-Click PDF Download
    dl_res = await client.get(
        f"/api/patient-portal/reports/{report_a_id}/download",
        headers={"Authorization": f"Bearer {patient_a_token}"},
    )
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"] == "application/pdf"
    assert len(dl_res.content) > 500

    # 5.7 Invoices & Receipt
    inv_res = await client.get("/api/patient-portal/invoices", headers={"Authorization": f"Bearer {patient_a_token}"})
    assert inv_res.status_code == 200
    assert len(inv_res.json()["data"]) == 1
    invoice_a_id = inv_res.json()["data"][0]["id"]

    rec_res = await client.get(
        f"/api/patient-portal/invoices/{invoice_a_id}/receipt",
        headers={"Authorization": f"Bearer {patient_a_token}"},
    )
    assert rec_res.status_code == 200
    assert rec_res.headers["content-type"] == "application/pdf"
    assert len(rec_res.content) > 500

    # =========================================================================
    # STEP 6: CRITICAL GATE CHECK - Strict Patient Isolation
    # =========================================================================

    # Patient A attempts to view Patient B's report details -> MUST BE 403 Forbidden!
    cross_report_get = await client.get(
        f"/api/patient-portal/reports/{report_b_id}",
        headers={"Authorization": f"Bearer {patient_a_token}"},
    )
    assert cross_report_get.status_code == 403
    assert "Access forbidden" in cross_report_get.json()["message"]

    # Patient A attempts to download Patient B's report PDF -> MUST BE 403 Forbidden!
    cross_report_dl = await client.get(
        f"/api/patient-portal/reports/{report_b_id}/download",
        headers={"Authorization": f"Bearer {patient_a_token}"},
    )
    assert cross_report_dl.status_code == 403
    assert "Access forbidden" in cross_report_dl.json()["message"]

    # Find Patient B's invoice ID
    inv_b_res = await client.get("/api/patient-portal/invoices", headers={"Authorization": f"Bearer {patient_b_token}"})
    assert inv_b_res.status_code == 200
    assert len(inv_b_res.json()["data"]) == 1
    invoice_b_id = inv_b_res.json()["data"][0]["id"]

    # Patient A attempts to download Patient B's receipt PDF -> MUST BE 403 Forbidden!
    cross_rec_dl = await client.get(
        f"/api/patient-portal/invoices/{invoice_b_id}/receipt",
        headers={"Authorization": f"Bearer {patient_a_token}"},
    )
    assert cross_rec_dl.status_code == 403
    assert "Access forbidden" in cross_rec_dl.json()["message"]

    # Lab staff role attempting to access patient portal -> MUST BE 403 Forbidden
    staff_attempt = await client.get(
        "/api/patient-portal/dashboard",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert staff_attempt.status_code == 403
