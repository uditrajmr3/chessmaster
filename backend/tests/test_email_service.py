from unittest.mock import patch
from app.services import email_service

def test_verification_email_builds_frontend_link(monkeypatch):
    monkeypatch.setattr(email_service.settings, "resend_api_key", "test")
    monkeypatch.setattr(email_service.settings, "frontend_url", "https://app.test")
    with patch.object(email_service, "_send") as m:
        email_service.send_verification_email("u@test.com", "TOK")
    body = m.call_args.kwargs["html"] if m.call_args.kwargs else m.call_args.args[2]
    assert "https://app.test/verify-email?token=TOK" in body

def test_no_api_key_is_noop(monkeypatch):
    monkeypatch.setattr(email_service.settings, "resend_api_key", "")
    email_service.send_verification_email("u@test.com", "TOK")  # must not raise
