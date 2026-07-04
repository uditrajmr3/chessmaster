"""Position analyzer access gating: locked by default, unlocked by either a
user-supplied Anthropic key (BYOK) or an active premium purchase — never by
the raw key being echoed back to the client."""

import asyncio
from datetime import datetime, timedelta

from cryptography.fernet import Fernet
from sqlalchemy import func, select

from app import config
from app.auth.models import User
from tests.conftest import AsyncTestSession


def test_locked_by_default(verified_user_client):
    r = verified_user_client.get("/api/position/access")
    assert r.status_code == 200
    assert r.json() == {"allowed": False, "reason": "locked"}


def test_byok_unlocks_and_key_is_never_echoed(verified_user_client, monkeypatch):
    monkeypatch.setattr(config.settings, "encryption_key", Fernet.generate_key().decode())

    r = verified_user_client.patch(
        "/api/users/me", json={"own_anthropic_api_key": "sk-ant-my-own-key"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["has_own_api_key"] is True
    assert "own_anthropic_api_key" not in body

    r = verified_user_client.get("/api/position/access")
    assert r.json() == {"allowed": True, "reason": "own_key"}

    async def _stored_encrypted():
        async with AsyncTestSession() as session:
            result = await session.execute(
                select(User).where(func.lower(User.email) == "a@test.com")
            )
            return result.scalar_one().own_anthropic_api_key_encrypted

    encrypted = asyncio.run(_stored_encrypted())
    assert encrypted is not None
    assert "sk-ant-my-own-key" not in encrypted


def test_removing_byok_key_relocks(verified_user_client, monkeypatch):
    monkeypatch.setattr(config.settings, "encryption_key", Fernet.generate_key().decode())
    verified_user_client.patch("/api/users/me", json={"own_anthropic_api_key": "sk-ant-x"})
    verified_user_client.patch("/api/users/me", json={"own_anthropic_api_key": ""})

    r = verified_user_client.get("/api/position/access")
    assert r.json() == {"allowed": False, "reason": "locked"}


def test_premium_unlocks(verified_user_client):
    async def _grant_premium():
        async with AsyncTestSession() as session:
            result = await session.execute(
                select(User).where(func.lower(User.email) == "a@test.com")
            )
            u = result.scalar_one()
            u.is_premium = True
            u.premium_expires_at = datetime.utcnow() + timedelta(days=30)
            await session.commit()

    asyncio.run(_grant_premium())

    r = verified_user_client.get("/api/position/access")
    assert r.json() == {"allowed": True, "reason": "premium"}


def test_expired_premium_is_locked(verified_user_client):
    async def _grant_expired_premium():
        async with AsyncTestSession() as session:
            result = await session.execute(
                select(User).where(func.lower(User.email) == "a@test.com")
            )
            u = result.scalar_one()
            u.is_premium = True
            u.premium_expires_at = datetime.utcnow() - timedelta(days=1)
            await session.commit()

    asyncio.run(_grant_expired_premium())

    r = verified_user_client.get("/api/position/access")
    assert r.json() == {"allowed": False, "reason": "locked"}
