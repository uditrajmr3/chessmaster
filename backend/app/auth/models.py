import uuid
from datetime import datetime
from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"
    lichess_username: Mapped[str | None] = mapped_column(String, nullable=True)
    chesscom_username: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
