import pytest
from fastapi import HTTPException
from app.core.permissions import verify_tenant_access, RoleChecker
from app.models.user import User, UserRole


def test_tenant_isolation_same_lab():
    """User accessing resource within their own laboratory is allowed."""
    user = User(id="u1", lab_id="lab-alpha-123", role=UserRole.LAB_ADMIN)
    # Should not raise any exception
    verify_tenant_access(user, "lab-alpha-123")


def test_tenant_isolation_cross_lab_blocked():
    """User of Lab A attempting to access Lab B resource MUST raise HTTP 403 Forbidden."""
    user_lab_a = User(id="u-alpha", lab_id="lab-alpha-123", role=UserRole.LAB_ADMIN)

    with pytest.raises(HTTPException) as exc_info:
        verify_tenant_access(user_lab_a, "lab-beta-456")

    assert exc_info.value.status_code == 403
    assert "Cross-tenant" in exc_info.value.detail or "cannot access" in exc_info.value.detail


def test_tenant_isolation_super_admin_bypass():
    """Super Admin has global platform oversight and is never blocked by tenant checks."""
    super_admin = User(id="u-super", lab_id=None, role=UserRole.SUPER_ADMIN)
    # Both should pass without exception
    verify_tenant_access(super_admin, "lab-alpha-123")
    verify_tenant_access(super_admin, "lab-beta-456")


def test_role_checker_guard():
    """RoleChecker blocks unpermitted roles."""
    checker = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN"])
    assistant = User(id="u-asst", lab_id="lab-1", role=UserRole.LAB_ASSISTANT)

    with pytest.raises(HTTPException) as exc_info:
        checker(assistant)

    assert exc_info.value.status_code == 403
    assert "does not have sufficient permissions" in exc_info.value.detail
