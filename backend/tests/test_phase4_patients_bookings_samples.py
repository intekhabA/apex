import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase4_patient_multi_tenancy_gate_check(client: AsyncClient, seed_test_data):
    """Phase 4 Critical Gate Check:
    Patient A created in Lab Alpha CANNOT be searched, accessed, or modified by Lab Beta staff (403 Forbidden).
    """
    lab1_admin = seed_test_data["lab1_admin"]
    lab2_admin = seed_test_data["lab2_admin"]

    lab1_token = create_access_token(data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id})
    lab2_token = create_access_token(data={"sub": lab2_admin.id, "role": lab2_admin.role.value, "email": lab2_admin.email, "lab_id": lab2_admin.lab_id})

    # Step 1: Lab 1 registers Patient A
    p_payload = {
        "first_name": "Rohan",
        "last_name": "Verma",
        "gender": "MALE",
        "age_years": 34,
        "age_months": 0,
        "phone": "+91 99887 66554",
        "email": "rohan.verma@example.com",
        "address_street": "12 Ridge Road",
        "city": "Alpha City",
        "state": "Alpha State",
        "postal_code": "111111",
    }
    create_res = await client.post("/api/patients", headers={"Authorization": f"Bearer {lab1_token}"}, json=p_payload)
    assert create_res.status_code == 201
    patient_a = create_res.json()["data"]
    patient_a_id = patient_a["id"]
    assert patient_a["patient_id_display"].startswith("PAT-")
    assert patient_a["first_name"] == "Rohan"

    # Step 2: Lab 1 staff can access Patient A
    res_lab1_get = await client.get(f"/api/patients/{patient_a_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert res_lab1_get.status_code == 200
    assert res_lab1_get.json()["data"]["id"] == patient_a_id

    # Step 3: CRITICAL GATE CHECK - Lab 2 staff attempts to retrieve Patient A -> MUST BE 403 Forbidden
    res_lab2_get = await client.get(f"/api/patients/{patient_a_id}", headers={"Authorization": f"Bearer {lab2_token}"})
    assert res_lab2_get.status_code == 403
    assert "forbidden" in res_lab2_get.json()["message"].lower()

    # Step 4: CRITICAL GATE CHECK - Lab 2 staff searches patients -> Patient A MUST NOT appear
    res_lab2_search = await client.get("/api/patients?search=Rohan", headers={"Authorization": f"Bearer {lab2_token}"})
    assert res_lab2_search.status_code == 200
    assert len(res_lab2_search.json()["data"]) == 0

    # Step 5: CRITICAL GATE CHECK - Lab 2 staff attempts to update Patient A -> MUST BE 403 Forbidden
    res_lab2_put = await client.put(
        f"/api/patients/{patient_a_id}",
        headers={"Authorization": f"Bearer {lab2_token}"},
        json={"first_name": "Hacked"},
    )
    assert res_lab2_put.status_code == 403

    # Verify Patient A remained unchanged
    res_verify = await client.get(f"/api/patients/{patient_a_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert res_verify.json()["data"]["first_name"] == "Rohan"


@pytest.mark.asyncio
async def test_phase4_booking_financials_and_specimen_accessioning(client: AsyncClient, seed_test_data):
    """Test full booking lifecycle:
    1. Financial calculation (subtotal, discounts, tax, balance, payment status).
    2. Dynamic pricing resolution in booking.
    3. Auto-accessioning of specimens with SMP-2026-XXXXXX IDs.
    4. Phlebotomy custody transitions (Collect -> Receive -> Custody History).
    """
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]
    lab1_assistant = seed_test_data["lab1_assistant"]

    super_token = create_access_token(data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email})
    lab1_token = create_access_token(data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id})
    asst_token = create_access_token(data={"sub": lab1_assistant.id, "role": lab1_assistant.role.value, "email": lab1_assistant.email, "lab_id": lab1_assistant.lab_id})

    # Setup Category and Tests
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "PATH", "name": "General Pathology", "display_order": 1, "is_active": True},
    )
    cat_id = cat_res.json()["data"]["id"]

    t1_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "CBC-P4",
            "name": "Complete Blood Count P4",
            "test_type": "PATHOLOGY",
            "sample_type": "WHOLE_BLOOD_EDTA",
            "sample_container": "EDTA Lavender Top",
            "default_price": 500.00,
        },
    )
    test1_id = t1_res.json()["data"]["id"]

    t2_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "URINE-P4",
            "name": "Urine Routine P4",
            "test_type": "PATHOLOGY",
            "sample_type": "URINE_ROUTINE",
            "sample_container": "Sterile Urine Cup",
            "default_price": 200.00,
        },
    )
    test2_id = t2_res.json()["data"]["id"]

    # Lab 1 sets custom pricing override on CBC-P4 to 450.00
    await client.put(
        "/api/tests/pricing/override",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"test_id": test1_id, "custom_price": 450.00, "is_available": True},
    )

    # Register Patient
    p_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Meera",
            "last_name": "Nair",
            "gender": "FEMALE",
            "age_years": 29,
            "phone": "+91 98888 77777",
        },
    )
    patient_id = p_res.json()["data"]["id"]

    # Create Booking: CBC (effective price 450) + Urine (default price 200) = Subtotal 650.00
    # Discount: 50.00 -> Taxable: 600.00
    # Tax: 10% -> 60.00
    # Grand Total: 660.00
    # Paid Amount: 300.00 -> Balance: 360.00, PaymentStatus: PARTIAL
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": "2026-10-01",
            "appointment_time": "10:00 AM",
            "discount_amount": 50.00,
            "tax_percentage": 10.00,
            "paid_amount": 300.00,
            "items": [
                {"item_type": "TEST", "test_id": test1_id},
                {"item_type": "TEST", "test_id": test2_id},
            ],
        },
    )
    assert booking_res.status_code == 201
    booking = booking_res.json()["data"]
    booking_id = booking["id"]

    assert booking["booking_id_display"].startswith("BK-")
    assert float(booking["subtotal_amount"]) == 650.00
    assert float(booking["discount_amount"]) == 50.00
    assert float(booking["tax_amount"]) == 60.00
    assert float(booking["grand_total"]) == 660.00
    assert float(booking["paid_amount"]) == 300.00
    assert float(booking["balance_amount"]) == 360.00
    assert booking["payment_status"] == "PARTIAL"
    assert len(booking["items"]) == 2

    # Verify Auto-Accessioned Specimens for this booking (2 distinct sample types)
    samples_res = await client.get(
        f"/api/samples?booking_id={booking_id}",
        headers={"Authorization": f"Bearer {asst_token}"},
    )
    assert samples_res.status_code == 200
    samples = samples_res.json()["data"]
    assert len(samples) == 2
    for s in samples:
        assert s["sample_id_display"].startswith("SMP-")
        assert s["status"] == "REGISTERED"

    blood_sample = next(s for s in samples if s["sample_type"] == "WHOLE_BLOOD_EDTA")
    urine_sample = next(s for s in samples if s["sample_type"] == "URINE_ROUTINE")

    # Step: Phlebotomist collects blood specimen
    collect_res = await client.post(
        "/api/samples/collect",
        headers={"Authorization": f"Bearer {asst_token}"},
        json={
            "sample_id": blood_sample["id"],
            "sample_container": "EDTA Lavender Vacutainer",
            "barcode_value": f"BAR-{blood_sample['sample_id_display']}",
            "remarks": "Sample drawn via venipuncture, antecubital fossa.",
        },
    )
    assert collect_res.status_code == 200
    collected_data = collect_res.json()["data"]
    assert collected_data["status"] == "COLLECTED"
    assert collected_data["collected_at"] is not None

    # Step: Lab receives blood specimen
    receive_res = await client.post(
        "/api/samples/receive",
        headers={"Authorization": f"Bearer {asst_token}"},
        json={"sample_id": blood_sample["id"], "remarks": "Received in central pathology lab."},
    )
    assert receive_res.status_code == 200
    assert receive_res.json()["data"]["status"] == "RECEIVED"

    # Step: Verify custody history
    history_res = await client.get(
        f"/api/samples/{blood_sample['id']}/history",
        headers={"Authorization": f"Bearer {asst_token}"},
    )
    assert history_res.status_code == 200
    events = history_res.json()["data"]
    # Events should be: REGISTERED -> COLLECTED -> RECEIVED
    statuses = [ev["to_status"] for ev in events]
    assert "REGISTERED" in statuses
    assert "COLLECTED" in statuses
    assert "RECEIVED" in statuses

    # Step: Reject urine specimen (e.g. insufficient volume)
    reject_res = await client.post(
        "/api/samples/reject",
        headers={"Authorization": f"Bearer {asst_token}"},
        json={
            "sample_id": urine_sample["id"],
            "rejection_reason": "Insufficient volume (< 10 mL)",
        },
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["data"]["status"] == "REJECTED"
    assert "Insufficient volume" in reject_res.json()["data"]["rejection_reason"]

    # Verify Patient Timeline reflects registration, booking, and samples
    timeline_res = await client.get(
        f"/api/patients/{patient_id}/timeline",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert timeline_res.status_code == 200
    tl_events = timeline_res.json()["data"]
    event_types = [e["event_type"] for e in tl_events]
    assert "PATIENT_REGISTERED" in event_types
    assert "BOOKING_CREATED" in event_types
    assert "SAMPLE_ACCESSIONED" in event_types
