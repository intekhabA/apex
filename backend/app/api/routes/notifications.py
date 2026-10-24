from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.permissions import require_lab_staff, verify_tenant_access
from app.models.user import User
from app.models.notification import (
    NotificationLog,
    NotificationEventType,
    NotificationChannel,
    NotificationStatus,
)
from app.schemas.common import APIResponse, paginate_meta
from app.schemas.notification import NotificationLogResponse, NotificationDispatchRequest
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications & Alerts"])


@router.get("", response_model=APIResponse[List[NotificationLogResponse]])
async def list_notifications(
    event_type: Optional[NotificationEventType] = Query(None),
    channel: Optional[NotificationChannel] = Query(None),
    status: Optional[NotificationStatus] = Query(None),
    recipient: Optional[str] = Query(None),
    page: int = Query(1, ge=1, description="Page number"),
    limit: Optional[int] = Query(20, ge=1, le=500, description="Items per page"),
    all: bool = Query(False, description="Fetch all without pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Retrieve communication and notification dispatch logs."""
    query = select(NotificationLog)
    count_query = select(func.count(NotificationLog.id))

    if current_user.role.value != "SUPER_ADMIN":
        if not current_user.lab_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User has no assigned laboratory.",
            )
        query = query.where(NotificationLog.lab_id == current_user.lab_id)
        count_query = count_query.where(NotificationLog.lab_id == current_user.lab_id)

    if event_type:
        query = query.where(NotificationLog.event_type == event_type)
        count_query = count_query.where(NotificationLog.event_type == event_type)
    if channel:
        query = query.where(NotificationLog.channel == channel)
        count_query = count_query.where(NotificationLog.channel == channel)
    if status:
        query = query.where(NotificationLog.status == status)
        count_query = count_query.where(NotificationLog.status == status)
    if recipient:
        filter_recip = NotificationLog.recipient.ilike(f"%{recipient}%")
        query = query.where(filter_recip)
        count_query = count_query.where(filter_recip)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(desc(NotificationLog.created_at))
    if not all and limit:
        query = query.offset((page - 1) * limit).limit(limit)

    res = await db.execute(query)
    logs = res.scalars().all()

    output = [
        NotificationLogResponse(
            id=str(log.id),
            lab_id=str(log.lab_id),
            event_type=log.event_type,
            channel=log.channel,
            recipient=log.recipient,
            recipient_name=log.recipient_name,
            subject=log.subject,
            message_body=log.message_body,
            status=log.status,
            error_message=log.error_message,
            metadata_json=log.metadata_json,
            sent_at=log.sent_at,
            created_at=log.created_at,
        )
        for log in logs
    ]

    effective_limit = limit if (not all and limit) else (total or 20)
    meta = paginate_meta(page=page, limit=effective_limit, total=total)

    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} notification logs.",
        data=output,
        meta=meta,
    )


@router.post("/dispatch", response_model=APIResponse[NotificationLogResponse])
async def dispatch_manual_notification(
    payload: NotificationDispatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_staff),
):
    """Manually dispatch a customer notification for testing or reminder."""
    if not current_user.lab_id and current_user.role.value != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no assigned laboratory.",
        )

    lab_id = current_user.lab_id or "global"
    log = await NotificationService.dispatch_event(
        db=db,
        lab_id=lab_id,
        event_type=payload.event_type,
        recipient=payload.recipient,
        recipient_name=payload.recipient_name,
        template_params=payload.template_params,
        channel=payload.channel,
    )

    data = NotificationLogResponse(
        id=str(log.id),
        lab_id=str(log.lab_id),
        event_type=log.event_type,
        channel=log.channel,
        recipient=log.recipient,
        recipient_name=log.recipient_name,
        subject=log.subject,
        message_body=log.message_body,
        status=log.status,
        error_message=log.error_message,
        metadata_json=log.metadata_json,
        sent_at=log.sent_at,
        created_at=log.created_at,
    )

    return APIResponse(success=True, message="Notification dispatched successfully.", data=data)
