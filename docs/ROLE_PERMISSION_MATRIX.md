# DiagnoLab – Role & Permission Matrix (RBAC)
## Fine-Grained Authorization & Tenant Scoping Rules

---

## 1. Principles of Authorization in DiagnoLab

1. **Deny by Default**: Any request lacking explicit permission granted to the authenticated role is denied with `HTTP 403 Forbidden`.
2. **Context-Derived Tenancy**: The user's role and `lab_id` are derived strictly from the cryptographically validated JWT session. No user can escalate privileges by supplying an arbitrary `lab_id` in request headers, query parameters, or payloads.
3. **Cross-Tenant Guard**: Every query that touches tenant-scoped resources (`patients`, `bookings`, `samples`, `reports`, `invoices`) must enforce:
   $$\text{Resource}.\text{lab\_id} == \text{CurrentUser}.\text{lab\_id}$$
   Unless the caller is `SUPER_ADMIN` accessing global oversight endpoints.
4. **Medical Document Sealing Guard**: A finalized diagnostic report (`status == 'FINAL'`) can never be modified through standard update endpoints. Only an authorized `PATHOLOGIST` or `LAB_ADMIN` may invoke the dedicated `/amend` endpoint, which increments the version and requires a documented medical justification.

---

## 2. Granular Role & Permission Matrix

| Module / Entity | Operation / Endpoint Guard | SUPER_ADMIN | LAB_ADMIN | LAB_ASSISTANT | PATHOLOGIST | RADIOLOGIST | RECEPTIONIST | PATIENT |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Laboratories** | List All Labs | ✅ (All) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Create / Onboard Laboratory | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Activate / Deactivate Lab | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | View Own Lab Profile | ✅ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ |
| | Edit Own Lab Profile / Branding | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Configure Report Header / Footer / Disclaimers | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Users & Staff** | List Platform Users | ✅ (All) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | List Own Lab Staff | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Create Lab Staff User | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Update Lab Staff User / Role | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Deactivate Lab Staff User | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Test Catalog** | Manage Global Test Categories | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Create / Edit Global Tests | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Configure Sub-parameters & Display Order | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Configure Global Biological Reference Ranges | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | View Test Catalog | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Configure Lab-Specific Pricing & Discounts | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Create / Edit Test Packages | ✅ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Patients** | Register New Patient | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ✅ (Own) | ❌ |
| | Search & View Patient Directory | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ |
| | Edit Patient Demographics | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ✅ (Own) | ❌ |
| | View Own Patient Profile | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Self) |
| **Bookings & Orders** | Create New Booking / Order | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ✅ (Own) | ❌ |
| | List & Filter Lab Bookings | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ |
| | Update Booking Status | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ✅ (Own) | ❌ |
| | Cancel Booking | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| | View Own Bookings | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Self) |
| **Samples & Specimen** | Accession & Generate Barcode | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ❌ | ❌ |
| | Update Sample Status (Collected/Received) | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ❌ |
| | Mark Specimen Rejected (with reason) | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ❌ |
| | View Specimen Tracking History | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ❌ |
| **Results Entry** | Enter Pathology Values (Draft) | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ❌ |
| | Enter Imaging Findings & Impression | ❌ | ✅ (Own) | ❌ | ❌ | ✅ (Own) | ❌ | ❌ |
| | Upload Imaging Assets (DICOM/X-ray) | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ✅ (Own) | ❌ | ❌ |
| | Calculate Reference Flags (LOW/NORMAL/HIGH) | Automatic | Automatic | Automatic | Automatic | Automatic | Automatic | ❌ |
| **Reports Workflow** | Submit Report for Review | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ | ❌ |
| | Medically Verify Pathology Report | ❌ | ❌ | ❌ | ✅ (Own) | ❌ | ❌ | ❌ |
| | Medically Verify Imaging Report | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ | ❌ |
| | Finalize & Digitally Seal Report | ❌ | ✅ (Own) | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ |
| | Amend Finalized Report (New Version) | ❌ | ✅ (Own) | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ |
| | Download Report PDF | ✅ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Self) |
| | Public QR Verification | 🌐 Public | 🌐 Public | 🌐 Public | 🌐 Public | 🌐 Public | 🌐 Public | 🌐 Public |
| **Invoices & Billing** | Generate Invoice & Bill | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| | Record Payment (Cash, UPI, Card) | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| | Print Receipt & Invoice PDF | ❌ | ✅ (Own) | ✅ (Own) | ❌ | ❌ | ✅ (Own) | ✅ (Self) |
| **Analytics & Logs** | Platform-Wide KPIs & Revenue | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | Laboratory Operational Dashboard | ❌ | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ✅ (Own) | ❌ |
| | View Laboratory Audit Logs | ❌ | ✅ (Own) | ❌ | ❌ | ❌ | ❌ | ❌ |
| | View Global System Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. Dependency Injection & Guard Enforcement in FastAPI

In FastAPI, permissions and tenancy are enforced via typed, reusable dependency injectors:

```python
# app/core/permissions.py
from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user
from app.models.user import User, UserRole

class RoleChecker:
    def __init__(self, allowed_roles: list[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for current role."
            )
        return current_user

# Pre-configured dependency shortcuts:
require_super_admin = RoleChecker([UserRole.SUPER_ADMIN])
require_lab_admin = RoleChecker([UserRole.SUPER_ADMIN, UserRole.LAB_ADMIN])
require_pathologist = RoleChecker([UserRole.PATHOLOGIST, UserRole.LAB_ADMIN])
require_radiologist = RoleChecker([UserRole.RADIOLOGIST, UserRole.LAB_ADMIN])
require_lab_staff = RoleChecker([
    UserRole.SUPER_ADMIN,
    UserRole.LAB_ADMIN,
    UserRole.LAB_ASSISTANT,
    UserRole.PATHOLOGIST,
    UserRole.RADIOLOGIST,
    UserRole.RECEPTIONIST
])
```

### 3.1 Tenant Scope Verification Helper
```python
def verify_tenant_access(current_user: User, resource_lab_id: UUID) -> None:
    """Verifies that the current user belongs to the resource's laboratory.
    Super Admins are granted global bypass for maintenance/oversight.
    """
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    if current_user.lab_id != resource_lab_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cross-tenant resource access is prohibited."
        )
```
