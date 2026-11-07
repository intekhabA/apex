from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import zoneinfo
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.config import settings as app_settings
from app.core.permissions import require_super_admin
from app.models.user import User
from app.models.contact import ContactQuery, ContactSettings
from app.schemas.common import APIResponse, paginate_meta
from app.schemas.contact import (
    ContactQueryCreate,
    ContactQueryResponse,
    ContactQueryUpdateStatus,
    ContactPublicInfoResponse,
    ContactSettingsResponse,
    ContactSettingsUpdate,
)
from app.services.email_service import EmailService
from app.services.audit_service import AuditService
from app.services.bot_protection import BotProtectionService

router = APIRouter(prefix="/contact", tags=["Public Contact & Queries"])


DEFAULT_NOTIFICATION_SUBJECT = "New Service Inquiry: {subject} — From {user_name}"
DEFAULT_NOTIFICATION_BODY = (
    "Hello Admin,\n\n"
    "You have received a new service query submitted through the TrustMyLab Contact Form:\n\n"
    "--------------------------------------------------\n"
    "CONTACT DETAILS:\n"
    "--------------------------------------------------\n"
    "• Full Name:      {user_name}\n"
    "• Email Address:  {user_email}\n"
    "• Phone Number:   {user_phone}\n"
    "• Organization:   {organization_name}\n"
    "• Service:        {service_interested}\n"
    "• Date & Time:    {submitted_at}\n\n"
    "--------------------------------------------------\n"
    "INQUIRY SUBJECT: {subject}\n"
    "--------------------------------------------------\n"
    "{message}\n\n"
    "--------------------------------------------------\n"
    "You can reply directly to {user_email} or manage this inquiry in the TrustMyLab Admin Console."
)

DEFAULT_AUTO_REPLY_SUBJECT = "We have received your inquiry — TrustMyLab Clinical Systems"
DEFAULT_AUTO_REPLY_BODY = (
    "Dear {user_name},\n\n"
    "Thank you for contacting TrustMyLab Diagnostic Systems. We have successfully received your inquiry regarding \"{subject}\".\n\n"
    "Our diagnostic solutions team is reviewing your requirements and will get back to you at {user_email} or {user_phone} within 1 business day.\n\n"
    "SUMMARY OF YOUR INQUIRY:\n"
    "--------------------------------------------------\n"
    "Service of Interest: {service_interested}\n"
    "Message:\n"
    "{message}\n"
    "--------------------------------------------------\n\n"
    "If your request is urgent, you can also reach our support desk directly at +91 94150 05517.\n\n"
    "Warm regards,\n"
    "TrustMyLab Solutions Team\n"
    "https://trustmylab.in"
)


async def get_or_create_contact_settings(db: AsyncSession) -> ContactSettings:
    """Retrieves or creates singleton contact form email and public support settings."""
    res = await db.execute(select(ContactSettings).limit(1))
    contact_settings = res.scalar_one_or_none()
    if not contact_settings:
        contact_settings = ContactSettings(
            recipient_email=getattr(app_settings, "CONTACT_RECIPIENT_EMAIL", "alam347709@gmail.com"),
            support_email="support@trustmylab.in",
            contact_phone="+91 94150 05517",
            office_address="Cyber City, Block A, Gurugram, India",
            working_hours="Monday – Saturday: 8:00 AM – 8:00 PM IST",
            notification_subject_template=DEFAULT_NOTIFICATION_SUBJECT,
            notification_body_template=DEFAULT_NOTIFICATION_BODY,
            auto_reply_enabled=True,
            auto_reply_subject_template=DEFAULT_AUTO_REPLY_SUBJECT,
            auto_reply_body_template=DEFAULT_AUTO_REPLY_BODY,
        )
        db.add(contact_settings)
        await db.commit()
        await db.refresh(contact_settings)
    else:
        # Guarantee fallbacks if existing row has null fields
        changed = False
        if not getattr(contact_settings, "support_email", None):
            contact_settings.support_email = "support@trustmylab.in"
            changed = True
        if not getattr(contact_settings, "contact_phone", None):
            contact_settings.contact_phone = "+91 94150 05517"
            changed = True
        if not getattr(contact_settings, "office_address", None):
            contact_settings.office_address = "Cyber City, Block A, Gurugram, India"
            changed = True
        if not getattr(contact_settings, "working_hours", None):
            contact_settings.working_hours = "Monday – Saturday: 8:00 AM – 8:00 PM IST"
            changed = True
        if changed:
            await db.commit()
            await db.refresh(contact_settings)
    return contact_settings


