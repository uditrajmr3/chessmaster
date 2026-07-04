"""Razorpay premium-unlock flow.

Regression coverage for a cross-session bug: `current_verified_user` resolves
through fastapi-users' ASYNC session (auth/users.py), while these endpoints
also take the SYNC `db` session from get_db. Mutating the async-bound `user`
object and committing it through the sync session raises a SQLAlchemy
InvalidRequestError ("already attached to session X") — a 500 in production
that these tests catch by exercising the real dependency chain end-to-end
(not just calling the handler function directly).
"""

from unittest.mock import MagicMock, patch

import razorpay

from app import config
from app.auth.models import User
from app.models import Payment


def _configure_razorpay(monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_key_id", "rzp_test_fake")
    monkeypatch.setattr(config.settings, "razorpay_key_secret", "fake_secret")


def test_create_order_requires_auth(client):
    r = client.post("/api/payments/premium/create-order")
    assert r.status_code == 401


def test_create_order_seeds_a_payment_row(verified_user_client, db, monkeypatch):
    _configure_razorpay(monkeypatch)
    mock_client = MagicMock()
    mock_client.order.create.return_value = {"id": "order_fake123"}

    with patch("app.routers.payments.razorpay.Client", return_value=mock_client):
        r = verified_user_client.post("/api/payments/premium/create-order")

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["order_id"] == "order_fake123"
    assert body["key_id"] == "rzp_test_fake"

    payment = db.query(Payment).filter(Payment.razorpay_order_id == "order_fake123").first()
    assert payment is not None
    assert payment.status == "created"


def test_verify_success_unlocks_premium_without_cross_session_error(
    verified_user_client, db, monkeypatch
):
    _configure_razorpay(monkeypatch)

    # fastapi-users registers the User row via the ASYNC engine only; this
    # test harness's sync `db` fixture is a *separate* in-memory SQLite
    # database (unlike production, where both engines point at the same
    # real Postgres — see app/database.py). So the sync engine never gets a
    # `users` row on its own. Seed one here with the same id so the sync
    # UPDATE the handler performs actually has a row to hit — this is what
    # exercises the fixed SQL path (and would raise the original
    # cross-session InvalidRequestError if the old `db.add(user)` code came
    # back).
    me = verified_user_client.get("/api/users/me").json()
    db.add(User(id=me["id"], email=me["email"], hashed_password="x", is_active=True, is_verified=True))
    db.commit()

    order_client = MagicMock()
    order_client.order.create.return_value = {"id": "order_verify_ok"}
    with patch("app.routers.payments.razorpay.Client", return_value=order_client):
        verified_user_client.post("/api/payments/premium/create-order")

    verify_client = MagicMock()
    verify_client.utility.verify_payment_signature.return_value = None
    with patch("app.routers.payments.razorpay.Client", return_value=verify_client):
        r = verified_user_client.post(
            "/api/payments/premium/verify",
            json={
                "razorpay_order_id": "order_verify_ok",
                "razorpay_payment_id": "pay_fake123",
                "razorpay_signature": "sig_fake",
            },
        )

    assert r.status_code == 200, r.text
    assert r.json()["premium"] is True

    user = db.query(User).filter(User.email == me["email"]).first()
    assert user.is_premium is True
    assert user.premium_expires_at is not None

    payment = db.query(Payment).filter(Payment.razorpay_order_id == "order_verify_ok").first()
    assert payment.status == "paid"
    assert payment.razorpay_payment_id == "pay_fake123"


def test_verify_bad_signature_marks_payment_failed(verified_user_client, db, monkeypatch):
    _configure_razorpay(monkeypatch)
    order_client = MagicMock()
    order_client.order.create.return_value = {"id": "order_verify_bad"}
    with patch("app.routers.payments.razorpay.Client", return_value=order_client):
        verified_user_client.post("/api/payments/premium/create-order")

    verify_client = MagicMock()
    verify_client.utility.verify_payment_signature.side_effect = (
        razorpay.errors.SignatureVerificationError("bad signature")
    )
    with patch("app.routers.payments.razorpay.Client", return_value=verify_client):
        r = verified_user_client.post(
            "/api/payments/premium/verify",
            json={
                "razorpay_order_id": "order_verify_bad",
                "razorpay_payment_id": "pay_fake456",
                "razorpay_signature": "sig_bad",
            },
        )

    assert r.status_code == 400
    payment = db.query(Payment).filter(Payment.razorpay_order_id == "order_verify_bad").first()
    assert payment.status == "failed"

    access = verified_user_client.get("/api/position/access")
    assert access.json() == {"allowed": False, "reason": "locked"}
