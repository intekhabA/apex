from typing import List, Optional
from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user


class RoleChecker:
    """Dependency that ensures the authenticated user possesses one of the allowed roles."""

    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user = Depends(get_current_user)):
        user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{user_role}' does not have sufficient permissions for this operation."
            )
        return current_user


# Role guards
require_super_admin = RoleChecker(["SUPER_ADMIN"])
require_lab_admin = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN"])
require_pathologist = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN", "PATHOLOGIST"])
require_radiologist = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN", "RADIOLOGIST"])
require_lab_staff = RoleChecker([
    "SUPER_ADMIN",
    "LAB_ADMIN",
    "LAB_ASSISTANT",
    "PATHOLOGIST",
    "RADIOLOGIST",
    "RECEPTIONIST"
])
require_patient = RoleChecker(["PATIENT"])


def verify_tenant_access(current_user, resource_lab_id: Optional[str]) -> None:
    """Enforces strict multi-tenant boundary.
    Raises HTTP 403 Forbidden if a tenant user attempts to access another lab's resource.
    SUPER_ADMIN is granted platform-wide oversight.
    """
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role == "SUPER_ADMIN":
        return

    if not current_user.lab_id or str(current_user.lab_id) != str(resource_lab_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot access data outside your assigned laboratory."
        )
