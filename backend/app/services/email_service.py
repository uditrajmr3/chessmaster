import logging
from datetime import datetime
from typing import TYPE_CHECKING

from ..config import settings

if TYPE_CHECKING:
    from fastapi import Request

logger = logging.getLogger(__name__)


def _send(
    to: str,
    subject: str,
    html: str | None = None,
    variables: dict | None = None,
    use_template: bool = True,
) -> bool:
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
        if use_template and settings.email_template_id:
            params["template"] = {"id": settings.email_template_id, "variables": variables or {}}
        else:
            params["html"] = html or ""
        resend.Emails.send(params)
        return True
    except Exception as e:  # noqa: BLE001 — email must be best-effort
        logger.warning("Email send failed (%s -> %s): %s", subject, to, e)
        return False


def _template_vars(link: str, heading: str, cta: str, name: str = "") -> dict:
    """Hedge the CTA link (and heading/button label) across the variable names a
    Resend template is likely to use, so the template renders correctly without
    us having to hard-code its exact placeholder names. Unused keys are ignored.

    The published "Verify Email" template greets `{{first_name}}` and references
    `{{company_name}}`, so we always supply those too (blank first_name -> a
    neutral greeting rather than "Hi ,")."""
    greeting = name or "there"
    return {
        "link": link, "url": link, "action_url": link, "button_url": link,
        "cta_url": link, "verification_url": link, "reset_url": link,
        "heading": heading, "title": heading, "preheader": heading,
        "cta": cta, "button_text": cta, "action": cta,
        "first_name": greeting, "name": greeting,
        "company_name": "ChessInt", "company": "ChessInt", "product_name": "ChessInt",
    }


def _name_from_email(email: str) -> str:
    """Best-effort first name from the local part (no PII source available here)."""
    local = email.split("@", 1)[0]
    parts = local.replace(".", " ").replace("_", " ").split()
    return parts[0].title() if parts else ""


def send_verification_email(email: str, token: str) -> None:
    link = f"{settings.frontend_url}/verify-email?token={token}"
    sent = _send(
        email,
        "Verify your ChessInt email",
        html=f'<p>Confirm your email:</p><p><a href="{link}">{link}</a></p>',
        variables=_template_vars(link, "Verify your email", "Verify email", _name_from_email(email)),
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
        variables=_template_vars(link, "Reset your password", "Reset password", _name_from_email(email)),
        # The published template is the verify-email design; don't reuse its
        # "Confirm your email address" copy for a password reset.
        use_template=False,
    )
    if not sent:
        logger.warning("Reset link for %s: %s", email, link)


# ── Signup verification code email — custom-coded HTML (not the Resend  ──────
# dashboard template), table-based for email-client compatibility.

_LOGO_SVG = (
    '<div style="width:48px;height:48px;background:#1a120c;border-radius:12px;'
    'display:inline-block;line-height:48px;color:#e8b98a;font-family:Georgia,serif;'
    'font-weight:700;font-size:22px;text-align:center;">&#9822;</div>'
)


def _client_ip(request: "Request | None") -> str:
    if request is None:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _parse_device(request: "Request | None") -> str:
    if request is None:
        return "an unknown device"
    ua = request.headers.get("user-agent", "")
    if "iPhone" in ua or "iOS" in ua:
        os_name = "iOS"
    elif "Android" in ua:
        os_name = "Android"
    elif "Macintosh" in ua or "Mac OS X" in ua:
        os_name = "macOS"
    elif "Windows" in ua:
        os_name = "Windows"
    elif "Linux" in ua:
        os_name = "Linux"
    else:
        os_name = "an unknown OS"

    if "Edg/" in ua:
        browser = "Edge"
    elif "Chrome/" in ua:
        browser = "Chrome"
    elif "Firefox/" in ua:
        browser = "Firefox"
    elif "Safari/" in ua:
        browser = "Safari"
    else:
        browser = "an unknown browser"

    return f"{browser} on {os_name}"


def _email_shell(inner_html: str) -> str:
    """Shared dark/cosmic branded wrapper — every ChessInt transactional email
    template renders its body into this. Table-based layout with inline
    styles only, since many email clients strip <style> blocks."""
    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#05040a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05040a;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<tr><td style="padding:40px 40px 36px;text-align:center;">
{_LOGO_SVG}
{inner_html}
</td></tr>
</table>
<p style="color:#4a4a5a;font-size:11px;margin:20px 0 0;font-family:-apple-system,sans-serif;">
ChessInt — Chess Intelligence · chessmaster.cyou
</p>
</td></tr>
</table>
</body>
</html>"""


def _code_boxes_html(code: str) -> str:
    cells = "".join(
        f'<td style="width:40px;height:48px;background:#f4f1ea;border:1px solid #e5ddc8;'
        f'border-radius:8px;text-align:center;font-family:ui-monospace,monospace;'
        f'font-size:22px;font-weight:600;color:#1a120c;">{digit}</td>'
        f'<td style="width:8px;"></td>'
        for digit in code
    )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="margin:24px auto;"><tr>' + cells + "</tr></table>"
    )


def send_verification_code_email(email: str, code: str, request: "Request | None" = None) -> None:
    ip = _client_ip(request)
    device = _parse_device(request)
    when = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")

    body = f"""
<h1 style="font-family:Georgia,serif;font-size:22px;color:#1a120c;margin:20px 0 8px;">Verify your email</h1>
<p style="color:#6b6b7a;font-size:14px;margin:0;">Enter this code to finish creating your ChessInt account.</p>
{_code_boxes_html(code)}
<p style="color:#9a9aa8;font-size:12px;margin:0 0 24px;">
This code expires in {settings.verification_code_ttl_minutes} minutes. Don't share it with anyone.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6e9;border:1px solid #eee0c5;border-radius:10px;">
<tr><td style="padding:14px 16px;text-align:left;">
<p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#7a5c1e;">Wasn't you?</p>
<p style="margin:0;font-size:12px;color:#8a7a5a;line-height:1.5;">
This code was requested from <strong>{device}</strong> at {when}, IP {ip}.
If you didn't request this, you can safely ignore this email.
</p>
</td></tr>
</table>
"""
    sent = _send(email, "Your ChessInt verification code", html=_email_shell(body), use_template=False)
    if not sent:
        logger.warning("Verification code for %s: %s", email, code)
