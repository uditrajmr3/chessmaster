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

# Same rook mark as frontend/src/components/Logo.tsx, rasterized to a PNG —
# inline <svg> is unreliably supported in HTML email (Gmail among others has
# historically stripped it), so an <img> with a base64 data URI is the safe
# choice. Regenerate with ImageMagick if the mark ever changes:
#   convert -background none -density 300 rook.svg -resize 96x96 rook.png
_ROOK_LOGO_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAIoUExURQAAAOi5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5iui5igAAAMGYZ4oAAAC2dFJOUwAAAQwREAoCDQkOCA8VpN3a34kXqdzbfbRxxWoYwaIbyJMc1YYZ6b+hxpLTheZ8oJEahKoWLpgw1P4v577C3sTv1/l7HYEDs/Tk/FmCevo/Y5DojUGe8lVf2SM99iHNjwf98zlK7uCcC8OAVjcTu3RRbzTtml5y6yxS9yaWumuV8UvLtgTwtXY2YVCtYkUFVOOHQCfW4jLPaSgUd07JrPhCEvUGV7kxJMB1q3DhvG0e+8c+g2gi75A7CgAAAAFiS0dEAIgFHUgAAAAJcEhZcwAAASwAAAEsAHOI6VIAAAAHdElNRQfqBwkEDhunzE1gAAADiklEQVRo3u3Z91MTQRQH8LxQQm+hiYCgkIAEFUUgFFHAqAEUUUEBFVAQRbEhYm8goqjYC1gQK2DX+/vcDLkLDMzt27fjjDPm+9ububzPXNvb3RgM3njjjTf/aIAaNGD08fWbjq8/gCnAT00gq4K0KphVITMrNBAaFh4xncgoAHN0jLuKjWNVfKy7ilgAEJqgVrELjXggMUlRkwywKEWrUgEWL9GqNIB0i1bFiQBW7WcZDMjUqqWsytIqGwOytWqZF/hLwHLWxAOsAMjxACvZMyUNrMrNXe0B8sy5+QVqYY9KNBdaZIGiYmuJ1sS+xmotXatV66zWhDJZAJ//CQAaUG5EjnZs2K0oIQDrHWigcMNGArApzQ8J+CcT2rM4K5FATikNsFchgRljj1hsSMBcTASqkYCjajOpf9EW7FMUUrPVldRaZOeEba7Do7Y70O+BOztw/evqRect6uE77ShgV4PovEhlGptQQKa/YGcN2L0HBew10QADNGdg+rfUi14bzynYMEDrPjqwvw0BJOVQAQNUtCOAA8jHfz6g4yC/v72afAIGMB3iA5ZGCQA6+UCMmdyfAYezuUB8oAxwpIsLHKVfIZfA/Xraj8kBx3mfhvBCGcAAJ07ybkGATH82AYjkAN1SJ8CmMGH6/ZtOSQLQow+c7pUFzpzVBQpCpfoz4FyWLnC+WQ4wQPAFXeCi3BVyncIlvf6Xr8gDujfhaoUsYIDeOh3gWp90f+jt1wGu98lfogGnDtB+QxKYtZczX2z0D7IbGCzTBSIa5AZT8OV8cZwDwlPS2cBN3nIwReZBBfC/xemvtAxJAbf7eYBS6icxbbnTze2vtN6lzxwhf5gPKNE+RAHAeA/RX2m7TwYePMQASjdxvOB+LtU8ekwCAMxPcIASRVpDATzFrscjn1FOAZ7z56Xu2EcIAMAobhHrygvxVRRA8Et0f+VVjSDgWrW/tuABpWtMbFBlR4/lCfRX3nSOiwgA42/f4e+AK0V570X+w4FK3qx9bjI/CAAdAjdYjX1QACBtqlWLbC1/JADorWV2s/Av8Yx8wm1JsYOMQYkThHsw5PpTjy8ApE+mTNURzqA2cmK0mSuwQXrCSeg+nbZJE08AKG8h91eUYe7mFAR+luivKF+4QEiSFDDABfoIL7EnTu6ymS2ZKH9OqEn5yn+MmnumqO2/ff/BfxEAHI0jNlJ+/vo99037A2K1gt7cAK4mAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTA3LTA5VDA0OjE0OjI3KzAwOjAwZnaVOAAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0wNy0wOVQwNDoxNDoyNyswMDowMBcrLYQAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMDctMDlUMDQ6MTQ6MjcrMDA6MDBAPgxbAAAAAElFTkSuQmCC"
)

_LOGO_SVG = (
    '<div style="width:48px;height:48px;background:#1a120c;border-radius:12px;'
    'display:inline-block;text-align:center;line-height:48px;">'
    f'<img src="data:image/png;base64,{_ROOK_LOGO_BASE64}" width="24" height="24" '
    'alt="ChessInt" style="vertical-align:middle;"/>'
    '</div>'
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
