"""Task 9c: Auth isolation tests for puzzles + time-management routers."""

import pytest

from app.models import PuzzleProgress
from app.services.puzzle_service import PuzzleService
from tests.conftest import TEST_USER_ID, make_blunder, make_game, make_move_analysis

OTHER_USER_ID = "00000000-0000-0000-0000-000000000099"

ENDPOINTS = [
    "/api/time-management",
    "/api/puzzles/next",
    "/api/puzzles/stats",
]


@pytest.mark.parametrize("ep", ENDPOINTS)
def test_requires_auth(client, ep):
    """Each endpoint must return 401 for unauthenticated requests."""
    assert client.get(ep).status_code == 401


def test_submit_requires_auth(client):
    """POST /api/puzzles/{id}/submit must return 401 for unauthenticated requests."""
    resp = client.post("/api/puzzles/1/submit", json={"move_uci": "e2e4"})
    assert resp.status_code == 401


# ── Puzzle isolation ─────────────────────────────────────────────────────────


class TestPuzzleIsolation:
    """Prove that puzzle endpoints only surface the authenticated user's puzzles."""

    def test_next_puzzle_excludes_other_user(self, verified_user_client, db):
        """Authed user sees no puzzles if all blunders belong to another user."""
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Other user has blunders
        make_game(db, id="other_g1", platform_id="other_g1", user_id=OTHER_USER_ID)
        make_blunder(db, game_id="other_g1", move_number=0, centipawn_loss=500)
        # Pre-populate PuzzleProgress for other user via service
        PuzzleService(db, user_id=OTHER_USER_ID).ensure_puzzles_exist()

        # Authed user has no games/blunders
        resp = verified_user_client.get("/api/puzzles/next")
        assert resp.status_code == 200
        assert resp.json() is None  # must not surface other user's puzzle

    def test_stats_excludes_other_user(self, verified_user_client, db):
        """Puzzle stats must count only the authed user's PuzzleProgress rows."""
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Other user: 3 blunders -> 3 puzzles
        make_game(db, id="og1", platform_id="og1", user_id=OTHER_USER_ID)
        make_blunder(db, game_id="og1", move_number=0, centipawn_loss=200)
        make_blunder(db, game_id="og1", move_number=2, centipawn_loss=300)
        make_blunder(db, game_id="og1", move_number=4, centipawn_loss=400)
        PuzzleService(db, user_id=OTHER_USER_ID).ensure_puzzles_exist()

        # Authed user: 1 blunder -> 1 puzzle
        make_game(db, id="ug1", platform_id="ug1", user_id=uid)
        make_blunder(db, game_id="ug1", move_number=0, centipawn_loss=150)

        resp = verified_user_client.get("/api/puzzles/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_puzzles"] == 1  # only authed user's puzzle

    def test_submit_cannot_target_other_user_puzzle(self, verified_user_client, db):
        """A user cannot submit against another user's puzzle_id (expect 404)."""
        # Other user seeds a puzzle
        make_game(db, id="og1", platform_id="og1", user_id=OTHER_USER_ID)
        make_blunder(db, game_id="og1", move_number=0, centipawn_loss=300, best_move_uci="d2d4")
        PuzzleService(db, user_id=OTHER_USER_ID).ensure_puzzles_exist()

        other_puzzle = db.query(PuzzleProgress).filter(PuzzleProgress.user_id == OTHER_USER_ID).first()
        assert other_puzzle is not None, "Test setup: other user's puzzle must exist"
        other_puzzle_id = other_puzzle.id
        original_attempts = other_puzzle.attempts

        # Authed user tries to submit against the other user's puzzle
        resp = verified_user_client.post(
            f"/api/puzzles/{other_puzzle_id}/submit",
            json={"move_uci": "d2d4"},
        )
        assert resp.status_code == 404

        # Other user's PuzzleProgress must be unchanged
        db.refresh(other_puzzle)
        assert other_puzzle.attempts == original_attempts, "Other user's puzzle state must not be mutated"


# ── Time-management isolation ────────────────────────────────────────────────


class TestTimeManagementIsolation:
    """Prove that /api/time-management only reflects the authenticated user's games."""

    def test_time_management_excludes_other_user_games(self, verified_user_client, db):
        """games_with_clock_data must count only the authed user's analyzed games."""
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Authed user: 1 game with clock data
        make_game(db, id="ug1", platform_id="ug1", user_id=uid)
        make_move_analysis(db, game_id="ug1", move_number=0, time_remaining=300)
        make_move_analysis(db, game_id="ug1", move_number=2, time_remaining=285)

        # Other user: 5 games with clock data (must not appear in authed user's profile)
        make_game(db, id="og1", platform_id="og1", user_id=OTHER_USER_ID)
        make_move_analysis(db, game_id="og1", move_number=0, time_remaining=600)
        make_move_analysis(db, game_id="og1", move_number=2, time_remaining=580)
        make_game(db, id="og2", platform_id="og2", user_id=OTHER_USER_ID)
        make_move_analysis(db, game_id="og2", move_number=0, time_remaining=400)
        make_move_analysis(db, game_id="og2", move_number=2, time_remaining=380)

        resp = verified_user_client.get("/api/time-management")
        assert resp.status_code == 200
        data = resp.json()

        # Must see exactly 1 game (authed user's), not 3
        assert data["games_with_clock_data"] == 1

    def test_time_trouble_stats_scoped_to_user(self, verified_user_client, db):
        """Time trouble stats must not count moves from other users' games."""
        uid = verified_user_client.get("/api/users/me").json()["id"]

        # Authed user: 1 move in normal zone (60-180s), no blunders
        make_game(db, id="ug1", platform_id="ug1", user_id=uid)
        make_move_analysis(db, game_id="ug1", move_number=0, time_remaining=120, classification="good", centipawn_loss=5)

        # Other user: 10 moves in critical zone with blunders
        make_game(db, id="og1", platform_id="og1", user_id=OTHER_USER_ID)
        for i in range(10):
            make_move_analysis(
                db, game_id="og1", move_number=i * 2, time_remaining=20,
                classification="blunder", centipawn_loss=300,
            )

        resp = verified_user_client.get("/api/time-management")
        assert resp.status_code == 200
        stats = resp.json()["time_trouble_stats"]

        # Authed user should have 0 critical moves, not 10
        assert stats["critical"]["moves"] == 0
        assert stats["normal"]["moves"] == 1
