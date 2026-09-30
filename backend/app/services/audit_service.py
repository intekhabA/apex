from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog


class AuditService:
    @staticmethod
    async def log_event(
        db: AsyncSession,
        action: str,
        entity_name: str,
        entity_id: Optional[str] = None,
        lab_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Persists a structured audit log entry for system traceability."""
        log = AuditLog(
            action=action,
            entity_name=entity_name,
            entity_id=str(entity_id) if entity_id else None,
            lab_id=str(lab_id) if lab_id else None,
            user_id=str(user_id) if user_id else None,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            user_agent=user_agent,
            before_state_json=before_state,
            after_state_json=after_state,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log


async def audit_log(
    db: AsyncSession,
    action: str,
    entity_name: str,
    entity_id: Optional[str] = None,
    user: Optional[Any] = None,
    lab_id: Optional[str] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    effective_lab_id = lab_id or (getattr(user, "lab_id", None) if user else None)
    role_val = None
    if user and hasattr(user, "role"):
        role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    return await AuditService.log_event(
        db=db,
        action=action,
        entity_name=entity_name,
        entity_id=entity_id,
        lab_id=effective_lab_id,
        user_id=getattr(user, "id", None) if user else None,
        user_email=getattr(user, "email", None) if user else None,
        user_role=role_val,
        ip_address=ip_address,
        user_agent=user_agent,
        before_state=before_state,
        after_state=after_state,
    )
