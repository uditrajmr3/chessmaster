import logging
from ..config import settings

logger = logging.getLogger(__name__)


def _send(to: str, subject: str, html: str | None = None, variables: dict | None = None) -> bool:
    """Send an email via Resend. Returns True on success. Never raises — a mail
    provider problem (missing key, unverified domain, outage) must not break the
    signup/reset flow that triggered it.

    When settings.email_template_id is set, the email is rendered from the Resend
    published template (passing `variables`); otherwise the inline `html` is used.
    Resend rejects html/text when a template is supplied, so we send one or the
    other — never both."""
    if not settings.resend_api_key:
        logger.warning("Email skipped (no RESEND_API_KEY): %s -> %s", subject, to)
        return False
    try:
        import resend
        resend.api_key = settings.resend_api_key
        params = {"from": settings.email_from, "to": [to], "subject": subject}
        if settings.email_template_id:
            params["template"] = {"id": settings.email_template_id, "variables": variables or {}}
        else:
            params["html"] = html or ""
        resend.Emails.send(params)
        return True
    except Exception as e:  # noqa: BLE001 — email must be best-effort
        logger.warning("Email send failed (%s -> %s): %s", subject, to, e)
        return False


def _template_vars(link: str, heading: str, cta: str) -> dict:
    """Hedge the CTA link (and heading/button label) across the variable names a
    Resend template is likely to use, so the template renders correctly without
    us having to hard-code its exact placeholder names. Unused keys are ignored."""
    return {
        "link": link, "url": link, "action_url": link, "button_url": link,
        "cta_url": link, "verification_url": link, "reset_url": link,
        "heading": heading, "title": heading, "preheader": heading,
        "cta": cta, "button_text": cta, "action": cta,
    }


def send_verification_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    sent = _send(
        email,
        "Verify your ChessInt email",
        html=f'<p>Confirm your email:</p><p><a href="{link}">{link}</a></p>',
        variables=_template_vars(link, "Verify your email", "Verify email"),
    )
    if not sent:
        # Fallback so the flow still works before a mail domain is verified.
        logger.warning("Verification link for %s: %s", email, link)


def send_reset_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={token}"
    sent = _send(
        email,
        "Reset your ChessInt password",
        html=f'<p>Reset your password:</p><p><a href="{link}">{link}</a></p>',
        variables=_template_vars(link, "Reset your password", "Reset password"),
    )
    if not sent:
        logger.warning("Reset link for %s: %s", email, link)
