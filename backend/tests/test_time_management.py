"""Tests for the Time Management Profile feature."""

import pytest

from app.services.time_management_service import TimeManagementService
from tests.conftest import make_game, make_move_analysis


# ── Service Tests ────────────────────────────────────────────────────────────


class TestTimeManagementService:

    def test_empty_db_returns_zero_games(self, db):
        service = TimeManagementService(db)
        profile = service.get_profile()
        assert profile["games_with_clock_data"] == 0

    def test_games_with_clock_data_count(self, db):
        make_game(db, id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=300)
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=280)

        make_game(db, id="g2", platform_id="t2")
        make_move_analysis(db, game_id="g2", move_number=0, time_remaining=600)

        service = TimeManagementService(db)
        assert service.get_profile()["games_with_clock_data"] == 2

    def test_games_without_clock_data_not_counted(self, db):
        make_game(db, id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=None)

        service = TimeManagementService(db)
        assert service.get_profile()["games_with_clock_data"] == 0

    def test_time_per_move_by_phase(self, db):
        make_game(db, id="g1")
        # Opening moves: 300 -> 290 -> 275 (spent 10, 15)
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening", time_remaining=300)
        make_move_analysis(db, game_id="g1", move_number=2, game_phase="opening", time_remaining=290)
        make_move_analysis(db, game_id="g1", move_number=4, game_phase="opening", time_remaining=275)

        service = TimeManagementService(db)
        phase = service.get_profile()["time_per_move_by_phase"]
        assert phase["opening"] == 12.5  # avg of 10, 15
        assert phase["middlegame"] == 0.0
        assert phase["endgame"] == 0.0

    def test_time_trouble_stats_zones(self, db):
        make_game(db, id="g1")
        # Critical zone: <30s
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=20, classification="blunder", centipawn_loss=200)
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=15, classification="good", centipawn_loss=5)
        # Normal zone: 60-180s
        make_move_analysis(db, game_id="g1", move_number=4, time_remaining=120, classification="good", centipawn_loss=5)

        service = TimeManagementService(db)
        stats = service.get_profile()["time_trouble_stats"]

        assert stats["critical"]["moves"] == 2
        assert stats["critical"]["blunder_rate"] == 50.0  # 1 blunder out of 2
        assert stats["normal"]["moves"] == 1
        assert stats["normal"]["blunder_rate"] == 0.0

    def test_time_vs_move_number(self, db):
        make_game(db, id="g1")
        # Ply 0 = move 1, ply 2 = move 2, ply 4 = move 3
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=300, centipawn_loss=5)
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=290, centipawn_loss=10)
        make_move_analysis(db, game_id="g1", move_number=4, time_remaining=275, centipawn_loss=20)

        service = TimeManagementService(db)
        data = service.get_profile()["time_vs_move_number"]

        # First move is skipped (can't compute time), so we get move 2 and 3
        move_nums = [d["move"] for d in data]
        assert 2 in move_nums
        assert 3 in move_nums

    def test_avg_time_by_classification(self, db):
        make_game(db, id="g1")
        # Good moves: 300 -> 290 (10s), 290 -> 280 (10s)
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=300, classification="good")
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=290, classification="good")
        make_move_analysis(db, game_id="g1", move_number=4, time_remaining=280, classification="blunder", centipawn_loss=200)

        service = TimeManagementService(db)
        by_class = service.get_profile()["avg_time_by_classification"]
        assert by_class["good"] == 10.0  # 10s for the second good move
        assert by_class["blunder"] == 10.0

    def test_time_class_breakdown(self, db):
        make_game(db, id="g1", time_class="rapid")
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=600)
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=580)

        make_game(db, id="g2", platform_id="t2", time_class="blitz")
        make_move_analysis(db, game_id="g2", move_number=0, time_remaining=180)
        make_move_analysis(db, game_id="g2", move_number=2, time_remaining=170)

        service = TimeManagementService(db)
        breakdown = service.get_profile()["time_class_breakdown"]
        tc_names = [b["time_class"] for b in breakdown]
        assert "rapid" in tc_names
        assert "blitz" in tc_names

    def test_overthink_moves_detected(self, db):
        make_game(db, id="g1")
        # Opening move with good accuracy but 20s spent (>15s threshold)
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening", time_remaining=300, centipawn_loss=0)
        make_move_analysis(db, game_id="g1", move_number=2, game_phase="opening", time_remaining=280, centipawn_loss=5)

        service = TimeManagementService(db)
        overthinks = service.get_profile()["overthink_moves"]
        assert len(overthinks) == 1
        assert overthinks[0]["time_spent"] == 20.0

    def test_overthink_not_triggered_for_fast_moves(self, db):
        make_game(db, id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening", time_remaining=300, centipawn_loss=0)
        make_move_analysis(db, game_id="g1", move_number=2, game_phase="opening", time_remaining=295, centipawn_loss=5)

        service = TimeManagementService(db)
        overthinks = service.get_profile()["overthink_moves"]
        assert len(overthinks) == 0

    def test_underthink_blunders_detected(self, db):
        make_game(db, id="g1")
        # Blunder played in 3s (<5s threshold)
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=300, classification="good", centipawn_loss=5)
        make_move_analysis(
            db, game_id="g1", move_number=2, time_remaining=297,
            classification="blunder", centipawn_loss=250,
            eval_before=150, eval_after=-100,
        )

        service = TimeManagementService(db)
        underthinks = service.get_profile()["underthink_blunders"]
        assert len(underthinks) == 1
        assert underthinks[0]["time_spent"] == 3.0
        assert underthinks[0]["cpl"] == 250

    def test_underthink_not_triggered_for_slow_blunders(self, db):
        make_game(db, id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=300, classification="good", centipawn_loss=5)
        make_move_analysis(
            db, game_id="g1", move_number=2, time_remaining=280,
            classification="blunder", centipawn_loss=250,
        )

        service = TimeManagementService(db)
        underthinks = service.get_profile()["underthink_blunders"]
        assert len(underthinks) == 0  # 20s is not "rushed"

    def test_time_trouble_pct_in_breakdown(self, db):
        make_game(db, id="g1", time_class="blitz")
        # 2 moves in time trouble (<30s), 1 comfortable
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=20)
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=15)
        make_move_analysis(db, game_id="g1", move_number=4, time_remaining=120)

        service = TimeManagementService(db)
        breakdown = service.get_profile()["time_class_breakdown"]
        blitz = next(b for b in breakdown if b["time_class"] == "blitz")
        # 2 out of 3 moves in time trouble
        assert blitz["time_trouble_pct"] == pytest.approx(66.7, abs=0.1)

    def test_profile_structure(self, db):
        """Verify the full profile has all expected keys."""
        service = TimeManagementService(db)
        profile = service.get_profile()
        expected_keys = {
            "time_per_move_by_phase",
            "time_vs_move_number",
            "time_trouble_stats",
            "overthink_moves",
            "underthink_blunders",
            "avg_time_by_classification",
            "time_class_breakdown",
            "games_with_clock_data",
        }
        assert set(profile.keys()) == expected_keys


# ── API Endpoint Tests ───────────────────────────────────────────────────────


class TestTimeManagementAPI:

    def test_get_time_management_empty(self, client):
        resp = client.get("/api/time-management")
        assert resp.status_code == 200
        data = resp.json()
        assert data["games_with_clock_data"] == 0

    def test_get_time_management_with_data(self, client, db):
        make_game(db, id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=300)
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=285)

        resp = client.get("/api/time-management")
        assert resp.status_code == 200
        data = resp.json()
        assert data["games_with_clock_data"] == 1
        assert "time_per_move_by_phase" in data
        assert "time_trouble_stats" in data

    def test_time_trouble_stats_in_response(self, client, db):
        make_game(db, id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=20, classification="blunder", centipawn_loss=200)
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=120, classification="good", centipawn_loss=5)

        resp = client.get("/api/time-management")
        data = resp.json()
        stats = data["time_trouble_stats"]
        assert "critical" in stats
        assert "normal" in stats
        assert stats["critical"]["moves"] == 1
