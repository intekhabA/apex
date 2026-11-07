from typing import List, Optional
from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user


AVAILABLE_MODULES = [
    {
        "key": "dashboard",
        "name": "Dashboard & Overview",
        "description": "View laboratory operational KPIs, sample throughput, and summary statistics.",
        "icon": "LayoutDashboard",
    },
    {
        "key": "patients",
        "name": "Patients Directory",
        "description": "View and manage patient profiles, medical history, and demographics.",
        "icon": "Users",
    },
    {
        "key": "bookings",
        "name": "Bookings & Orders",
        "description": "Create, schedule, view, and manage patient test orders and appointments.",
        "icon": "CalendarDays",
    },
    {
        "key": "samples",
        "name": "Phlebotomy & Samples",
        "description": "Collect samples, generate barcodes, print labels, and track tube status.",
        "icon": "Pipette",
    },
    {
        "key": "results",
        "name": "Results Entry",
        "description": "Enter, update, and manage technical lab values (CBC, LFT, KFT, Lipid, etc.).",
        "icon": "FileSpreadsheet",
    },
    {
        "key": "reports",
        "name": "Reports & Doctor Approvals",
        "description": "Review diagnostic findings, verify lab reports, and perform clinical digital signing.",
        "icon": "FileCheck2",
    },
    {
        "key": "templates",
        "name": "Report & USG Templates",
        "description": "Create and manage ultrasound, radiology, and diagnostic report narrative templates.",
        "icon": "Scan",
    },
    {
        "key": "invoices",
        "name": "Billing & Invoices",
        "description": "Generate invoices, record payments, manage dues, and print official receipts.",
        "icon": "Receipt",
    },
    {
        "key": "expenses",
        "name": "Daily Expenses",
        "description": "Track lab petty cash, vendor payments, clinic operational costs, and vouchers.",
        "icon": "Wallet",
    },
    {
        "key": "doctor_commissions",
        "name": "Doctor Referral Commissions",
        "description": "Track referring physicians, calculate commission cuts, and manage doctor settlements.",
        "icon": "Percent",
    },
    {
        "key": "tests",
        "name": "Test Catalog & Pricing",
        "description": "View laboratory test catalog, normal reference intervals, and lab pricing.",
        "icon": "TestTubes",
    },
    {
        "key": "notifications",
        "name": "Patient Alerts & SMS/WhatsApp",
        "description": "View dispatched notifications, SMS/WhatsApp delivery status, and communication logs.",
        "icon": "Bell",
    },
]

DEFAULT_ROLE_PERMISSIONS = {
    "SUPER_ADMIN": [m["key"] for m in AVAILABLE_MODULES],
    "LAB_ADMIN": [m["key"] for m in AVAILABLE_MODULES],
    "RECEPTIONIST": ["dashboard", "patients", "bookings", "samples", "invoices", "expenses", "doctor_commissions", "notifications"],
    "LAB_ASSISTANT": ["patients", "samples", "results", "expenses"],
    "PATHOLOGIST": ["results", "reports", "templates", "tests"],
    "RADIOLOGIST": ["results", "reports", "templates", "tests"],
    "PATIENT": [],
}


def user_has_permission(user, permission_key: str) -> bool:
    """Check whether a user has access to a specific functional module."""
    user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if user_role in ("SUPER_ADMIN", "LAB_ADMIN"):
        return True

    # If explicit permissions list is assigned to user
    if getattr(user, "permissions", None) is not None:
        return permission_key in user.permissions

    # Fallback to role defaults
    return permission_key in DEFAULT_ROLE_PERMISSIONS.get(user_role, [])


class RoleChecker:
    """Dependency that ensures the authenticated user possesses one of the allowed roles
    or has been assigned the specific functional module permission.
    """

    def __init__(self, allowed_roles: List[str], permission_key: Optional[str] = None):
        self.allowed_roles = allowed_roles
        self.permission_key = permission_key

    def __call__(self, current_user = Depends(get_current_user)):
        user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        
        # 1. Super Admin always bypasses
        if user_role == "SUPER_ADMIN":
            return current_user

        # 2. Check if user's role is in allowed_roles
        if user_role in self.allowed_roles:
            return current_user

        # 3. Check if user has explicit permission granted for this module
        if self.permission_key and user_has_permission(current_user, self.permission_key):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Role '{user_role}' does not have sufficient permissions for this operation."
        )


# Role guards
require_super_admin = RoleChecker(["SUPER_ADMIN"])
require_lab_admin = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN"])
require_pathologist = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN", "PATHOLOGIST"], permission_key="reports")
require_radiologist = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN", "RADIOLOGIST"], permission_key="reports")
require_report_signer = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN", "PATHOLOGIST", "RADIOLOGIST"], permission_key="reports")
require_doctor_manager = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN"], permission_key="doctor_commissions")
require_test_manager = RoleChecker(["SUPER_ADMIN", "LAB_ADMIN"], permission_key="tests")
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


def require_permission(permission_key: str):
    """FastAPI route dependency ensuring current user has access to a specific functional module."""
    def checker(current_user = Depends(require_lab_staff)):
        if not user_has_permission(current_user, permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You do not have permission to access the '{permission_key}' module.",
            )
        return current_user
    return checker

