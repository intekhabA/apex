import datetime
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import (
    NotificationLog,
    NotificationEventType,
    NotificationChannel,
    NotificationStatus,
)


class BaseNotificationProvider(ABC):
    @abstractmethod
    async def send(self, recipient: str, subject: Optional[str], body: str, metadata: Dict[str, Any]) -> bool:
        pass


class MockEmailProvider(BaseNotificationProvider):
    def __init__(self):
        self.dispatched_messages: List[Dict[str, Any]] = []

    async def send(self, recipient: str, subject: Optional[str], body: str, metadata: Dict[str, Any]) -> bool:
        entry = {
            "channel": "EMAIL",
            "recipient": recipient,
            "subject": subject,
            "body": body,
            "metadata": metadata,
            "timestamp": datetime.datetime.now(datetime.timezone.utc),
        }
        self.dispatched_messages.append(entry)
        return True


class MockSmsProvider(BaseNotificationProvider):
    async def send(self, recipient: str, subject: Optional[str], body: str, metadata: Dict[str, Any]) -> bool:
        return True


class MockWhatsAppProvider(BaseNotificationProvider):
    async def send(self, recipient: str, subject: Optional[str], body: str, metadata: Dict[str, Any]) -> bool:
        return True


# Global mock provider instance for inspection in tests
email_provider = MockEmailProvider()
sms_provider = MockSmsProvider()
whatsapp_provider = MockWhatsAppProvider()

TEMPLATES = {
    NotificationEventType.REPORT_FINALIZED: {
        "subject": "Diagnostic Report Ready & Verified — {test_name}",
        "body": (
            "Dear {patient_name}, your diagnostic report for {test_name} ({report_id_display}) "
            "has been finalized and verified by {lab_name}. You can review and verify your official "
            "sealed report online at: {verification_url}"
        ),
    },
    NotificationEventType.BOOKING_CREATED: {
        "subject": "Diagnostic Appointment Confirmed — {booking_id_display}",
        "body": (
            "Dear {patient_name}, your diagnostic order #{booking_id_display} at {lab_name} "
            "has been confirmed for {appointment_date} at {appointment_time}."
        ),
    },
    NotificationEventType.SAMPLE_COLLECTED: {
        "subject": "Specimen Accessioning Update — {sample_id_display}",
        "body": (
            "Dear {patient_name}, your diagnostic specimen ({sample_type}) has been safely collected "
            "and accessioned under ID {sample_id_display}."
        ),
    },
    NotificationEventType.PAYMENT_RECEIVED: {
        "subject": "Payment Receipt Acknowledged — {receipt_id_display}",
        "body": (
            "Dear {patient_name}, your payment of ₹{amount} has been received for invoice "
            "#{invoice_id_display}. Your official payment receipt #{receipt_id_display} is ready."
        ),
    },
}


class NotificationService:
    @staticmethod
    def render_template(
        event_type: NotificationEventType, params: Dict[str, Any]
    ) -> Dict[str, str]:
        tmpl = TEMPLATES.get(event_type, {
            "subject": "DiagnoLab Notification",
            "body": "Dear Patient, this is an update regarding your diagnostic service.",
        })
        subject_tpl = tmpl.get("subject", "DiagnoLab Notification")
        body_tpl = tmpl.get("body", "")

        def safe_format(template_str: str, values: Dict[str, Any]) -> str:
            res = template_str
            for k, v in values.items():
                res = res.replace(f"{{{k}}}", str(v or ""))
            return res

        return {
            "subject": safe_format(subject_tpl, params),
            "body": safe_format(body_tpl, params),
        }

    @staticmethod
    async def dispatch_event(
        db: AsyncSession,
        lab_id: str,
        event_type: NotificationEventType,
        recipient: str,
        recipient_name: str,
        template_params: Dict[str, Any],
        channel: NotificationChannel = NotificationChannel.EMAIL,
    ) -> NotificationLog:
        """Interpolates templates, invokes channel provider, and persists immutable audit log."""
        rendered = NotificationService.render_template(event_type, template_params)
        subject = rendered["subject"]
        body = rendered["body"]

        provider: BaseNotificationProvider
        if channel == NotificationChannel.EMAIL:
            provider = email_provider
        elif channel == NotificationChannel.SMS:
            provider = sms_provider
        else:
            provider = whatsapp_provider

        status = NotificationStatus.SENT
        error_msg = None
        try:
            success = await provider.send(
                recipient=recipient,
                subject=subject,
                body=body,
                metadata=template_params,
            )
            if not success:
                status = NotificationStatus.FAILED
                error_msg = "Provider returned unsuccessful response."
        except Exception as e:
            status = NotificationStatus.FAILED
            error_msg = str(e)

        log = NotificationLog(
            lab_id=lab_id,
            event_type=event_type,
            channel=channel,
            recipient=recipient,
            recipient_name=recipient_name,
            subject=subject,
            message_body=body,
            status=status,
            error_message=error_msg,
            metadata_json=template_params,
            sent_at=datetime.datetime.now(datetime.timezone.utc) if status == NotificationStatus.SENT else None,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)

        return log
