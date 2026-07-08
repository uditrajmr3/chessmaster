"""Signup email verification via a 6-digit code (password reset is untouched
and still uses fastapi-users' link/token flow — see auth/users.py).

Covers: happy path, wrong code (generic error + attempt counting), expired
code, attempt-limit lockout, idempotent re-verify, resend issuing a fresh
code, resend cooldown, and anti-enumeration behavior for both endpoints.
"""

import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from app import config
from app.auth.models import User
from tests.conftest import AsyncTestSession


def _get_user_sync(email: str) -> User:
    async def _fetch():
        async with AsyncTestSession() as session:
            result = await session.execute(
                select(User).where(func.lower(User.email) == email.lower())
            )
            return result.scalar_one()

    return asyncio.run(_fetch())


def _mutate_user(email: str, **fields):
    async def _update():
        async with AsyncTestSession() as session:
            result = await session.execute(
                select(User).where(func.lower(User.email) == email.lower())
            )
            u = result.scalar_one()
            for k, v in fields.items():
                setattr(u, k, v)
            await session.commit()

    asyncio.run(_update())


def _register_and_capture_code(client, email: str, password: str = "pw12345678") -> str:
    with patch("app.auth.users.send_verification_code_email") as mock_send:
        r = client.post("/api/auth/register", json={"email": email, "password": password})
        assert r.status_code == 201, r.text
        code = mock_send.call_args[0][1]  # send_verification_code_email(email, code, request)
    return code


def test_register_sets_hashed_code_not_plaintext(client):
    code = _register_and_capture_code(client, "signup1@test.com")
    user = _get_user_sync("signup1@test.com")
    assert user.is_verified is False
    assert user.verification_code_hash is not None
    assert code not in user.verification_code_hash
    assert user.verification_code_expires_at > datetime.utcnow()
    assert user.verification_attempts == 0


def test_correct_code_verifies_the_account(client):
    code = _register_and_capture_code(client, "signup2@test.com")
    r = client.post(
        "/api/auth/verify-code", json={"email": "signup2@test.com", "code": code}
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"verified": True}
    assert _get_user_sync("signup2@test.com").is_verified is True


def test_wrong_code_is_generic_error_and_counts_attempt(client):
    _register_and_capture_code(client, "signup3@test.com")
    r = client.post(
        "/api/auth/verify-code", json={"email": "signup3@test.com", "code": "000000"}
    )
    assert r.status_code == 400
    assert "invalid" in r.json()["detail"].lower()
    assert _get_user_sync("signup3@test.com").verification_attempts == 1


def test_too_many_attempts_locks_out_even_a_correct_code(client, monkeypatch):
    monkeypatch.setattr(config.settings, "verification_code_max_attempts", 3)
    code = _register_and_capture_code(client, "signup4@test.com")
    for _ in range(3):
        client.post(
            "/api/auth/verify-code", json={"email": "signup4@test.com", "code": "000000"}
        )
    r = client.post(
        "/api/auth/verify-code", json={"email": "signup4@test.com", "code": code}
    )
    assert r.status_code == 429


def test_expired_code_is_rejected(client):
    code = _register_and_capture_code(client, "signup5@test.com")
    _mutate_user(
        "signup5@test.com",
        verification_code_expires_at=datetime.utcnow() - timedelta(minutes=1),
    )
    r = client.post(
        "/api/auth/verify-code", json={"email": "signup5@test.com", "code": code}
    )
    assert r.status_code == 400
    assert "expired" in r.json()["detail"].lower()


def test_already_verified_is_idempotent(client):
    code = _register_and_capture_code(client, "signup6@test.com")
    client.post("/api/auth/verify-code", json={"email": "signup6@test.com", "code": code})
    r = client.post(
        "/api/auth/verify-code", json={"email": "signup6@test.com", "code": "wrong"}
    )
    assert r.status_code == 200
    assert r.json() == {"verified": True}


def test_verify_code_unknown_email_is_generic_error_not_404(client):
    r = client.post(
        "/api/auth/verify-code", json={"email": "nobody@test.com", "code": "123456"}
    )
    assert r.status_code == 400
    assert "invalid" in r.json()["detail"].lower()


def test_resend_issues_a_fresh_code_and_resets_attempts(client, monkeypatch):
    monkeypatch.setattr(config.settings, "verification_resend_cooldown_seconds", 0)
    old_code = _register_and_capture_code(client, "signup7@test.com")
    _mutate_user("signup7@test.com", verification_attempts=4)

    with patch("app.routers.email_verification.send_verification_code_email") as mock_send:
        r = client.post("/api/auth/resend-code", json={"email": "signup7@test.com"})
        assert r.status_code == 200, r.text
        assert r.json() == {"sent": True}
        new_code = mock_send.call_args[0][1]

    assert new_code != old_code
    user = _get_user_sync("signup7@test.com")
    assert user.verification_attempts == 0
    # Old code must no longer verify.
    r = client.post(
        "/api/auth/verify-code", json={"email": "signup7@test.com", "code": old_code}
    )
    assert r.status_code == 400
    # New code does.
    r = client.post(
        "/api/auth/verify-code", json={"email": "signup7@test.com", "code": new_code}
    )
    assert r.status_code == 200


def test_resend_respects_cooldown(client, monkeypatch):
    monkeypatch.setattr(config.settings, "verification_resend_cooldown_seconds", 3600)
    _register_and_capture_code(client, "signup8@test.com")
    with patch("app.routers.email_verification.send_verification_code_email"):
        r = client.post("/api/auth/resend-code", json={"email": "signup8@test.com"})
    assert r.status_code == 429


def test_resend_unknown_email_returns_generic_success(client):
    """Anti-enumeration: resend must not reveal whether an email is registered."""
    r = client.post("/api/auth/resend-code", json={"email": "nobody@test.com"})
    assert r.status_code == 200
    assert r.json() == {"sent": True}


def test_resend_already_verified_returns_generic_success_without_sending(client):
    code = _register_and_capture_code(client, "signup9@test.com")
    client.post("/api/auth/verify-code", json={"email": "signup9@test.com", "code": code})

    with patch("app.routers.email_verification.send_verification_code_email") as mock_send:
        r = client.post("/api/auth/resend-code", json={"email": "signup9@test.com"})
        assert r.status_code == 200
        assert r.json() == {"sent": True}
        mock_send.assert_not_called()


def test_login_still_blocked_until_verified(client):
    _register_and_capture_code(client, "signup10@test.com")
    login = client.post(
        "/api/auth/login",
        data={"username": "signup10@test.com", "password": "pw12345678"},
    )
    assert login.status_code == 400
    assert login.json()["detail"] == "LOGIN_USER_NOT_VERIFIED"
