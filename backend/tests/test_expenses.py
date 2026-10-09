import pytest
import datetime
from decimal import Decimal
from httpx import AsyncClient
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_expense_crud_and_period_filters(client: AsyncClient, seed_test_data):
    """Test full CRUD lifecycle, daily, monthly, and date range filters, and aggregations."""
    lab1 = seed_test_data["lab1"]
    lab1_admin = seed_test_data["lab1_admin"]
    lab2 = seed_test_data["lab2"]
    lab2_admin = seed_test_data["lab2_admin"]

    admin_token = create_access_token(data={"sub": lab1_admin.id, "email": lab1_admin.email, "role": lab1_admin.role.value, "lab_id": lab1.id})
    headers = {"Authorization": f"Bearer {admin_token}"}

    lab2_token = create_access_token(data={"sub": lab2_admin.id, "email": lab2_admin.email, "role": lab2_admin.role.value, "lab_id": lab2.id})
    lab2_headers = {"Authorization": f"Bearer {lab2_token}"}

    # 1. Test get categories presets
    res = await client.get("/api/expenses/categories/presets", headers=headers)
    assert res.status_code == 200
    presets = res.json()["data"]
    assert len(presets) > 0
    assert any(p["key"] == "LAB_SUPPLIES" for p in presets)

    # 2. Record expenses on different dates
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    two_weeks_ago = today - datetime.timedelta(days=14)
    two_months_ago = today - datetime.timedelta(days=60)

    # Expense 1: Today - Lab Supplies (Cash)
    exp1_payload = {
        "title": "Biochemistry Reagent Kits",
        "category": "LAB_SUPPLIES",
        "amount": 2500.50,
        "expense_date": today.isoformat(),
        "payment_method": "UPI",
        "vendor_name": "Accurex Diagnostics",
        "receipt_number": "REC-001",
        "notes": "Urgent reagents batch",
    }
    res = await client.post("/api/expenses", json=exp1_payload, headers=headers)
    assert res.status_code == 201
    exp1_data = res.json()["data"]
    assert exp1_data["title"] == "Biochemistry Reagent Kits"
    assert exp1_data["lab_id"] == lab1.id
    exp1_id = exp1_data["id"]

    # Expense 2: Today - Refreshments (Cash)
    exp2_payload = {
        "title": "Staff Tea & Coffee Supplies",
        "category": "REFRESHMENTS",
        "amount": 350.00,
        "expense_date": today.isoformat(),
        "payment_method": "CASH",
        "vendor_name": "Local Mart",
        "receipt_number": "PETTY-12",
    }
    res = await client.post("/api/expenses", json=exp2_payload, headers=headers)
    assert res.status_code == 201

    # Expense 3: Yesterday - Utilities (Bank Transfer)
    exp3_payload = {
        "title": "High-Speed Internet Fiber Bill",
        "category": "UTILITIES",
        "amount": 1200.00,
        "expense_date": yesterday.isoformat(),
        "payment_method": "BANK_TRANSFER",
        "vendor_name": "Airtel Broadband",
        "receipt_number": "INV-NET-889",
    }
    res = await client.post("/api/expenses", json=exp3_payload, headers=headers)
    assert res.status_code == 201

    # Expense 4: 2 weeks ago - Equipment
    exp4_payload = {
        "title": "Centrifuge Machine Calibration",
        "category": "EQUIPMENT",
        "amount": 4500.00,
        "expense_date": two_weeks_ago.isoformat(),
        "payment_method": "CARD",
        "vendor_name": "Meditech Instruments",
    }
    res = await client.post("/api/expenses", json=exp4_payload, headers=headers)
    assert res.status_code == 201

    # Expense 5: 2 months ago - Rent
    exp5_payload = {
        "title": "Premises Monthly Rent",
        "category": "RENT",
        "amount": 15000.00,
        "expense_date": two_months_ago.isoformat(),
        "payment_method": "BANK_TRANSFER",
    }
    res = await client.post("/api/expenses", json=exp5_payload, headers=headers)
    assert res.status_code == 201

    # Expense 6: Lab 2 expense (for isolation testing)
    exp_lab2 = {
        "title": "Lab 2 Test Tubes",
        "category": "LAB_SUPPLIES",
        "amount": 800.00,
        "expense_date": today.isoformat(),
        "payment_method": "CASH",
    }
    res = await client.post("/api/expenses", json=exp_lab2, headers=lab2_headers)
    assert res.status_code == 201
    lab2_exp_id = res.json()["data"]["id"]

    # 3. Test DAILY filter
    # Today's expenses (should be exp1 + exp2 = 2500.50 + 350.00 = 2850.50)
    res = await client.get(f"/api/expenses/summary?period=daily&date={today.isoformat()}", headers=headers)
    assert res.status_code == 200
    daily_summary = res.json()["data"]
    assert daily_summary["period"] == "daily"
    assert daily_summary["expense_count"] == 2
    assert Decimal(str(daily_summary["total_amount"])) == Decimal("2850.50")
    assert len(daily_summary["categories_breakdown"]) == 2
    assert len(daily_summary["payment_methods_breakdown"]) == 2

    # Yesterday's daily filter
    res = await client.get(f"/api/expenses/summary?period=daily&date={yesterday.isoformat()}", headers=headers)
    assert res.status_code == 200
    yesterday_summary = res.json()["data"]
    assert yesterday_summary["expense_count"] == 1
    assert Decimal(str(yesterday_summary["total_amount"])) == Decimal("1200.00")

    # 4. Test MONTHLY filter
    current_month_str = today.strftime("%Y-%m")
    res = await client.get(f"/api/expenses/summary?period=monthly&month={current_month_str}", headers=headers)
    assert res.status_code == 200
    month_summary = res.json()["data"]
    assert month_summary["period"] == "monthly"
    # Today, yesterday, two_weeks_ago are within this or recent month
    # Specifically, check expenses list does not contain lab 2's data
    for exp in month_summary["expenses"]:
        assert exp["lab_id"] == lab1.id

    # 5. Test CUSTOM DATE RANGE filter
    res = await client.get(
        f"/api/expenses/summary?period=custom&start_date={yesterday.isoformat()}&end_date={today.isoformat()}",
        headers=headers,
    )
    assert res.status_code == 200
    range_summary = res.json()["data"]
    assert range_summary["expense_count"] == 3  # exp1, exp2, exp3
    assert Decimal(str(range_summary["total_amount"])) == Decimal("4050.50")

    # 6. Test Category Filter
    res = await client.get(
        f"/api/expenses?category=LAB_SUPPLIES",
        headers=headers,
    )
    assert res.status_code == 200
    cat_res = res.json()["data"]
    assert len(cat_res) == 1
    assert cat_res[0]["category"] == "LAB_SUPPLIES"

    # 7. Test Search Filter
    res = await client.get(
        f"/api/expenses?search=Accurex",
        headers=headers,
    )
    assert res.status_code == 200
    search_res = res.json()["data"]
    assert len(search_res) == 1
    assert search_res[0]["vendor_name"] == "Accurex Diagnostics"

    # 8. Test Update Expense
    update_payload = {
        "title": "Biochemistry Reagent Kits Updated",
        "amount": 2600.00,
        "payment_method": "CARD",
    }
    res = await client.put(f"/api/expenses/{exp1_id}", json=update_payload, headers=headers)
    assert res.status_code == 200
    updated_exp = res.json()["data"]
    assert updated_exp["title"] == "Biochemistry Reagent Kits Updated"
    assert Decimal(str(updated_exp["amount"])) == Decimal("2600.00")
    assert updated_exp["payment_method"] == "CARD"

    # 9. Tenant Isolation: Lab 1 cannot update or delete Lab 2's expense
    res = await client.put(f"/api/expenses/{lab2_exp_id}", json={"amount": 999.00}, headers=headers)
    assert res.status_code == 404

    res = await client.delete(f"/api/expenses/{lab2_exp_id}", headers=headers)
    assert res.status_code == 404

    # 10. Delete Expense
    res = await client.delete(f"/api/expenses/{exp1_id}", headers=headers)
    assert res.status_code == 200

    # Verify deleted
    res = await client.get(f"/api/expenses/{exp1_id}", headers=headers)
    assert res.status_code == 404
