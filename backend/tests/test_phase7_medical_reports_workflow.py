import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase7_medical_report_workflow_and_gate_check(client: AsyncClient, seed_test_data):
    """Phase 7 Gate Check:
    1. Report progression (DRAFT -> APPROVED -> FINAL).
    2. Digital signature, tamper-proof HMAC digest, and ReportLab PDF generation.
    3. Immutable report protection: standard PUT on finalized report returns 400 Bad Request.
    4. Versioned amendment: Creates Version 2, preserves Version 1 snapshot, allows editing in v2.
    5. Public QR verification: Unauthenticated scan resolves public view with masked patient data.
    6. Multi-tenant isolation: Cross-lab access returns 403 Forbidden.
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

    # Step 1: Create Test Category & Test
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "BIO_P7", "name": "Biochemistry P7", "display_order": 1, "is_active": True},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "LFT_P7",
            "name": "Liver Function Panel P7",
            "short_name": "LFT",
            "test_type": "BIOCHEMISTRY",
            "sample_type": "SERUM",
            "default_price": 600.00,
            "is_active": True,
            "parameters": [
                {
                    "code": "TBIL",
                    "name": "Total Bilirubin",
                    "unit": "mg/dL",
                    "result_type": "NUMBER",
                    "decimal_precision": 2,
                    "reference_ranges": [
                        {
                            "gender": None,
                            "age_min_years": 0,
                            "age_max_years": 120,
                            "min_value": 0.2,
                            "max_value": 1.2,
                            "display_range_string": "0.2 - 1.2 mg/dL",
                        }
                    ],
                }
            ],
        },
    )
    assert test_res.status_code == 201
    test_data = test_res.json()["data"]
    test_id = test_data["id"]
    param_id = test_data["parameters"][0]["id"]

    # Step 2: Register Patient in Lab 1
    patient_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Karan",
            "last_name": "Malhotra",
            "gender": "MALE",
            "age_years": 38,
            "phone": "+91 99000 88000",
            "email": "karan.malhotra@example.com",
            "city": "Delhi",
            "state": "Delhi",
        },
    )
    assert patient_res.status_code == 201
    patient_id = patient_res.json()["data"]["id"]

    # Step 3: Create Booking (generates draft report)
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": "2026-10-03",
            "appointment_time": "09:00 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0,
            "tax_percentage": 0,
            "paid_amount": 600.00,
        },
    )
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["data"]["id"]

    # Retrieve created report
    pending_res = await client.get("/api/results/pending", headers={"Authorization": f"Bearer {lab1_token}"})
    assert pending_res.status_code == 200
    worklist = pending_res.json()["data"]
    report_id = [r["report_id"] for r in worklist if r["booking_id"] == booking_id][0]

    # Step 4: Enter Results
    save_val_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "values": [{"parameter_id": param_id, "numeric_value": 0.8}],
            "submit_for_review": True,
        },
    )
    assert save_val_res.status_code == 200
    assert save_val_res.json()["data"]["status"] == "PENDING_REVIEW"

    # Step 5: Pathologist Approves Report
    approve_res = await client.post(
        f"/api/reports/{report_id}/approve",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["data"]["status"] == "APPROVED"
    assert approve_res.json()["data"]["approved_by_name"] is not None

    # Step 6: Pathologist Finalizes and Seals Report (triggers HMAC, QR token, and PDF generation)
    finalize_res = await client.post(
        f"/api/reports/{report_id}/finalize",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert finalize_res.status_code == 200
    final_data = finalize_res.json()["data"]
    assert final_data["status"] == "FINAL"
    assert final_data["is_immutable"] is True
    assert final_data["current_version"] == 1
    assert final_data["hmac_digest"] is not None
    assert final_data["verification_token"] is not None
    assert final_data["pdf_file_url"] == f"/api/reports/{report_id}/download"
    verification_token = final_data["verification_token"]

    # Verify PDF Download
    download_res = await client.get(
        f"/api/reports/{report_id}/download",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert download_res.status_code == 200
    assert download_res.headers["content-type"] == "application/pdf"
    assert len(download_res.content) > 1000

    # Step 7: CRITICAL GATE CHECK 1 - Immutability Protection
    # Standard PUT to modify values MUST FAIL with 400 Bad Request
    attempt_val_put = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 1.1}]},
    )
    assert attempt_val_put.status_code == 400
    assert "cannot modify a finalized" in attempt_val_put.json()["message"].lower()

    # Step 8: CRITICAL GATE CHECK 2 - Versioned Amendment
    # Create Version 2 with documented amendment justification
    amend_payload = {"amendment_reason": "Clinician requested repeat analysis on secondary calibration standard."}
    amend_res = await client.post(
        f"/api/reports/{report_id}/amend",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json=amend_payload,
    )
    assert amend_res.status_code == 200
    amended_data = amend_res.json()["data"]
    assert amended_data["current_version"] == 2
    assert amended_data["status"] == "DRAFT"
    assert amended_data["is_immutable"] is False
    assert len(amended_data["versions"]) == 1
    v1_snapshot = amended_data["versions"][0]
    assert v1_snapshot["version_number"] == 1
    assert "repeat analysis" in v1_snapshot["amendment_reason"]

    # Now that it is v2 in DRAFT, editing values is allowed
    amend_val_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 0.9}]},
    )
    assert amend_val_res.status_code == 200
    assert float(amend_val_res.json()["data"]["values"][0]["numeric_value"]) == 0.9

    # Finalize Version 2
    finalize_v2_res = await client.post(
        f"/api/reports/{report_id}/finalize",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert finalize_v2_res.status_code == 200
    assert finalize_v2_res.json()["data"]["current_version"] == 2
    assert finalize_v2_res.json()["data"]["status"] == "FINAL"
    assert finalize_v2_res.json()["data"]["is_immutable"] is True

    # Step 9: CRITICAL GATE CHECK 3 - Public QR Verification
    # Unauthenticated client verifies report authenticity using verification token
    verify_res = await client.get(f"/api/reports/verify/{verification_token}")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()["data"]
    assert verify_data["is_valid"] is True
    assert verify_data["report_id_display"] == final_data["report_id_display"]
    assert verify_data["test_name"] == "Liver Function Panel P7"
    # Verify patient privacy masking: e.g. "K*** M******", NOT plain "Karan Malhotra"
    assert verify_data["patient_name_masked"] != "Karan Malhotra"
    assert "*" in verify_data["patient_name_masked"]
    assert verify_data["patient_name_masked"].startswith("K")

    # Step 10: Multi-Tenant Isolation Gate Check
    # Lab 2 staff cannot view Lab 1 report
    cross_get = await client.get(f"/api/reports/{report_id}", headers={"Authorization": f"Bearer {lab2_token}"})
    assert cross_get.status_code == 403

    # Lab 2 staff cannot download Lab 1 PDF
    cross_dl = await client.get(f"/api/reports/{report_id}/download", headers={"Authorization": f"Bearer {lab2_token}"})
    assert cross_dl.status_code == 403

    # Lab 2 staff cannot finalize Lab 1 report
    cross_fin = await client.post(f"/api/reports/{report_id}/finalize", headers={"Authorization": f"Bearer {lab2_token}"})
    assert cross_fin.status_code == 403

    # Lab 2 staff cannot amend Lab 1 report
    cross_amend = await client.post(
        f"/api/reports/{report_id}/amend",
        headers={"Authorization": f"Bearer {lab2_token}"},
        json={"amendment_reason": "Unauthorized attempt."},
    )
    assert cross_amend.status_code == 403
