import pytest

# NOTE: this file deliberately uses the `client`/`db` fixtures from conftest.py
# (in-memory SQLite, via app.dependency_overrides[get_db]) rather than a
# module-level `TestClient(app)`. A bare `TestClient(app)` leaves `get_db`
# wired to the real `settings.database_url`, so every POST here would hit a
# real database. Worse, `start_scan` fires `asyncio.create_task(_run(...))`
# fire-and-forget, and `_run` calls `run_scan(..., client=None)` — which
# builds a real `ChessComClient()` and scans the live Chess.com API for
# whatever username the test posts. `test_scan_endpoint_requires_no_authentication`
# used to do exactly that for "alice" on every test run. `client`/`db` fixes
# the DB half; monkeypatching `run_scan` fixes the network half.


def test_scan_endpoint_requires_no_authentication(client, monkeypatch):
    """The public contract under test: no Authorization header, no cookies —
    and the request still succeeds (202), rather than being bounced with 401
    or 403. `run_scan` is monkeypatched purely so the fire-and-forget
    background task it triggers doesn't reach the real Chess.com API; the
    auth assertion itself is untouched and still fails if the router ever
    grows an auth dependency.
    """
    async def fake_run_scan(platform, username, db=None, progress_cb=None, **kwargs):
        if progress_cb:
            progress_cb(1, 1)
        return {
            "username": username,
            "platform": platform,
            "scanned_at": "2026-01-01T00:00:00+00:00",
            "games_parsed": 0,
            "games_skipped": 0,
            "truncated": False,
            "measurements": {},
        }

    monkeypatch.setattr("app.routers.awards.run_scan", fake_run_scan)

    r = client.post("/api/awards/scan", json={"platform": "chesscom", "username": "alice"})
    assert r.status_code == 202, r.text
    assert r.status_code != 401 and r.status_code != 403
    assert "job_id" in r.json()


@pytest.mark.parametrize("bad", ["ab", "a" * 26, "bad user", "drop;table", "../etc"])
def test_invalid_usernames_are_rejected_before_any_outbound_call(client, bad):
    r = client.post("/api/awards/scan", json={"platform": "chesscom", "username": bad})
    assert r.status_code == 422


def test_unknown_job_id_returns_404(client):
    assert client.get("/api/awards/scan/00000000-0000-0000-0000-000000000000").status_code == 404


def test_router_does_not_depend_on_auth():
    import app.routers.awards as mod
    src = open(mod.__file__).read()
    assert "current_verified_user" not in src, "the awards router must stay public"
