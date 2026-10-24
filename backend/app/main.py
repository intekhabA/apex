import os
import mimetypes
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles
from starlette.types import Scope
from starlette.responses import Response

from app.core.config import settings
from app.core.database import engine, Base
from app.core.exceptions import (
    DiagnoLabException,
    diagnolab_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from app.api.api_v1 import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema tables exist for dev/testing
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: Dispose engine connection pool
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Multi-Tenant Diagnostic Laboratory Management Portal REST API",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

from app.middleware.audit_middleware import AuditMiddleware

# CORS Middleware
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://([a-zA-Z0-9-]+\.)*trustmylab\.in(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

# Global Exception Handlers
app.add_exception_handler(DiagnoLabException, diagnolab_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


class StorageStaticFiles(StaticFiles):
    """
    StaticFiles handler that checks multiple storage root directories
    (handling local backend execution, repo root execution, and Docker container paths),
    and falls back to S3 streaming if S3 storage is enabled.
    """
    def __init__(self, directories: list[str], **kwargs):
        existing = [os.path.abspath(d) for d in directories if os.path.isdir(d)]
        first_dir = existing[0] if existing else (os.path.abspath(directories[0]) if directories else None)
        if first_dir and not os.path.exists(first_dir):
            os.makedirs(first_dir, exist_ok=True)
            if first_dir not in existing:
                existing.append(first_dir)
        super().__init__(directory=first_dir, check_dir=False, **kwargs)
        self.all_directories = existing

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                from app.services.storage_service import storage_service
                if storage_service.is_s3:
                    try:
                        guessed_type, _ = mimetypes.guess_type(path)
                        return await storage_service.get_file_response(
                            rel_path=path,
                            filename=os.path.basename(path),
                            media_type=guessed_type or "application/octet-stream",
                            inline=True,
                        )
                    except Exception:
                        pass
            raise exc


potential_storage_dirs = [
    os.path.abspath(os.path.join(settings.STORAGE_LOCAL_ROOT, "..")),
    os.path.abspath("storage"),
    os.path.abspath("../storage"),
    os.path.abspath("./backend/storage"),
    "/app/storage",
]
app.mount("/storage", StorageStaticFiles(directories=potential_storage_dirs), name="storage")


@app.get(f"{settings.API_V1_PREFIX}/health", tags=["Health"])
async def health_check():
    """Health status probe for reverse proxy and load balancers."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }
