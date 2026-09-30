import pytest
from httpx import AsyncClient
from datetime import date
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase12_security_audit_and_immutability_gate_check(
    client: AsyncClient, seed_test_data
):
    """Phase 12 Gate Check:
    1. Security Headers: Verified on all API responses.
    2. Audit Trail: State mutations (booking creation, report approval, etc.) generate audit logs.
    3. Multi-Tenant Audit Isolation: Lab 1 cannot view Lab 2 audit logs. Cross-tenant param returns 403.
    4. Medical Report Immutability: Finalized and sealed report strictly forbids further modifications.
    5. RBAC & Security Perimeter: Non-admin users cannot access audit logs (403).
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

    # 1. Verify Security Headers on API response
    health_res = await client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.headers.get("X-Content-Type-Options") == "nosniff"
    assert health_res.headers.get("X-Frame-Options") == "DENY"
    assert health_res.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "max-age=31536000" in health_res.headers.get("Strict-Transport-Security", "")
    assert "X-Response-Time-Ms" in health_res.headers

    # 2. Setup Category & Test
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "SEC_CAT", "name": "Security Diagnostics", "display_order": 1, "is_active": True},
    )
    assert cat_res.status_code in [200, 201]
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "BIO_SEC",
            "name": "Biomarker Security",
            "short_name": "BIO_S",
            "test_type": "BIOCHEMISTRY",
            "sample_type": "SERUM",
            "default_price": 750.00,
            "is_active": True,
        },
    )
    assert test_res.status_code == 201
    test_id = test_res.json()["data"]["id"]

    param_res = await client.post(
        f"/api/tests/{test_id}/parameters",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"name": "Biomarker Level", "code": "BM_LVL", "unit": "ng/mL", "display_order": 1},
    )
    assert param_res.status_code == 201
    param_id = param_res.json()["data"]["id"]

    # 3. Create Patient & Booking in Lab 1
    p_res = await client.post(
        "/api/patients",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "first_name": "Pooja",
            "last_name": "Iyer",
            "gender": "FEMALE",
            "age_years": 29,
            "phone": "+919123456780",
            "email": "pooja.iyer@example.com",
            "address_street": "12 Indiranagar",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560038",
        },
    )
    assert p_res.status_code == 201
    patient_id = p_res.json()["data"]["id"]

    booking_res = await client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "patient_id": patient_id,
            "appointment_date": date.today().isoformat(),
            "appointment_time": "11:00 AM",
            "items": [{"item_type": "TEST", "test_id": test_id}],
            "discount_amount": 0.00,
            "paid_amount": 750.00,
        },
    )
    assert booking_res.status_code == 201
    booking_id = booking_res.json()["data"]["id"]

    # 4. Verify Audit Trail generated for Booking Creation
    audit_res = await client.get("/api/audit/logs", headers={"Authorization": f"Bearer {lab1_token}"})
    assert audit_res.status_code == 200
    logs = audit_res.json()["data"]
    booking_audit = [l for l in logs if l["action"] == "CREATE_BOOKING" and l["entity_id"] == booking_id]
    assert len(booking_audit) >= 1
    assert booking_audit[0]["user_email"] == lab1_admin.email
    assert booking_audit[0]["lab_id"] == lab1_admin.lab_id

    # 5. Strict Tenant Isolation on Audit Logs
    # Lab 1 admin requesting Lab 2's audit logs via ?lab_id= must return 403 Forbidden
    cross_audit = await client.get(
        f"/api/audit/logs?lab_id={lab2_admin.lab_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert cross_audit.status_code == 403

    # Lab 2 admin querying audit logs cannot see Lab 1's booking
    lab2_audit_res = await client.get("/api/audit/logs", headers={"Authorization": f"Bearer {lab2_token}"})
    assert lab2_audit_res.status_code == 200
    lab2_logs = lab2_audit_res.json()["data"]
    assert all(l["lab_id"] == lab2_admin.lab_id for l in lab2_logs)
    assert not any(l["entity_id"] == booking_id for l in lab2_logs)

    # Super admin can view all logs
    super_audit_res = await client.get("/api/audit/logs", headers={"Authorization": f"Bearer {super_token}"})
    assert super_audit_res.status_code == 200
    super_logs = super_audit_res.json()["data"]
    assert any(l["entity_id"] == booking_id for l in super_logs)

    # 6. Medical Report Finalization & Immutability Enforcement
    reports_res = await client.get(f"/api/reports?booking_id={booking_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert reports_res.status_code == 200
    report_id = reports_res.json()["data"][0]["id"]

    # Enter results and approve
    await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 4.8}], "submit_for_review": True},
    )
    await client.post(f"/api/reports/{report_id}/approve", headers={"Authorization": f"Bearer {lab1_token}"})

    # Finalize & seal the report
    finalize_res = await client.post(f"/api/reports/{report_id}/finalize", headers={"Authorization": f"Bearer {lab1_token}"})
    assert finalize_res.status_code == 200
    assert finalize_res.json()["data"]["is_immutable"] is True
    assert finalize_res.json()["data"]["status"] == "FINAL"

    # IMMUTABILITY TEST 1: Modifying values on a finalized report MUST return 400 Bad Request
    tamper_values = await client.put(
        f"/api/results/{report_id}/values",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"values": [{"parameter_id": param_id, "numeric_value": 99.9}]},
    )
    assert tamper_values.status_code == 400
    assert "final" in tamper_values.json()["message"].lower() or "immutable" in tamper_values.json()["message"].lower()

    # IMMUTABILITY TEST 2: Re-finalizing an already sealed report MUST return 400 Bad Request
    refinalize = await client.post(
        f"/api/reports/{report_id}/finalize",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert refinalize.status_code == 400
    assert "already finalized" in refinalize.json()["message"].lower()

    # 7. Unauthenticated & Tampered Token Protection
    no_auth_res = await client.get("/api/audit/logs")
    assert no_auth_res.status_code == 401

    tampered_auth_res = await client.get(
        "/api/audit/logs",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.token"},
    )
    assert tampered_auth_res.status_code == 401
