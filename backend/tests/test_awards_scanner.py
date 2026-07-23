import pathlib

import pytest

from app.services.awards import scanner

FIX = pathlib.Path(__file__).parent / "fixtures" / "awards"
QUEEN_MATE_PGN = (FIX / "mate_by_queen.pgn").read_text()


@pytest.fixture(autouse=True)
def _reset_country_memo():
    """The opponent-country memo is intentionally process-global in
    production (fetch a popular opponent's country once, reuse it across
    every scan). That persistence makes tests order-dependent unless reset
    between them, since the module is imported once per test session."""
    scanner._country_memo.clear()
    yield
    scanner._country_memo.clear()


class FakeClient:
    def __init__(self, archives, games, stats, countries):
        self.archives, self.games, self.stats, self.countries = archives, games, stats, countries
        self.fetched = []

    async def get_archives(self, u):
        return self.archives

    async def get_archive_games(self, url):
        self.fetched.append(url)
        return self.games.get(url, [])

    async def get_stats(self, u):
        return self.stats

    async def get_player(self, u):
        return {"country": f"https://api.chess.com/pub/country/{self.countries.get(u.lower(), 'US')}"}


@pytest.mark.asyncio
async def test_scan_parses_games_and_returns_measurements():
    url = "https://api.chess.com/pub/player/alice/games/2026/06"
    client = FakeClient([url], {url: [{"pgn": QUEEN_MATE_PGN, "time_class": "blitz", "rules": "chess"}]},
                        {}, {"bob": "IN"})
    out = await scanner.run_scan("chesscom", "alice", db=None, client=client)
    assert out["games_parsed"] == 1
    assert out["measurements"]["mates_by_piece"]["queen"] == 1
    assert out["measurements"]["countries_played"] == ["IN"]


@pytest.mark.asyncio
async def test_unparseable_games_are_skipped_not_fatal():
    url = "https://api.chess.com/pub/player/alice/games/2026/06"
    client = FakeClient([url], {url: [{"pgn": "garbage {{{", "time_class": "blitz", "rules": "chess"}]}, {}, {})
    out = await scanner.run_scan("chesscom", "alice", db=None, client=client)
    assert out["games_skipped"] == 1
    assert out["games_parsed"] == 0


@pytest.mark.asyncio
async def test_opponent_countries_are_fetched_once_per_distinct_opponent():
    url = "https://api.chess.com/pub/player/alice/games/2026/06"
    games = [{"pgn": QUEEN_MATE_PGN, "time_class": "blitz", "rules": "chess"}] * 5
    client = FakeClient([url], {url: games}, {}, {"bob": "IN"})
    calls = []
    orig = client.get_player

    async def counting(u):
        calls.append(u); return await orig(u)

    client.get_player = counting
    await scanner.run_scan("chesscom", "alice", db=None, client=client)
    assert len(calls) == 1, "opponent country lookups must be memoised"


@pytest.mark.asyncio
async def test_watermark_excludes_the_current_month():
    """The current month is still accumulating games, so it is always rescanned."""
    urls = [f"https://api.chess.com/pub/player/alice/games/2026/0{m}" for m in (5, 6)]
    client = FakeClient(urls, {u: [] for u in urls}, {}, {})
    out = await scanner.run_scan("chesscom", "alice", db=None, client=client, current_month="2026/06")
    assert out["archive_watermark"] == "2026/05"
