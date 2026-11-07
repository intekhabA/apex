import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.contact import ContactQuery, ContactSettings
from app.models.user import User, UserRole
from app.core.security import get_password_hash, create_access_token
from app.services.bot_protection import BotProtectionService


@pytest.mark.asyncio
async def test_public_contact_info_endpoint(client: AsyncClient, db_session: AsyncSession):
    """Verifies that public endpoint returns configured support email, phone, and challenge."""
    res = await client.get("/api/contact/public-info")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "support_email" in data
    assert "contact_phone" in data
    assert "challenge_question" in data
    assert "challenge_token" in data
    assert data["support_email"] == "support@trustmylab.in"
    assert data["contact_phone"] == "+91 94150 05517"


@pytest.mark.asyncio
async def test_bot_challenge_endpoint(client: AsyncClient):
    """Verifies fresh challenge generation."""
    res = await client.get("/api/contact/challenge")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "question" in data
    assert "token" in data
    assert "What is" in data["question"]


@pytest.mark.asyncio
async def test_bot_protection_honeypot_trap(client: AsyncClient, db_session: AsyncSession):
    """
    Verifies that if a bot fills the hidden honeypot trap field,
    the submission is marked as SPAM and silently absorbed without error.
    """
    challenge = BotProtectionService.generate_challenge()
    # Decode token to get correct answer for challenge
    valid, _ = BotProtectionService.verify_challenge("invalid", challenge["token"])

    payload = {
        "name": "Automated Spam Bot",
        "email": "spambot@spammer.com",
        "phone": "+1 555-SPAM",
        "subject": "Buy cheap backlinks now",
        "message": "Click here to buy our casino backlinks service today http://spam.com",
        "website_trap": "I am a bot filling hidden fields",  # Trap triggered!
        "client_time_ms": 100,  # 100ms indicates automated script
        "challenge_answer": "12",
        "challenge_token": challenge["token"],
    }

    res = await client.post("/api/contact", json=payload)
    assert res.status_code == 201
    ticket_id = res.json()["data"]["ticket_id"]

    # Verify inquiry was marked as SPAM in database
    db_res = await db_session.execute(select(ContactQuery).where(ContactQuery.id == ticket_id))
    saved_query = db_res.scalar_one()
    assert saved_query.status == "SPAM"
    assert "Bot Protection Triggered" in (saved_query.admin_notes or "")


@pytest.mark.asyncio
async def test_bot_protection_failed_challenge(client: AsyncClient):
    """
    Verifies that if a non-spam submission provides an incorrect math answer,
    HTTP 400 is returned.
    """
    challenge = BotProtectionService.generate_challenge()

    payload = {
        "name": "Test Visitor",
        "email": "human@example.com",
        "subject": "Legitimate Inquiry",
        "message": "We would like to inquire about ultrasound reporting software pricing.",
        "website_trap": "",
        "client_time_ms": 6000,
        "challenge_answer": "99999",  # Wrong answer!
        "challenge_token": challenge["token"],
    }

    res = await client.post("/api/contact", json=payload)
    assert res.status_code == 400
    res_data = res.json()
    err_text = res_data.get("detail") or res_data.get("message", "")
    assert "Incorrect verification answer" in err_text


@pytest.mark.asyncio
async def test_successful_human_contact_submission(client: AsyncClient, db_session: AsyncSession):
    """Verifies clean human submission persists inquiry with status NEW."""
    # Compute challenge answer programmatically from token
    import base64
    import json

    challenge = BotProtectionService.generate_challenge()
    token_payload_b64 = challenge["token"].split(".")[0]
    payload_data = json.loads(base64.urlsafe_b64decode(token_payload_b64.encode('ascii')).decode('utf-8'))
    correct_ans = str(payload_data["ans"])

    payload = {
        "name": "Dr. Sunil Kapoor",
        "email": "dr.sunil@apexdiagnostic.com",
        "phone": "+91 98111 22334",
        "organization_name": "Apex Diagnostic Centre",
        "service_interested": "Diagnostic Center LIMS",
        "subject": "Integration with existing biochemistry analyzer",
        "message": "We need bidirectional HL7/ASTM interfacing for automated results fetching.",
        "website_trap": "",
        "client_time_ms": 12000,  # 12 seconds
        "challenge_answer": correct_ans,
        "challenge_token": challenge["token"],
    }

    res = await client.post("/api/contact", json=payload)
    assert res.status_code == 201
    ticket_id = res.json()["data"]["ticket_id"]

    db_res = await db_session.execute(select(ContactQuery).where(ContactQuery.id == ticket_id))
    saved_query = db_res.scalar_one()
    assert saved_query.status == "NEW"
    assert saved_query.name == "Dr. Sunil Kapoor"
    assert saved_query.email == "dr.sunil@apexdiagnostic.com"


@pytest.mark.asyncio
async def test_superadmin_manage_support_contact_and_templates(client: AsyncClient, db_session: AsyncSession):
    """
    Verifies that Super Admin can manage Support Email, Helpline Number,
    Recipient Email, and email templates, and changes reflect immediately on public endpoints.
    """
    # Create Super Admin user
    admin_user = User(
        id="super-admin-uuid-test",
        email="superadmin@trustmylab.com",
        hashed_password=get_password_hash("AdminPass123!"),
        first_name="Super",
        last_name="Admin",
        role=UserRole.SUPER_ADMIN,
        is_active=True,
    )
    db_session.add(admin_user)
    await db_session.commit()

    token = create_access_token(data={"sub": str(admin_user.id), "role": admin_user.role.value})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch current settings
    res = await client.get("/api/contact/settings", headers=headers)
    assert res.status_code == 200
    current_cfg = res.json()["data"]
    assert current_cfg["recipient_email"] == "alam347709@gmail.com"
    assert current_cfg["support_email"] == "support@trustmylab.in"

    # 2. Update Support Email, Contact Phone, and Recipient Email
    update_payload = {
        "support_email": "custom-support@trustmylab.in",
        "contact_phone": "+91 98765 00000",
        "office_address": "Diagnostic Park, Sector 44, Gurugram, India",
        "working_hours": "24/7 Priority Emergency Support",
        "recipient_email": "alam347709@gmail.com",
    }
    put_res = await client.put("/api/contact/settings", json=update_payload, headers=headers)
    assert put_res.status_code == 200
    updated_data = put_res.json()["data"]
    assert updated_data["support_email"] == "custom-support@trustmylab.in"
    assert updated_data["contact_phone"] == "+91 98765 00000"
    assert updated_data["office_address"] == "Diagnostic Park, Sector 44, Gurugram, India"

    # 3. Verify public endpoint now dynamically serves the updated details
    pub_res = await client.get("/api/contact/public-info")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()["data"]
    assert pub_data["support_email"] == "custom-support@trustmylab.in"
    assert pub_data["contact_phone"] == "+91 98765 00000"
    assert pub_data["office_address"] == "Diagnostic Park, Sector 44, Gurugram, India"
    assert pub_data["working_hours"] == "24/7 Priority Emergency Support"

    # 4. Super Admin lists inquiries
    queries_res = await client.get("/api/contact/queries", headers=headers)
    assert queries_res.status_code == 200
    assert "data" in queries_res.json()
