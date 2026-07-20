"""Orchestrate an incremental Chess.com awards scan.

Fetch a player's archive list, parse each game exactly once via
extract_features, aggregate into a measurements payload, and (when a
database session is supplied) fold the result into the cached AwardScan row.

SINGLE-INSTANCE MEMO: `_country_memo` is an in-process cache of opponent
username -> ISO-3166-1 alpha-2 country code. Like the sliding-window
limiter in ratelimit.py and the in-memory status dicts in sync.py, this is
per-worker state — under a multi-worker deployment each worker rebuilds its
own memo. Acceptable here because a cold cache only costs one extra request
per distinct opponent, never a correctness problem.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Callable

import httpx
from sqlalchemy import select

from app.models import AwardScan

from .aggregate import aggregate, merge
from .pgn_features import extract_features

MAX_GAMES = 25_000
_COUNTRY_CONCURRENCY = 8

# opponent username (lowercased) -> ISO-3166-1 alpha-2 country code.
_country_memo: dict[str, str] = {}


class PlayerNotFound(Exception):
    """Chess.com has no public profile for this username."""


class UpstreamError(Exception):
    """Chess.com rate-limited us or is having trouble; safe to retry when `retryable`."""

    def __init__(self, message: str = "Chess.com is not responding.", retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


def _translate(exc: httpx.HTTPStatusError) -> Exception:
    status = exc.response.status_code
    if status == 404:
        return PlayerNotFound(f"No such Chess.com player: {exc.request.url}")
    if status == 429 or status >= 500:
        return UpstreamError(retryable=True)
    return UpstreamError(f"Unexpected Chess.com response: {status}", retryable=False)


def _month_of(archive_url: str) -> str:
    """'https://api.chess.com/pub/player/x/games/2026/06' -> '2026/06'."""
    parts = archive_url.rstrip("/").split("/")
    return f"{parts[-2]}/{parts[-1]}"


def _country_code(country_url: str | None) -> str | None:
    if not country_url:
        return None
    return country_url.rstrip("/").split("/")[-1] or None


async def _resolve_countries(client, usernames: set[str], semaphore: asyncio.Semaphore) -> None:
    """Fill `_country_memo` for any of `usernames` not already cached."""
    pending = [u for u in usernames if u not in _country_memo]
    if not pending:
        return

    async def _one(u: str) -> None:
        async with semaphore:
            if u in _country_memo:
                return
            try:
                player = await client.get_player(u)
            except httpx.HTTPStatusError:
                return  # opponent deleted/private — skip, not fatal to the scan
            code = _country_code(player.get("country"))
            if code:
                _country_memo[u] = code

    await asyncio.gather(*(_one(u) for u in pending))


async def run_scan(
    platform: str,
    username: str,
    db=None,
    client=None,
    progress_cb: Callable[[int, int], None] | None = None,
    current_month: str | None = None,
) -> dict:
    if client is None:
        from app.services.chesscom_client import ChessComClient

        client = ChessComClient()
    if progress_cb is None:
        progress_cb = lambda done, total: None  # noqa: E731

    cached_row = None
    if db is not None:
        cached_row = db.execute(
            select(AwardScan).where(AwardScan.platform == platform, AwardScan.username == username)
        ).scalar_one_or_none()

    try:
        archives = await client.get_archives(username)
    except httpx.HTTPStatusError as exc:
        raise _translate(exc) from exc

    current_month = current_month or datetime.now(timezone.utc).strftime("%Y/%m")
    watermark = cached_row.archive_watermark if cached_row is not None else None

    if watermark:
        to_scan = [a for a in archives if _month_of(a) > watermark or _month_of(a) == current_month]
    else:
        to_scan = list(archives)
    # Newest first: satisfies "process newest archives first" when the
    # MAX_GAMES ceiling forces an early stop. Order doesn't affect the
    # eventual archive_watermark when nothing is truncated (see below).
    to_scan.sort(key=_month_of, reverse=True)

    features = []
    games_skipped = 0
    completed_months: list[str] = []
    truncated = False
    months_total = len(to_scan)

    for i, archive_url in enumerate(to_scan):
        try:
            games = await client.get_archive_games(archive_url)
        except httpx.HTTPStatusError as exc:
            raise _translate(exc) from exc

        for g in games:
            feat = extract_features(g.get("pgn", ""), username)
            if feat is None:
                games_skipped += 1
                continue
            # The archive JSON's time_class/rules are more reliable than
            # whatever the PGN headers happen to say.
            feat.time_class = g.get("time_class") or feat.time_class
            feat.rules = g.get("rules") or feat.rules
            features.append(feat)

        month = _month_of(archive_url)
        if month != current_month:
            completed_months.append(month)

        progress_cb(i + 1, months_total)

        if len(features) + games_skipped > MAX_GAMES:
            truncated = True
            break

    try:
        stats = await client.get_stats(username)
    except httpx.HTTPStatusError as exc:
        raise _translate(exc) from exc

    opponents = {f.opponent_username.lower() for f in features if f.opponent_username}
    semaphore = asyncio.Semaphore(_COUNTRY_CONCURRENCY)
    await _resolve_countries(client, opponents, semaphore)
    countries = {u: _country_memo[u] for u in opponents if u in _country_memo}

    fresh = aggregate(features, countries, stats)
    if cached_row is not None:
        measurements = merge(cached_row.measurements, fresh)
        games_parsed_total = cached_row.games_parsed + len(features)
    else:
        measurements = fresh
        games_parsed_total = len(features)

    # Never write a watermark on a failed scan: everything above either
    # completed or raised before we get here, so reaching this point means
    # the scan succeeded and it is safe to advance.
    archive_watermark = max(completed_months) if completed_months else watermark

    # Naive UTC, matching AwardScan.scanned_at's plain DateTime column (the
    # convention every other timestamp column in app/models.py already uses).
    now = datetime.utcnow()
    if db is not None:
        if cached_row is not None:
            cached_row.measurements = measurements
            cached_row.archive_watermark = archive_watermark
            cached_row.games_parsed = games_parsed_total
            cached_row.scanned_at = now
        else:
            db.add(
                AwardScan(
                    platform=platform,
                    username=username,
                    measurements=measurements,
                    archive_watermark=archive_watermark,
                    games_parsed=games_parsed_total,
                    scanned_at=now,
                )
            )
        db.commit()

    return {
        "username": username,
        "platform": platform,
        "scanned_at": now.isoformat(),
        "games_parsed": games_parsed_total,
        "games_skipped": games_skipped,
        "truncated": truncated,
        "measurements": measurements,
        "archive_watermark": archive_watermark,
    }
