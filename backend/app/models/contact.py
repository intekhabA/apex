from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer
from app.core.database import Base, UUIDMixin, TimestampMixin
from datetime import datetime, timezone


class ContactQuery(Base, UUIDMixin, TimestampMixin):
    """Stores public visitor and prospective client service inquiries."""
    __tablename__ = "contact_queries"

    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    organization_name = Column(String(200), nullable=True)
    service_interested = Column(String(100), nullable=True)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(30), default="NEW", nullable=False, index=True)  # NEW, CONTACTED, RESOLVED, SPAM
    admin_notes = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)


class ContactSettings(Base, UUIDMixin, TimestampMixin):
    """Configures recipient destination email, public support details, and editable notification/auto-reply templates."""
    __tablename__ = "contact_settings"

    recipient_email = Column(String(255), default="alam347709@gmail.com", nullable=False)
    support_email = Column(String(255), default="support@trustmylab.in", nullable=False)
    contact_phone = Column(String(50), default="+91 94150 05517", nullable=False)
    office_address = Column(String(255), default="Cyber City, Block A, Gurugram, India", nullable=True)
    working_hours = Column(String(100), default="Monday – Saturday: 8:00 AM – 8:00 PM IST", nullable=True)

    # Outbound SMTP Server Settings (optional override over environment variables)
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, default=587, nullable=True)
    smtp_user = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    smtp_from_email = Column(String(255), nullable=True)
    smtp_from_name = Column(String(100), default="TrustMyLab Notifications", nullable=True)
    smtp_use_tls = Column(Boolean, default=True, nullable=True)

    notification_subject_template = Column(
        String(255),
        default="New Service Inquiry: {subject} — From {user_name}",
        nullable=False,
    )
    notification_body_template = Column(
        Text,
        default=(
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
        ),
        nullable=False,
    )
    auto_reply_enabled = Column(Boolean, default=True, nullable=False)
    auto_reply_subject_template = Column(
        String(255),
        default="We have received your inquiry — TrustMyLab Clinical Systems",
        nullable=False,
    )
    auto_reply_body_template = Column(
        Text,
        default=(
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
        ),
        nullable=False,
    )
