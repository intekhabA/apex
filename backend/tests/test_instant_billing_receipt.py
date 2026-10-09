import pytest
from httpx import AsyncClient
from decimal import Decimal
from datetime import date, timedelta
from app.models.user import UserRole
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_instant_billing_and_receipt_download(client: AsyncClient, seed_test_data):
    """Verify that creating a booking returns invoice_id, and receipt PDF generates successfully."""
    # Authenticate as Lab Admin of Lab 1 and Super Admin
    super_admin = seed_test_data["super_admin"]
    lab1_user = seed_test_data["lab1_admin"]
    super_token = create_access_token(
        data={
            "sub": super_admin.id,
            "role": super_admin.role.value,
            "email": super_admin.email,
        }
    )
    token = create_access_token(
        data={
            "sub": lab1_user.id,
            "role": lab1_user.role.value,
            "email": lab1_user.email,
            "lab_id": lab1_user.lab_id,
        }
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Setup Category and Test
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "INSTANT-CAT", "name": "Instant Test Cat", "display_order": 1, "is_active": True},
    )
    cat_id = cat_res.json()["data"]["id"]

    t1_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "INST-T1",
            "name": "Instant Test 1",
            "test_type": "PATHOLOGY",
            "sample_type": "WHOLE_BLOOD_EDTA",
            "sample_container": "EDTA Lavender Top",
            "default_price": 500.00,
        },
    )
    test_id = t1_res.json()["data"]["id"]

    # Register patient
    patient_res = await client.post(
        "/api/patients",
        headers=headers,
        json={
            "first_name": "Kavita",
            "last_name": "Sharma",
            "gender": "FEMALE",
            "age_years": 29,
            "phone": "9876543210",
            "referring_doctor": "Dr. R. Gupta",
        },
    )
    assert patient_res.status_code == 201
    patient_data = patient_res.json()["data"]
    patient_id = patient_data["id"]

    # 3. Create booking with partial/initial payment
    booking_payload = {
        "patient_id": patient_id,
        "appointment_date": str(date.today() + timedelta(days=1)),
        "appointment_time": "10:00 AM",
        "referring_doctor": "Dr. R. Gupta",
        "items": [{"item_type": "TEST", "test_id": test_id}],
        "paid_amount": 250.0,
        "payment_method": "CASH",
    }
    booking_res = await client.post(
        "/api/bookings",
        headers=headers,
        json=booking_payload,
    )
    assert booking_res.status_code == 201
    booking_data = booking_res.json()["data"]
    assert "invoice_id" in booking_data
    assert booking_data["invoice_id"] is not None
    assert "invoice_id_display" in booking_data
    assert booking_data["invoice_id_display"] is not None
    invoice_id = booking_data["invoice_id"]

    # 4. Instantly download receipt PDF
    receipt_res = await client.get(
        f"/api/invoices/{invoice_id}/receipt",
        headers=headers,
    )
    assert receipt_res.status_code == 200
    assert receipt_res.headers["content-type"] == "application/pdf"
    assert len(receipt_res.content) > 100

    # 5. Create booking with 0 paid_amount and verify receipt/bill download doesn't crash with 400
    booking_zero_res = await client.post(
        "/api/bookings",
        headers=headers,
        json={
            "patient_id": patient_id,
            "appointment_date": str(date.today() + timedelta(days=2)),
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "paid_amount": 0.0,
        },
    )
    assert booking_zero_res.status_code == 201
    zero_inv_id = booking_zero_res.json()["data"]["invoice_id"]
    zero_receipt_res = await client.get(
        f"/api/invoices/{zero_inv_id}/receipt",
        headers=headers,
    )
    assert zero_receipt_res.status_code == 200
    assert zero_receipt_res.headers["content-type"] == "application/pdf"
