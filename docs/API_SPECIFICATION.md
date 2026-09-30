# DiagnoLab – Complete REST API Specification
## RESTful Endpoints, Envelopes, Schemas & Security Contracts

---

## 1. Standard Response Envelope Design

All DiagnoLab endpoints respond using a unified JSON envelope.

### 1.1 Success Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "total_pages": 8
  }
}
```

### 1.2 Error Response Envelope
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "A user with this email address already exists in this tenant.",
    "phone": "Invalid mobile phone format."
  }
}
```

---

## 2. API Endpoints Catalog

### 2.1 Authentication & Profile (`/api/auth`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate with email/password; returns JWT access + refresh tokens. |
| `POST` | `/api/auth/refresh` | Public (Refresh Token) | Rotate access token using valid refresh token. |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate refresh token session. |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile, assigned role, and lab info. |
| `PUT` | `/api/auth/profile` | Authenticated | Update personal profile details (name, phone, qualifications). |
| `POST` | `/api/auth/change-password`| Authenticated | Change current user password (verifying previous). |

---

### 2.2 Super Admin & Platform Management (`/api/admin`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard` | `SUPER_ADMIN` | Global KPIs (Total Labs, Revenue, Bookings, Active Tests, Trends). |
| `GET` | `/api/admin/laboratories` | `SUPER_ADMIN` | List all laboratories with subscription status, pagination, and search. |
| `POST` | `/api/admin/laboratories` | `SUPER_ADMIN` | Onboard a new laboratory (creates lab, default settings, initial admin user). |
| `GET` | `/api/admin/laboratories/{id}` | `SUPER_ADMIN` | Detailed profile of a specific laboratory. |
| `PUT` | `/api/admin/laboratories/{id}` | `SUPER_ADMIN` | Update laboratory organization details. |
| `PATCH`| `/api/admin/laboratories/{id}/status` | `SUPER_ADMIN` | Activate or suspend laboratory operations. |
| `GET` | `/api/admin/audit-logs` | `SUPER_ADMIN` | System-wide audit log query with date/action filters. |

---

### 2.3 Laboratory Operations & Settings (`/api/lab`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/lab/dashboard` | Lab Staff | Operational dashboard (today's bookings, samples, pending reports, revenue). |
| `GET` | `/api/lab/profile` | Lab Staff | Get current laboratory profile and settings. |
| `PUT` | `/api/lab/profile` | `LAB_ADMIN` | Update current laboratory profile, branding, contacts. |
| `GET` | `/api/lab/settings` | Lab Staff | Get report header/footer templates, disclaimer, invoice configs. |
| `PUT` | `/api/lab/settings` | `LAB_ADMIN` | Update report templates, signatory details, disclaimers. |
| `GET` | `/api/lab/users` | `LAB_ADMIN` | List staff members belonging to this laboratory. |
| `POST` | `/api/lab/users` | `LAB_ADMIN` | Create a new staff account (technician, pathologist, radiologist, receptionist). |
| `PUT` | `/api/lab/users/{id}` | `LAB_ADMIN` | Update staff details, roles, or active state. |
| `GET` | `/api/lab/audit-logs` | `LAB_ADMIN` | View audit trail scoped strictly to this laboratory. |

---

### 2.4 Test Catalog & Pricing (`/api/tests`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/test-categories` | Authenticated | List all active test categories (Biochemistry, Hematology, etc.). |
| `POST` | `/api/test-categories` | `SUPER_ADMIN` | Create new diagnostic category. |
| `PUT` | `/api/test-categories/{id}` | `SUPER_ADMIN` | Update category details or display order. |
| `GET` | `/api/tests` | Authenticated | List tests with pagination, category filter, and lab-specific pricing. |
| `POST` | `/api/tests` | `SUPER_ADMIN` | Create new test in master catalog. |
| `GET` | `/api/tests/{id}` | Authenticated | Get full test details with parameters and reference ranges. |
| `PUT` | `/api/tests/{id}` | `SUPER_ADMIN` | Update master test definitions. |
| `POST` | `/api/tests/{id}/parameters`| `SUPER_ADMIN` | Add parameter (analyte) to test. |
| `POST` | `/api/parameters/{id}/ranges`| `SUPER_ADMIN` | Configure age/gender reference ranges. |
| `PUT` | `/api/lab/test-pricing` | `LAB_ADMIN` | Set laboratory-specific price override and discount. |
| `GET` | `/api/test-packages` | Authenticated | List health checkup packages. |
| `POST` | `/api/test-packages` | `SUPER_ADMIN` / `LAB_ADMIN` | Create package bundled with multiple tests. |

---

