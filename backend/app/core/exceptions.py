from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


class DiagnoLabException(Exception):
    """Base exception for application domain errors."""
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, errors: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.errors = errors or {}
        super().__init__(message)


class TenantAccessViolationException(DiagnoLabException):
    def __init__(self, message: str = "Access forbidden: Cross-tenant resource violation"):
        super().__init__(message=message, status_code=status.HTTP_403_FORBIDDEN)


class ResourceNotFoundException(DiagnoLabException):
    def __init__(self, resource_name: str, identifier: Any):
        super().__init__(
            message=f"{resource_name} with identifier '{identifier}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND
        )


class ReportFinalizedException(DiagnoLabException):
    def __init__(self, message: str = "Cannot modify a finalized medical report. Create an amendment instead."):
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST)


async def diagnolab_exception_handler(request: Request, exc: DiagnoLabException) -> JSONResponse:
    """Handles domain-specific DiagnoLab exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "errors": exc.errors,
        }
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handles HTTPExceptions converting to standard envelope."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": str(exc.detail),
            "errors": {},
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Converts Pydantic validation errors into clean key-value mapping in standard envelope."""
    errors_dict: Dict[str, str] = {}
    for err in exc.errors():
        field_loc = " -> ".join([str(loc) for loc in err["loc"] if loc != "body"])
        errors_dict[field_loc or "general"] = err["msg"]

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error: Check provided fields.",
            "errors": errors_dict,
        }
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches unhandled server exceptions without leaking internal stack traces in production."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An internal server error occurred. Please contact system support.",
            "errors": {"detail": str(exc)} if request.app.debug else {},
        }
    )
