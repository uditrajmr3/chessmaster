import hashlib
import hmac
import secrets

from ..config import settings


def generate_code() -> str:
    """A 6-digit numeric code, zero-padded (e.g. "052508")."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    """HMAC the code with the app secret before storing it. The real defense
    here is short expiry + attempt limiting (a 6-digit code only has a
    million possibilities) — this just avoids keeping it plaintext at rest."""
    return hmac.new(settings.secret_key.encode(), code.encode(), hashlib.sha256).hexdigest()


def check_code(code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code), stored_hash)
