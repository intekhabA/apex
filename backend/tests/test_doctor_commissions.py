import pytest
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.laboratory import Laboratory
from app.models.user import User, UserRole
from app.models.doctor import Doctor, DoctorTestCommission
from app.models.test import Test as LabTest, TestCategory as LabTestCategory


@pytest.mark.asyncio
async def test_update_doctor_test_commissions_multiple_times(
    client: AsyncClient,
    db_session: AsyncSession,
):
    # Setup lab and lab admin
    lab = Laboratory(
        name="Commission Test Lab",
        code="CTL01",
        email="lab@commission.test",
        phone="1234567890",
        address_street="123 Test St",
        city="Test City",
        state="Test State",
        postal_code="123456",
        is_active=True,
    )
    db_session.add(lab)
    await db_session.flush()

    admin = User(
        first_name="Admin",
        last_name="User",
        email="admin@commission.test",
        hashed_password="hashed_pw",
        role=UserRole.LAB_ADMIN,
        lab_id=lab.id,
        is_active=True,
    )
    db_session.add(admin)

    # Setup tests
    category = LabTestCategory(name="Biochemistry", code="BIO")
    db_session.add(category)
    await db_session.flush()

    test1 = LabTest(
        category_id=category.id,
        name="Blood Sugar Fasting",
        code="BSF",
        sample_type="SERUM",
        default_price=Decimal("150.00"),
        is_active=True,
    )
    test2 = LabTest(
        category_id=category.id,
        name="Lipid Profile",
        code="LP",
        sample_type="SERUM",
        default_price=Decimal("600.00"),
        is_active=True,
    )
    db_session.add_all([test1, test2])

    # Setup doctor
    doctor = Doctor(
        lab_id=lab.id,
        name="Dr. Sameer Khan",
        phone="9876543210",
        default_commission_percentage=Decimal("15.00"),
        is_active=True,
    )
    db_session.add(doctor)
    await db_session.commit()

    from app.core.security import create_access_token
    token = create_access_token(data={"sub": admin.id, "lab_id": lab.id, "role": admin.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. First Update
    payload1 = {
        "commissions": [
            {"test_id": test1.id, "commission_percentage": 20.0},
            {"test_id": test2.id, "commission_percentage": 25.0},
        ]
    }
    resp1 = await client.put(
        f"/api/doctors/{doctor.id}/commissions",
        json=payload1,
        headers=headers,
    )
    assert resp1.status_code == 200, f"First update failed: {resp1.text}"

    # 2. Second Update (Changing percentages)
    payload2 = {
        "commissions": [
            {"test_id": test1.id, "commission_percentage": 30.0},
            {"test_id": test2.id, "commission_percentage": 35.0},
        ]
    }
    resp2 = await client.put(
        f"/api/doctors/{doctor.id}/commissions",
        json=payload2,
        headers=headers,
    )
    assert resp2.status_code == 200, f"Second update failed: {resp2.text}"

    # Verify rates in DB after second update
    comm_res = await db_session.execute(
        select(DoctorTestCommission).where(DoctorTestCommission.doctor_id == doctor.id)
    )
    rates = {ov.test_id: ov.commission_percentage for ov in comm_res.scalars().all()}
    assert rates[test1.id] == Decimal("30.00")
    assert rates[test2.id] == Decimal("35.00")

    # 3. Third Update (Changing again to different values)
    payload3 = {
        "commissions": [
            {"test_id": test1.id, "commission_percentage": 12.5},
            {"test_id": test2.id, "commission_percentage": 18.0},
        ]
    }
    resp3 = await client.put(
        f"/api/doctors/{doctor.id}/commissions",
        json=payload3,
        headers=headers,
    )
    assert resp3.status_code == 200, f"Third update failed: {resp3.text}"

    # Verify rates in DB after third update
    await db_session.commit()
    comm_res3 = await db_session.execute(
        select(DoctorTestCommission).where(DoctorTestCommission.doctor_id == doctor.id)
    )
    rates3 = {ov.test_id: ov.commission_percentage for ov in comm_res3.scalars().all()}
    assert rates3[test1.id] == Decimal("12.50")
    assert rates3[test2.id] == Decimal("18.00")

    # 4. GET matrix verification
    get_res = await client.get(
        f"/api/doctors/{doctor.id}/commissions",
        headers=headers,
    )
    assert get_res.status_code == 200
    items = {item["test_id"]: item["commission_percentage"] for item in get_res.json()["data"]}
    assert float(items[test1.id]) == 12.5
    assert float(items[test2.id]) == 18.0
