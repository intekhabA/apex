import pytest
from datetime import datetime, timezone
import zoneinfo
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.models.laboratory import Laboratory, LaboratorySettings
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_audit_log_timezone_and_formatting(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a Laboratory with custom timezone (Asia/Dubai: UTC+4)
    lab = Laboratory(
        id="lab-dubai-tz-01",
        name="Dubai Clinical Lab",
        code="DCL-001",
        email="dubai@test.com",
        phone="+971501234567",
        address_street="Sheikh Zayed Rd",
        city="Dubai",
        state="Dubai",
        postal_code="00000",
        country="AE",
    )
    db_session.add(lab)
    await db_session.flush()

    settings = LaboratorySettings(
        lab_id=lab.id,
        timezone="Asia/Dubai",
    )
    db_session.add(settings)
    await db_session.flush()

    # 2. Create Lab Admin user
    admin_user = User(
        id="user-dubai-admin-01",
        email="admin@dubailab.com",
        hashed_password=get_password_hash("Password@123"),
        first_name="Hassan",
        last_name="Ali",
        role=UserRole.LAB_ADMIN,
        lab_id=lab.id,
        is_active=True,
    )
    db_session.add(admin_user)
    await db_session.flush()

    # 3. Create an Audit Log at a known fixed UTC time: 2026-11-07 10:00:00 UTC
    # In Asia/Dubai (UTC+4), 10:00 UTC = 14:00 (02:00 PM)
    utc_time = datetime(2026, 11, 7, 10, 0, 0, tzinfo=timezone.utc)
    audit_entry = AuditLog(
        id="audit-dubai-tz-01",
        lab_id=lab.id,
        user_id=admin_user.id,
        user_email=admin_user.email,
        user_role=admin_user.role.value,
        action="UPDATE_SETTINGS",
        entity_name="laboratory_settings",
        entity_id=settings.id,
        created_at=utc_time,
    )
    db_session.add(audit_entry)
    await db_session.commit()

    token = create_access_token({
        "sub": str(admin_user.id),
        "email": admin_user.email,
        "role": admin_user.role.value,
        "lab_id": str(lab.id),
    })

    resp = await client.get(
        "/api/audit/logs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert len(data) >= 1

    matched = next(d for d in data if d["id"] == str(audit_entry.id))
    assert matched["lab_timezone"] == "Asia/Dubai"
    assert matched["lab_name"] == "Dubai Clinical Lab"
    # 10:00 UTC formatted in Asia/Dubai (UTC+4) must be 02:00 PM
    assert "02:00 PM" in matched["formatted_time"]
    assert "+00:00" in matched["created_at"] or "Z" in matched["created_at"]


@pytest.mark.asyncio
async def test_superadmin_audit_logs_cross_lab_timezones(client: AsyncClient, db_session: AsyncSession):
    # Setup Super Admin
    super_admin = User(
        id="user-superadmin-tz-01",
        email="superadmin@tztest.com",
        hashed_password=get_password_hash("Password@123"),
        first_name="Super",
        last_name="Admin",
        role=UserRole.SUPER_ADMIN,
        lab_id=None,
        is_active=True,
    )
    db_session.add(super_admin)

    # Lab in New York (UTC-5)
    lab_ny = Laboratory(
        id="lab-ny-tz-01",
        name="New York Labs",
        code="NYL-001",
        email="ny@test.com",
        phone="1234567890",
        address_street="Broadway",
        city="New York",
        state="NY",
        postal_code="10001",
        country="US",
    )
    db_session.add(lab_ny)
    await db_session.flush()

    settings_ny = LaboratorySettings(
        lab_id=lab_ny.id,
        timezone="America/New_York",
    )
    db_session.add(settings_ny)

    # 15:00 UTC -> in America/New_York (EST: UTC-5), this is 10:00 AM
    utc_time = datetime(2026, 11, 7, 15, 0, 0, tzinfo=timezone.utc)
    entry_ny = AuditLog(
        id="audit-ny-tz-01",
        lab_id=lab_ny.id,
        user_id=super_admin.id,
        user_email=super_admin.email,
        user_role=super_admin.role.value,
        action="UPDATE_SECURITY",
        entity_name="security_policy",
        entity_id=None,
        created_at=utc_time,
    )
    db_session.add(entry_ny)
    await db_session.commit()

    token = create_access_token({
        "sub": str(super_admin.id),
        "email": super_admin.email,
        "role": super_admin.role.value,
        "lab_id": None,
    })

    resp = await client.get(
        "/api/audit/logs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]

    ny_item = next(d for d in data if d["id"] == str(entry_ny.id))
    assert ny_item["lab_timezone"] == "America/New_York"
    assert ny_item["lab_name"] == "New York Labs"
    assert "10:00 AM" in ny_item["formatted_time"]


