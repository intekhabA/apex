# DiagnoLab – Project Directory & File Layout
## Production-Grade Monorepo Structure

---

```
/home/intekhab/python/apex/
│
├── .env.example                       # Documented environment variables blueprint
├── .gitignore                         # Python, Node, Vite, Docker, OS ignore rules
├── docker-compose.yml                 # Multi-service composition (postgres, backend, frontend, nginx)
├── nginx/
│   └── default.conf                   # Nginx reverse proxy, gzip, proxy_pass, security headers
│
├── backend/
│   ├── Dockerfile                     # Multi-stage Python 3.12-slim container with non-root user
│   ├── requirements.txt               # Pinned production dependencies
│   ├── requirements-dev.txt           # Testing & linting tooling (pytest, httpx, black, ruff)
│   ├── alembic.ini                    # Database migration configuration
│   ├── alembic/
│   │   ├── env.py                     # SQLAlchemy metadata auto-detection
│   │   ├── script.py.mako             # Revision template
│   │   └── versions/                  # Incremental versioned migration scripts
│   │       └── 0001_initial_schema.py
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI application initialization & lifespan
│   │   │
│   │   ├── core/                      # Kernel foundations
│   │   │   ├── __init__.py
│   │   │   ├── config.py              # Pydantic BaseSettings (env parsing & validation)
│   │   │   ├── database.py            # SQLAlchemy async/sync engine, sessionmaker, base
│   │   │   ├── security.py            # Password hashing (bcrypt), JWT encode/decode
│   │   │   ├── permissions.py         # RoleChecker dependencies & tenant context validators
│   │   │   └── exceptions.py          # Unified domain exceptions & handlers
│   │   │
│   │   ├── models/                    # Declarative SQLAlchemy 2.0 ORM entities
│   │   │   ├── __init__.py
│   │   │   ├── laboratory.py          # Laboratory & LaboratorySettings
│   │   │   ├── user.py                # User, UserRole, credentials
│   │   │   ├── patient.py             # Patient & demographics
│   │   │   ├── test.py                # TestCategory, Test, TestParameter, ReferenceRange, TestPackage
│   │   │   ├── booking.py             # Booking, BookingItem, status enums
│   │   │   ├── sample.py              # Sample, SampleTrackingEvent
│   │   │   ├── result.py              # TestResultValue, result flags
│   │   │   ├── report.py              # Report, ReportVersion, ReportAttachment
│   │   │   ├── invoice.py             # Invoice, Payment, payment methods
│   │   │   └── audit.py               # AuditLog
│   │   │
│   │   ├── schemas/                   # Pydantic validation & response serialization
│   │   │   ├── __init__.py
│   │   │   ├── common.py              # Envelope schemas (APIResponse, PaginationMeta)
│   │   │   ├── auth.py                # LoginRequest, TokenResponse, UserProfile
│   │   │   ├── laboratory.py          # LaboratoryCreate, LaboratoryResponse
│   │   │   ├── user.py                # UserCreate, UserUpdate, UserResponse
│   │   │   ├── patient.py             # PatientCreate, PatientResponse, PatientTimeline
│   │   │   ├── test.py                # TestCreate, ParameterCreate, ReferenceRangeSchema
│   │   │   ├── booking.py             # BookingCreate, BookingResponse, PricingBreakdown
│   │   │   ├── sample.py              # SampleCreate, SampleStatusUpdate, SampleResponse
│   │   │   ├── result.py              # ResultEntrySchema, FlagEvaluation
│   │   │   ├── report.py              # ReportResponse, AmendmentRequest, VerificationResponse
│   │   │   └── invoice.py             # InvoiceResponse, PaymentCreate
│   │   │
│   │   ├── api/                       # HTTP API Routers
│   │   │   ├── __init__.py
│   │   │   ├── api_v1.py              # Master router aggregating all modular endpoints
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py            # Authentication, refresh, me
│   │   │       ├── admin.py           # Super Admin labs & platform oversight
│   │   │       ├── lab.py             # Lab settings, profile, lab users
│   │   │       ├── patients.py        # Patient management
│   │   │       ├── tests.py           # Test catalog, packages & lab pricing
│   │   │       ├── bookings.py        # Orders & scheduling
│   │   │       ├── samples.py         # Specimen accessioning
│   │   │       ├── results.py         # LFT/KFT/CBC and imaging result entry
│   │   │       ├── reports.py         # Verification, approval, finalize, amend, download
│   │   │       ├── invoices.py        # Billing, payments & receipts
│   │   │       ├── patient_portal.py  # Self-service patient endpoints
│   │   │       └── public.py          # QR Verification endpoint
│   │   │
│   │   ├── services/                  # Encapsulated Business Logic Layer
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py        # Token generation, credential checks
│   │   │   ├── tenant_service.py      # Lab creation, isolation guarantees
│   │   │   ├── calculation_service.py # Biological reference interval flag evaluator
│   │   │   ├── pdf_service.py         # Diagnostic report & invoice PDF generation (ReportLab)
│   │   │   ├── qr_service.py          # Cryptographic HMAC & QR code generation
│   │   │   ├── storage_service.py     # Local / S3 storage abstraction
│   │   │   └── audit_service.py       # Asynchronous audit log persistence
│   │   │
│   │   ├── repositories/              # Tenant-Aware Data Access Layer
│   │   │   ├── __init__.py
│   │   │   ├── base_repository.py     # Scoped CRUD abstractions
│   │   │   ├── patient_repo.py
│   │   │   ├── booking_repo.py
│   │   │   ├── sample_repo.py
│   │   │   ├── report_repo.py
│   │   │   └── invoice_repo.py
│   │   │
│   │   ├── middleware/                # ASGI Middlewares
│   │   │   ├── __init__.py
│   │   │   ├── audit_middleware.py    # IP and request metadata capture
│   │   │   └── error_middleware.py    # Global unhandled exception handler
│   │   │
│   │   └── db/
│   │       ├── __init__.py
│   │       └── seed.py                # Comprehensive development seed data generator
│   │
│   └── tests/                         # Pytest Suite
│       ├── __init__.py
│       ├── conftest.py                # Test fixtures (DB, test clients, tokens)
│       ├── test_auth.py               # Login, refresh, password hashing
│       ├── test_tenant_isolation.py   # Multi-tenancy cross-access prevention (Lab A vs Lab B)
│       ├── test_patients.py           # Patient CRUD and validation
│       ├── test_bookings.py           # Booking calculations and workflows
│       ├── test_results.py            # LFT/KFT/CBC result calculations
│       ├── test_reports.py            # Immutability, amendments, approvals
│       └── test_invoices.py           # Financial amounts and payment receipts
│
├── frontend/
│   ├── Dockerfile                     # Multi-stage build (Node build -> Nginx alpine)
│   ├── package.json                   # React, Vite, Tailwind, TanStack Query, Lucide
│   ├── tsconfig.json                  # TypeScript compiler options & path aliases
│   ├── vite.config.ts                 # Vite bundler configuration & proxy
│   ├── tailwind.config.js             # Tailwind theme configuration
│   ├── postcss.config.js
│   ├── index.html                     # Entry HTML with meta & fonts
│   │
│   └── src/
│       ├── main.tsx                   # React root bootstrap
│       ├── App.tsx                    # Top-level Router & QueryClientProvider
│       ├── index.css                  # Global Tailwind styles & healthcare theme
│       │
│       ├── assets/                    # Static brand logos & medical iconography
│       │
│       ├── types/                     # Shared TypeScript interfaces & types
│       │   ├── auth.ts
│       │   ├── laboratory.ts
│       │   ├── patient.ts
│       │   ├── booking.ts
│       │   ├── sample.ts
│       │   ├── test.ts
│       │   ├── report.ts
│       │   ├── invoice.ts
│       │   └── api.ts
│       │
│       ├── api/                       # Axios / Fetch client with JWT interceptors
│       │   ├── client.ts              # Unified HTTP client with automatic 401 token refresh
│       │   └── endpoints.ts           # Centralized URL endpoints map
│       │
│       ├── store/                     # Client state management
│       │   └── authStore.ts           # User session, JWT tokens, active lab profile
│       │
│       ├── hooks/                     # Custom React hooks
│       │   ├── useAuth.ts
│       │   ├── useDebounce.ts
│       │   └── usePermissions.ts
│       │
│       ├── components/                # Reusable UI Atoms & Molecules
│       │   ├── ui/                    # Button, Input, Modal, Badge, Table, Card, Tabs, Select
│       │   ├── common/                # Navbar, Sidebar, Breadcrumb, Toast, EmptyState, SkeletonLoader
│       │   └── charts/                # Recharts wrappers (Area, Bar, Donut)
│       │
│       ├── layouts/                   # Structural Application Shells
│       │   ├── AuthLayout.tsx         # Clean split-screen login/auth shell
│       │   ├── SuperAdminLayout.tsx   # Global administrative shell
│       │   ├── LabLayout.tsx          # Laboratory operational shell with role-aware nav
│       │   ├── PatientLayout.tsx      # Patient self-service shell
│       │   └── PublicLayout.tsx       # QR Verification public wrapper
│       │
│       └── features/                  # Domain Feature Modules
│           ├── auth/                  # LoginPage, ProfilePage
│           ├── superadmin/            # LabsList, AddLabModal, GlobalCatalog, Analytics
│           ├── dashboard/             # LabAdminDashboard, AssistantDashboard
│           ├── patients/              # PatientsList, PatientRegistration, PatientDetailTimeline
│           ├── bookings/              # BookingsList, NewBookingModal, BookingDetail
│           ├── tests/                 # TestCatalogView, PricingConfigModal, PackageBuilder
│           ├── samples/               # SampleAccessioningView, SpecimenStatusModal
│           ├── results/               # ResultEntrySheet, LFTForm, KFTForm, CBCForm, ImagingForm
│           ├── reports/               # ReportsQueue, ReportDetail, ApproveModal, AmendModal
│           ├── invoices/              # InvoiceList, InvoiceView, RecordPaymentModal
│           ├── settings/              # LabProfileSettings, ReportHeaderFooterConfig
│           ├── audit/                 # AuditLogsViewer
│           ├── patientPortal/         # PatientDashboard, MyReports, MyBookings, MyInvoices
│           └── verification/          # PublicQRVerifyPage
│
└── docs/                              # Project Documentation
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    ├── ROLE_PERMISSION_MATRIX.md
    ├── API_SPECIFICATION.md
    ├── PROJECT_STRUCTURE.md
    └── DEVELOPMENT_ROADMAP.md
```
