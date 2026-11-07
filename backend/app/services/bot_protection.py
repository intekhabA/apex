import hmac
import hashlib
import json
import base64
import time
import random
import re
import secrets
from typing import Dict, List, Tuple, Optional
from fastapi import HTTPException, status
from app.core.config import settings

# In-memory sliding window rate limiter: IP -> list of submission timestamps
_ip_submission_history: Dict[str, List[float]] = {}
RATE_LIMIT_WINDOW_SECONDS = 600  # 10 minutes
RATE_LIMIT_MAX_SUBMISSIONS = 5    # Max 5 queries per 10 mins per IP

# Known disposable / throwaway email domains
DISPOSABLE_DOMAINS = {
    "tempmail.com",
    "guerrillamail.com",
    "10minutemail.com",
    "mailinator.com",
    "throwawaymail.com",
    "yopmail.com",
    "trashmail.com",
    "sharklasers.com",
    "getairmail.com",
    "dispostable.com",
    "fakemailgenerator.com",
    "temp-mail.org",
}


class BotProtectionService:
    """Multi-layer enterprise bot protection and anti-spam verification service."""

    @classmethod
    def generate_challenge(cls) -> Dict[str, str]:
        """
        Generates a human-friendly mathematical challenge along with a tamper-proof HMAC token.
        """
        a = random.randint(4, 18)
        b = random.randint(2, 9)
        answer = a + b
        question = f"Security Check: What is {a} + {b}?"

        payload = {
            "ans": str(answer),
            "ts": int(time.time()),
            "nonce": secrets.token_hex(4),
        }
        payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('ascii')

        sig = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        token = f"{payload_b64}.{sig}"
        return {
            "question": question,
            "token": token,
        }

    @classmethod
    def verify_challenge(cls, user_answer: str, token: str) -> Tuple[bool, str]:
        """
        Validates the math challenge answer against the signed token.
        Ensures the token hasn't been tampered with and hasn't expired.
        """
        if not token or "." not in token:
            return False, "Security verification token is missing or malformed."

        parts = token.split(".")
        if len(parts) != 2:
            return False, "Invalid security verification token format."

        payload_b64, provided_sig = parts

        expected_sig = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, provided_sig):
            return False, "Security token verification failed (tampered token)."

        try:
            payload_bytes = base64.urlsafe_b64decode(payload_b64.encode('ascii'))
            payload = json.loads(payload_bytes.decode('utf-8'))
        except Exception:
            return False, "Failed to decode security token."

        created_ts = payload.get("ts", 0)
        expected_ans = str(payload.get("ans", "")).strip()

        # Token expiry (valid for 30 minutes)
        now = time.time()
        if now - created_ts > 1800:
            return False, "Security verification has expired. Please refresh the question."

        # Check user answer (allow trimmed whitespace)
        if str(user_answer).strip() != expected_ans:
            return False, "Incorrect verification answer. Please solve the security question."

        return True, "Verification successful."

    @classmethod
    def check_rate_limit(cls, client_ip: Optional[str]) -> None:
        """
        Enforces IP-based rate limiting using an in-memory sliding window.
        Raises 429 if rate limit is exceeded.
        """
        if not client_ip:
            return

        now = time.time()
        timestamps = _ip_submission_history.get(client_ip, [])

        # Filter out timestamps older than the window
        valid_timestamps = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW_SECONDS]

        if len(valid_timestamps) >= RATE_LIMIT_MAX_SUBMISSIONS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many inquiries received from your network. Please wait a few minutes before submitting again.",
            )

        valid_timestamps.append(now)
        _ip_submission_history[client_ip] = valid_timestamps

    @classmethod
    def assess_submission(
        cls,
        email: str,
        subject: str,
        message: str,
        website_trap: Optional[str],
        client_time_ms: Optional[int],
    ) -> Tuple[bool, Optional[str]]:
        """
        Assesses if a submission is an automated bot or spam.
        Returns:
            (is_spam: bool, reason: Optional[str])
        """
        # 1. Honeypot Trap Triggered
        if website_trap and website_trap.strip():
            return True, "Bot honeypot field filled"

        # 2. Timing Guard (Bots submit in under 1.5 seconds)
        if client_time_ms is not None and client_time_ms < 1500:
            return True, f"Automated submission detected (duration {client_time_ms}ms < 1.5s)"

        # 3. Disposable Email Domain Check
        domain = email.split("@")[-1].lower() if "@" in email else ""
        if domain in DISPOSABLE_DOMAINS:
            return True, f"Disposable email domain detected: {domain}"

        # 4. Excessive Link Stuffing (> 2 URLs in subject or message)
        url_matches = re.findall(r'https?://[^\s<>"]+|www\.[^\s<>"]+', f"{subject} {message}", re.IGNORECASE)
        if len(url_matches) > 2:
            return True, f"Excessive URLs detected ({len(url_matches)} links)"

        # 5. Phishing / Crypto / Casino Spam Keywords
        combined_text = f"{subject} {message}".lower()
        spam_patterns = [
            r"\bcrypto\s*trading\b",
            r"\binstant\s*bitcoin\b",
            r"\bonline\s*casino\b",
            r"\bviagra\b",
            r"\bseo\s*backlinks\s*guarantee\b",
            r"\bmake\s*money\s*fast\b",
        ]
        for pattern in spam_patterns:
            if re.search(pattern, combined_text):
                return True, f"Spam keyword pattern detected: {pattern}"

        return False, None
