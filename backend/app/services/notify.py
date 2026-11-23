"""Fire-and-forget Telegram notifications to the site owner.

Never raises and never blocks a request. No-op when the bot token / chat id
are unset. Error details go ONLY to the owner's chat, never to users.
"""
import asyncio
import logging
import threading
import time

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

_MAX_LEN = 3500
_DEDUPE_WINDOW_S = 600

_tasks: set = set()
_last_sent: dict[str, float] = {}


async def send(text: str) -> None:
    token = settings.telegram_bot_token
    chat_id = settings.telegram_chat_id
    if not token or not chat_id:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": ("[ChessInt] " + text)[: _MAX_LEN],
                    "disable_web_page_preview": True,
                },
            )
            if resp.status_code >= 300:
                logger.warning("Telegram notify got HTTP %s", resp.status_code)
    except Exception as e:  # noqa: BLE001 - must never raise
        # Do not log repr/str of the exception wholesale: httpx errors can
        # embed the request URL, which contains the bot token.
        logger.warning("Telegram notify failed: %s", type(e).__name__)


def _run_in_thread(text: str) -> None:
    try:
        asyncio.run(send(text))
    except Exception as e:  # noqa: BLE001
        logger.warning("Telegram notify thread failed: %s", type(e).__name__)


def notify(text: str) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop is not None:
            task = loop.create_task(send(text))
            _tasks.add(task)
            task.add_done_callback(_tasks.discard)
        else:
            threading.Thread(target=_run_in_thread, args=(text,), daemon=True).start()
    except Exception as e:  # noqa: BLE001
        logger.warning("Telegram notify scheduling failed: %s", type(e).__name__)


def notify_error(key: str, text: str) -> None:
    now = time.monotonic()
    last = _last_sent.get(key)
    if last is not None and now - last < _DEDUPE_WINDOW_S:
        return
    _last_sent[key] = now
    notify("⚠️ ERROR " + text)
