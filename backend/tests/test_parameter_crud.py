import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_test_parameter_edit_and_delete(client: AsyncClient, seed_test_data):
    """
    Test editing and deleting test parameters in master catalog:
    1. Super Admin adds a parameter to a test.
    2. Super Admin edits the parameter (name, code, unit, reference ranges).
    3. Super Admin deletes the parameter.
    4. Non-super admin is forbidden from editing or deleting parameters.
    """
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]
    tests = seed_test_data.get("tests", [])

    super_token = create_access_token(
        data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email, "lab_id": None}
    )
    lab1_token = create_access_token(
        data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id}
    )

    # Create category & test first
    cat_res = await client.post(
        "/api/tests/categories",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"code": "PATH_TEST", "name": "Pathology Test", "display_order": 1},
    )
    assert cat_res.status_code == 201
    category_id = cat_res.json()["data"]["id"]

    test_res = await client.post(
        "/api/tests",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "category_id": category_id,
            "code": "CBC_TEST",
            "name": "Complete Blood Count",
            "sample_type": "WHOLE_BLOOD_EDTA",
            "turnaround_hours": 12,
            "default_price": 350.0,
        },
    )
    assert test_res.status_code == 201
    test_id = test_res.json()["data"]["id"]

    # 1. Super Admin adds a parameter
    add_res = await client.post(
        f"/api/tests/{test_id}/parameters",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "code": "TEST_PARAM_X",
            "name": "Test Analyte X",
            "short_name": "TPX",
            "unit": "mg/dL",
            "result_type": "NUMBER",
            "decimal_precision": 2,
            "display_order": 99,
            "reference_ranges": [
                {
                    "gender": "MALE",
                    "age_min_years": 0,
                    "age_max_years": 100,
                    "min_value": 10.0,
                    "max_value": 50.0,
                    "display_range_string": "10.0 - 50.0",
                }
            ],
        },
    )
    assert add_res.status_code == 201
    param_data = add_res.json()["data"]
    param_id = param_data["id"]
    assert param_data["code"] == "TEST_PARAM_X"
    assert param_data["name"] == "Test Analyte X"
    assert len(param_data["reference_ranges"]) == 1

    # 2. Lab Admin (non-super-admin) cannot update parameter
    forbidden_update = await client.put(
        f"/api/tests/{test_id}/parameters/{param_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
        json={"name": "Hacked Name"},
    )
    assert forbidden_update.status_code == 403

    # 3. Super Admin updates parameter
    update_res = await client.put(
        f"/api/tests/{test_id}/parameters/{param_id}",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "code": "TEST_PARAM_Y",
            "name": "Updated Analyte Y",
            "unit": "g/L",
            "decimal_precision": 1,
            "reference_ranges": [
                {
                    "gender": "FEMALE",
                    "age_min_years": 18,
                    "age_max_years": 80,
                    "min_value": 12.0,
                    "max_value": 45.0,
                    "display_range_string": "12.0 - 45.0 g/L",
                }
            ],
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()["data"]
    assert updated["code"] == "TEST_PARAM_Y"
    assert updated["name"] == "Updated Analyte Y"
    assert updated["unit"] == "g/L"
    assert len(updated["reference_ranges"]) == 1
    assert updated["reference_ranges"][0]["gender"] == "FEMALE"

    # 4. Lab Admin cannot delete parameter
    forbidden_delete = await client.delete(
        f"/api/tests/{test_id}/parameters/{param_id}",
        headers={"Authorization": f"Bearer {lab1_token}"},
    )
    assert forbidden_delete.status_code == 403

    # 5. Super Admin deletes parameter
    delete_res = await client.delete(
        f"/api/tests/{test_id}/parameters/{param_id}",
        headers={"Authorization": f"Bearer {super_token}"},
    )
    assert delete_res.status_code == 200

    # 6. Verify parameter is gone from test details
    get_res = await client.get(f"/api/tests/{test_id}", headers={"Authorization": f"Bearer {super_token}"})
    assert get_res.status_code == 200
    param_ids = [p["id"] for p in get_res.json()["data"]["parameters"]]
    assert param_id not in param_ids

    # 7. Deleting already deleted parameter returns 404
    del_404 = await client.delete(
        f"/api/tests/{test_id}/parameters/{param_id}",
        headers={"Authorization": f"Bearer {super_token}"},
    )
    assert del_404.status_code == 404
