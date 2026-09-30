import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.patient import Patient
from app.models.booking import Booking
from app.models.sample import Sample


from app.models.report import Report


async def _get_next_sequence_id(db: AsyncSession, model_column, lab_id: str, prefix: str) -> str:
    res = await db.execute(
        select(func.max(model_column)).where(
            model_column.like(f"{prefix}%"),
        )
    )
    max_val = res.scalar()
    if max_val:
        try:
            last_seq = int(str(max_val).split("-")[-1])
        except (ValueError, IndexError):
            last_seq = 0
    else:
        last_seq = 0
    return f"{prefix}{str(last_seq + 1).zfill(6)}"


async def generate_patient_id(db: AsyncSession, lab_id: str) -> str:
    year = datetime.datetime.now().year
    prefix = f"PAT-{year}-"
    res = await db.execute(
        select(func.max(Patient.patient_id_display)).where(
            Patient.lab_id == lab_id,
            Patient.patient_id_display.like(f"{prefix}%"),
        )
    )
    max_val = res.scalar()
    last_seq = int(str(max_val).split("-")[-1]) if max_val else 0
    return f"{prefix}{str(last_seq + 1).zfill(6)}"


async def generate_booking_id(db: AsyncSession, lab_id: str) -> str:
    year = datetime.datetime.now().year
    prefix = f"BK-{year}-"
    res = await db.execute(
        select(func.max(Booking.booking_id_display)).where(
            Booking.lab_id == lab_id,
            Booking.booking_id_display.like(f"{prefix}%"),
        )
    )
    max_val = res.scalar()
    last_seq = int(str(max_val).split("-")[-1]) if max_val else 0
    return f"{prefix}{str(last_seq + 1).zfill(6)}"


async def generate_sample_id(db: AsyncSession, lab_id: str) -> str:
    year = datetime.datetime.now().year
    prefix = f"SMP-{year}-"
    res = await db.execute(
        select(func.max(Sample.sample_id_display)).where(
            Sample.lab_id == lab_id,
            Sample.sample_id_display.like(f"{prefix}%"),
        )
    )
    max_val = res.scalar()
    last_seq = int(str(max_val).split("-")[-1]) if max_val else 0
    return f"{prefix}{str(last_seq + 1).zfill(6)}"


async def generate_report_id(db: AsyncSession, lab_id: str) -> str:
    year = datetime.datetime.now().year
    prefix = f"REP-{year}-"
    res = await db.execute(
        select(func.max(Report.report_id_display)).where(
            Report.lab_id == lab_id,
            Report.report_id_display.like(f"{prefix}%"),
        )
    )
    max_val = res.scalar()
    last_seq = int(str(max_val).split("-")[-1]) if max_val else 0
    return f"{prefix}{str(last_seq + 1).zfill(6)}"


async def generate_invoice_id(db: AsyncSession, lab_id: str) -> str:
    from app.models.invoice import Invoice
    year = datetime.datetime.now().year
    prefix = f"INV-{year}-"
    res = await db.execute(
        select(func.max(Invoice.invoice_id_display)).where(
            Invoice.lab_id == lab_id,
            Invoice.invoice_id_display.like(f"{prefix}%"),
        )
    )
    max_val = res.scalar()
    last_seq = int(str(max_val).split("-")[-1]) if max_val else 0
    return f"{prefix}{str(last_seq + 1).zfill(6)}"


async def generate_receipt_id(db: AsyncSession, lab_id: str) -> str:
    from app.models.invoice import Payment
    year = datetime.datetime.now().year
    prefix = f"REC-{year}-"
    res = await db.execute(
        select(func.max(Payment.receipt_id_display)).where(
            Payment.lab_id == lab_id,
            Payment.receipt_id_display.like(f"{prefix}%"),
        )
    )
    max_val = res.scalar()
    last_seq = int(str(max_val).split("-")[-1]) if max_val else 0
    return f"{prefix}{str(last_seq + 1).zfill(6)}"

