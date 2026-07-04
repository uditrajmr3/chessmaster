import uuid
from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    lichess_username: str | None = None
    chesscom_username: str | None = None
    has_own_api_key: bool = False
    is_premium: bool = False
    premium_active: bool = False


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    lichess_username: str | None = None
    chesscom_username: str | None = None
    # Write-only: set to unlock all AI features for free using the user's own
    # Anthropic key; send "" to remove it. Never echoed back — see UserRead.
    own_anthropic_api_key: str | None = None
