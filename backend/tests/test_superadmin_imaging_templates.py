import pytest
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_superadmin_imaging_templates_management(client: AsyncClient, seed_test_data):
    """
    Test Super Admin Imaging Templates Management:
    1. Super Admin lists all imaging templates.
    2. Super Admin updates an existing template (e.g. CHEST_XRAY_PA).
    3. Super Admin adds a new template for a new test (e.g. USG_KUB or XRAY_KNEE).
    4. Verify that regular lab staff sees the updated and newly added templates via /api/imaging/templates.
    5. Super Admin deletes a template and verifies deletion.
    """
    super_admin = seed_test_data["super_admin"]
    lab1_admin = seed_test_data["lab1_admin"]

    super_token = create_access_token(
        data={"sub": super_admin.id, "role": super_admin.role.value, "email": super_admin.email, "lab_id": None}
    )
    lab1_token = create_access_token(
        data={"sub": lab1_admin.id, "role": lab1_admin.role.value, "email": lab1_admin.email, "lab_id": lab1_admin.lab_id}
    )

    # 1. Super Admin lists templates
    res = await client.get("/api/admin/imaging-templates", headers={"Authorization": f"Bearer {super_token}"})
    assert res.status_code == 200
    templates = res.json()["data"]
    assert len(templates) >= 5

    chest_tpl = next((t for t in templates if t["code"] == "CHEST_XRAY_PA"), None)
    assert chest_tpl is not None

    # 2. Super Admin updates the Chest X-Ray template
    update_res = await client.put(
        f"/api/admin/imaging-templates/{chest_tpl['id']}",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "impression_template": "Normal chest radiograph (PA View). Completely clear cardiopulmonary silhouette. No active lesion.",
            "recommendations_template": "Annual routine follow-up as clinically indicated.",
        },
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()["data"]
    assert "Completely clear cardiopulmonary silhouette" in updated_data["impression_template"]

    # 3. Super Admin creates a new template for a new test
    create_res = await client.post(
        "/api/admin/imaging-templates",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "code": "USG_KUB_CUSTOM",
            "name": "USG KUB (Kidney, Ureter, Bladder)",
            "modality": "USG",
            "clinical_history_template": "Evaluation for flank pain and dysuria.",
            "findings_template": (
                "RIGHT KIDNEY: Normal in size (10.2 cm), shape, and cortical thickness. No hydronephrosis or calculus.\n"
                "LEFT KIDNEY: Normal in size (10.5 cm), shape, and cortical thickness. No hydronephrosis or calculus.\n"
                "URINARY BLADDER: Adequately distended. Wall thickness is normal. Pre-void volume: 320 ml, Post-void residual: Nil."
            ),
            "impression_template": "Sonographically normal KUB study. No renal calculus, mass, or hydronephrosis.",
            "recommendations_template": "Clinical correlation with urine routine and microscopy.",
            "is_active": True,
            "display_order": 10,
        },
    )
    assert create_res.status_code == 201
    new_tpl = create_res.json()["data"]
    assert new_tpl["code"] == "USG_KUB_CUSTOM"

    # 4. Verify Lab staff fetches updated and new templates
    staff_res = await client.get("/api/imaging/templates", headers={"Authorization": f"Bearer {lab1_token}"})
    assert staff_res.status_code == 200
    staff_templates = staff_res.json()["data"]

    # Verify updated impression is returned
    staff_chest = next((t for t in staff_templates if t["code"] == "CHEST_XRAY_PA"), None)
    assert staff_chest is not None
    assert "Completely clear cardiopulmonary silhouette" in staff_chest["impression_template"]

    # Verify new template is available
    staff_kub = next((t for t in staff_templates if t["code"] == "USG_KUB_CUSTOM"), None)
    assert staff_kub is not None
    assert "RIGHT KIDNEY: Normal in size" in staff_kub["findings_template"]

    # 5. Super Admin deletes the newly created template
    del_res = await client.delete(
        f"/api/admin/imaging-templates/{new_tpl['id']}",
        headers={"Authorization": f"Bearer {super_token}"},
    )
    assert del_res.status_code == 200

    # Verify it is no longer returned
    staff_res_after = await client.get("/api/imaging/templates", headers={"Authorization": f"Bearer {lab1_token}"})
    staff_templates_after = staff_res_after.json()["data"]
    assert not any(t["code"] == "USG_KUB_CUSTOM" for t in staff_templates_after)
