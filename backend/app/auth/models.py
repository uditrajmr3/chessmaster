from datetime import datetime
from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"
    lichess_username: Mapped[str | None] = mapped_column(String, nullable=True)
    chesscom_username: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Signup email verification — a 6-digit code (hashed at rest), not
    # fastapi-users' built-in token+link flow. Password reset still uses the
    # link flow untouched; this only replaces first-time signup verification.
    verification_code_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    verification_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verification_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verification_code_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Bring-your-own-key: stored encrypted (see app/services/crypto.py). Never
    # exposed in API responses — only a derived `has_own_api_key` boolean is.
    own_anthropic_api_key_encrypted: Mapped[str | None] = mapped_column(String, nullable=True)

    # Premium unlocks the position analyzer for users without their own key
    # (billed against ChessInt's own Anthropic key). One-time purchase via
    # Razorpay; premium_expires_at is None only for a legacy/manual grant.
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    premium_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def own_anthropic_api_key(self) -> str | None:
        if not self.own_anthropic_api_key_encrypted:
            return None
        from ..services.crypto import decrypt

        return decrypt(self.own_anthropic_api_key_encrypted)

    @own_anthropic_api_key.setter
    def own_anthropic_api_key(self, value: str | None) -> None:
        from ..services.crypto import encrypt

        self.own_anthropic_api_key_encrypted = encrypt(value) if value else None

    @property
    def has_own_api_key(self) -> bool:
        return bool(self.own_anthropic_api_key_encrypted)

    @property
    def premium_active(self) -> bool:
        if not self.is_premium:
            return False
        if self.premium_expires_at is None:
            return True
        return self.premium_expires_at > datetime.utcnow()
