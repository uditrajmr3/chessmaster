from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.models import User
from ..config import settings
from ..database import get_async_db
from ..services.email_service import send_verification_code_email
from ..services.verification_code import check_code, generate_code, hash_code

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyCodeRequest(BaseModel):
    email: str
    code: str


class ResendCodeRequest(BaseModel):
    email: str


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


@router.post("/verify-code")
async def verify_email_code(
    body: VerifyCodeRequest,
    db: AsyncSession = Depends(get_async_db),
):
    user = await _get_user_by_email(db, body.email)
    if user and user.is_verified:
        return {"verified": True}  # idempotent — already done, not an error

    generic_error = HTTPException(400, "Invalid or expired code.")
    if not user or not user.verification_code_hash or not user.verification_code_expires_at:
        raise generic_error
    if user.verification_code_expires_at < datetime.utcnow():
        raise HTTPException(400, "This code has expired. Request a new one.")
    if user.verification_attempts >= settings.verification_code_max_attempts:
        raise HTTPException(429, "Too many attempts. Request a new code.")

    if not check_code(body.code, user.verification_code_hash):
        user.verification_attempts += 1
        db.add(user)
        await db.commit()
        raise generic_error

    user.is_verified = True
    user.verification_code_hash = None
    user.verification_code_expires_at = None
    user.verification_attempts = 0
    db.add(user)
    await db.commit()
    return {"verified": True}


@router.post("/resend-code")
async def resend_verification_code(
    body: ResendCodeRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_db),
):
    # Always return the same generic response regardless of whether the
    # account exists or was rate-limited, so this can't be used to enumerate
    # registered emails or probe account state.
    generic_response = {"sent": True}

    user = await _get_user_by_email(db, body.email)
    if not user or user.is_verified:
        return generic_response

    if (
        user.verification_code_sent_at
        and (datetime.utcnow() - user.verification_code_sent_at).total_seconds()
        < settings.verification_resend_cooldown_seconds
    ):
        # A real 429 here (rather than a silent generic_response) is more
        # honest to a legitimate user who just clicked resend too soon — the
        # frontend can show an accurate "wait Ns" countdown instead of a
        # false "code sent". Narrows the anti-enumeration guarantee slightly
        # (an attacker who resends twice fast learns the account exists),
        # which is an acceptable trade for this app.
        raise HTTPException(429, "Please wait before requesting another code.")

    code = generate_code()
    user.verification_code_hash = hash_code(code)
    user.verification_code_expires_at = datetime.utcnow() + timedelta(
        minutes=settings.verification_code_ttl_minutes
    )
    user.verification_attempts = 0
    user.verification_code_sent_at = datetime.utcnow()
    db.add(user)
    await db.commit()

    send_verification_code_email(user.email, code, request)
    return generic_response
