import logging
from ..config import settings

logger = logging.getLogger(__name__)


def _send(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend. Returns True on success. Never raises — a mail
    provider problem (missing key, unverified domain, outage) must not break the
    signup/reset flow that triggered it."""
    if not settings.resend_api_key:
        logger.warning("Email skipped (no RESEND_API_KEY): %s -> %s", subject, to)
        return False
    try:
        import resend
        resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})
        return True
    except Exception as e:  # noqa: BLE001 — email must be best-effort
        logger.warning("Email send failed (%s -> %s): %s", subject, to, e)
        return False


def send_verification_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    sent = _send(email, "Verify your ChessMaster email",
                 f'<p>Confirm your email:</p><p><a href="{link}">{link}</a></p>')
    if not sent:
        # Fallback so the flow still works before a mail domain is verified.
        logger.warning("Verification link for %s: %s", email, link)


def send_reset_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    sent = _send(email, "Reset your ChessMaster password",
                 f'<p>Reset your password:</p><p><a href="{link}">{link}</a></p>')
    if not sent:
        logger.warning("Reset link for %s: %s", email, link)
