"""Guard: test runs must never send real Telegram owner alerts."""

import httpx

from app.config import settings
from app.services import notify as n


def test_notify_makes_no_network_call_under_tests(monkeypatch):
    # Settings are blanked by conftest (env vars + session fixture). Use bool()
    # so a failure does not print the token value.
    assert bool(settings.telegram_bot_token) is False
    assert bool(settings.telegram_chat_id) is False

    def _forbidden(*args, **kwargs):
        raise AssertionError("network call attempted during tests")

    monkeypatch.setattr(httpx.AsyncClient, "post", _forbidden)
    monkeypatch.setattr(httpx.Client, "post", _forbidden)

    n.notify("x")  # must return early: no task, no thread, no HTTP
    n.notify_error("telegram-guard-test", "x")
