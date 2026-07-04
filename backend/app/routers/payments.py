from datetime import datetime, timedelta

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.deps import current_verified_user
from ..auth.models import User
from ..config import settings
from ..database import get_db
from ..models import Payment

router = APIRouter(prefix="/payments", tags=["payments"])


def _client() -> razorpay.Client:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(500, "Razorpay is not configured on this server.")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


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
    if payment.status == "paid":
        return {"premium": True}

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

    payment.status = "paid"
    payment.razorpay_payment_id = body.razorpay_payment_id
    payment.verified_at = datetime.utcnow()

    # `user` is loaded via fastapi-users' async session (see auth/users.py),
    # while `db` here is the sync session — mutating `user` and calling
    # db.add(user) raises a cross-session InvalidRequestError. Update by id
    # through the sync session instead, never touching the async-bound object.
    new_expiry = datetime.utcnow() + timedelta(days=settings.premium_duration_days)
    db.query(User).filter(User.id == user.id).update(
        {"is_premium": True, "premium_expires_at": new_expiry}
    )
    db.commit()

    return {"premium": True, "expires_at": new_expiry.isoformat()}
