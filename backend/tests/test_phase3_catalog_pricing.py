import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_phase3_test_categories_and_rbac(client: AsyncClient, seed_test_data):
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]

    super_token = create_access_token(data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email})
    lab1_token = create_access_token(data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id})

    # 1. Non-super admin cannot create category
    res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "code": "HEM",
            "name": "Hematology",
            "description": "Blood and blood disorders",
            "display_order": 1,
            "is_active": True,
        },
    )
    assert res.status_code == 403

    # 2. Super admin creates category
    res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "code": "HEM",
            "name": "Hematology",
            "description": "Blood and blood disorders",
            "display_order": 1,
            "is_active": True,
        },
    )
    assert res.status_code == 201
    cat_data = res.json()["data"]
    assert cat_data["code"] == "HEM"
    assert cat_data["name"] == "Hematology"
    cat_id = cat_data["id"]

    # 3. List categories
    res = await client.get("/api/tests/categories", headers={"Authorization": f"Bearer {lab1_token}"})
    assert res.status_code == 200
    cats = res.json()["data"]
    assert len(cats) >= 1
    assert any(c["id"] == cat_id for c in cats)


@pytest.mark.asyncio
async def test_phase3_create_multi_analyte_test_and_pricing_gate_check(client: AsyncClient, seed_test_data):
    """Phase 3 Gate Check:
    1. Create multi-analyte test with nested parameters & biological reference intervals.
    2. Verify that Lab A custom pricing does not affect Lab B or global defaults.
    """
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]
    lab2_admin = seed_test_data["lab2_admin"]

    super_token = create_access_token(data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email})
    lab1_token = create_access_token(data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id})
    lab2_token = create_access_token(data={"sub": lab2_admin.id, "role": lab2_admin.role.value, "email": lab2_admin.email, "lab_id": lab2_admin.lab_id})

    # Step 1: Create Category
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "BIO", "name": "Biochemistry", "display_order": 2, "is_active": True},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["data"]["id"]

    # Step 2: Super Admin creates multi-analyte panel test (LFT)
    test_payload = {
        "category_id": cat_id,
        "code": "LFT",
        "name": "Liver Function Test",
        "short_name": "LFT",
        "test_type": "BIOCHEMISTRY",
        "sample_type": "SERUM",
        "sample_container": "Gold Top SST",
        "turnaround_hours": 24,
        "default_price": 750.00,
        "is_active": True,
        "parameters": [
            {
                "code": "TBIL",
                "name": "Total Bilirubin",
                "unit": "mg/dL",
                "result_type": "NUMBER",
                "decimal_precision": 2,
                "display_order": 1,
                "reference_ranges": [
                    {
                        "gender": None,
                        "age_min_years": 0,
                        "age_max_years": 120,
                        "min_value": 0.2,
                        "max_value": 1.2,
                        "critical_low": None,
                        "critical_high": 15.0,
                        "display_range_string": "0.2 - 1.2 mg/dL",
                    }
                ],
            },
            {
                "code": "SGPT",
                "name": "SGPT / ALT",
                "unit": "U/L",
                "result_type": "NUMBER",
                "decimal_precision": 0,
                "display_order": 2,
                "reference_ranges": [
                    {
                        "gender": "MALE",
                        "age_min_years": 18,
                        "age_max_years": 120,
                        "min_value": 10.0,
                        "max_value": 45.0,
                        "critical_high": 300.0,
                        "display_range_string": "10 - 45 U/L",
                    },
                    {
                        "gender": "FEMALE",
                        "age_min_years": 18,
                        "age_max_years": 120,
                        "min_value": 7.0,
                        "max_value": 35.0,
                        "critical_high": 300.0,
                        "display_range_string": "7 - 35 U/L",
                    },
                ],
            },
        ],
    }

    create_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json=test_payload,
    )
    assert create_res.status_code == 201
    created_test = create_res.json()["data"]
    test_id = created_test["id"]
    assert created_test["code"] == "LFT"
    assert len(created_test["parameters"]) == 2
    assert float(created_test["default_price"]) == 750.00
    assert float(created_test["effective_price"]) == 750.00

    # Step 3: Check baseline effective price for Lab 1 and Lab 2 (both should see default 750.00)
    res_lab1_initial = await client.get(f"/api/tests/{test_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert res_lab1_initial.status_code == 200
    assert float(res_lab1_initial.json()["data"]["effective_price"]) == 750.00

    res_lab2_initial = await client.get(f"/api/tests/{test_id}", headers={"Authorization": f"Bearer {lab2_token}"})
    assert res_lab2_initial.status_code == 200
    assert float(res_lab2_initial.json()["data"]["effective_price"]) == 750.00

    # Step 4: Lab 1 Admin configures custom pricing override (discounted to 600.00)
    override_res = await client.put(
        "/api/tests/pricing/override",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"test_id": test_id, "custom_price": 600.00, "discount_percentage": 20.0, "is_available": True},
    )
    assert override_res.status_code == 200
    assert float(override_res.json()["data"]["custom_price"]) == 600.00

    # Step 5: Critical Multi-Tenant Dynamic Pricing Gate Check!
    # A) Lab 1 Staff queries test -> effective price MUST BE 600.00
    res_lab1_after = await client.get(f"/api/tests/{test_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert res_lab1_after.status_code == 200
    assert float(res_lab1_after.json()["data"]["effective_price"]) == 600.00

    res_lab1_list = await client.get("/api/tests", headers={"Authorization": f"Bearer {lab1_token}"})
    assert res_lab1_list.status_code == 200
    lab1_test = next(t for t in res_lab1_list.json()["data"] if t["id"] == test_id)
    assert float(lab1_test["effective_price"]) == 600.00
    assert float(lab1_test["default_price"]) == 750.00

    # B) Lab 2 Staff queries test -> MUST REMAIN 750.00 (UNTOUCHED!)
    res_lab2_after = await client.get(f"/api/tests/{test_id}", headers={"Authorization": f"Bearer {lab2_token}"})
    assert res_lab2_after.status_code == 200
    assert float(res_lab2_after.json()["data"]["effective_price"]) == 750.00

    res_lab2_list = await client.get("/api/tests", headers={"Authorization": f"Bearer {lab2_token}"})
    assert res_lab2_list.status_code == 200
    lab2_test = next(t for t in res_lab2_list.json()["data"] if t["id"] == test_id)
    assert float(lab2_test["effective_price"]) == 750.00

    # C) Super Admin queries test -> default price remains 750.00
    res_super_list = await client.get("/api/tests", headers={"Authorization": f"Bearer {super_token}"})
    super_test = next(t for t in res_super_list.json()["data"] if t["id"] == test_id)
    assert float(super_test["effective_price"]) == 750.00

    # Step 6: Lab 1 Admin removes pricing override -> reverts back to 750.00
    delete_res = await client.delete(
        f"/api/tests/pricing/override/{test_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert delete_res.status_code == 200

    res_lab1_reverted = await client.get(f"/api/tests/{test_id}", headers={"Authorization": f"Bearer {lab1_token}"})
    assert float(res_lab1_reverted.json()["data"]["effective_price"]) == 750.00


@pytest.mark.asyncio
async def test_phase3_packages(client: AsyncClient, seed_test_data):
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]

    super_token = create_access_token(data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email})
    lab1_token = create_access_token(data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id})

    # Create category and test
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "GEN", "name": "General Tests", "display_order": 3, "is_active": True},
    )
    cat_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": cat_id,
            "code": "GLU",
            "name": "Blood Glucose Fasting",
            "test_type": "BIOCHEMISTRY",
            "sample_type": "SERUM",
            "default_price": 150.00,
        },
    )
    test_id = test_res.json()["data"]["id"]

    # Lab Admin creates bundle package
    pkg_res = await client.post(
        "/api/tests/packages",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={
            "code": "PKG-DIABETES",
            "name": "Basic Diabetes Screening",
            "description": "Fasting blood sugar package",
            "price": 120.00,
            "discount_percentage": 20.0,
            "test_ids": [test_id],
        },
    )
    assert pkg_res.status_code == 201
    pkg = pkg_res.json()["data"]
    assert pkg["code"] == "PKG-DIABETES"
    assert len(pkg["items"]) == 1

    # List packages
    list_res = await client.get("/api/tests/packages", headers={"Authorization": f"Bearer {lab1_token}"})
    assert list_res.status_code == 200
    pkgs = list_res.json()["data"]
    assert len(pkgs) >= 1
    found = next(p for p in pkgs if p["id"] == pkg["id"])
    assert found["items"][0]["test_name"] == "Blood Glucose Fasting"
