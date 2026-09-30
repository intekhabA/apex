import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase5_hemoglobin_calculation_gate_check(client: AsyncClient, seed_test_data):
    """Phase 5 Gate Check:
    Inputting Hemoglobin = 10.5 for an adult male outputs status LOW automatically
    based on configured 13–17 range without asserting a diagnosis.
    Also verifies critical thresholds (CRITICAL_LOW, CRITICAL_HIGH, NORMAL),
    status transitions (DRAFT -> PENDING_REVIEW), and strict multi-tenant isolation.
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

    # Step 1: Create Category and Test Catalog item (CBC with Hemoglobin parameter)
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "HEM", "name": "Hematology", "display_order": 1, "is_active": True},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    test_payload = {
        "category_id": cat_id,
        "code": "CBC_P5",
        "name": "Complete Blood Count",
        "short_name": "CBC",
        "test_type": "PATHOLOGY",
        "sample_type": "WHOLE_BLOOD_EDTA",
        "sample_container": "Lavender Top Tube",
        "turnaround_hours": 12,
        "default_price": 350.00,
        "is_active": True,
        "parameters": [
            {
                "code": "HB",
                "name": "Hemoglobin",
                "unit": "g/dL",
                "result_type": "NUMBER",
                "decimal_precision": 1,
                "display_order": 1,
                "reference_ranges": [
                    {
                        "gender": "MALE",
                        "age_min_years": 18,
                        "age_max_years": 120,
                        "min_value": 13.0,
                        "max_value": 17.0,
                        "critical_low": 7.0,
                        "critical_high": 20.0,
                        "display_range_string": "13.0 - 17.0 g/dL",
                    },
                    {
                        "gender": "FEMALE",
                        "age_min_years": 18,
                        "age_max_years": 120,
                        "min_value": 12.0,
                        "max_value": 15.5,
                        "critical_low": 7.0,
                        "critical_high": 19.0,
                        "display_range_string": "12.0 - 15.5 g/dL",
                    },
                ],
            }
        ],
    }
    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json=test_payload,
    )
    assert test_res.status_code == 201
    test_data = test_res.json()["data"]
    test_id = test_data["id"]
    hb_param = test_data["parameters"][0]
    hb_param_id = hb_param["id"]

    # Step 2: Register Adult Male Patient (Age 35) in Lab 1
    patient_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Amitabh",
            "last_name": "Sharma",
            "gender": "MALE",
            "age_years": 35,
            "age_months": 0,
            "phone": "+91 98765 11111",
            "email": "amitabh.sharma@example.com",
            "city": "Mumbai",
            "state": "Maharashtra",
        },
    )
    assert patient_res.status_code == 201
    patient_id = patient_res.json()["data"]["id"]

    # Step 3: Create Booking in Lab 1 (triggers auto-creation of Report)
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": "2026-10-01",
            "appointment_time": "10:00 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0,
            "tax_percentage": 0,
            "paid_amount": 0,
        },
    )
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["data"]["id"]

    # Step 4: Verify Report exists in Pending Worklist
    pending_res = await client.get(
        "/api/results/pending",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert pending_res.status_code == 200
    worklist = pending_res.json()["data"]
    matching_reports = [r for r in worklist if r["booking_id"] == booking_id]
    assert len(matching_reports) == 1
    report_id = matching_reports[0]["report_id"]
    assert matching_reports[0]["status"] == "DRAFT"

    # Step 5: Lab 1 technician fetches result entry worksheet
    sheet_res = await client.get(
        f"/api/results/{report_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert sheet_res.status_code == 200
    sheet_data = sheet_res.json()["data"]
    assert sheet_data["patient_gender"] == "MALE"
    assert sheet_data["patient_age_years"] == 35
    assert len(sheet_data["values"]) == 1
    assert sheet_data["values"][0]["parameter_code"] == "HB"
    assert sheet_data["values"][0]["reference_range_display"] == "13.0 - 17.0 g/dL"

    # Step 6: CRITICAL GATE CHECK - Enter Hemoglobin = 10.5
    # Expected: 10.5 is below 13.0, above 7.0 -> Flag must be "LOW"
    save_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "values": [
                {
                    "parameter_id": hb_param_id,
                    "numeric_value": 10.5,
                    "technician_comment": "Sample processed on automated cell counter.",
                }
            ],
            "submit_for_review": False,
        },
    )
    assert save_res.status_code == 200
    saved_data = save_res.json()["data"]
    val_hb = saved_data["values"][0]
    assert float(val_hb["numeric_value"]) == 10.5
    assert val_hb["flag"] == "LOW"
    assert val_hb["reference_range_display"] == "13.0 - 17.0 g/dL"
    assert saved_data["status"] == "DRAFT"

    # Step 7: Test other boundary conditions
    # 7a: Value 6.5 (< 7.0 critical low) -> CRITICAL_LOW
    save_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "values": [{"parameter_id": hb_param_id, "numeric_value": 6.5}],
            "submit_for_review": False,
        },
    )
    assert save_res.status_code == 200
    assert save_res.json()["data"]["values"][0]["flag"] == "CRITICAL_LOW"

    # 7b: Value 21.0 (> 20.0 critical high) -> CRITICAL_HIGH
    save_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "values": [{"parameter_id": hb_param_id, "numeric_value": 21.0}],
            "submit_for_review": False,
        },
    )
    assert save_res.status_code == 200
    assert save_res.json()["data"]["values"][0]["flag"] == "CRITICAL_HIGH"

    # 7c: Value 14.5 (within 13.0 - 17.0) -> NORMAL and submit for review
    save_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "values": [{"parameter_id": hb_param_id, "numeric_value": 14.5}],
            "submit_for_review": True,
        },
    )
    assert save_res.status_code == 200
    assert save_res.json()["data"]["values"][0]["flag"] == "NORMAL"
    assert save_res.json()["data"]["status"] == "PENDING_REVIEW"

    # Step 8: Multi-tenant Isolation Gate Check
    # Lab 2 staff attempts to retrieve Lab 1 report -> 403 Forbidden
    cross_get = await client.get(
        f"/api/results/{report_id}",
        headers={"Authorization": f"Bearer {lab2_token}"},
    )
    assert cross_get.status_code == 403

    # Lab 2 staff attempts to edit Lab 1 report -> 403 Forbidden
    cross_put = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab2_token}"},
        json={"values": [{"parameter_id": hb_param_id, "numeric_value": 15.0}]},
    )
    assert cross_put.status_code == 403


@pytest.mark.asyncio
async def test_phase5_gender_specific_reference_range_evaluation(client: AsyncClient, seed_test_data):
    """Test that biological reference ranges correctly evaluate gender-specific intervals:
    For Hemoglobin, 12.5 g/dL is NORMAL for a FEMALE (12.0 - 15.5) but LOW for a MALE (13.0 - 17.0).
    """
    lab1_admin = seed_test_data["lab1_admin"]
    lab1_token = create_access_token(
        data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id}
    )

    super_admin = seed_test_data["super_admin"]
    super_token = create_access_token(
        data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email}
    )

    # Create Category and CBC test
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "HEM2", "name": "Hematology 2", "display_order": 1, "is_active": True},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "CBC_FEMALE",
            "name": "Complete Blood Count Female Test",
            "short_name": "CBC",
            "test_type": "PATHOLOGY",
            "sample_type": "WHOLE_BLOOD_EDTA",
            "sample_container": "Lavender Top Tube",
            "default_price": 350.00,
            "is_active": True,
            "parameters": [
                {
                    "code": "HB",
                    "name": "Hemoglobin",
                    "unit": "g/dL",
                    "result_type": "NUMBER",
                    "decimal_precision": 1,
                    "reference_ranges": [
                        {
                            "gender": "MALE",
                            "age_min_years": 18,
                            "age_max_years": 120,
                            "min_value": 13.0,
                            "max_value": 17.0,
                            "display_range_string": "13.0 - 17.0 g/dL",
                        },
                        {
                            "gender": "FEMALE",
                            "age_min_years": 18,
                            "age_max_years": 120,
                            "min_value": 12.0,
                            "max_value": 15.5,
                            "display_range_string": "12.0 - 15.5 g/dL",
                        },
                    ],
                }
            ],
        },
    )
    assert test_res.status_code == 201
    test_data = test_res.json()["data"]
    test_id = test_data["id"]
    hb_param_id = test_data["parameters"][0]["id"]

    # Register Adult Female Patient (Age 28)
    patient_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Pooja",
            "last_name": "Nair",
            "gender": "FEMALE",
            "age_years": 28,
            "age_months": 0,
            "phone": "+91 97777 22222",
            "email": "pooja.nair@example.com",
            "city": "Bengaluru",
            "state": "Karnataka",
        },
    )
    assert patient_res.status_code == 201
    female_patient_id = patient_res.json()["data"]["id"]

    # Create Booking
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": female_patient_id,
            "appointment_date": "2026-10-01",
            "appointment_time": "11:00 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0,
            "tax_percentage": 0,
            "paid_amount": 0,
        },
    )
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["data"]["id"]

    # Find the report
    pending_res = await client.get("/api/results/pending", headers={"Authorization": f"Bearer {lab1_token}"})
    worklist = pending_res.json()["data"]
    report_id = [r["report_id"] for r in worklist if r["booking_id"] == booking_id][0]

    # Enter Hemoglobin = 12.5
    save_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "values": [{"parameter_id": hb_param_id, "numeric_value": 12.5}],
            "submit_for_review": False,
        },
    )
    assert save_res.status_code == 200
    val_data = save_res.json()["data"]["values"][0]
    # For female, 12.5 is NORMAL (range 12.0 - 15.5)
    assert val_data["flag"] == "NORMAL"
    assert val_data["reference_range_display"] == "12.0 - 15.5 g/dL"
