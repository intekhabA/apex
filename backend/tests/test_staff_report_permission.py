import pytest
import datetime
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token, get_password_hash
from app.models.laboratory import Laboratory, LaboratorySettings
from app.models.user import User, UserRole
from app.models.patient import Patient, GenderEnum
from app.models.test import Test, TestCategory, SampleTypeEnum
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.report import Report, ReportStatus


@pytest.mark.asyncio
async def test_staff_report_permission_gate(client: AsyncClient, db_session: AsyncSession):
    # Setup Lab
    lab = Laboratory(
        id="lab-perm-test-01",
        code="LAB-PERM",
        name="Permission Test Lab",
        email="lab@perm.test",
        phone="1234567890",
        address_street="Perm Street",
        city="Perm City",
        state="Perm State",
        postal_code="123456",
        is_active=True,
    )
    db_session.add(lab)
    settings = LaboratorySettings(
        lab_id=lab.id,
        default_signatory_name="Dr. Designated Signatory",
        default_signatory_designation="Senior Pathologist",
    )
    db_session.add(settings)

    # Setup Assistant with reports permission
    user_with_reports = User(
        id="user-assistant-perm-yes",
        lab_id=lab.id,
        email="assistant.reports@lab.test",
        hashed_password=get_password_hash("Pass@1234"),
        first_name="Permitted",
        last_name="Assistant",
        role=UserRole.LAB_ASSISTANT,
        permissions=["patients", "results", "reports"],
        is_active=True,
    )
    # Setup Assistant WITHOUT reports permission
    user_no_reports = User(
        id="user-assistant-perm-no",
        lab_id=lab.id,
        email="assistant.noreports@lab.test",
        hashed_password=get_password_hash("Pass@1234"),
        first_name="Unpermitted",
        last_name="Assistant",
        role=UserRole.LAB_ASSISTANT,
        permissions=["patients", "results"],
        is_active=True,
    )
    db_session.add_all([user_with_reports, user_no_reports])

    # Setup patient, category, test, booking, report
    cat = TestCategory(name="Biochemistry", code="BIO")
    db_session.add(cat)
    await db_session.flush()

    patient = Patient(
        lab_id=lab.id,
        patient_id_display="PAT-PERM-01",
        first_name="Test",
        last_name="Patient",
        gender=GenderEnum.MALE,
        age_years=35,
        phone="+919876543210",
    )
    db_session.add(patient)
    await db_session.flush()

    test_item = Test(
        category_id=cat.id,
        code="GLUC",
        name="Glucose Fasting",
        sample_type=SampleTypeEnum.SERUM,
        default_price=100.0,
    )
    db_session.add(test_item)
    await db_session.flush()

    today = datetime.date.today()
    booking = Booking(
        lab_id=lab.id,
        patient_id=patient.id,
        booking_id_display="BKG-PERM-01",
        booking_date=today,
        appointment_date=today,
        status=BookingStatus.CONFIRMED,
        payment_status=PaymentStatus.PAID,
        grand_total=100.0,
        paid_amount=100.0,
    )
    db_session.add(booking)
    await db_session.flush()

    report = Report(
        lab_id=lab.id,
        booking_id=booking.id,
        patient_id=patient.id,
        test_id=test_item.id,
        report_id_display="REP-PERM-01",
        status=ReportStatus.DRAFT,
    )
    db_session.add(report)
    await db_session.commit()

    # 1. Test unpermitted assistant attempt to approve -> 403 Forbidden
    token_no_perm = create_access_token({"sub": user_no_reports.id, "role": user_no_reports.role.value, "lab_id": lab.id})
    resp = await client.post(
        f"/api/reports/{report.id}/approve",
        headers={"Authorization": f"Bearer {token_no_perm}"},
    )
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["message"]

    # 2. Test unpermitted assistant attempt to finalize -> 403 Forbidden
    resp = await client.post(
        f"/api/reports/{report.id}/finalize",
        headers={"Authorization": f"Bearer {token_no_perm}"},
    )
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["message"]

    # 3. Test permitted assistant attempt to approve -> 200 OK
    token_perm = create_access_token({"sub": user_with_reports.id, "role": user_with_reports.role.value, "lab_id": lab.id})
    resp = await client.post(
        f"/api/reports/{report.id}/approve",
        headers={"Authorization": f"Bearer {token_perm}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "APPROVED"

    # 4. Test permitted assistant attempt to finalize -> 200 OK
    resp = await client.post(
        f"/api/reports/{report.id}/finalize",
        headers={"Authorization": f"Bearer {token_perm}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "FINAL"
    assert resp.json()["data"]["pdf_file_url"] is not None
