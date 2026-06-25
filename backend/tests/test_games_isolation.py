"""Isolation tests for the games router: auth required + per-user scoping.

These tests establish the canonical per-user query-scoping pattern.
"""

import pytest
from tests.conftest import make_game, make_move_analysis

OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"


# ── Auth gate ─────────────────────────────────────────────────────────────────

def test_games_list_requires_auth(client):
    """Unauthenticated requests to /api/games must return 401."""
    assert client.get("/api/games").status_code == 401


def test_games_detail_requires_auth(client):
    """Unauthenticated requests to /api/games/{id} must return 401."""
    assert client.get("/api/games/any-id").status_code == 401


# ── List isolation ────────────────────────────────────────────────────────────

def test_user_only_sees_own_games(verified_user_client, db):  # noqa: F811
    """GET /api/games returns only games belonging to the authenticated user."""
    me = verified_user_client.get("/api/users/me").json()
    uid = me["id"]

    make_game(db, id="g1", user_id=uid, platform_id="p1")
    make_game(db, id="g2", user_id=OTHER_USER_ID, platform_id="p2")

    r = verified_user_client.get("/api/games")
    assert r.status_code == 200
    ids = [g["id"] for g in r.json()]
    assert ids == ["g1"], f"Expected only own game, got: {ids}"


def test_other_user_games_are_hidden(verified_user_client, db):  # noqa: F811
    """Games owned by another user must not appear in the list."""
    me = verified_user_client.get("/api/users/me").json()
    uid = me["id"]

    # Seed 3 own games and 2 other-user games
    for i in range(3):
        make_game(db, id=f"mine-{i}", user_id=uid, platform_id=f"mine-{i}")
    for i in range(2):
        make_game(db, id=f"other-{i}", user_id=OTHER_USER_ID, platform_id=f"other-{i}")

    r = verified_user_client.get("/api/games")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 3
    for g in data:
        assert g["id"].startswith("mine-")


# ── Detail isolation ──────────────────────────────────────────────────────────

def test_get_own_game_returns_200(verified_user_client, db):  # noqa: F811
    """GET /api/games/{id} returns 200 for a game the user owns."""
    me = verified_user_client.get("/api/users/me").json()
    uid = me["id"]

    make_game(db, id="my-game", user_id=uid, platform_id="my-game")
    r = verified_user_client.get("/api/games/my-game")
    assert r.status_code == 200
    assert r.json()["id"] == "my-game"


def test_get_other_users_game_returns_404(verified_user_client, db):  # noqa: F811
    """GET /api/games/{id} returns 404 for a game owned by another user (no info leak)."""
    make_game(db, id="not-mine", user_id=OTHER_USER_ID, platform_id="not-mine")

    r = verified_user_client.get("/api/games/not-mine")
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_get_nonexistent_game_returns_404(verified_user_client, db):  # noqa: F811
    """GET /api/games/{id} returns 404 for a game that doesn't exist."""
    r = verified_user_client.get("/api/games/does-not-exist")
    assert r.status_code == 404
