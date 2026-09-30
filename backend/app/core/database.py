import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from sqlalchemy import Column, DateTime, String, Boolean
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, declared_attr
from app.core.config import settings

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Engine configuration
connect_args = {}
engine_kwargs = {
    "echo": getattr(settings, "DB_ECHO", False),
    "future": True,
}

if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False
else:
    # MySQL / PostgreSQL connection pooling & health checks
    engine_kwargs["pool_pre_ping"] = getattr(settings, "DB_POOL_PRE_PING", True)
    engine_kwargs["pool_recycle"] = getattr(settings, "DB_POOL_RECYCLE", 3600)
    engine_kwargs["pool_size"] = getattr(settings, "DB_POOL_SIZE", 10)
    engine_kwargs["max_overflow"] = getattr(settings, "DB_MAX_OVERFLOW", 20)

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_sync_engine():
    """Returns a synchronous SQLAlchemy engine for scripts, migrations, or ETL."""
    sync_engine_kwargs = {
        "echo": getattr(settings, "DB_ECHO", False),
    }
    sync_connect_args = {}
    if "sqlite" in settings.SYNC_DATABASE_URL:
        sync_connect_args["check_same_thread"] = False
    else:
        sync_engine_kwargs["pool_pre_ping"] = getattr(settings, "DB_POOL_PRE_PING", True)
        sync_engine_kwargs["pool_recycle"] = getattr(settings, "DB_POOL_RECYCLE", 3600)
    return create_engine(
        settings.SYNC_DATABASE_URL,
        connect_args=sync_connect_args,
        **sync_engine_kwargs,
    )


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy declarative models."""

    @declared_attr.directive
    def __tablename__(cls) -> str:
        # Generate tablename automatically in plural/snake_case if not provided
        return cls.__name__.lower() + "s"


class TimestampMixin:
    """Provides created_at, updated_at, and soft delete deleted_at timestamps."""
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class UUIDMixin:
    """Provides a UUID string primary key compatible across SQLite and PostgreSQL."""
    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an async database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
