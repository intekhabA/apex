from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR
import logging
import traceback

logger = logging.getLogger("diagnolab.error")


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Safety-net ASGI middleware catching uncaught server exceptions."""

    async def dispatch(self, request: Request, call_next) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            logger.error(f"Unhandled exception during {request.method} {request.url.path}: {str(exc)}")
            logger.error(traceback.format_exc())

            return JSONResponse(
                status_code=HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "success": False,
                    "message": "An internal server error occurred. Please contact laboratory support.",
                    "errors": {"detail": str(exc)} if getattr(request.app, "debug", False) else {},
                },
            )
