import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase8_invoice_financials_and_payments_gate_check(client: AsyncClient, seed_test_data):
    """Phase 8 Gate Check:
    1. Booking with 10% discount and partial payment accurately generates invoice with matching subtotal, discount, tax, paid_amount, and balance_amount.
    2. Initial payment record with sequential receipt number (REC-YYYY-XXXXXX) is auto-created.
    3. Secondary payment recording closes outstanding balance to 0 and transitions status to PAID.
    4. Receipt PDF downloads correctly and contains valid PDF binary content.
    5. Multi-tenant isolation: Cross-lab invoice and receipt access returns 403 Forbidden.
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
        json={"code": "DIA_P8", "name": "Diabetes Screening P8", "display_order": 1, "is_active": True},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "FBS_P8",
            "name": "Fasting Blood Sugar P8",
            "short_name": "FBS",
            "test_type": "BIOCHEMISTRY",
            "sample_type": "SERUM",
            "default_price": 400.00,
            "is_active": True,
        },
    )
    assert test_res.status_code == 201
    test_id = test_res.json()["data"]["id"]

    # Step 2: Register Patient
    patient_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Devendra",
            "last_name": "Prasad",
            "gender": "MALE",
            "age_years": 50,
            "phone": "+91 98111 22334",
            "email": "devendra.prasad@example.com",
            "city": "Lucknow",
            "state": "Uttar Pradesh",
        },
    )
    assert patient_res.status_code == 201
    patient_id = patient_res.json()["data"]["id"]

    # Step 3: Create Booking with 10% discount and partial payment:
    # Subtotal = 400.00
    # Discount = 40.00 -> Taxable = 360.00
    # Tax @ 5% = 18.00 -> Grand Total = 378.00
    # Paid Amount = 200.00 -> Balance Due = 178.00, PaymentStatus = PARTIAL
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": "2026-10-05",
            "appointment_time": "08:30 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 40.00,
            "tax_percentage": 5.00,
            "paid_amount": 200.00,
        },
    )
    assert booking_res.status_code == 201
    booking_data = booking_res.json()["data"]
    booking_id = booking_data["id"]

    # Step 4: CRITICAL GATE CHECK 1 - Verify Auto-Generated Invoice
    invoices_res = await client.get(
        f"/api/invoices?booking_id={booking_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert invoices_res.status_code == 200
    invoices_list = invoices_res.json()["data"]
    assert len(invoices_list) == 1
    invoice = invoices_list[0]
    invoice_id = invoice["id"]

    assert invoice["invoice_id_display"].startswith("INV-")
    assert float(invoice["subtotal"]) == 400.00
    assert float(invoice["discount_amount"]) == 40.00
    assert float(invoice["tax_amount"]) == 18.00
    assert float(invoice["grand_total"]) == 378.00
    assert float(invoice["paid_amount"]) == 200.00
    assert float(invoice["balance_amount"]) == 178.00
    assert invoice["payment_status"] == "PARTIAL"

    # Verify initial deposit payment
    assert len(invoice["payments"]) == 1
    initial_payment = invoice["payments"][0]
    assert float(initial_payment["amount"]) == 200.00
    assert initial_payment["receipt_id_display"].startswith("REC-")

    # Step 5: CRITICAL GATE CHECK 2 - Secondary Payment (Settle remaining 178.00 via UPI)
    pay_res = await client.post(
        f"/api/invoices/{invoice_id}/payments",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "amount": 178.00,
            "payment_method": "UPI",
            "transaction_reference": "UPI/9876543210/PAY",
            "notes": "Balance settlement via GooglePay UPI.",
        },
    )
    assert pay_res.status_code == 200
    updated_inv = pay_res.json()["data"]
    assert float(updated_inv["paid_amount"]) == 378.00
    assert float(updated_inv["balance_amount"]) == 0.00
    assert updated_inv["payment_status"] == "PAID"
    assert len(updated_inv["payments"]) == 2
    second_payment = updated_inv["payments"][1]
    assert float(second_payment["amount"]) == 178.00
    assert second_payment["payment_method"] == "UPI"
    assert second_payment["transaction_reference"] == "UPI/9876543210/PAY"

    # Step 6: CRITICAL GATE CHECK 3 - Receipt PDF Download
    receipt_res = await client.get(
        f"/api/invoices/{invoice_id}/receipt",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert receipt_res.status_code == 200
    assert receipt_res.headers["content-type"] == "application/pdf"
    assert len(receipt_res.content) > 1000

    # Step 7: Multi-Tenant Isolation Gate Check
    # Lab 2 staff cannot view Lab 1 invoice
    cross_get = await client.get(f"/api/invoices/{invoice_id}", headers={"Authorization": f"Bearer {lab2_token}"})
    assert cross_get.status_code == 403

    # Lab 2 staff cannot record payments on Lab 1 invoice
    cross_pay = await client.post(
        f"/api/invoices/{invoice_id}/payments",
        headers={"Authorization": f"Bearer {lab2_token}"},
        json={"amount": 10.00, "payment_method": "CASH"},
    )
    assert cross_pay.status_code == 403

    # Lab 2 staff cannot download Lab 1 receipt
    cross_rec = await client.get(f"/api/invoices/{invoice_id}/receipt", headers={"Authorization": f"Bearer {lab2_token}"})
    assert cross_rec.status_code == 403
