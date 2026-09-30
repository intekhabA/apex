from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc

from app.core.database import get_db
from app.core.permissions import require_lab_staff, require_lab_admin
from app.core.security import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.booking import Booking
from app.models.sample import Sample
from app.schemas.common import APIResponse
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    TimelineEvent,
)
from app.services.sequence_service import generate_patient_id
from app.services.audit_service import audit_log

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("", response_model=APIResponse[List[PatientResponse]])
async def list_patients(
    search: Optional[str] = Query(None, description="Search by name, phone, or patient ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Search and list patients strictly within current laboratory tenant."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory context.")

    query = select(Patient)
    if current_user.lab_id:
        query = query.where(Patient.lab_id == current_user.lab_id)

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.phone.ilike(term),
                Patient.patient_id_display.ilike(term),
            )
        )

    query = query.order_by(desc(Patient.created_at))
    res = await db.execute(query)
    patients = res.scalars().all()

    return APIResponse(
        success=True,
        message=f"Retrieved {len(patients)} patients.",
        data=[PatientResponse.model_validate(p) for p in patients],
    )


@router.post("", response_model=APIResponse[PatientResponse], status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Register a new patient and allocate unique sequential ID (PAT-YYYY-XXXXXX)."""
    if not current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory context.")

    patient_id_display = await generate_patient_id(db, current_user.lab_id)

    patient = Patient(
        lab_id=current_user.lab_id,
        patient_id_display=patient_id_display,
        first_name=payload.first_name,
        last_name=payload.last_name,
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
        age_years=payload.age_years,
        age_months=payload.age_months,
        phone=payload.phone,
        email=payload.email,
        blood_group=payload.blood_group,
        address_street=payload.address_street,
        city=payload.city,
        state=payload.state,
        postal_code=payload.postal_code,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        referring_doctor=payload.referring_doctor,
        clinical_notes=payload.clinical_notes,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)

    await audit_log(
        db=db,
        action="CREATE_PATIENT",
        entity_name="Patient",
        entity_id=patient.id,
        user=current_user,
        after_state={"patient_id_display": patient.patient_id_display, "name": patient.full_name},
    )

    return APIResponse(
        success=True,
        message=f"Patient {patient.full_name} ({patient.patient_id_display}) registered.",
        data=PatientResponse.model_validate(patient),
    )


@router.get("/{patient_id}", response_model=APIResponse[PatientResponse])
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve patient record with strict tenant isolation enforcement."""
    res = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    # Multi-tenancy gate check: if user is not Super Admin and lab does not match, reject with 403 Forbidden
    if current_user.role.value != "SUPER_ADMIN" and patient.lab_id != current_user.lab_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient belongs to another laboratory tenant.",
        )

    return APIResponse(success=True, message="Patient details retrieved.", data=PatientResponse.model_validate(patient))


@router.put("/{patient_id}", response_model=APIResponse[PatientResponse])
async def update_patient(
    patient_id: str,
    payload: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Update patient demographics strictly within current tenant."""
    res = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    # Multi-tenancy gate check
    if current_user.role.value != "SUPER_ADMIN" and patient.lab_id != current_user.lab_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient belongs to another laboratory tenant.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(patient, field, val)

    await db.commit()
    await db.refresh(patient)

    return APIResponse(
        success=True,
        message=f"Patient {patient.full_name} updated.",
        data=PatientResponse.model_validate(patient),
    )


@router.get("/{patient_id}/timeline", response_model=APIResponse[List[TimelineEvent]])
async def get_patient_timeline(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full chronological medical history for the patient."""
    res = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    if current_user.role.value != "SUPER_ADMIN" and patient.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    events: List[TimelineEvent] = [
        TimelineEvent(
            event_type="PATIENT_REGISTERED",
            title="Patient Registered",
            description=f"Initial registration as {patient.patient_id_display}.",
            timestamp=patient.created_at,
        )
    ]

    # Fetch Bookings
    b_res = await db.execute(
        select(Booking).where(Booking.patient_id == patient_id).order_by(Booking.created_at.desc())
    )
    for b in b_res.scalars().all():
        events.append(
            TimelineEvent(
                event_type="BOOKING_CREATED",
                title=f"Test Order {b.booking_id_display}",
                description=f"Status: {b.status.value}, Grand Total: ₹{b.grand_total}",
                timestamp=b.created_at,
            )
        )

    # Fetch Samples
    s_res = await db.execute(
        select(Sample).where(Sample.patient_id == patient_id).order_by(Sample.created_at.desc())
    )
    for s in s_res.scalars().all():
        events.append(
            TimelineEvent(
                event_type="SAMPLE_ACCESSIONED",
                title=f"Sample {s.sample_id_display} ({s.sample_type})",
                description=f"Specimen status: {s.status.value}",
                timestamp=s.created_at,
            )
        )

    # Sort events descending by timestamp
    events.sort(key=lambda e: e.timestamp, reverse=True)

    return APIResponse(success=True, message=f"Retrieved {len(events)} timeline events.", data=events)
