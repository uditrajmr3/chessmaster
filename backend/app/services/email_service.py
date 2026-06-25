import logging
from ..config import settings

logger = logging.getLogger(__name__)

def _send(to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.warning("Email skipped (no RESEND_API_KEY): %s -> %s", subject, to)
        return
    import resend
    resend.api_key = settings.resend_api_key
    resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})

def send_verification_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    _send(email, "Verify your ChessMaster email",
          f'<p>Confirm your email:</p><p><a href="{link}">{link}</a></p>')

def send_reset_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    _send(email, "Reset your ChessMaster password",
          f'<p>Reset your password:</p><p><a href="{link}">{link}</a></p>')
