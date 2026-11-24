import asyncio
import types

import httpx
import pytest

from app.config import settings
from app.services import notify as n


class FakeClient:
    calls: list = []
    raise_exc = False

    def __init__(self, *a, **k):
        self.timeout = k.get("timeout")

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None):
        if FakeClient.raise_exc:
            raise httpx.ConnectError("boom")
        FakeClient.calls.append((url, json))
        return types.SimpleNamespace(status_code=200)


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    FakeClient.calls = []
    FakeClient.raise_exc = False
    monkeypatch.setattr(n.httpx, "AsyncClient", FakeClient)
    n._last_sent.clear()
    yield


def _enable_send_path(monkeypatch):
    """Exercise the real send path: token/chat set, flag on, pytest guard lifted.
    Network stays mocked via FakeClient."""
    monkeypatch.setattr(settings, "telegram_bot_token", "TOK")
    monkeypatch.setattr(settings, "telegram_chat_id", "42")
    monkeypatch.setattr(settings, "telegram_alerts_enabled", True)
    monkeypatch.setattr(n, "_ALLOW_UNDER_PYTEST", True)


def test_noop_when_unset(monkeypatch):
    monkeypatch.setattr(settings, "telegram_bot_token", "")
    monkeypatch.setattr(settings, "telegram_chat_id", "")
    monkeypatch.setattr(settings, "telegram_alerts_enabled", True)
    monkeypatch.setattr(n, "_ALLOW_UNDER_PYTEST", True)
    asyncio.run(n.send("hi"))
    assert FakeClient.calls == []


def test_sends_payload(monkeypatch):
    _enable_send_path(monkeypatch)
    asyncio.run(n.send("hello"))
    url, body = FakeClient.calls[0]
    assert url == "https://api.telegram.org/botTOK/sendMessage"
    assert body == {
        "chat_id": "42",
        "text": "[ChessInt] hello",
        "disable_web_page_preview": True,
    }


def test_truncates(monkeypatch):
    _enable_send_path(monkeypatch)
    asyncio.run(n.send("x" * 10000))
    assert len(FakeClient.calls[0][1]["text"]) == 3500


def test_never_raises_on_httpx_error(monkeypatch):
    _enable_send_path(monkeypatch)
    FakeClient.raise_exc = True
    asyncio.run(n.send("hello"))  # must not raise


def test_notify_error_dedupes(monkeypatch):
    sent = []
    monkeypatch.setattr(n, "notify", lambda t: sent.append(t))
    n.notify_error("k", "a")
    n.notify_error("k", "b")
    n.notify_error("other", "c")
    assert sent == ["⚠️ ERROR a", "⚠️ ERROR c"]
    n._last_sent["k"] -= 601
    n.notify_error("k", "d")
    assert sent[-1] == "⚠️ ERROR d"


def test_notify_without_loop_uses_thread(monkeypatch):
    import time

    _enable_send_path(monkeypatch)
    n.notify("thr")
    for _ in range(50):
        if FakeClient.calls:
            break
        time.sleep(0.05)
    assert FakeClient.calls


def test_notify_inside_loop_schedules_task(monkeypatch):
    _enable_send_path(monkeypatch)

    async def go():
        n.notify("in-loop")
        await asyncio.sleep(0.05)

    asyncio.run(go())
    assert FakeClient.calls
    assert not n._tasks


def test_no_send_when_flag_false_even_with_token(monkeypatch):
    _enable_send_path(monkeypatch)
    monkeypatch.setattr(settings, "telegram_alerts_enabled", False)
    asyncio.run(n.send("hi"))
    n.notify("hi")
    n.notify_error("flag-off", "hi")
    assert FakeClient.calls == []


def test_no_send_under_pytest_when_guard_not_lifted(monkeypatch):
    _enable_send_path(monkeypatch)
    monkeypatch.setattr(n, "_ALLOW_UNDER_PYTEST", False)
    asyncio.run(n.send("hi"))
    n.notify("hi")
    assert FakeClient.calls == []
