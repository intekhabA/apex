from fastapi import APIRouter
from app.api.routes import auth, admin, lab, tests, patients, bookings, samples, results, imaging, reports, invoices, patient_portal, notifications, audit, doctors

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(lab.router)
api_router.include_router(tests.router)
api_router.include_router(patients.router)
api_router.include_router(bookings.router)
api_router.include_router(samples.router)
api_router.include_router(results.router)
api_router.include_router(imaging.router)
api_router.include_router(reports.router)
api_router.include_router(invoices.router)
api_router.include_router(patient_portal.router)
api_router.include_router(notifications.router)
api_router.include_router(audit.router)
api_router.include_router(doctors.router)

