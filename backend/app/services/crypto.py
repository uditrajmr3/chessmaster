"""Symmetric encryption for secrets we store on behalf of users (e.g. a
user-supplied Anthropic API key). Never log or return the plaintext value
once stored."""

from cryptography.fernet import Fernet, InvalidToken

from ..config import settings


def _fernet() -> Fernet:
    if not settings.encryption_key:
        raise RuntimeError(
            "ENCRYPTION_KEY not set in .env — generate one with "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"`"
        )
    return Fernet(settings.encryption_key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None
