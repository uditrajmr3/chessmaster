"""Task 9b: Auth isolation tests for openings/endgame/digest/peer-comparison/export/opening-book routers."""

import pytest

from tests.conftest import make_game

ENDPOINTS = [
    "/api/openings/tree",
    "/api/endgame",
    "/api/digest",
    "/api/peer-comparison",
    "/api/export/summary",
    "/api/export/games/csv",
    "/api/export/games/json",
    "/api/export/analysis/csv",
    "/api/opening-book",
]


@pytest.mark.parametrize("ep", ENDPOINTS)
def test_requires_auth(client, ep):
    """Each endpoint must return 401 for unauthenticated requests."""
    assert client.get(ep).status_code == 401


class TestOpeningsIsolation:
    """Prove that /api/openings/tree only shows the authenticated user's games."""

    def test_openings_only_shows_authed_user_games(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Authed user: 1 game with B12
        make_game(db, id="u1g1", platform_id="u1g1", opening_eco="B12",
                  opening_name="Caro-Kann", user_id=uid)

        # Another user: 2 games with E04
        other_uid = "00000000-0000-0000-0000-000000000099"
        make_game(db, id="u2g1", platform_id="u2g1", opening_eco="E04",
                  opening_name="Catalan", user_id=other_uid)
        make_game(db, id="u2g2", platform_id="u2g2", opening_eco="E04",
                  opening_name="Catalan", user_id=other_uid)

        resp = verified_user_client.get("/api/openings/tree")
        assert resp.status_code == 200
        data = resp.json()

        ecos = [o["eco"] for o in data]
        assert "B12" in ecos
        assert "E04" not in ecos
        b12 = next(o for o in data if o["eco"] == "B12")
        assert b12["games"] == 1


class TestExportIsolation:
    """Prove that /api/export/summary only shows the authenticated user's games."""

    def test_export_summary_only_shows_authed_user_games(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Authed user: 2 games
        make_game(db, id="u1g1", platform_id="u1g1", result="win", user_id=uid)
        make_game(db, id="u1g2", platform_id="u1g2", result="loss", user_id=uid)

        # Another user: 5 games (should not appear)
        other_uid = "00000000-0000-0000-0000-000000000099"
        for i in range(5):
            make_game(db, id=f"u2g{i}", platform_id=f"u2g{i}",
                      result="win", user_id=other_uid)

        resp = verified_user_client.get("/api/export/summary")
        assert resp.status_code == 200
        data = resp.json()

        assert data["total_games"] == 2
        assert data["wins"] == 1
        assert data["losses"] == 1
