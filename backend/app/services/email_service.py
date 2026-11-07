import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from datetime import datetime
import zoneinfo

from app.core.config import settings

logger = logging.getLogger("diagnolab.email")


class EmailService:
    @staticmethod
    def render_template(template_str: str, params: Dict[str, Any]) -> str:
        """Safely interpolates template placeholders."""
        if not template_str:
            return ""
        result = template_str
        for key, val in params.items():
            result = result.replace(f"{{{key}}}", str(val if val is not None else ""))
        return result

    @staticmethod
    def _send_sync(to_email: str, subject: str, body_text: str, reply_to: Optional[str] = None) -> bool:
        """Synchronous SMTP mail delivery worker intended for execution in a thread pool."""
        if not settings.SMTP_HOST:
            logger.warning("SMTP host is not configured; skipping email dispatch to %s", to_email)
            return False

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        # Plaintext payload
        part_text = MIMEText(body_text, "plain", "utf-8")
        msg.attach(part_text)

        # HTML formatted payload with clean formatting
        html_formatted = (
            "<div style='font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; "
            "line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;'>"
            f"<div style='background-color: #0284c7; color: #ffffff; padding: 12px 18px; border-radius: 6px; font-weight: bold; font-size: 16px; margin-bottom: 20px;'>"
            f"TrustMyLab Healthcare Notification"
            f"</div>"
            f"<pre style='white-space: pre-wrap; font-family: inherit; font-size: 14px;'>{body_text}</pre>"
            "<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;' />"
            "<div style='font-size: 12px; color: #64748b; text-align: center;'>"
            "TrustMyLab — Multi-Tenant Diagnostic Laboratory Management System<br />"
            "https://trustmylab.in"
            "</div>"
            "</div>"
        )
        part_html = MIMEText(html_formatted, "html", "utf-8")
        msg.attach(part_html)

        try:
            port = int(settings.SMTP_PORT or 587)
            if port == 465:
                # SSL
                with smtplib.SMTP_SSL(settings.SMTP_HOST, port, timeout=10) as server:
                    if settings.SMTP_USER and settings.SMTP_PASSWORD:
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            else:
                # STARTTLS or plain
                with smtplib.SMTP(settings.SMTP_HOST, port, timeout=10) as server:
                    server.ehlo()
                    if getattr(settings, "SMTP_USE_TLS", True):
                        try:
                            server.starttls()
                            server.ehlo()
                        except Exception as tls_err:
                            logger.debug("STARTTLS not supported or skipped: %s", tls_err)
                    if settings.SMTP_USER and settings.SMTP_PASSWORD:
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)

            logger.info("Email dispatched successfully to %s: %s", to_email, subject)
            return True
        except Exception as e:
            logger.warning("SMTP email dispatch to %s failed (non-fatal): %s", to_email, e)
            return False

    @classmethod
    async def send_email(
        cls,
        to_email: str,
        subject: str,
        body_text: str,
        reply_to: Optional[str] = None,
    ) -> bool:
        """Asynchronously dispatches an email using background thread pool."""
        try:
            return await asyncio.to_thread(
                cls._send_sync,
                to_email=to_email,
                subject=subject,
                body_text=body_text,
                reply_to=reply_to,
            )
        except Exception as e:
            logger.error("Error in async email dispatch: %s", e)
            return False
