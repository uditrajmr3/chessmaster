import uuid
from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    lichess_username: str | None = None
    chesscom_username: str | None = None


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    lichess_username: str | None = None
    chesscom_username: str | None = None
