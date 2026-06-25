"""Task 9a: Auth isolation tests for stats, patterns, tilt, rating-predictor routers."""

import pytest

from tests.conftest import make_game

ENDPOINTS = [
    "/api/stats/overview",
    "/api/patterns",
    "/api/tilt",
    "/api/rating-predictor",
]


@pytest.mark.parametrize("ep", ENDPOINTS)
def test_requires_auth(client, ep):
    """Each endpoint must return 401 for unauthenticated requests."""
    assert client.get(ep).status_code == 401


class TestStatsIsolation:
    """Prove that /api/stats/overview only counts the authenticated user's games."""

    def test_stats_only_shows_authed_user_games(self, verified_user_client, db):
        # Get the authenticated user's id
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Seed 2 games for the authed user
        make_game(db, id="u1g1", platform_id="u1g1", result="win", user_id=uid)
        make_game(db, id="u1g2", platform_id="u1g2", result="loss", user_id=uid)

        # Seed 3 games for a different (non-existent) user
        other_uid = "00000000-0000-0000-0000-000000000099"
        make_game(db, id="u2g1", platform_id="u2g1", result="win", user_id=other_uid)
        make_game(db, id="u2g2", platform_id="u2g2", result="win", user_id=other_uid)
        make_game(db, id="u2g3", platform_id="u2g3", result="win", user_id=other_uid)

        resp = verified_user_client.get("/api/stats/overview")
        assert resp.status_code == 200
        data = resp.json()

        # Must see only the authed user's 2 games, not the other user's 3
        assert data["total_games"] == 2
        assert data["wins"] == 1
        assert data["losses"] == 1

    def test_patterns_only_shows_authed_user_games(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Authed user: 1 game
        make_game(db, id="pg1", platform_id="pg1", result="win", user_id=uid,
                  opening_eco="B12", opening_name="Caro-Kann")

        # Other user: 2 games with different openings
        other_uid = "00000000-0000-0000-0000-000000000099"
        make_game(db, id="pg2", platform_id="pg2", result="win", user_id=other_uid,
                  opening_eco="E04", opening_name="Catalan")
        make_game(db, id="pg3", platform_id="pg3", result="win", user_id=other_uid,
                  opening_eco="E04", opening_name="Catalan")

        resp = verified_user_client.get("/api/patterns")
        assert resp.status_code == 200
        data = resp.json()

        # Should only see the authed user's 1 opening (B12)
        ecos = [o["eco"] for o in data["opening_stats"]]
        assert "B12" in ecos
        assert "E04" not in ecos

    def test_tilt_only_shows_authed_user_games(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Authed user: 3 win games
        from datetime import datetime, timedelta
        base = datetime(2025, 6, 1, 10, 0)
        for i in range(3):
            make_game(db, id=f"tg{i}", platform_id=f"tg{i}", result="win",
                      user_id=uid, played_at=base + timedelta(minutes=i * 10))

        # Other user: 10 loss games → would create large loss streak
        other_uid = "00000000-0000-0000-0000-000000000099"
        for i in range(10):
            make_game(db, id=f"tg_other{i}", platform_id=f"tg_other{i}",
                      result="loss", user_id=other_uid,
                      played_at=base + timedelta(minutes=100 + i * 10))

        resp = verified_user_client.get("/api/tilt")
        assert resp.status_code == 200
        data = resp.json()

        # Should reflect authed user's wins, not the other user's 10-loss streak
        assert data["streaks"]["max_win_streak"] == 3
        assert data["streaks"]["max_loss_streak"] == 0

    def test_rating_predictor_only_shows_authed_user_games(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]

        from datetime import datetime, timedelta
        base = datetime(2025, 1, 1)

        # Authed user: 6 games starting at rating 1000
        for i in range(6):
            make_game(db, id=f"rp{i}", platform_id=f"rp{i}",
                      player_rating=1000 + i * 10,
                      played_at=base + timedelta(days=i * 5),
                      result="win", user_id=uid)

        # Other user: 6 games starting at rating 2000
        other_uid = "00000000-0000-0000-0000-000000000099"
        for i in range(6):
            make_game(db, id=f"rp_other{i}", platform_id=f"rp_other{i}",
                      player_rating=2000 + i * 10,
                      played_at=base + timedelta(days=i * 5),
                      result="win", user_id=other_uid)

        resp = verified_user_client.get("/api/rating-predictor")
        assert resp.status_code == 200
        data = resp.json()

        # Should see authed user's starting rating of 1000, not other user's 2000
        assert data["trajectory"]["starting_rating"] == 1000
        assert data["trajectory"]["current_rating"] == 1050
