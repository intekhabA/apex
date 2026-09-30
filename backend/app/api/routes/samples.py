import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_lab_staff
from app.core.security import get_current_user
from app.models.user import User
from app.models.sample import Sample, SampleTrackingEvent, SampleStatus
from app.models.notification import NotificationEventType, NotificationChannel
from app.services.notification_service import NotificationService
from app.schemas.common import APIResponse
from app.schemas.sample import (
    SampleResponse,
    SampleTrackingEventResponse,
    SampleCollectRequest,
    SampleReceiveRequest,
    SampleRejectRequest,
)

router = APIRouter(prefix="/samples", tags=["Specimens & Phlebotomy Accessioning"])


@router.get("", response_model=APIResponse[List[SampleResponse]])
async def list_samples(
    status_filter: Optional[SampleStatus] = Query(None, alias="status"),
    booking_id: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by sample ID or barcode"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """List accessioned specimens strictly within current laboratory tenant."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")

    query = select(Sample).options(selectinload(Sample.events))
    if current_user.lab_id:
        query = query.where(Sample.lab_id == current_user.lab_id)

    if status_filter:
        query = query.where(Sample.status == status_filter)

    if booking_id:
        query = query.where(Sample.booking_id == booking_id)

    if patient_id:
        query = query.where(Sample.patient_id == patient_id)

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Sample.sample_id_display.ilike(term),
                Sample.barcode_value.ilike(term),
            )
        )

    query = query.order_by(desc(Sample.created_at))
    res = await db.execute(query)
    samples = res.scalars().all()

    return APIResponse(
        success=True,
        message=f"Retrieved {len(samples)} specimen records.",
        data=[SampleResponse.model_validate(s) for s in samples],
    )


@router.post("/collect", response_model=APIResponse[SampleResponse])
async def collect_sample(
    payload: SampleCollectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Mark specimen collected by phlebotomist, record timestamp & barcode."""
    res = await db.execute(
        select(Sample)
        .options(selectinload(Sample.events), selectinload(Sample.patient))
        .where(Sample.id == payload.sample_id)
    )
    sample = res.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specimen record not found.")

    if current_user.role.value != "SUPER_ADMIN" and sample.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    prev_status = sample.status.value
    sample.status = SampleStatus.COLLECTED
    sample.collected_at = datetime.datetime.now(datetime.timezone.utc)
    sample.collected_by = current_user.id
    if payload.sample_container:
        sample.sample_container = payload.sample_container
    if payload.barcode_value:
        sample.barcode_value = payload.barcode_value

    event = SampleTrackingEvent(
        sample_id=sample.id,
        from_status=prev_status,
        to_status=SampleStatus.COLLECTED.value,
        performed_by=current_user.id,
        performer_name=current_user.full_name,
        remarks=payload.remarks or "Specimen collected successfully.",
    )
    db.add(event)
    await db.commit()
    await db.refresh(sample)

    # Phase 11: Notification Dispatch for Sample Collected
    if sample.patient and (sample.patient.email or sample.patient.phone):
        await NotificationService.dispatch_event(
            db=db,
            lab_id=str(sample.lab_id),
            event_type=NotificationEventType.SAMPLE_COLLECTED,
            recipient=sample.patient.email or sample.patient.phone,
            recipient_name=sample.patient.full_name,
            template_params={
                "patient_name": sample.patient.full_name,
                "sample_type": str(sample.sample_type),
                "sample_id_display": sample.sample_id_display,
            },
            channel=NotificationChannel.EMAIL if sample.patient.email else NotificationChannel.SMS,
        )

    return APIResponse(
        success=True,
        message=f"Specimen {sample.sample_id_display} marked as COLLECTED.",
        data=SampleResponse.model_validate(sample),
    )


@router.post("/receive", response_model=APIResponse[SampleResponse])
async def receive_sample(
    payload: SampleReceiveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Confirm specimen received inside testing laboratory."""
    res = await db.execute(
        select(Sample)
        .options(selectinload(Sample.events))
        .where(Sample.id == payload.sample_id)
    )
    sample = res.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specimen record not found.")

    if current_user.role.value != "SUPER_ADMIN" and sample.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    prev_status = sample.status.value
    sample.status = SampleStatus.RECEIVED
    sample.received_at = datetime.datetime.now(datetime.timezone.utc)
    sample.received_by = current_user.id

    event = SampleTrackingEvent(
        sample_id=sample.id,
        from_status=prev_status,
        to_status=SampleStatus.RECEIVED.value,
        performed_by=current_user.id,
        performer_name=current_user.full_name,
        remarks=payload.remarks or "Specimen received in laboratory processing area.",
    )
    db.add(event)
    await db.commit()
    await db.refresh(sample)

    return APIResponse(
        success=True,
        message=f"Specimen {sample.sample_id_display} received.",
        data=SampleResponse.model_validate(sample),
    )


@router.post("/reject", response_model=APIResponse[SampleResponse])
async def reject_sample(
    payload: SampleRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Reject compromised or hemolyzed specimen with mandatory clinical reason."""
    res = await db.execute(
        select(Sample)
        .options(selectinload(Sample.events))
        .where(Sample.id == payload.sample_id)
    )
    sample = res.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specimen record not found.")

    if current_user.role.value != "SUPER_ADMIN" and sample.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    prev_status = sample.status.value
    sample.status = SampleStatus.REJECTED
    sample.rejection_reason = payload.rejection_reason

    event = SampleTrackingEvent(
        sample_id=sample.id,
        from_status=prev_status,
        to_status=SampleStatus.REJECTED.value,
        performed_by=current_user.id,
        performer_name=current_user.full_name,
        remarks=f"REJECTED: {payload.rejection_reason}",
    )
    db.add(event)
    await db.commit()
    await db.refresh(sample)

    return APIResponse(
        success=True,
        message=f"Specimen {sample.sample_id_display} REJECTED: {payload.rejection_reason}",
        data=SampleResponse.model_validate(sample),
    )


@router.get("/{sample_id}/history", response_model=APIResponse[List[SampleTrackingEventResponse]])
async def get_sample_history(
    sample_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Get complete chain of custody events for the specimen."""
    res = await db.execute(
        select(Sample)
        .options(selectinload(Sample.events))
        .where(Sample.id == sample_id)
    )
    sample = res.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specimen record not found.")

    if current_user.role.value != "SUPER_ADMIN" and sample.lab_id != current_user.lab_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden.")

    return APIResponse(
        success=True,
        message=f"Retrieved {len(sample.events)} custody events.",
        data=[SampleTrackingEventResponse.model_validate(ev) for ev in sample.events],
    )
