# DiagnoLab — Enterprise Multi-Tenant Diagnostic Laboratory Management System (LIMS)

![DiagnoLab Architecture](https://img.shields.io/badge/Architecture-Multi--Tenant-blue.svg)
![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12-emerald.svg)
![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript%20%7C%20Vite-indigo.svg)
![Database](https://img.shields.io/badge/Database-MySQL%208.0%20%7C%20SQLAlchemy%202.0-sky.svg)
![Security](https://img.shields.io/badge/Security-HMAC--SHA256%20%7C%20RBAC%20%7C%20Audit%20Ledger-rose.svg)
![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-success.svg)

**DiagnoLab** is an enterprise-grade, cloud-ready multi-tenant Diagnostic Laboratory Management System (LIMS) designed for clinical pathology labs, radiology and imaging centers, and diagnostic hospital chains. It enforces strict tenant isolation, immutable medical record verification, automated clinical calculations, real-time analytics, billing ledger management, and multi-channel patient communications.

---

## 🚀 Key Highlights & Capabilities

- **Strict Multi-Tenancy**: Data isolation at the database, query, and service layers with automatic tenant enforcement (`403 Forbidden` on any unauthorized cross-lab access).
- **Comprehensive RBAC**: Granular permissions across 6 system roles:
  - `SUPER_ADMIN`: Global laboratory lifecycle, subscription tiers, platform audits.
  - `LAB_ADMIN`: Lab branding, staff management, report headers, signatories, billing rates.
  - `PATHOLOGIST`: Diagnostic validation, multi-analyte formula calculations, report sign-off.
  - `RADIOLOGIST`: Imaging report authoring, DICOM/JPEG attachments, PACS integration.
  - `LAB_ASSISTANT`: Phlebotomy, specimen accessioning, barcode tracking, initial entry.
  - `RECEPTIONIST`: Patient registration, booking scheduling, invoice & payment collection.
  - `PATIENT`: Self-service portal for appointment tracking, receipt downloads, and signed PDF reports.
- **Clinical Calculation Engine**: Automatic computation of derived parameters (e.g. Indirect Bilirubin, eGFR, Globulin, A/G Ratio) with gender/age-specific reference ranges and critical flags (Low, Normal, High, Critical).
- **Tamper-Proof Medical Reports**: Cryptographic HMAC-SHA256 digital seals, ReportLab PDF rendering, and public QR code verification (`/verify/{token}`) that does not expose private patient identifiers.
- **Complete Billing & Invoicing**: Automated tax invoice generation upon booking, sequence generation (`INV-YYYY-XXXXXX`, `REC-YYYY-XXXXXX`), partial payments, and thermal/standard PDF receipts.
- **Event-Driven Communications**: Notification contracts for Email (SMTP), SMS, and WhatsApp across 4 core lifecycle milestones: Booking Created, Sample Collected, Report Finalized, and Payment Received.
- **Security & Auditability**: System-wide immutable audit trail logging user, role, IP address, user agent, action, and before/after state diffs.

---

## 🏛️ System Architecture

```
                       ┌─────────────────────────────────────────┐
                       │          Client Web Browsers            │
                       │     (Desktop, Tablet & Mobile Views)    │
                       └───────────────────┬─────────────────────┘
                                           │
                                           ▼ (Port 80 / 443)
                       ┌─────────────────────────────────────────┐
                       │           Nginx Reverse Proxy           │
                       │        (Gzip, SSL & Security Headers)   │
                       └───────────┬─────────────────┬───────────┘
                                   │                 │
              Static UI & Assets   │                 │ API Requests (/api/*)
             (Vite Port 5173)      ▼                 ▼ (Uvicorn Port 8000)
                     ┌──────────────────┐       ┌────────────────────────┐
                     │ React 18 + TS    │       │ FastAPI REST API       │
                     │ Tailwind + Vite  │       │ Python 3.12 + Pydantic │
                     └──────────────────┘       └───────────┬────────────┘
                                                            │
                                             SQLAlchemy 2.0 │ aiomysql / pymysql
                                                            ▼
                                                ┌────────────────────────┐
                                                │ MySQL 8.0 Database     │
                                                │ (Multi-Tenant Schema)  │
                                                └────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (asyncio), Pydantic v2, Alembic |
| **Frontend** | React 18, TypeScript (strict mode), Vite, TailwindCSS, Recharts, Lucide Icons |
| **Database** | MySQL 8.0 (production), SQLite / aiosqlite (zero-dependency testing) |
| **Document Engine** | ReportLab 4.2 (vector PDF generation), QRCode (pil) |
| **Security** | JWT (HS256) rotation, Bcrypt, HMAC-SHA256 digital sealing, AuditMiddleware |
| **DevOps** | Docker, Docker Compose, Nginx Alpine, Multi-stage builds |

---

## 🏁 Quickstart with Docker Compose

1. **Clone & Configure**:
   ```bash
   cp .env.example .env
   ```

2. **Launch Full Stack**:
   ```bash
   docker compose up --build -d
   ```

3. **Run Initial Database Migrations & Seeds**:
   ```bash
   docker compose exec backend alembic upgrade head
   docker compose exec backend python -m app.db.seed
   ```

4. **Access the Applications**:
   - Web Application: [http://localhost](http://localhost) (or [http://localhost:5173](http://localhost:5173))
   - Interactive Swagger API Docs: [http://localhost/api/docs](http://localhost/api/docs)
   - Health Probe: [http://localhost/api/health](http://localhost/api/health)

---

## 🔄 Migrating Existing SQLite Data to MySQL

If you have existing data in SQLite (`diagnolab.db`), you can migrate all records directly into MySQL using the included migration utility:

```bash
# 1. Start MySQL container
docker compose up -d mysql

# 2. Run the migration utility
python scripts/migrate_sqlite_to_mysql.py

# Optional: Specify explicit SQLite path and MySQL connection string
python scripts/migrate_sqlite_to_mysql.py \
  --sqlite-path backend/diagnolab.db \
  --mysql-url mysql+pymysql://diagnolab:diagnolab_secret@localhost:3306/diagnolab_db
```

The migration utility:
- Automatically creates all tables in MySQL if they do not exist
- Disables foreign key checks during bulk loading to prevent constraint conflicts
- Migrates all 23 database tables in topological dependency order
- Verifies and prints a side-by-side record count audit table

---

## 🔑 Demo & Test Credentials

After running the database seed runner (`python -m app.db.seed`), the following test accounts are available:

| Role | Email | Password | Scope |
|---|---|---|---|
| **Platform Super Admin** | `admin@example.com` | `SuperAdmin@2026!` | Global / All Labs |
| **Demo Lab Admin** | `admin@demolab.com` | `LabAdmin@2026!` | Demo Diagnostic Lab |
| **Demo Lab Pathologist** | `pathologist@demolab.com` | `Pathologist@2026!` | Demo Diagnostic Lab |
| **Demo Lab Radiologist** | `radiologist@demolab.com` | `Radiologist@2026!` | Demo Diagnostic Lab |
| **Demo Lab Assistant** | `assistant@demolab.com` | `Assistant@2026!` | Demo Diagnostic Lab |
| **Demo Lab Receptionist** | `receptionist@demolab.com` | `Receptionist@2026!` | Demo Diagnostic Lab |
| **Demo Patient** | `patient@example.com` | `Patient@2026!` | Self-Service Portal |
| **City Care Lab Admin** | `admin@citycare.com` | `LabAdmin@2026!` | City Care Lab (Tenant B) |

---

## 🧪 Automated Testing & Verification

DiagnoLab features a 100% automated test suite covering all 13 phases of the development roadmap:

```bash
# Activate virtual environment
source .venv/bin/activate

# Execute complete pytest suite
pytest -v

# Run specific phase test
pytest backend/tests/test_phase11_notifications.py -v
pytest backend/tests/test_phase12_security_audit.py -v
```

### Frontend TypeScript Verification
```bash
cd frontend
npm run build   # Runs tsc -b with strict checks and builds production bundle
```

---

## 📖 Documentation
- [Deployment Guide](DEPLOYMENT.md) — Production hardening, SSL, backup, and scaling.
- [User Manual](USER_GUIDE.md) — Step-by-step role workflows and operator instructions.
- [Roadmap & Progress](DEVELOPMENT_ROADMAP.md) — Detailed specifications of Phases 1 through 13.
