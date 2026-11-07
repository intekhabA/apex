from typing import List, Optional, Dict
from datetime import datetime, timezone
import zoneinfo
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.permissions import require_lab_admin, verify_tenant_access
from app.models.user import User
from app.models.audit import AuditLog
from app.models.laboratory import Laboratory, LaboratorySettings
from app.schemas.common import APIResponse, paginate_meta
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Security & Audit Logs"])


@router.get("/logs", response_model=APIResponse[List[AuditLogResponse]])
async def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name"),
    entity_name: Optional[str] = Query(None, description="Filter by entity"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    user_email: Optional[str] = Query(None, description="Filter by actor email"),
    lab_id: Optional[str] = Query(None, description="Super Admin lab filter"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1, description="Page number"),
    limit: Optional[int] = Query(20, ge=1, le=500, description="Items per page"),
    offset: Optional[int] = Query(None, ge=0),
    all: bool = Query(False, description="Fetch all without pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Retrieve audit logs with strict tenant isolation and filtering."""
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    # Tenant enforcement
    if current_user.role.value != "SUPER_ADMIN":
        if not current_user.lab_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")
        if lab_id and lab_id != current_user.lab_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access forbidden.")
        query = query.where(AuditLog.lab_id == current_user.lab_id)
        count_query = count_query.where(AuditLog.lab_id == current_user.lab_id)
    else:
        if lab_id:
            query = query.where(AuditLog.lab_id == lab_id)
            count_query = count_query.where(AuditLog.lab_id == lab_id)

    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
        count_query = count_query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_name:
        query = query.where(AuditLog.entity_name.ilike(f"%{entity_name}%"))
        count_query = count_query.where(AuditLog.entity_name.ilike(f"%{entity_name}%"))
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
        count_query = count_query.where(AuditLog.entity_id == entity_id)
    if user_email:
        query = query.where(AuditLog.user_email.ilike(f"%{user_email}%"))
        count_query = count_query.where(AuditLog.user_email.ilike(f"%{user_email}%"))
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
        count_query = count_query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
        count_query = count_query.where(AuditLog.created_at <= end_date)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(desc(AuditLog.created_at))
    effective_limit = limit or 20
    effective_page = page
    if offset is not None and offset > 0 and effective_limit > 0:
        effective_page = (offset // effective_limit) + 1

    if not all and effective_limit:
        query = query.offset((effective_page - 1) * effective_limit).limit(effective_limit)

    res = await db.execute(query)
    logs = res.scalars().all()

    # Collect all relevant lab IDs for timezone and name lookup
    lab_ids = {str(log.lab_id) for log in logs if log.lab_id}
    if current_user.lab_id:
        lab_ids.add(str(current_user.lab_id))

    lab_info_map: Dict[str, Dict[str, str]] = {}
    if lab_ids:
        lab_query = (
            select(Laboratory)
            .options(selectinload(Laboratory.settings))
            .where(Laboratory.id.in_(list(lab_ids)))
        )
        lab_res = await db.execute(lab_query)
        for lab in lab_res.scalars().all():
            tz = "Asia/Kolkata"
            if lab.settings and getattr(lab.settings, "timezone", None):
                tz = lab.settings.timezone
            lab_info_map[str(lab.id)] = {
                "name": lab.name,
                "timezone": tz,
            }

    fallback_tz = "Asia/Kolkata"
    if current_user.lab_id and str(current_user.lab_id) in lab_info_map:
        fallback_tz = lab_info_map[str(current_user.lab_id)]["timezone"]

    output: List[AuditLogResponse] = []
    for log in logs:
        lid = str(log.lab_id) if log.lab_id else None
        lab_meta = lab_info_map.get(lid) if lid else None
        lab_name = lab_meta["name"] if lab_meta else None
        lab_tz_name = lab_meta["timezone"] if lab_meta else fallback_tz

        dt = log.created_at
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        formatted_str = None
        if dt:
            try:
                target_tz = zoneinfo.ZoneInfo(lab_tz_name)
            except Exception:
                target_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
            formatted_str = dt.astimezone(target_tz).strftime("%d %b %Y, %I:%M %p")

        output.append(
            AuditLogResponse(
                id=str(log.id),
                lab_id=lid,
                lab_name=lab_name,
                lab_timezone=lab_tz_name,
                user_id=str(log.user_id) if log.user_id else None,
                user_email=log.user_email,
                user_role=log.user_role,
                action=log.action,
                entity_name=log.entity_name,
                entity_id=str(log.entity_id) if log.entity_id else None,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                before_state_json=log.before_state_json,
                after_state_json=log.after_state_json,
                created_at=dt,
                formatted_time=formatted_str,
            )
        )

    paged_limit = effective_limit if (not all and effective_limit) else (total or 20)
    meta = paginate_meta(page=effective_page, limit=paged_limit, total=total)

    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} audit logs.",
        data=output,
        meta=meta,
    )
