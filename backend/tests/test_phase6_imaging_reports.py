import io
import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase6_imaging_report_gate_check(client: AsyncClient, seed_test_data):
    """Phase 6 Gate Check:
    1. Retrieve pre-configured ultrasound and radiography narrative templates.
    2. Register patient and book an imaging diagnostic test (Chest X-Ray PA View).
    3. Radiologist uploads a diagnostic scan/image attachment.
    4. Radiologist writes structured narrative findings (Clinical History, Findings, Impression, Recommendations).
    5. Verify report persists findings and attachment metadata.
    6. Verify strict multi-tenant isolation: Lab 2 staff cannot access or mutate Lab 1 imaging report.
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

    # Step 1: Verify pre-seeded clinical templates
    tpl_res = await client.get("/api/imaging/templates", headers={"Authorization": f"Bearer {lab1_token}"})
    assert tpl_res.status_code == 200
    templates = tpl_res.json()["data"]
    assert len(templates) >= 5
    chest_tpl = next((t for t in templates if t["id"] == "CHEST_XRAY_PA"), None)
    assert chest_tpl is not None
    assert "clear bilaterally" in chest_tpl["findings_template"].lower()

    # Step 2: Create Radiology Category and Test
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "RAD", "name": "Radiology & Imaging", "display_order": 5, "is_active": True},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "CXR_PA",
            "name": "Chest X-Ray PA View",
            "short_name": "Chest X-Ray",
            "test_type": "RADIOLOGY",
            "sample_type": "IMAGING",
            "turnaround_hours": 6,
            "default_price": 500.00,
            "is_active": True,
        },
    )
    assert test_res.status_code == 201
    test_id = test_res.json()["data"]["id"]

    # Step 3: Register Patient in Lab 1
    patient_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Kavita",
            "last_name": "Iyer",
            "gender": "FEMALE",
            "age_years": 42,
            "phone": "+91 91234 56789",
            "email": "kavita.iyer@example.com",
        },
    )
    assert patient_res.status_code == 201
    patient_id = patient_res.json()["data"]["id"]

    # Step 4: Create Booking for Radiology Test (auto-generates Report)
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": "2026-10-02",
            "appointment_time": "02:30 PM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0,
            "tax_percentage": 0,
            "paid_amount": 500.00,
        },
    )
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["data"]["id"]

    # Retrieve created report from pending results
    pending_res = await client.get("/api/results/pending", headers={"Authorization": f"Bearer {lab1_token}"})
    assert pending_res.status_code == 200
    worklist = pending_res.json()["data"]
    matching_reports = [r for r in worklist if r["booking_id"] == booking_id]
    assert len(matching_reports) == 1
    report_id = matching_reports[0]["report_id"]

    # Step 5: Radiologist uploads simulated X-ray scan image
    fake_image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    files = {"file": ("chest_xray_pa.png", io.BytesIO(fake_image_bytes), "image/png")}
    data = {"caption": "PA erect view showing normal lung parenchyma and cardiothoracic silhouette."}

    upload_res = await client.post(
        f"/api/imaging/{report_id}/attachments",
        headers={"Authorization": f"Bearer {lab1_token}"},
        files=files,
        data=data,
    )
    assert upload_res.status_code == 201
    attachment = upload_res.json()["data"]
    attachment_id = attachment["id"]
    assert attachment["file_name"] == "chest_xray_pa.png"
    assert attachment["caption"] == "PA erect view showing normal lung parenchyma and cardiothoracic silhouette."

    # Step 6: Radiologist writes structured narrative findings & submits draft
    narrative_payload = {
        "clinical_history": "42-year-old female presenting with dry cough for 5 days. Pre-operative anesthesia fitness.",
        "imaging_findings": chest_tpl["findings_template"],
        "imaging_impression": "Normal chest radiograph (PA View). No cardiopulmonary abnormality identified.",
        "recommendations": "Cleared from pulmonary standpoint for elective surgical procedure.",
        "submit_for_review": False,
    }

    put_res = await client.put(
        f"/api/imaging/{report_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json=narrative_payload,
    )
    assert put_res.status_code == 200
    report_data = put_res.json()["data"]
    assert report_data["status"] == "DRAFT"
    assert "dry cough" in report_data["clinical_history"]
    assert "Normal chest radiograph" in report_data["imaging_impression"]
    assert len(report_data["attachments"]) == 1
    assert report_data["attachments"][0]["id"] == attachment_id

    # Step 7: Transition to PENDING_REVIEW
    review_res = await client.put(
        f"/api/imaging/{report_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"submit_for_review": True},
    )
    assert review_res.status_code == 200
    assert review_res.json()["data"]["status"] == "PENDING_REVIEW"

    # Step 8: Multi-Tenant Gate Check
    # Lab 2 staff attempts to retrieve report -> 403 Forbidden
    cross_get = await client.get(f"/api/imaging/{report_id}", headers={"Authorization": f"Bearer {lab2_token}"})
    assert cross_get.status_code == 403

    # Lab 2 staff attempts to upload attachment to Lab 1 report -> 403 Forbidden
    files_cross = {"file": ("cross_test.png", io.BytesIO(b"fake data"), "image/png")}
    cross_upload = await client.post(
        f"/api/imaging/{report_id}/attachments",
        headers={"Authorization": f"Bearer {lab2_token}"},
        files=files_cross,
    )
    assert cross_upload.status_code == 403

    # Lab 2 staff attempts to delete Lab 1 attachment -> 403 Forbidden
    cross_del = await client.delete(
        f"/api/imaging/{report_id}/attachments/{attachment_id}",
        headers={"Authorization": f"Bearer {lab2_token}"},
    )
    assert cross_del.status_code == 403
