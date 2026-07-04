import json
import logging
from datetime import datetime, timedelta

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..config import settings
from ..database import get_db
from ..models import Payment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


def _client() -> razorpay.Client:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(500, "Razorpay is not configured on this server.")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def _grant_premium(db: Session, payment: Payment, razorpay_payment_id: str) -> None:
    """Mark a Payment paid and unlock premium for its owner. Idempotent —
    safe to call from both the browser-callback path and the webhook path,
    whichever confirms the payment first."""
    if payment.status == "paid":
        return
    payment.status = "paid"
    payment.razorpay_payment_id = razorpay_payment_id
    payment.verified_at = datetime.utcnow()

    # `current_verified_user` resolves via fastapi-users' ASYNC session (see
    # auth/users.py); this `db` is the SYNC session. Updating a User row by
    # id through it (rather than mutating an async-bound ORM object and
    # calling db.add()) avoids a cross-session InvalidRequestError — see the
    # 2026-07-04 incident where this crashed a real purchase with a 500.
    new_expiry = datetime.utcnow() + timedelta(days=settings.premium_duration_days)
    db.query(User).filter(User.id == payment.user_id).update(
        {"is_premium": True, "premium_expires_at": new_expiry}
    )
    db.commit()


@router.get("/config")
def get_payment_config():
    """Public config the frontend needs to open Razorpay Checkout."""
    return {
        "key_id": settings.razorpay_key_id,
        "amount_paise": settings.premium_price_paise,
        "currency": "INR",
        "duration_days": settings.premium_duration_days,
    }


@router.post("/premium/create-order")
def create_premium_order(
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    if user.premium_active:
        raise HTTPException(400, "You already have an active premium unlock.")

    client = _client()
    order = client.order.create(
        {
            "amount": settings.premium_price_paise,
            "currency": "INR",
            "receipt": f"premium-{user.id}"[:40],
            "notes": {"user_id": str(user.id), "purpose": "position_analyzer_premium"},
        }
    )

    payment = Payment(
        user_id=user.id,
        razorpay_order_id=order["id"],
        amount_paise=settings.premium_price_paise,
        currency="INR",
        status="created",
        created_at=datetime.utcnow(),
    )
    db.add(payment)
    db.commit()

    return {
        "order_id": order["id"],
        "amount_paise": settings.premium_price_paise,
        "currency": "INR",
        "key_id": settings.razorpay_key_id,
    }


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/premium/verify")
def verify_premium_payment(
    body: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_verified_user),
):
    payment = (
        db.query(Payment)
        .filter(
            Payment.razorpay_order_id == body.razorpay_order_id,
            Payment.user_id == user.id,
        )
        .first()
    )
    if not payment:
        raise HTTPException(404, "No matching order for this user.")

    # This is a fast-path only — if the webhook already confirmed the
    # payment (e.g. this callback was slow, or never fired at all and the
    # user is now polling/retrying), there's nothing left to do.
    if payment.status != "paid":
        client = _client()
        try:
            client.utility.verify_payment_signature(
                {
                    "razorpay_order_id": body.razorpay_order_id,
                    "razorpay_payment_id": body.razorpay_payment_id,
                    "razorpay_signature": body.razorpay_signature,
                }
            )
        except razorpay.errors.SignatureVerificationError:
            payment.status = "failed"
            db.commit()
            raise HTTPException(400, "Payment signature verification failed.")

        _grant_premium(db, payment, body.razorpay_payment_id)

    updated = db.query(User).filter(User.id == user.id).first()
    return {"premium": True, "expires_at": updated.premium_expires_at.isoformat()}


@router.post("/premium/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Server-to-server confirmation from Razorpay — the authoritative path.

    The browser callback in /premium/verify only fires if the checkout tab
    stays open long enough; if it closes or the network drops right after a
    successful payment, Razorpay still has the money but our backend never
    hears about it via that path. This endpoint is called directly by
    Razorpay regardless of what the browser does, so it's what actually
    unlocks premium in that case. No auth dependency — the request isn't
    tied to a user session, so security comes entirely from the signature
    check below (never skip it).
    """
    if not settings.razorpay_webhook_secret:
        raise HTTPException(500, "Webhook secret not configured.")

    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    try:
        razorpay.Utility().verify_webhook_signature(
            raw_body.decode(), signature, settings.razorpay_webhook_secret
        )
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(400, "Invalid webhook signature.")

    payload = json.loads(raw_body)
    event = payload.get("event")
    if event != "payment.captured":
        # Same Razorpay account may be shared across other sites/webhooks —
        # acknowledge anything we don't handle rather than erroring.
        return {"status": "ignored"}

    entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = entity.get("order_id")
    payment_id = entity.get("id")
    if not order_id or not payment_id:
        return {"status": "ignored"}

    payment = db.query(Payment).filter(Payment.razorpay_order_id == order_id).first()
    if not payment:
        # Order not ours (e.g. a different site on the same Razorpay account).
        return {"status": "ignored"}

    _grant_premium(db, payment, payment_id)
    return {"status": "ok"}
