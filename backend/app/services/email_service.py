import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional, Tuple
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
    def _send_sync(
        to_email: str,
        subject: str,
        body_text: str,
        reply_to: Optional[str] = None,
        smtp_config: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str]:
        """Synchronous SMTP mail delivery worker intended for execution in a thread pool."""
        cfg = smtp_config or {}
        smtp_host = cfg.get("smtp_host") or getattr(settings, "SMTP_HOST", "")
        smtp_port = int(cfg.get("smtp_port") or getattr(settings, "SMTP_PORT", 587))
        smtp_user = cfg.get("smtp_user") if cfg.get("smtp_user") is not None else getattr(settings, "SMTP_USER", "")
        smtp_password = cfg.get("smtp_password") if cfg.get("smtp_password") is not None else getattr(settings, "SMTP_PASSWORD", "")
        from_email = cfg.get("smtp_from_email") or getattr(settings, "SMTP_FROM_EMAIL", "noreply@diagnolab.com")
        from_name = cfg.get("smtp_from_name") or getattr(settings, "SMTP_FROM_NAME", "TrustMyLab Notifications")
        use_tls = cfg.get("smtp_use_tls") if "smtp_use_tls" in cfg and cfg.get("smtp_use_tls") is not None else getattr(settings, "SMTP_USE_TLS", True)

        if not smtp_host:
            msg = "SMTP host is not configured; skipping email dispatch"
            logger.warning("%s to %s", msg, to_email)
            return False, msg

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        # Plaintext payload
        part_text = MIMEText(body_text, "plain", "utf-8")
        msg.attach(part_text)

        # HTML formatted payload
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
            if smtp_port == 465:
                # SSL
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12) as server:
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.send_message(msg)
            else:
                # STARTTLS or plain
                with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                    server.ehlo()
                    if use_tls:
                        try:
                            server.starttls()
                            server.ehlo()
                        except Exception as tls_err:
                            logger.debug("STARTTLS not supported or skipped: %s", tls_err)
                    if smtp_user and smtp_password:
                        server.login(smtp_user, smtp_password)
                    server.send_message(msg)

            logger.info("Email dispatched successfully to %s: %s", to_email, subject)
            return True, "Email dispatched successfully"
        except Exception as e:
            err_msg = f"{type(e).__name__}: {str(e)}"
            logger.warning("SMTP email dispatch to %s failed (non-fatal): %s", to_email, err_msg)
            return False, err_msg

    @classmethod
    async def send_email(
        cls,
        to_email: str,
        subject: str,
        body_text: str,
        reply_to: Optional[str] = None,
        smtp_config: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, str]:
        """Asynchronously dispatches an email using background thread pool."""
        try:
            return await asyncio.to_thread(
                cls._send_sync,
                to_email=to_email,
                subject=subject,
                body_text=body_text,
                reply_to=reply_to,
                smtp_config=smtp_config,
            )
        except Exception as e:
            logger.exception("Failed to dispatch email in thread pool: %s", e)
            return False, str(e)
