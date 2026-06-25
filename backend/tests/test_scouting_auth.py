"""Task 12: Auth + tenant-isolation tests for the scouting endpoint."""

from datetime import datetime
from unittest.mock import patch
from uuid import UUID

import pytest

from app.services.scouting_service import ScoutingService

from .conftest import TEST_USER_ID, make_game

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

OTHER_USER_ID = "00000000-0000-0000-0000-000000000002"


def _opp_game(eco="B20", name="Sicilian Defense", color="black", result="win"):
    return {
        "platform": "chesscom",
        "platform_id": f"opp_{eco}_{color}_{result}",
        "pgn": "",
        "white_username": "opponent" if color == "black" else "me",
        "black_username": "me" if color == "black" else "opponent",
        "player_color": color,
        "time_class": "blitz",
        "time_control": "300",
        "result": result,
        "result_detail": result,
        "player_rating": 1500,
        "opponent_rating": 1400,
        "opening_eco": eco,
        "opening_name": name,
        "num_moves": 30,
        "played_at": datetime(2025, 6, 15, 12, 0),
        "platform_accuracy": None,
    }


# ---------------------------------------------------------------------------
# 1. Auth requirement
# ---------------------------------------------------------------------------

class TestScoutingRequiresAuth:
    """Unauthenticated requests must be rejected with 401."""

    def test_scouting_requires_auth(self, client):
        """POST /api/scouting/scout without a session cookie → 401."""
        resp = client.post("/api/scouting/scout", json={
            "opponent_username": "someuser",
            "platform": "chesscom",
        })
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 2. Auth allows access
# ---------------------------------------------------------------------------

class TestScoutingAllowsAuthedUser:
    """Authenticated requests should succeed (200) when mocked."""

    @patch("app.services.scouting_service.ChessComClient.fetch_recent_games")
    def test_scout_succeeds_for_authed_user(self, mock_fetch, verified_user_client):
        mock_fetch.return_value = [
            _opp_game(eco="B20", name="Sicilian", color="black", result="win"),
        ]
        resp = verified_user_client.post("/api/scouting/scout", json={
            "opponent_username": "anyopponent",
            "platform": "chesscom",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["opponent"]["username"] == "anyopponent"


# ---------------------------------------------------------------------------
# 3. Cross-reference isolation — service layer
# ---------------------------------------------------------------------------

class TestCrossReferenceIsolation:
    """Cross-reference queries must be scoped to the requesting user.

    A game belonging to *another* user (same opening ECO, same DB) must NOT
    appear in the authed user's cross-reference results.
    """

    def test_cross_reference_scoped_to_user(self, db):
        """Seed two users' games with B20; only the requesting user's games count."""
        # Games for the authed user (user A)
        make_game(db, id="ua1", platform_id="ua1", user_id=TEST_USER_ID, opening_eco="B20", result="win")
        make_game(db, id="ua2", platform_id="ua2", user_id=TEST_USER_ID, opening_eco="B20", result="loss")

        # Games for another user (user B) — same opening
        make_game(db, id="ub1", platform_id="ub1", user_id=OTHER_USER_ID, opening_eco="B20", result="win")
        make_game(db, id="ub2", platform_id="ub2", user_id=OTHER_USER_ID, opening_eco="B20", result="win")
        make_game(db, id="ub3", platform_id="ub3", user_id=OTHER_USER_ID, opening_eco="B20", result="win")

        # Service scoped to user A
        service = ScoutingService(db, user_id=UUID(TEST_USER_ID))
        opp_openings = [{"eco": "B20", "name": "Sicilian", "frequency_pct": 60.0}]
        xref = service._cross_reference(opp_openings)

        assert len(xref) == 1
        entry = xref[0]
        # Should see 2 games (user A's), NOT 5 (user A's + user B's)
        assert entry["your_games"] == 2, (
            f"Expected 2 games for user A, got {entry['your_games']} "
            f"(cross-reference leaked other user's games)"
        )
        # Win rate: 1/2 = 50%
        assert entry["your_win_rate"] == pytest.approx(50.0, abs=0.1)

    def test_cross_reference_other_user_sees_own_games(self, db):
        """The other user's service instance sees only their own games."""
        # User A: 1 win
        make_game(db, id="ua1", platform_id="ua1", user_id=TEST_USER_ID, opening_eco="C50", result="win")

        # User B: 3 wins
        make_game(db, id="ub1", platform_id="ub1", user_id=OTHER_USER_ID, opening_eco="C50", result="win")
        make_game(db, id="ub2", platform_id="ub2", user_id=OTHER_USER_ID, opening_eco="C50", result="win")
        make_game(db, id="ub3", platform_id="ub3", user_id=OTHER_USER_ID, opening_eco="C50", result="win")

        service_b = ScoutingService(db, user_id=UUID(OTHER_USER_ID))
        opp_openings = [{"eco": "C50", "name": "Italian", "frequency_pct": 40.0}]
        xref = service_b._cross_reference(opp_openings)

        assert xref[0]["your_games"] == 3
        assert xref[0]["your_win_rate"] == pytest.approx(100.0, abs=0.1)

    def test_service_requires_user_id(self, db):
        """ScoutingService must raise ValueError when user_id is None (fail-closed)."""
        with pytest.raises(ValueError, match="user_id is required"):
            ScoutingService(db, user_id=None)
