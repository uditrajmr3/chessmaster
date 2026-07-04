"""Razorpay premium-unlock flow.

Regression coverage for a cross-session bug: `current_verified_user` resolves
through fastapi-users' ASYNC session (auth/users.py), while these endpoints
also take the SYNC `db` session from get_db. Mutating the async-bound `user`
object and committing it through the sync session raises a SQLAlchemy
InvalidRequestError ("already attached to session X") — a 500 in production
that these tests catch by exercising the real dependency chain end-to-end
(not just calling the handler function directly).
"""

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

import razorpay

from app import config
from app.auth.models import User
from app.models import Payment


def _sign(body: bytes, secret: str) -> str:
    """Same construction as razorpay.Utility.verify_signature: hex HMAC-SHA256."""
    return hmac.new(key=secret.encode(), msg=body, digestmod=hashlib.sha256).hexdigest()


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


# ── Webhook: the authoritative confirmation path ────────────────────────────
#
# The browser callback in /premium/verify only fires if the checkout tab
# stays open. If it closes right after a successful payment, Razorpay still
# has the money but the callback never runs — the webhook is what actually
# confirms payment in that case, so it must work standalone (no user session,
# no reliance on the browser having done anything).

WEBHOOK_SECRET = "whsec_test_fake"


def _payment_captured_payload(order_id: str, payment_id: str) -> bytes:
    return json.dumps(
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": payment_id, "order_id": order_id}}},
        }
    ).encode()


def _seed_order(verified_user_client, monkeypatch, order_id: str):
    _configure_razorpay(monkeypatch)
    order_client = MagicMock()
    order_client.order.create.return_value = {"id": order_id}
    with patch("app.routers.payments.razorpay.Client", return_value=order_client):
        verified_user_client.post("/api/payments/premium/create-order")


def test_webhook_unlocks_premium_with_valid_signature(
    verified_user_client, db, monkeypatch
):
    monkeypatch.setattr(config.settings, "razorpay_webhook_secret", WEBHOOK_SECRET)
    _seed_order(verified_user_client, monkeypatch, "order_webhook_ok")

    me = verified_user_client.get("/api/users/me").json()
    db.add(User(id=me["id"], email=me["email"], hashed_password="x", is_active=True, is_verified=True))
    db.commit()

    body = _payment_captured_payload("order_webhook_ok", "pay_webhook_ok")
    r = verified_user_client.post(
        "/api/payments/premium/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, WEBHOOK_SECRET),
        },
    )

    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"

    payment = db.query(Payment).filter(Payment.razorpay_order_id == "order_webhook_ok").first()
    assert payment.status == "paid"
    assert payment.razorpay_payment_id == "pay_webhook_ok"

    user = db.query(User).filter(User.email == me["email"]).first()
    assert user.is_premium is True


def test_webhook_rejects_bad_signature(verified_user_client, monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_webhook_secret", WEBHOOK_SECRET)
    _seed_order(verified_user_client, monkeypatch, "order_webhook_bad_sig")

    body = _payment_captured_payload("order_webhook_bad_sig", "pay_x")
    r = verified_user_client.post(
        "/api/payments/premium/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": "not-the-right-signature",
        },
    )
    assert r.status_code == 400


def test_webhook_ignores_unmatched_order(verified_user_client, monkeypatch):
    """Same Razorpay account may serve other sites — an event for an order
    we never created must not error, just be acknowledged and ignored."""
    monkeypatch.setattr(config.settings, "razorpay_webhook_secret", WEBHOOK_SECRET)

    body = _payment_captured_payload("order_from_a_different_site", "pay_y")
    r = verified_user_client.post(
        "/api/payments/premium/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, WEBHOOK_SECRET),
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"


def test_webhook_ignores_other_event_types(verified_user_client, monkeypatch):
    monkeypatch.setattr(config.settings, "razorpay_webhook_secret", WEBHOOK_SECRET)
    _seed_order(verified_user_client, monkeypatch, "order_other_event")

    body = json.dumps({"event": "order.paid", "payload": {}}).encode()
    r = verified_user_client.post(
        "/api/payments/premium/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, WEBHOOK_SECRET),
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"


def test_webhook_is_idempotent_after_browser_callback_already_confirmed(
    verified_user_client, db, monkeypatch
):
    """If the browser callback already unlocked premium, a later webhook
    delivery for the same payment (Razorpay retries webhooks) must be a
    no-op, not double-charge the 30-day window or error."""
    _configure_razorpay(monkeypatch)
    monkeypatch.setattr(config.settings, "razorpay_webhook_secret", WEBHOOK_SECRET)
    _seed_order(verified_user_client, monkeypatch, "order_already_confirmed")

    me = verified_user_client.get("/api/users/me").json()
    db.add(User(id=me["id"], email=me["email"], hashed_password="x", is_active=True, is_verified=True))
    db.commit()

    verify_client = MagicMock()
    verify_client.utility.verify_payment_signature.return_value = None
    with patch("app.routers.payments.razorpay.Client", return_value=verify_client):
        verified_user_client.post(
            "/api/payments/premium/verify",
            json={
                "razorpay_order_id": "order_already_confirmed",
                "razorpay_payment_id": "pay_already",
                "razorpay_signature": "sig_fake",
            },
        )

    first_expiry = (
        db.query(User).filter(User.email == me["email"]).first().premium_expires_at
    )

    body = _payment_captured_payload("order_already_confirmed", "pay_already")
    r = verified_user_client.post(
        "/api/payments/premium/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, WEBHOOK_SECRET),
        },
    )

    assert r.status_code == 200
    second_expiry = (
        db.query(User).filter(User.email == me["email"]).first().premium_expires_at
    )
    assert second_expiry == first_expiry
