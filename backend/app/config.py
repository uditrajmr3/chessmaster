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

    # Fernet key used to encrypt user-supplied secrets (own Anthropic API key)
    # at rest. Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    # Vision-based position analyzer. Free for users with their own Anthropic
    # key (own_anthropic_api_key on the user); otherwise gated on is_premium
    # and billed against ChessInt's own key.
    position_analyzer_model: str = "claude-opus-4-8"

    # Razorpay (payment processor for the premium position-analyzer unlock).
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    # Separate secret for the /payments/premium/webhook endpoint (Razorpay
    # dashboard -> Settings -> Webhooks), distinct from the API key secret.
    # Authoritative confirmation path — the browser checkout callback alone
    # can't be trusted if the tab closes/crashes right after a successful
    # payment, so the webhook is what actually unlocks premium in that case.
    razorpay_webhook_secret: str = ""
    # One-time purchase price, in paise (smallest INR unit), for a 30-day
    # premium unlock of the position analyzer. ₹149.00 by default.
    premium_price_paise: int = 14900
    premium_duration_days: int = 30

    # Signup email verification code (first-time signup only — password reset
    # keeps the existing link flow untouched).
    verification_code_ttl_minutes: int = 15
    verification_code_max_attempts: int = 5
    verification_resend_cooldown_seconds: int = 60

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