# -------------------------------------------------------------------------
# PUBLIC ENDPOINTS
# -------------------------------------------------------------------------

@router.get("/challenge", response_model=APIResponse[dict])
async def get_bot_challenge():
    """Generates a fresh human-verification challenge question and HMAC token."""
    challenge = BotProtectionService.generate_challenge()
    return APIResponse(
        success=True,
        message="Verification challenge generated.",
        data=challenge,
    )


@router.get("/public-info", response_model=APIResponse[ContactPublicInfoResponse])
async def get_public_contact_info(
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint providing configured Support Email, Contact Helpline Number,
    Working Hours, and a signed security verification challenge.
    """
    cfg = await get_or_create_contact_settings(db)
    challenge = BotProtectionService.generate_challenge()
    return APIResponse(
        success=True,
        message="Public contact information retrieved successfully.",
        data=ContactPublicInfoResponse(
            support_email=cfg.support_email or "support@trustmylab.in",
            contact_phone=cfg.contact_phone or "+91 94150 05517",
            office_address=cfg.office_address,
            working_hours=cfg.working_hours,
            challenge_question=challenge["question"],
            challenge_token=challenge["token"],
        ),
    )


@router.post("", response_model=APIResponse[dict], status_code=status.HTTP_201_CREATED)
async def submit_contact_query(
    payload: ContactQueryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public Contact Us endpoint for prospective clients, patients, and partners
    to submit service inquiries. Features multi-layer bot & spam protection:
    - IP Rate Limiting (Sliding Window)
    - Honeypot Trap
    - Sub-second timing bot detection
    - Disposable email domain detection
    - Phishing/excessive URL filtering
    - HMAC Math Verification Challenge
    """
    # 1. Capture Client IP & Agent
    client_ip = request.client.host if request.client else None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent")

    # 2. Rate Limiting Check
    BotProtectionService.check_rate_limit(client_ip)

    # 3. Assess Bot / Spam Indicators
    is_spam, spam_reason = BotProtectionService.assess_submission(
        email=payload.email,
        subject=payload.subject,
        message=payload.message,
        website_trap=payload.website_trap,
        client_time_ms=payload.client_time_ms,
    )

    # 4. Human Verification Math Challenge Check (if token provided)
    if payload.challenge_token and not is_spam:
        valid_ans, verify_err = BotProtectionService.verify_challenge(
            user_answer=payload.challenge_answer or "",
            token=payload.challenge_token,
        )
        if not valid_ans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=verify_err,
            )

    # 5. Persist Contact Query
    initial_status = "SPAM" if is_spam else "NEW"
    admin_notes = f"Bot Protection Triggered: {spam_reason}" if is_spam else None

    query = ContactQuery(
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip() if payload.phone else None,
        organization_name=payload.organization_name.strip() if payload.organization_name else None,
        service_interested=payload.service_interested.strip() if payload.service_interested else "Diagnostic Center LIMS",
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        status=initial_status,
        admin_notes=admin_notes,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(query)
    await db.commit()
    await db.refresh(query)

    # Compute Human-Readable Submission Time (IST default)
    now_utc = datetime.now(timezone.utc)
    try:
        ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        formatted_submitted_at = now_utc.astimezone(ist_tz).strftime("%d %b %Y, %I:%M %p (IST)")
    except Exception:
        formatted_submitted_at = now_utc.strftime("%d %b %Y, %I:%M %p UTC")

    # If flagged as SPAM or bot, silently stop here (tarpit defense)
    if is_spam:
        return APIResponse(
            success=True,
            message="Thank you! Your query has been submitted successfully.",
            data={
                "ticket_id": str(query.id),
                "name": query.name,
                "email": query.email,
                "submitted_at": formatted_submitted_at,
            },
        )

    # 6. Fetch Email Settings & Template
    contact_cfg = await get_or_create_contact_settings(db)

    # 4. Compute Human-Readable Submission Time (IST default)
    now_utc = datetime.now(timezone.utc)
    try:
        ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        formatted_submitted_at = now_utc.astimezone(ist_tz).strftime("%d %b %Y, %I:%M %p (IST)")
    except Exception:
        formatted_submitted_at = now_utc.strftime("%d %b %Y, %I:%M %p UTC")

    template_params: Dict[str, Any] = {
        "user_name": query.name,
        "user_email": query.email,
        "user_phone": query.phone or "Not provided",
        "organization_name": query.organization_name or "Individual / Not specified",
        "service_interested": query.service_interested or "Diagnostic Center LIMS",
        "subject": query.subject,
        "message": query.message,
        "submitted_at": formatted_submitted_at,
    }

    # 5. Dispatch Notification Email to Administrator / Service Desk
    smtp_config = {
        "smtp_host": contact_cfg.smtp_host,
        "smtp_port": contact_cfg.smtp_port,
        "smtp_user": contact_cfg.smtp_user,
        "smtp_password": contact_cfg.smtp_password,
        "smtp_from_email": contact_cfg.smtp_from_email,
        "smtp_from_name": contact_cfg.smtp_from_name,
        "smtp_use_tls": contact_cfg.smtp_use_tls,
    }

    admin_subject = EmailService.render_template(
        contact_cfg.notification_subject_template or DEFAULT_NOTIFICATION_SUBJECT,
        template_params,
    )
    admin_body = EmailService.render_template(
        contact_cfg.notification_body_template or DEFAULT_NOTIFICATION_BODY,
        template_params,
    )
    recipient = contact_cfg.recipient_email or "alam347709@gmail.com"
    await EmailService.send_email(
        to_email=recipient,
        subject=admin_subject,
        body_text=admin_body,
        reply_to=query.email,
        smtp_config=smtp_config,
    )

    # 6. Dispatch Auto-Reply to Inquiring User (if enabled)
    if contact_cfg.auto_reply_enabled:
        user_subject = EmailService.render_template(
            contact_cfg.auto_reply_subject_template or DEFAULT_AUTO_REPLY_SUBJECT,
            template_params,
        )
        user_body = EmailService.render_template(
            contact_cfg.auto_reply_body_template or DEFAULT_AUTO_REPLY_BODY,
            template_params,
        )
        await EmailService.send_email(
            to_email=query.email,
            subject=user_subject,
            body_text=user_body,
            reply_to=recipient,
            smtp_config=smtp_config,
        )

    # 7. Audit log
    await AuditService.log_event(
        db=db,
        action="SUBMIT_CONTACT_QUERY",
        entity_name="contact_queries",
        entity_id=str(query.id),
        user_email=query.email,
        ip_address=client_ip,
        user_agent=user_agent,
        after_state={
            "name": query.name,
            "email": query.email,
            "subject": query.subject,
            "recipient_email": recipient,
        },
    )

    return APIResponse(
        success=True,
        message="Thank you! Your query has been submitted successfully. Our diagnostic specialist team will contact you shortly.",
        data={
            "ticket_id": str(query.id),
            "name": query.name,
            "email": query.email,
            "submitted_at": formatted_submitted_at,
        },
    )


# -------------------------------------------------------------------------
# ADMIN SETTINGS & TEMPLATES MANAGEMENT
# -------------------------------------------------------------------------

@router.get("/settings", response_model=APIResponse[ContactSettingsResponse])
async def get_contact_settings_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Retrieve editable contact email recipient, public contact details, SMTP settings, and templates."""
    cfg = await get_or_create_contact_settings(db)
    is_smtp_configured = bool(cfg.smtp_user and cfg.smtp_password) or bool(getattr(app_settings, "SMTP_USER", "") and getattr(app_settings, "SMTP_PASSWORD", ""))

    return APIResponse(
        success=True,
        message="Contact settings and email templates retrieved.",
        data=ContactSettingsResponse(
            id=str(cfg.id),
            recipient_email=cfg.recipient_email,
            support_email=cfg.support_email or "support@trustmylab.in",
            contact_phone=cfg.contact_phone or "+91 94150 05517",
            office_address=cfg.office_address,
            working_hours=cfg.working_hours,
            smtp_host=cfg.smtp_host or getattr(app_settings, "SMTP_HOST", "smtp.gmail.com"),
            smtp_port=cfg.smtp_port or getattr(app_settings, "SMTP_PORT", 587),
            smtp_user=cfg.smtp_user or getattr(app_settings, "SMTP_USER", ""),
            smtp_password=cfg.smtp_password or "",
            smtp_from_email=cfg.smtp_from_email or getattr(app_settings, "SMTP_FROM_EMAIL", "noreply@diagnolab.com"),
            smtp_from_name=cfg.smtp_from_name or getattr(app_settings, "SMTP_FROM_NAME", "TrustMyLab Notifications"),
            smtp_use_tls=cfg.smtp_use_tls if cfg.smtp_use_tls is not None else getattr(app_settings, "SMTP_USE_TLS", True),
            is_smtp_configured=is_smtp_configured,
            notification_subject_template=cfg.notification_subject_template,
            notification_body_template=cfg.notification_body_template,
            auto_reply_enabled=cfg.auto_reply_enabled,
            auto_reply_subject_template=cfg.auto_reply_subject_template,
            auto_reply_body_template=cfg.auto_reply_body_template,
        ),
    )


@router.put("/settings", response_model=APIResponse[ContactSettingsResponse])
async def update_contact_settings_endpoint(
    payload: ContactSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update contact recipient email, public support details, SMTP settings, and templates."""
    cfg = await get_or_create_contact_settings(db)

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None:
            setattr(cfg, field, val)

    await db.commit()
    await db.refresh(cfg)

    await AuditService.log_event(
        db=db,
        action="UPDATE_CONTACT_SETTINGS",
        entity_name="contact_settings",
        entity_id=str(cfg.id),
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        after_state={k: v for k, v in update_dict.items() if k != "smtp_password"},
    )

    is_smtp_configured = bool(cfg.smtp_user and cfg.smtp_password) or bool(getattr(app_settings, "SMTP_USER", "") and getattr(app_settings, "SMTP_PASSWORD", ""))

    return APIResponse(
        success=True,
        message="Contact settings and email templates updated successfully.",
        data=ContactSettingsResponse(
            id=str(cfg.id),
            recipient_email=cfg.recipient_email,
            support_email=cfg.support_email or "support@trustmylab.in",
            contact_phone=cfg.contact_phone or "+91 94150 05517",
            office_address=cfg.office_address,
            working_hours=cfg.working_hours,
            smtp_host=cfg.smtp_host or getattr(app_settings, "SMTP_HOST", "smtp.gmail.com"),
            smtp_port=cfg.smtp_port or getattr(app_settings, "SMTP_PORT", 587),
            smtp_user=cfg.smtp_user or getattr(app_settings, "SMTP_USER", ""),
            smtp_password=cfg.smtp_password or "",
            smtp_from_email=cfg.smtp_from_email or getattr(app_settings, "SMTP_FROM_EMAIL", "noreply@diagnolab.com"),
            smtp_from_name=cfg.smtp_from_name or getattr(app_settings, "SMTP_FROM_NAME", "TrustMyLab Notifications"),
            smtp_use_tls=cfg.smtp_use_tls if cfg.smtp_use_tls is not None else getattr(app_settings, "SMTP_USE_TLS", True),
            is_smtp_configured=is_smtp_configured,
            notification_subject_template=cfg.notification_subject_template,
            notification_body_template=cfg.notification_body_template,
            auto_reply_enabled=cfg.auto_reply_enabled,
            auto_reply_subject_template=cfg.auto_reply_subject_template,
            auto_reply_body_template=cfg.auto_reply_body_template,
        ),
    )


@router.post("/settings/reset", response_model=APIResponse[ContactSettingsResponse])
async def reset_contact_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Resets email notification and auto-reply templates to factory default sample templates."""
    cfg = await get_or_create_contact_settings(db)
    cfg.support_email = "support@trustmylab.in"
    cfg.contact_phone = "+91 94150 05517"
    cfg.office_address = "Cyber City, Block A, Gurugram, India"
    cfg.working_hours = "Monday – Saturday: 8:00 AM – 8:00 PM IST"
    cfg.notification_subject_template = DEFAULT_NOTIFICATION_SUBJECT
    cfg.notification_body_template = DEFAULT_NOTIFICATION_BODY
    cfg.auto_reply_subject_template = DEFAULT_AUTO_REPLY_SUBJECT
    cfg.auto_reply_body_template = DEFAULT_AUTO_REPLY_BODY
    await db.commit()
    await db.refresh(cfg)

    is_smtp_configured = bool(cfg.smtp_user and cfg.smtp_password) or bool(getattr(app_settings, "SMTP_USER", "") and getattr(app_settings, "SMTP_PASSWORD", ""))

    return APIResponse(
        success=True,
        message="Contact email templates reset to default sample templates.",
        data=ContactSettingsResponse(
            id=str(cfg.id),
            recipient_email=cfg.recipient_email,
            support_email=cfg.support_email,
            contact_phone=cfg.contact_phone,
            office_address=cfg.office_address,
            working_hours=cfg.working_hours,
            smtp_host=cfg.smtp_host or getattr(app_settings, "SMTP_HOST", "smtp.gmail.com"),
            smtp_port=cfg.smtp_port or getattr(app_settings, "SMTP_PORT", 587),
            smtp_user=cfg.smtp_user or getattr(app_settings, "SMTP_USER", ""),
            smtp_password=cfg.smtp_password or "",
            smtp_from_email=cfg.smtp_from_email or getattr(app_settings, "SMTP_FROM_EMAIL", "noreply@diagnolab.com"),
            smtp_from_name=cfg.smtp_from_name or getattr(app_settings, "SMTP_FROM_NAME", "TrustMyLab Notifications"),
            smtp_use_tls=cfg.smtp_use_tls if cfg.smtp_use_tls is not None else getattr(app_settings, "SMTP_USE_TLS", True),
            is_smtp_configured=is_smtp_configured,
            notification_subject_template=cfg.notification_subject_template,
            notification_body_template=cfg.notification_body_template,
            auto_reply_enabled=cfg.auto_reply_enabled,
            auto_reply_subject_template=cfg.auto_reply_subject_template,
            auto_reply_body_template=cfg.auto_reply_body_template,
        ),
    )


@router.post("/settings/test-email", response_model=APIResponse[dict])
async def send_test_contact_email(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Sends a sample test email to verify that SMTP delivery is operating properly."""
    cfg = await get_or_create_contact_settings(db)
    sample_params = {
        "user_name": "Dr. Sarah Jenkins (Test Lead)",
        "user_email": "sarah.jenkins@testclinic.com",
        "user_phone": "+91 98765 43210",
        "organization_name": "Apex Diagnostic & Imaging Care",
        "service_interested": "Full Multi-Branch LIMS & USG Reporting",
        "subject": "Inquiry regarding multi-tenant branch connectivity",
        "message": "We operate 3 diagnostic collection centers and need automated central pathology report approvals. Could you share details regarding onboarding and timeline?",
        "submitted_at": datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p UTC"),
    }

    subject = EmailService.render_template(cfg.notification_subject_template, sample_params)
    body = EmailService.render_template(cfg.notification_body_template, sample_params)

    smtp_config = {
        "smtp_host": cfg.smtp_host,
        "smtp_port": cfg.smtp_port,
        "smtp_user": cfg.smtp_user,
        "smtp_password": cfg.smtp_password,
        "smtp_from_email": cfg.smtp_from_email,
        "smtp_from_name": cfg.smtp_from_name,
        "smtp_use_tls": cfg.smtp_use_tls,
    }

    sent, error_msg = await EmailService.send_email(
        to_email=cfg.recipient_email,
        subject=f"[TEST] {subject}",
        body_text=body,
        smtp_config=smtp_config,
    )

    if sent:
        return APIResponse(
            success=True,
            message=f"Test inquiry email sent successfully to {cfg.recipient_email}!",
            data={"recipient": cfg.recipient_email, "dispatched": True, "error": None},
        )
    else:
        return APIResponse(
            success=False,
            message=f"Failed to deliver email: {error_msg}. Please configure your SMTP Host, Port, Username, and Password.",
            data={"recipient": cfg.recipient_email, "dispatched": False, "error": error_msg},
        )


# -------------------------------------------------------------------------
# ADMIN INQUIRIES & LEADS MANAGEMENT
# -------------------------------------------------------------------------

@router.get("/queries", response_model=APIResponse[List[ContactQueryResponse]])
async def list_contact_queries(
    search: Optional[str] = Query(None, description="Search across name, email, org, message"),
    status_filter: Optional[str] = Query(None, description="NEW, CONTACTED, RESOLVED, SPAM"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """List visitor contact inquiries and service leads with filtering and pagination."""
    query = select(ContactQuery)
    count_query = select(func.count(ContactQuery.id))

    if status_filter:
        query = query.where(ContactQuery.status == status_filter.upper())
        count_query = count_query.where(ContactQuery.status == status_filter.upper())

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            (ContactQuery.name.ilike(term))
            | (ContactQuery.email.ilike(term))
            | (ContactQuery.organization_name.ilike(term))
            | (ContactQuery.subject.ilike(term))
            | (ContactQuery.message.ilike(term))
        )
        count_query = count_query.where(
            (ContactQuery.name.ilike(term))
            | (ContactQuery.email.ilike(term))
            | (ContactQuery.organization_name.ilike(term))
            | (ContactQuery.subject.ilike(term))
            | (ContactQuery.message.ilike(term))
        )

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = query.order_by(desc(ContactQuery.created_at))
    query = query.offset((page - 1) * limit).limit(limit)

    res = await db.execute(query)
    items = res.scalars().all()

    try:
        ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    except Exception:
        ist_tz = timezone.utc

    output = []
    for item in items:
        dt = item.created_at
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        fmt_str = dt.astimezone(ist_tz).strftime("%d %b %Y, %I:%M %p") if dt else None

        output.append(
            ContactQueryResponse(
                id=str(item.id),
                name=item.name,
                email=item.email,
                phone=item.phone,
                organization_name=item.organization_name,
                service_interested=item.service_interested,
                subject=item.subject,
                message=item.message,
                status=item.status,
                admin_notes=item.admin_notes,
                ip_address=item.ip_address,
                created_at=dt,
                formatted_time=fmt_str,
            )
        )

    meta = paginate_meta(page=page, limit=limit, total=total)
    return APIResponse(
        success=True,
        message=f"Retrieved {len(output)} contact inquiries.",
        data=output,
        meta=meta,
    )


@router.patch("/queries/{query_id}/status", response_model=APIResponse[ContactQueryResponse])
async def update_contact_query_status(
    query_id: str,
    payload: ContactQueryUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Update contact inquiry status (e.g. marked as CONTACTED or RESOLVED) and add internal admin notes."""
    res = await db.execute(select(ContactQuery).where(ContactQuery.id == query_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact query not found.")

    item.status = payload.status.upper()
    if payload.admin_notes is not None:
        item.admin_notes = payload.admin_notes

    await db.commit()
    await db.refresh(item)

    dt = item.created_at
    if dt and dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return APIResponse(
        success=True,
        message="Inquiry status updated successfully.",
        data=ContactQueryResponse(
            id=str(item.id),
            name=item.name,
            email=item.email,
            phone=item.phone,
            organization_name=item.organization_name,
            service_interested=item.service_interested,
            subject=item.subject,
            message=item.message,
            status=item.status,
            admin_notes=item.admin_notes,
            ip_address=item.ip_address,
            created_at=dt,
        ),
    )