### 2.5 Patients Management (`/api/patients`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/patients` | Lab Staff | Search patients in lab by phone, name, or `patient_id_display`. |
| `POST` | `/api/patients` | Lab Staff | Register new patient (generates `PAT-2026-000001`). |
| `GET` | `/api/patients/{id}` | Lab Staff / Patient (Self) | Retrieve comprehensive patient profile and clinical history. |
| `PUT` | `/api/patients/{id}` | Lab Staff | Update patient demographics and emergency contact. |
| `GET` | `/api/patients/{id}/timeline` | Lab Staff / Patient (Self) | Timeline of registrations, bookings, reports, and payments. |

---

### 2.6 Bookings & Order Management (`/api/bookings`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/bookings` | Lab Staff | List bookings with status filters (PENDING, PROCESSING, COMPLETED). |
| `POST` | `/api/bookings` | Lab Staff | Create booking with items (tests/packages), tax, and discount. |
| `GET` | `/api/bookings/{id}` | Lab Staff / Patient (Self) | Get complete booking order details with items and invoice state. |
| `PATCH`| `/api/bookings/{id}/status` | Lab Staff | Advance booking status. |
| `DELETE`| `/api/bookings/{id}` | `LAB_ADMIN` / Receptionist | Cancel booking (if not yet processed). |

---

### 2.7 Specimen & Sample Accessioning (`/api/samples`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/samples` | Lab Staff | List accessioned specimens, filter by status or test type. |
| `POST` | `/api/samples/collect` | Lab Assistant | Mark specimen collected, generate barcode & accession timestamp. |
| `POST` | `/api/samples/receive` | Lab Assistant / Pathologist | Confirm specimen received in processing lab. |
| `POST` | `/api/samples/reject` | Lab Assistant / Pathologist | Reject damaged/hemolyzed specimen with mandatory reason. |
| `GET` | `/api/samples/{id}/history` | Lab Staff | Audit trail of all custody transitions for the specimen. |

---

### 2.8 Results Entry & Review (`/api/results`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/results/pending` | Lab Staff | Worklist of tests awaiting result entry. |
| `GET` | `/api/results/{report_id}` | Lab Staff | Get result entry sheet with parameters, ranges, and current values. |
| `PUT` | `/api/results/{report_id}/values` | Lab Assistant / Pathologist | Save/update numeric and text analyte values (auto-evaluates flags). |
| `PUT` | `/api/results/{report_id}/imaging`| Radiologist | Save clinical history, findings, and impression for imaging test. |
| `POST` | `/api/results/{report_id}/attachments`| Radiologist / Staff | Upload diagnostic image attachment (X-Ray / Ultrasound JPEG/PNG). |

---

### 2.9 Diagnostic Reports, Approvals & Verification (`/api/reports`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports` | Lab Staff | List reports filtered by status (DRAFT, PENDING_REVIEW, APPROVED, FINAL). |
| `GET` | `/api/reports/{id}` | Lab Staff / Patient (Self) | Retrieve structured report details. |
| `POST` | `/api/reports/{id}/submit-review` | Lab Assistant | Submit drafted results for medical review. |
| `POST` | `/api/reports/{id}/approve` | Pathologist / Radiologist | Medically approve report with electronic signature stamp. |
| `POST` | `/api/reports/{id}/finalize`| Pathologist / Radiologist / Admin | Seal report into immutable state, generate verification token & PDF. |
| `POST` | `/api/reports/{id}/amend` | Pathologist / Lab Admin | Create versioned amendment with documented clinical justification. |
| `GET` | `/api/reports/{id}/download`| Lab Staff / Patient (Self) | Authenticated, secure streaming download of finalized PDF report. |
| `GET` | `/api/reports/verify/{token}`| Public | Public QR verification endpoint returning masked integrity data. |

---

### 2.10 Invoices & Payments (`/api/invoices`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/invoices` | Lab Staff | Query invoices with payment status filter (PENDING, PARTIAL, PAID). |
| `GET` | `/api/invoices/{id}` | Lab Staff / Patient (Self) | Invoice line items, tax breakdown, payments ledger. |
| `POST` | `/api/invoices/{id}/payments` | Receptionist / Lab Admin | Record payment (CASH, CARD, UPI) and generate receipt. |
| `GET` | `/api/invoices/{id}/download` | Lab Staff / Patient (Self) | Authenticated download of printable tax invoice PDF. |
| `GET` | `/api/payments/{receipt_id}/download` | Lab Staff / Patient (Self) | Authenticated download of thermal or standard payment receipt PDF. |

---

### 2.11 Patient Self-Service Portal (`/api/patient-portal`)

| Method | Endpoint | Access Guard | Summary |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/patient-portal/dashboard` | Patient | Overview of upcoming bookings, finalized reports, and pending invoices. |
| `GET` | `/api/patient-portal/bookings` | Patient | List personal diagnostic appointments and booking history. |
| `GET` | `/api/patient-portal/reports` | Patient | List and download finalized diagnostic reports. |
| `GET` | `/api/patient-portal/invoices`| Patient | View payment history and receipts. |
