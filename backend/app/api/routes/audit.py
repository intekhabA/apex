from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.permissions import require_lab_admin, verify_tenant_access
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.common import APIResponse
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
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lab_admin),
):
    """Retrieve audit logs with strict tenant isolation and filtering."""
    query = select(AuditLog).order_by(desc(AuditLog.created_at))

    # Tenant enforcement
    if current_user.role.value != "SUPER_ADMIN":
        if not current_user.lab_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active laboratory.")
        if lab_id and lab_id != current_user.lab_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access forbidden.")
        query = query.where(AuditLog.lab_id == current_user.lab_id)
    else:
        if lab_id:
            query = query.where(AuditLog.lab_id == lab_id)

    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_name:
        query = query.where(AuditLog.entity_name.ilike(f"%{entity_name}%"))
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if user_email:
        query = query.where(AuditLog.user_email.ilike(f"%{user_email}%"))
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    query = query.limit(limit).offset(offset)
    res = await db.execute(query)
    logs = res.scalars().all()

    output = [
        AuditLogResponse(
            id=str(log.id),
            lab_id=str(log.lab_id) if log.lab_id else None,
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
            created_at=log.created_at,
        )
        for log in logs
    ]

    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} audit logs.",
        data=output,
    )
