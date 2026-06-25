"""Tests for auth HTTP endpoints: register, login, /me with linked usernames."""

import asyncio
import pytest
from app.auth.models import User
from tests.conftest import AsyncTestSession


@pytest.fixture()
def verified_user_client(client, db):
    """Register, verify, and log in a user; return the authenticated TestClient."""
    r = client.post("/api/auth/register", json={"email": "a@test.com", "password": "pw12345678"})
    assert r.status_code == 201, r.text

    # The user is stored in the async SQLite engine (fastapi-users uses async).
    # Set is_verified=True directly via the async session.
    async def _verify_user():
        async with AsyncTestSession() as session:
            from sqlalchemy import select, func
            result = await session.execute(
                select(User).where(func.lower(User.email) == "a@test.com")
            )
            u = result.scalar_one()
            u.is_verified = True
            await session.commit()

    asyncio.get_event_loop().run_until_complete(_verify_user())

    login = client.post("/api/auth/login", data={"username": "a@test.com", "password": "pw12345678"})
    assert login.status_code in (200, 204), login.text
    return client


def test_register_then_login_sets_cookie(client):
    """Register returns 201; login returns 200/204 and sets an auth cookie."""
    r = client.post("/api/auth/register", json={"email": "b@test.com", "password": "pw12345678"})
    assert r.status_code == 201, r.text

    login = client.post("/api/auth/login", data={"username": "b@test.com", "password": "pw12345678"})
    assert login.status_code in (200, 204), login.text
    # Cookie should be set either in response cookies or the client jar
    has_cookie = bool(login.cookies) or bool(client.cookies)
    assert has_cookie, f"Expected auth cookie, got response cookies={dict(login.cookies)}, client jar={dict(client.cookies)}"


def test_patch_me_sets_usernames(verified_user_client):
    """PATCH /api/users/me sets lichess_username and chesscom_username."""
    r = verified_user_client.patch(
        "/api/users/me",
        json={"lichess_username": "magnus", "chesscom_username": "hikaru"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["lichess_username"] == "magnus"
    assert body["chesscom_username"] == "hikaru"
