import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.laboratory import Laboratory, LaboratorySettings
from app.models.user import User, UserRole

# Use in-memory SQLite for high-speed isolated test runs
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def seed_test_data(db_session: AsyncSession):
    """Seed test database with 2 distinct laboratories and users for isolation testing."""
    # Lab 1
    lab1 = Laboratory(
        id="lab-1-uuid-1111-1111",
        code="LAB-ALPHA",
        name="Alpha Diagnostic Lab",
        email="contact@alpha.com",
        phone="1111111111",
        address_street="Alpha Street",
        city="Alpha City",
        state="Alpha State",
        postal_code="111111",
        is_active=True,
    )
    db_session.add(lab1)

    # Lab 2
    lab2 = Laboratory(
        id="lab-2-uuid-2222-2222",
        code="LAB-BETA",
        name="Beta Diagnostic Lab",
        email="contact@beta.com",
        phone="2222222222",
        address_street="Beta Street",
        city="Beta City",
        state="Beta State",
        postal_code="222222",
        is_active=True,
    )
    db_session.add(lab2)

    # Super Admin
    super_admin = User(
        id="user-superadmin-000",
        email="superadmin@diagnolab.com",
        hashed_password=get_password_hash("SuperAdmin@123"),
        first_name="Super",
        last_name="Admin",
        role=UserRole.SUPER_ADMIN,
        is_active=True,
    )
    db_session.add(super_admin)

    # Lab 1 Admin
    lab1_admin = User(
        id="user-lab1-admin-111",
        lab_id=lab1.id,
        email="admin@alpha.com",
        hashed_password=get_password_hash("AlphaAdmin@123"),
        first_name="Alpha",
        last_name="Admin",
        role=UserRole.LAB_ADMIN,
        is_active=True,
    )
    db_session.add(lab1_admin)

    # Lab 1 Assistant
    lab1_assistant = User(
        id="user-lab1-asst-112",
        lab_id=lab1.id,
        email="assistant@alpha.com",
        hashed_password=get_password_hash("AlphaAsst@123"),
        first_name="Alpha",
        last_name="Assistant",
        role=UserRole.LAB_ASSISTANT,
        is_active=True,
    )
    db_session.add(lab1_assistant)

    # Lab 2 Admin
    lab2_admin = User(
        id="user-lab2-admin-221",
        lab_id=lab2.id,
        email="admin@beta.com",
        hashed_password=get_password_hash("BetaAdmin@123"),
        first_name="Beta",
        last_name="Admin",
        role=UserRole.LAB_ADMIN,
        is_active=True,
    )
    db_session.add(lab2_admin)

    # Deactivated User
    deactivated_user = User(
        id="user-deactivated-999",
        lab_id=lab1.id,
        email="inactive@alpha.com",
        hashed_password=get_password_hash("Inactive@123"),
        first_name="Inactive",
        last_name="User",
        role=UserRole.LAB_ASSISTANT,
        is_active=False,
    )
    db_session.add(deactivated_user)

    await db_session.commit()

    return {
        "lab1": lab1,
        "lab2": lab2,
        "super_admin": super_admin,
        "lab1_admin": lab1_admin,
        "lab1_assistant": lab1_assistant,
        "lab2_admin": lab2_admin,
        "deactivated_user": deactivated_user,
    }
