import uuid
from datetime import datetime, timedelta

from fastapi import Depends
from fastapi_users import FastAPIUsers, BaseUserManager, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_async_db
from .models import User
from ..services.email_service import send_reset_email, send_verification_code_email
from ..services.verification_code import generate_code, hash_code


async def get_user_db(session: AsyncSession = Depends(get_async_db)):
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.secret_key
    verification_token_secret = settings.secret_key

    async def on_after_register(self, user, request=None):
        # Signup verification uses a 6-digit code (this), not fastapi-users'
        # built-in token+link flow (self.request_verify) — password reset
        # still uses that link flow untouched, via on_after_forgot_password.
        code = generate_code()
        await self.user_db.update(
            user,
            {
                "verification_code_hash": hash_code(code),
                "verification_code_expires_at": datetime.utcnow()
                + timedelta(minutes=settings.verification_code_ttl_minutes),
                "verification_attempts": 0,
                "verification_code_sent_at": datetime.utcnow(),
            },
        )
        send_verification_code_email(user.email, code, request)

    async def on_after_forgot_password(self, user, token, request=None):
        send_reset_email(user.email, token)


async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)


cookie_transport = CookieTransport(
    cookie_max_age=settings.access_token_lifetime,
    cookie_secure=settings.cookie_secure,
    cookie_samesite=settings.cookie_samesite,
    cookie_httponly=True,
)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.secret_key,
        lifetime_seconds=settings.access_token_lifetime,
    )


auth_backend = AuthenticationBackend(
    name="cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])
