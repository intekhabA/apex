from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time
import logging

logger = logging.getLogger("diagnolab.audit")


class AuditMiddleware(BaseHTTPMiddleware):
    """Captures request metadata such as client IP, user agent, and execution latency."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.perf_counter()

        client_ip = request.headers.get("x-forwarded-for")
        if client_ip:
            client_ip = client_ip.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "unknown"

        user_agent = request.headers.get("user-agent", "unknown")
        request.state.client_ip = client_ip
        request.state.user_agent = user_agent

        response = await call_next(request)

        duration = time.perf_counter() - start_time
        response.headers["X-Response-Time-Ms"] = f"{duration * 1000:.2f}"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Structured audit log
        if not request.url.path.endswith("/health"):
            logger.info(
                f"{request.method} {request.url.path} - {response.status_code} - "
                f"IP: {client_ip} - Time: {duration * 1000:.2f}ms"
            )

        return response
