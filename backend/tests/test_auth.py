import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test health check probe."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, seed_test_data):
    """Test successful authentication returning user profile and tokens."""
    payload = {
        "email": "admin@alpha.com",
        "password": "AlphaAdmin@123",
    }
    response = await client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert "data" in body
    assert body["data"]["user"]["email"] == "admin@alpha.com"
    assert body["data"]["user"]["role"] == "LAB_ADMIN"
    assert body["data"]["user"]["lab_id"] == "lab-1-uuid-1111-1111"
    assert "access_token" in body["data"]["tokens"]
    assert "refresh_token" in body["data"]["tokens"]


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, seed_test_data):
    """Test authentication failure with incorrect password returns 401."""
    payload = {
        "email": "admin@alpha.com",
        "password": "WrongPassword!999",
    }
    response = await client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert "Incorrect email or password" in body["message"]


@pytest.mark.asyncio
async def test_login_deactivated_account(client: AsyncClient, seed_test_data):
    """Test authentication failure with deactivated account returns 403."""
    payload = {
        "email": "inactive@alpha.com",
        "password": "Inactive@123",
    }
    response = await client.post("/api/auth/login", json=payload)
    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert "deactivated" in body["message"].lower()


@pytest.mark.asyncio
async def test_me_endpoint_authenticated(client: AsyncClient, seed_test_data):
    """Test /api/auth/me returns the active user profile when authenticated."""
    login_res = await client.post("/api/auth/login", json={
        "email": "assistant@alpha.com",
        "password": "AlphaAsst@123"
    })
    token = login_res.json()["data"]["tokens"]["access_token"]

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["email"] == "assistant@alpha.com"
    assert body["data"]["role"] == "LAB_ASSISTANT"
    assert body["data"]["lab_id"] == "lab-1-uuid-1111-1111"


@pytest.mark.asyncio
async def test_me_endpoint_unauthenticated(client: AsyncClient, seed_test_data):
    """Test /api/auth/me returns 401 when missing bearer token."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False


@pytest.mark.asyncio
async def test_token_rotation_refresh(client: AsyncClient, seed_test_data):
    """Test refresh token successfully issues new access and refresh tokens."""
    login_res = await client.post("/api/auth/login", json={
        "email": "superadmin@diagnolab.com",
        "password": "SuperAdmin@123"
    })
    refresh_token = login_res.json()["data"]["tokens"]["refresh_token"]

    refresh_res = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    body = refresh_res.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert "refresh_token" in body["data"]


@pytest.mark.asyncio
async def test_change_password(client: AsyncClient, seed_test_data):
    """Test changing user password with verification of old password."""
    login_res = await client.post("/api/auth/login", json={
        "email": "admin@alpha.com",
        "password": "AlphaAdmin@123"
    })
    token = login_res.json()["data"]["tokens"]["access_token"]

    change_res = await client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "AlphaAdmin@123",
            "new_password": "NewAlphaPassword@2026",
        }
    )
    assert change_res.status_code == 200
    assert change_res.json()["success"] is True

    # Confirm login works with new password
    new_login_res = await client.post("/api/auth/login", json={
        "email": "admin@alpha.com",
        "password": "NewAlphaPassword@2026"
    })
    assert new_login_res.status_code == 200


def test_password_hashing_and_verification():
    """Test bcrypt password hashing and verification functionality."""
    from app.core.security import get_password_hash, verify_password

    raw_password = "SecurePassword@2026!"
    hashed = get_password_hash(raw_password)

    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False


@pytest.mark.asyncio
async def test_expired_token_rejected(client: AsyncClient, seed_test_data):
    """Test that an expired access token is rejected with 401 Unauthorized."""
    from datetime import timedelta
    from app.core.security import create_access_token

    expired_token = create_access_token(
        data={"sub": seed_test_data["lab1_admin"].id, "role": "LAB_ADMIN", "lab_id": seed_test_data["lab1"].id},
        expires_delta=timedelta(seconds=-10)
    )

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert "expired" in body["message"].lower() or "invalid" in body["message"].lower()


@pytest.mark.asyncio
async def test_malformed_token_rejected(client: AsyncClient, seed_test_data):
    """Test that malformed or tampered token strings are rejected with 401."""
    response = await client.get("/api/auth/me", headers={"Authorization": "Bearer this-is-not-a-valid-jwt"})
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False


@pytest.mark.asyncio
async def test_invalid_signature_token_rejected(client: AsyncClient, seed_test_data):
    """Test that a JWT signed with a different secret key is rejected."""
    from jose import jwt

    fake_token = jwt.encode(
        {"sub": seed_test_data["lab1_admin"].id, "type": "access"},
        "completely-different-fake-secret-key-123456",
        algorithm="HS256"
    )

    response = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False

