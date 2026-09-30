# DiagnoLab — Comprehensive User Guide & Role Operations Manual

Welcome to **DiagnoLab**, the cloud diagnostic laboratory management system designed for clinical pathology laboratories, imaging centers, and multi-branch diagnostic networks.

---

## 1. System Navigation & Role Architecture

DiagnoLab provides role-based interfaces with adaptive sidebars tailored to specific operational responsibilities:

| Role | Primary Responsibilities |
|---|---|
| **Super Admin** | Platform governance, laboratory onboarding, global analytics, multi-tenant audit |
| **Lab Admin** | Laboratory profile, staff management, report headers, signatories, pricing, audit trail |
| **Receptionist** | Patient registration, booking accessioning, discount management, billing & receipts |
| **Lab Assistant / Phlebotomist** | Specimen collection, accessioning, barcode scanning, specimen status tracking |
| **Pathologist** | Result value entry, automatic clinical calculations, reference range review, report sign-off |
| **Radiologist** | Imaging observations, narrative impressions, DICOM/JPEG attachments, report sign-off |
| **Patient** | Personalized portal for bookings, invoices, and authenticated PDF report downloads |

---

## 2. Operational Workflows

### 2.1 Front Desk & Receptionist: Patient Registration & Booking
1. **Patient Registration**:
   - Navigate to **Patients** in the sidebar.
   - Click **+ Register Patient**. Fill in Name, Gender, Age/DOB, Phone, and Email.
   - A sequential Patient ID is automatically generated (e.g. `PAT-2026-000001`).
2. **Creating a Diagnostic Booking**:
   - Click **+ New Booking** or open **Bookings & Orders**.
   - Select the patient and choose tests or packages (e.g. *Complete Blood Count*, *Liver Function Test*, *Lipid Profile*).
   - Enter referring doctor information (or select *Self / Direct Walk-in*).
   - Review pricing, apply discounts (if authorized), and enter initial payment deposit.
   - Click **Confirm Booking**. The system automatically:
     - Assigns a Booking ID (e.g. `ORD-2026-000001`).
     - Accessions required specimen collection tubes (e.g. Serum, EDTA Whole Blood).
     - Initializes draft report records.
     - Creates a synchronized Tax Invoice (e.g. `INV-2026-000001`).
     - Dispatches a booking confirmation notification to the patient.

---

### 2.2 Phlebotomy & Specimen Accessioning
1. Navigate to **Phlebotomy / Samples**.
2. View pending samples filtered by specimen status: `REGISTERED`, `COLLECTED`, `RECEIVED`, `PROCESSING`.
3. Locate the patient's specimen order.
4. Click **Collect Specimen**:
   - Confirm sample container type (e.g. *Lavender EDTA*, *Gold SST*).
   - Enter or scan the physical tube barcode.
   - Click **Confirm Collection**.
   - The status updates to `COLLECTED`, an immutable tracking event is logged, and the patient receives a collection notification.
5. In the laboratory processing room, click **Receive in Lab** once the specimen arrives for testing.

---

### 2.3 Diagnostic Results Entry & Clinical Calculations (Pathology)
1. Navigate to **Results Entry (LFT/KFT/CBC)**.
2. Select a pending report to open the clinical entry grid.
3. **Numeric & Text Value Entry**:
   - Enter raw observed analyte values.
   - As values are entered, DiagnoLab evaluates reference ranges based on patient age and gender.
   - Out-of-range values are flagged automatically:
     - 🟢 **Normal**: Value within standard biological reference interval.
     - 🟡 **Low / High**: Value outside standard interval.
     - 🔴 **Critical**: Value exceeds life-threatening critical limits.
4. **Automated Clinical Formulas**:
   - DiagnoLab calculates derived parameters automatically without manual calculation errors:
     - `Indirect Bilirubin = Total Bilirubin - Direct Bilirubin`
     - `Globulin = Total Protein - Albumin`
     - `A/G Ratio = Albumin / Globulin`
     - `eGFR (CKD-EPI / MDRD)` based on Serum Creatinine, Age, and Gender.
5. Click **Submit for Review** to advance the report to pathologist approval.

---

### 2.4 Diagnostic Imaging (Radiology & Ultrasound)
1. Navigate to **Reports & Approvals** and select an imaging study (e.g. *X-Ray Chest PA*, *USG Abdomen*).
2. Enter structured narrative sections:
   - **Clinical History & Indication**
   - **Imaging Findings & Technique**
   - **Impression / Conclusion**
   - **Recommendations & Follow-up**
3. Upload or view attached study images (JPEG/PNG/DICOM renders).
4. Save drafts or advance to sign-off.

---

### 2.5 Medical Report Approval & Digital Finalization
1. Open the report under **Reports & Approvals**.
2. Review patient demographics, analyte results, flags, technician remarks, and disclaimers.
3. Click **Approve Report** (requires Pathologist or Radiologist role).
4. Click **Finalize & Seal Report**:
   - The system generates an immutable cryptographic **HMAC-SHA256 digital signature**.
   - Generates a unique, non-guessable **verification token**.
   - Generates a vector **ReportLab PDF** containing lab branding, signatory credentials, analyte tables, and an authenticated QR code.
   - Locks the report: any subsequent modification attempts will be rejected (`400 Bad Request`).
   - Dispatches a finalized report notification to the patient with the verification link.

---

### 2.6 Billing, Invoices & Payment Receipts
1. Navigate to **Billing & Invoices**.
2. View invoice ledger with filters for `PAID`, `PARTIAL`, and `UNPAID`.
3. To record a payment on an outstanding balance:
   - Click **Record Payment**.
   - Select payment method (*Cash*, *Credit/Debit Card*, *UPI*, *Bank Transfer*).
   - Enter payment amount and transaction reference number.
   - Click **Confirm Payment**.
   - The invoice balance and payment status update immediately.
4. Click **Download Receipt** to print or export the official PDF receipt (`REC-YYYY-XXXXXX`).

---

### 2.7 Patient Self-Service Portal
Patients access a streamlined, mobile-responsive portal:
1. Log in with registered mobile number or email.
2. **Dashboard**: View active appointments, recent test orders, and overall health status.
3. **My Medical Reports**: Direct 1-click download of signed and sealed PDF reports.
4. **My Invoices & Receipts**: View payment history, remaining balance, and download official receipts.
5. Strict security: Attempting to query or view records belonging to any other patient returns `403 Forbidden`.

---

### 2.8 Public QR Verification & Tamper Protection
Every finalized DiagnoLab medical report contains an authenticated QR code linking to:
`https://diagnolab.yourdomain.com/verify/{verification_token}`

When scanned by a referring physician, hospital, or insurance provider:
- Validates the report's HMAC digest against the tamper-proof registry.
- Displays verification status: **Valid & Authentic Medical Report** or **Signature Mismatch**.
- Displays masked patient information (e.g. `P***a I***r`), test name, lab accreditation, version, and sign-off timestamp.
- Protects patient privacy by never exposing full personal identifiers to unauthenticated scanners.

---

### 2.9 System Audit Trail (Compliance & Governance)
1. Lab Admins and Super Admins can access **System Audit Trail** (`/audit/logs`).
2. Track all state-changing activities:
   - User account, role, and email of the actor.
   - Action performed (e.g. `CREATE_BOOKING`, `APPROVE_REPORT`, `COLLECT_SAMPLE`).
   - Client IP address and browser User Agent.
   - Expandable **State Before** and **State After** JSON diffs.
3. Multi-tenant privacy: Lab Admins can only view audit events within their own laboratory tenant.
