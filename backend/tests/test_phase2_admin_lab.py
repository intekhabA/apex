import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_super_admin_onboard_labs_and_gate_check(client: AsyncClient, seed_test_data):
    """Phase 2 Gate Check:
    1. Super Admin creates Lab Alpha and Lab Beta with their respective Lab Admins.
    2. Lab Admin Alpha and Lab Admin Beta provision their respective staff.
    3. Verify strict isolation: Lab Admin Alpha only sees Lab Alpha staff; Lab Admin Beta only sees Lab Beta staff.
    4. Verify cross-tenant staff manipulation is blocked with 403 Forbidden.
    """
    # 1. Login as Super Admin
    sa_login = await client.post("/api/auth/login", json={
        "email": "superadmin@diagnolab.com",
        "password": "SuperAdmin@123",
    })
    assert sa_login.status_code == 200
    sa_token = sa_login.json()["data"]["tokens"]["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Super Admin onboards Lab X
    lab_x_payload = {
        "code": "LAB-X",
        "name": "Lab X Diagnostics",
        "legal_name": "Lab X Diagnostics Pvt Ltd",
        "email": "contact@labx.com",
        "phone": "+91 99999 11111",
        "address_street": "100 X Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postal_code": "400001",
        "country": "India",
        "initial_admin_first_name": "Rajesh",
        "initial_admin_last_name": "AdminX",
        "initial_admin_email": "admin@labx.com",
        "initial_admin_password": "AdminPassword@X123",
    }
    create_x_res = await client.post("/api/admin/laboratories", headers=sa_headers, json=lab_x_payload)
    assert create_x_res.status_code == 201
    lab_x_data = create_x_res.json()["data"]
    lab_x_id = lab_x_data["id"]
    assert lab_x_data["code"] == "LAB-X"

    # 3. Super Admin onboards Lab Y
    lab_y_payload = {
        "code": "LAB-Y",
        "name": "Lab Y Diagnostics",
        "legal_name": "Lab Y Healthcare LLP",
        "email": "contact@laby.com",
        "phone": "+91 99999 22222",
        "address_street": "200 Y Road",
        "city": "Delhi",
        "state": "Delhi",
        "postal_code": "110001",
        "country": "India",
        "initial_admin_first_name": "Suresh",
        "initial_admin_last_name": "AdminY",
        "initial_admin_email": "admin@laby.com",
        "initial_admin_password": "AdminPassword@Y123",
    }
    create_y_res = await client.post("/api/admin/laboratories", headers=sa_headers, json=lab_y_payload)
    assert create_y_res.status_code == 201
    lab_y_data = create_y_res.json()["data"]
    lab_y_id = lab_y_data["id"]
    assert lab_y_data["code"] == "LAB-Y"

    # 4. Super Admin lists all laboratories
    list_labs_res = await client.get("/api/admin/laboratories", headers=sa_headers)
    assert list_labs_res.status_code == 200
    labs_list = list_labs_res.json()["data"]
    lab_codes = [l["code"] for l in labs_list]
    assert "LAB-X" in lab_codes
    assert "LAB-Y" in lab_codes

    # 5. Super Admin checks dashboard stats
    stats_res = await client.get("/api/admin/dashboard", headers=sa_headers)
    assert stats_res.status_code == 200
    assert stats_res.json()["data"]["total_laboratories"] >= 2

    # 6. Lab Admin X logs in
    login_x = await client.post("/api/auth/login", json={
        "email": "admin@labx.com",
        "password": "AdminPassword@X123",
    })
    assert login_x.status_code == 200
    token_x = login_x.json()["data"]["tokens"]["access_token"]
    headers_x = {"Authorization": f"Bearer {token_x}"}

    # 7. Lab Admin X provisions a Pathologist and an Assistant for Lab X
    staff_x1 = await client.post("/api/lab/users", headers=headers_x, json={
        "email": "pathologist@labx.com",
        "password": "PathPassword@123",
        "first_name": "Dr. Vikas",
        "last_name": "PathX",
        "role": "PATHOLOGIST",
        "medical_license_number": "MCI-X-101",
        "qualifications": "MD Pathology",
    })
    assert staff_x1.status_code == 201
    staff_x1_id = staff_x1.json()["data"]["id"]

    staff_x2 = await client.post("/api/lab/users", headers=headers_x, json={
        "email": "assistant@labx.com",
        "password": "AsstPassword@123",
        "first_name": "Karan",
        "last_name": "TechX",
        "role": "LAB_ASSISTANT",
    })
    assert staff_x2.status_code == 201

    # 8. Lab Admin Y logs in
    login_y = await client.post("/api/auth/login", json={
        "email": "admin@laby.com",
        "password": "AdminPassword@Y123",
    })
    assert login_y.status_code == 200
    token_y = login_y.json()["data"]["tokens"]["access_token"]
    headers_y = {"Authorization": f"Bearer {token_y}"}

    # 9. Lab Admin Y provisions a Radiologist for Lab Y
    staff_y1 = await client.post("/api/lab/users", headers=headers_y, json={
        "email": "radiologist@laby.com",
        "password": "RadPassword@123",
        "first_name": "Dr. Neha",
        "last_name": "RadY",
        "role": "RADIOLOGIST",
        "medical_license_number": "DMC-Y-202",
        "qualifications": "MD Radiology",
    })
    assert staff_y1.status_code == 201
    staff_y1_id = staff_y1.json()["data"]["id"]

    # 10. CRITICAL GATE CHECK: Isolation of Staff Queries
    # Lab Admin X queries /api/lab/users
    x_users_res = await client.get("/api/lab/users", headers=headers_x)
    assert x_users_res.status_code == 200
    x_user_emails = [u["email"] for u in x_users_res.json()["data"]]
    assert "admin@labx.com" in x_user_emails
    assert "pathologist@labx.com" in x_user_emails
    assert "assistant@labx.com" in x_user_emails
    # Lab X MUST NOT see Lab Y staff
    assert "admin@laby.com" not in x_user_emails
    assert "radiologist@laby.com" not in x_user_emails

    # Lab Admin Y queries /api/lab/users
    y_users_res = await client.get("/api/lab/users", headers=headers_y)
    assert y_users_res.status_code == 200
    y_user_emails = [u["email"] for u in y_users_res.json()["data"]]
    assert "admin@laby.com" in y_user_emails
    assert "radiologist@laby.com" in y_user_emails
    # Lab Y MUST NOT see Lab X staff
    assert "admin@labx.com" not in y_user_emails
    assert "pathologist@labx.com" not in y_user_emails
    assert "assistant@labx.com" not in y_user_emails

    # 11. Cross-Tenant Direct Resource Access Blocked (403 Forbidden)
    # Lab Admin X attempts to view Lab Y's staff member
    forbidden_get = await client.get(f"/api/lab/users/{staff_y1_id}", headers=headers_x)
    assert forbidden_get.status_code == 403

    # Lab Admin X attempts to update Lab Y's staff member
    forbidden_put = await client.put(f"/api/lab/users/{staff_y1_id}", headers=headers_x, json={
        "first_name": "HackedName"
    })
    assert forbidden_put.status_code == 403

    # Lab Admin X attempts to deactivate Lab Y's staff member
    forbidden_patch = await client.patch(f"/api/lab/users/{staff_y1_id}/status", headers=headers_x, json={
        "is_active": False
    })
    assert forbidden_patch.status_code == 403

    # 12. Non-SuperAdmin attempting SuperAdmin operations gets 403 Forbidden
    unauthorized_admin_req = await client.get("/api/admin/laboratories", headers=headers_x)
    assert unauthorized_admin_req.status_code == 403

    # 13. Lab Admin updating own lab settings and profile
    settings_update_res = await client.put("/api/lab/settings", headers=headers_x, json={
        "default_tax_rate": 5.0,
        "default_signatory_name": "Dr. Vikas PathX",
        "default_signatory_designation": "Chief Pathologist",
    })
    assert settings_update_res.status_code == 200
    assert settings_update_res.json()["data"]["default_signatory_name"] == "Dr. Vikas PathX"

    # 14. Super Admin deactivating Lab X
    deactivate_lab_res = await client.patch(f"/api/admin/laboratories/{lab_x_id}/status", headers=sa_headers, json={
        "is_active": False
    })
    assert deactivate_lab_res.status_code == 200
    assert deactivate_lab_res.json()["data"]["is_active"] is False
