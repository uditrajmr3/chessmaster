from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://chessmaster:chessmaster@localhost:5432/chessmaster"
    stockfish_path: str = ""
    anthropic_api_key: str = ""
    stockfish_depth: int = 20
    cors_origins: list[str] = ["http://localhost:3000"]
    secret_key: str = "CHANGE_ME_DEV_ONLY"
    access_token_lifetime: int = 3600
    resend_api_key: str = ""
    email_from: str = "ChessMaster <noreply@example.com>"
    frontend_url: str = "http://localhost:3000"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        """Managed providers (Render, Heroku, etc.) hand out 'postgres://' or
        'postgresql://' URLs. SQLAlchemy needs the psycopg3 driver explicitly,
        so coerce the scheme to 'postgresql+psycopg://' for both the sync and
        async engines."""
        if v.startswith("postgres://"):
            v = "postgresql://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    def resolve_stockfish(self) -> str | None:
        import shutil

        if self.stockfish_path:
            p = Path(self.stockfish_path)
            if not p.is_absolute():
                p = Path(__file__).parent.parent / self.stockfish_path
            if p.exists():
                return str(p)
            return self.stockfish_path
        # Check local stockfish directory
        local = Path(__file__).parent.parent / "stockfish" / "stockfish.exe"
        if local.exists():
            return str(local)
        local_unix = Path(__file__).parent.parent / "stockfish" / "stockfish"
        if local_unix.exists():
            return str(local_unix)
        # Check system PATH
        found = shutil.which("stockfish")
        if found:
            return found
        return None


settings = Settings()
