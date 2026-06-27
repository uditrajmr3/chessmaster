from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://chessmaster:chessmaster@localhost:5432/chessmaster"
    anthropic_api_key: str = ""
    # AI Coach model. Haiku 4.5 is ~5x cheaper in/out than Sonnet 4 and plenty
    # strong for summarizing structured pattern stats into a coaching report.
    report_model: str = "claude-haiku-4-5"
    # Free-tier cap on AI Coach reports per user per rolling 30 days (the report
    # uses the owner's Anthropic key). 0 = unlimited.
    report_monthly_quota: int = 5
    cors_origins: list[str] = ["http://localhost:3000"]
    secret_key: str = "CHANGE_ME_DEV_ONLY"
    # 7 days. A short (1h) session logged users out mid-analysis — browser-side
    # analysis of a large history can run well over an hour.
    access_token_lifetime: int = 604800
    resend_api_key: str = ""
    email_from: str = "ChessInt <noreply@example.com>"
    # Resend published-template id. When set, transactional emails render via the
    # Resend template instead of inline HTML. Empty = use the inline HTML fallback.
    email_template_id: str = ""
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


settings = Settings()
