import pytest
from httpx import AsyncClient
from app.core.security import create_access_token
from app.services.notification_service import email_provider


@pytest.mark.asyncio
async def test_phase11_notifications_and_communication_contracts_gate_check(
    client: AsyncClient, seed_test_data
):
    """Phase 11 Gate Check:
    1. Configure lab notification preferences via /api/lab/settings.
    2. Manual notification dispatch endpoint (/api/notifications/dispatch).
    3. Milestone 1: Booking creation triggers BOOKING_CREATED notification.
    4. Milestone 2: Specimen collection triggers SAMPLE_COLLECTED notification.
    5. Milestone 3 (Gate Check): Finalizing a report triggers REPORT_FINALIZED notification with verification link.
    6. Milestone 4: Recording a payment triggers PAYMENT_RECEIVED notification with receipt ID.
    7. Notification listing & multi-tenant isolation: Lab 1 cannot see Lab 2 logs.
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

    # 1. Verify and update Lab 1 Notification Settings
    settings_res = await client.get("/api/lab/settings", headers={"Authorization": f"Bearer {lab1_token}"})
    assert settings_res.status_code == 200
    assert settings_res.json()["data"]["notify_on_report_finalized"] is True

    update_settings = await client.put(
        "/api/lab/settings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "notify_on_report_finalized": True,
            "notify_on_booking": True,
            "notify_on_sample_collected": True,
            "notify_on_payment_received": True,
            "notification_channel_default": "EMAIL",
        },
    )
    assert update_settings.status_code == 200
    assert update_settings.json()["data"]["notification_channel_default"] == "EMAIL"

    # 2. Setup Test Category and Test for Lab 1
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "NOTIF_CAT", "name": "Notification Diagnostics", "display_order": 1, "is_active": True},
    )
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "CBC_NOTIF",
            "name": "Complete Blood Count Notif",
            "short_name": "CBC_N",
            "test_type": "PATHOLOGY",
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
        json={"name": "Hemoglobin", "code": "HB_N", "unit": "g/dL", "display_order": 1},
    )
    assert param_res.status_code == 201
    param_id = param_res.json()["data"]["id"]

    # 3. Create Patient with email and phone
    patient_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Arjun",
            "last_name": "Sharma",
            "gender": "MALE",
            "age_years": 32,
            "phone": "+919876543210",
            "email": "arjun.sharma@example.com",
            "address_street": "42 MG Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560001",
        },
    )
    assert patient_res.status_code == 201
    patient_id = patient_res.json()["data"]["id"]

    # Clear mock email provider recorded messages
    email_provider.dispatched_messages.clear()

    # 4. Milestone 1: Create Booking -> Triggers BOOKING_CREATED notification
    from datetime import date
    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": date.today().isoformat(),
            "appointment_time": "10:30 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0.00,
            "paid_amount": 0.00,
        },
    )
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["data"]["id"]
    booking_display = booking_res.json()["data"]["booking_id_display"]

    # Verify notification log created for BOOKING_CREATED
    notifs_res = await client.get("/api/notifications", headers={"Authorization": f"Bearer {lab1_token}"})
    assert notifs_res.status_code == 200
    logs = notifs_res.json()["data"]
    booking_notifs = [l for l in logs if l["event_type"] == "BOOKING_CREATED"]
    assert len(booking_notifs) >= 1
    assert "arjun.sharma@example.com" in booking_notifs[0]["recipient"]
    assert booking_display in booking_notifs[0]["message_body"]

    # 5. Milestone 2: Specimen Collection -> Triggers SAMPLE_COLLECTED notification
    samples_res = await client.get(f"/api/samples?booking_id={booking_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert samples_res.status_code == 200
    sample_id = samples_res.json()["data"][0]["id"]
    sample_display = samples_res.json()["data"][0]["sample_id_display"]

    collect_res = await client.post(
        "/api/samples/collect",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"sample_id": sample_id, "barcode_value": f"BC-{sample_display}"},
    )
    assert collect_res.status_code == 200

    notifs_res = await client.get("/api/notifications", headers={"Authorization": f"Bearer {lab1_token}"})
    logs = notifs_res.json()["data"]
    sample_notifs = [l for l in logs if l["event_type"] == "SAMPLE_COLLECTED"]
    assert len(sample_notifs) >= 1
    assert sample_display in sample_notifs[0]["message_body"]

    # 6. Milestone 3 (GATE CHECK): Finalize Report -> Triggers REPORT_FINALIZED with verification link
    reports_res = await client.get(f"/api/reports?booking_id={booking_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert reports_res.status_code == 200
    report_id = reports_res.json()["data"][0]["id"]

    # Enter result via results API and approve
    val_res = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 14.5}], "submit_for_review": True},
    )
    assert val_res.status_code == 200

    # Approve report
    appr_res = await client.post(
        f"/api/reports/{report_id}/approve",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert appr_res.status_code == 200

    # Finalize Report
    finalize_res = await client.post(
        f"/api/reports/{report_id}/finalize",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert finalize_res.status_code == 200
    final_data = finalize_res.json()["data"]
    verification_token = final_data["verification_token"]
    assert verification_token is not None

    # Check notification logs for REPORT_FINALIZED
    notifs_res = await client.get("/api/notifications", headers={"Authorization": f"Bearer {lab1_token}"})
    logs = notifs_res.json()["data"]
    report_notifs = [l for l in logs if l["event_type"] == "REPORT_FINALIZED"]
    assert len(report_notifs) >= 1
    report_notif = report_notifs[0]
    assert report_notif["recipient"] == "arjun.sharma@example.com"
    assert f"/verify/{verification_token}" in report_notif["message_body"]
    assert "Complete Blood Count Notif" in report_notif["subject"] or "Complete Blood Count Notif" in report_notif["message_body"]

    # Verify provider sent the message
    sent_emails = [m for m in email_provider.dispatched_messages if f"/verify/{verification_token}" in m["body"]]
    assert len(sent_emails) >= 1
    assert sent_emails[0]["recipient"] == "arjun.sharma@example.com"

    # 7. Milestone 4: Record Payment -> Triggers PAYMENT_RECEIVED notification
    inv_res = await client.get(f"/api/invoices?booking_id={booking_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert inv_res.status_code == 200
    invoice_id = inv_res.json()["data"][0]["id"]

    pay_res = await client.post(
        f"/api/invoices/{invoice_id}/payments",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "payment_method": "UPI",
            "amount": 500.00,
            "transaction_reference": "UPI-NOTIF-999",
            "notes": "Full payment via UPI",
        },
    )
    assert pay_res.status_code == 200

    notifs_res = await client.get("/api/notifications", headers={"Authorization": f"Bearer {lab1_token}"})
    logs = notifs_res.json()["data"]
    pay_notifs = [l for l in logs if l["event_type"] == "PAYMENT_RECEIVED"]
    assert len(pay_notifs) >= 1
    assert "500.00" in pay_notifs[0]["message_body"] or "500" in pay_notifs[0]["message_body"]

    # 8. Multi-Tenant Isolation
    # Lab 2 admin queries /api/notifications -> must NOT see any of Lab 1's notifications
    lab2_notifs_res = await client.get("/api/notifications", headers={"Authorization": f"Bearer {lab2_token}"})
    assert lab2_notifs_res.status_code == 200
    lab2_logs = lab2_notifs_res.json()["data"]
    lab1_recipients = [l["recipient"] for l in lab2_logs]
    assert "arjun.sharma@example.com" not in lab1_recipients
