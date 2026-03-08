"""Tests for the cross-game pattern detection engine."""

import json

import pytest

from app.services.pattern_engine import PatternEngine
from tests.conftest import make_game, make_move_analysis


class TestPatternEngine:
    def test_empty_database(self, db):
        """Pattern engine should return valid defaults with no data."""
        engine = PatternEngine(db)
        report = engine.generate_report()
        assert report["opening_stats"] == []
        assert report["phase_accuracy"] == {"opening": 0.0, "middlegame": 0.0, "endgame": 0.0}
        assert report["blunder_rate_normal"] == 0.0
        assert report["blunder_rate_time_trouble"] == 0.0
        assert report["endgame_conversion_rate"] == 0.0
        assert report["example_positions"] == []

    def test_opening_stats_aggregation(self, db):
        """Opening stats should count wins/losses/draws per ECO."""
        make_game(db, id="g1", platform_id="g1", result="win", opening_eco="B12")
        make_game(db, id="g2", platform_id="g2", result="loss", opening_eco="B12")
        make_game(db, id="g3", platform_id="g3", result="win", opening_eco="C50")

        engine = PatternEngine(db)
        stats = engine._opening_stats()

        b12 = next(s for s in stats if s["eco"] == "B12")
        assert b12["games"] == 2
        assert b12["wins"] == 1
        assert b12["losses"] == 1

        c50 = next(s for s in stats if s["eco"] == "C50")
        assert c50["games"] == 1
        assert c50["wins"] == 1

    def test_worst_openings_min_3_games(self, db):
        """Worst openings requires minimum 3 games to be included."""
        # B12: 3 games, 0 wins → should appear
        for i in range(3):
            make_game(db, id=f"bad{i}", platform_id=f"bad{i}", result="loss", opening_eco="B12")
        # C50: 2 games → should NOT appear (below threshold)
        for i in range(2):
            make_game(db, id=f"ok{i}", platform_id=f"ok{i}", result="loss", opening_eco="C50")

        engine = PatternEngine(db)
        worst = engine._worst_openings()
        ecos = [o["eco"] for o in worst]
        assert "B12" in ecos
        assert "C50" not in ecos

    def test_phase_accuracy(self, db):
        """Average CPL should be computed per game phase."""
        make_game(db, id="g1", platform_id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening", centipawn_loss=10)
        make_move_analysis(db, game_id="g1", move_number=2, game_phase="opening", centipawn_loss=20)
        make_move_analysis(db, game_id="g1", move_number=4, game_phase="middlegame", centipawn_loss=50)

        engine = PatternEngine(db)
        phase_acc = engine._phase_accuracy()
        assert phase_acc["opening"] == 15.0  # (10+20)/2
        assert phase_acc["middlegame"] == 50.0

    def test_phase_blunder_rate(self, db):
        """Blunder rate = blunders / total moves per phase."""
        make_game(db, id="g1", platform_id="g1")
        # 3 opening moves, 1 is a blunder → 33.33%
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening", classification="good")
        make_move_analysis(db, game_id="g1", move_number=2, game_phase="opening", classification="good")
        make_move_analysis(db, game_id="g1", move_number=4, game_phase="opening", classification="blunder", centipawn_loss=200)

        engine = PatternEngine(db)
        rates = engine._phase_blunder_rate()
        assert rates["opening"] == pytest.approx(33.33, abs=0.01)

    def test_missed_tactics_counting(self, db):
        """Should count each tactical motif occurrence across all games."""
        make_game(db, id="g1", platform_id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, tactical_motifs=["fork", "pin"], classification="blunder", centipawn_loss=200)
        make_move_analysis(db, game_id="g1", move_number=2, tactical_motifs=["fork"], classification="blunder", centipawn_loss=180)

        engine = PatternEngine(db)
        tactics = engine._missed_tactics()
        assert tactics["fork"] == 2
        assert tactics["pin"] == 1

    def test_time_trouble_blunder_rate(self, db):
        """Blunder rate should differ between normal time and time trouble."""
        make_game(db, id="g1", platform_id="g1")
        # Normal time (>=60s): 2 moves, 0 blunders
        make_move_analysis(db, game_id="g1", move_number=0, time_remaining=300, classification="good")
        make_move_analysis(db, game_id="g1", move_number=2, time_remaining=200, classification="good")
        # Time trouble (<60s): 2 moves, 1 blunder → 50%
        make_move_analysis(db, game_id="g1", move_number=4, time_remaining=30, classification="good")
        make_move_analysis(db, game_id="g1", move_number=6, time_remaining=15, classification="blunder", centipawn_loss=200)

        engine = PatternEngine(db)
        assert engine._blunder_rate_by_time(trouble=False) == 0.0
        assert engine._blunder_rate_by_time(trouble=True) == 50.0

    def test_color_stats(self, db):
        """White vs black win rate and CPL."""
        make_game(db, id="w1", platform_id="w1", player_color="white", result="win")
        make_game(db, id="w2", platform_id="w2", player_color="white", result="loss")
        make_game(db, id="b1", platform_id="b1", player_color="black", result="win")

        engine = PatternEngine(db)
        white = engine._color_stats("white")
        assert white["win_rate"] == 50.0
        assert white["games"] == 2

        black = engine._color_stats("black")
        assert black["win_rate"] == 100.0
        assert black["games"] == 1

    def test_color_stats_empty(self, db):
        engine = PatternEngine(db)
        stats = engine._color_stats("white")
        assert stats == {"win_rate": 0, "avg_cpl": 0, "games": 0}

    def test_endgame_conversion(self, db):
        """Should track % of winning endgame positions actually converted to wins."""
        # Game 1: had advantage in endgame, won → converted
        make_game(db, id="g1", platform_id="g1", result="win")
        make_move_analysis(db, game_id="g1", move_number=40, game_phase="endgame", eval_before=300, classification="good")

        # Game 2: had advantage in endgame, lost → not converted
        make_game(db, id="g2", platform_id="g2", result="loss")
        make_move_analysis(db, game_id="g2", move_number=42, game_phase="endgame", eval_before=250, classification="blunder", centipawn_loss=400)

        engine = PatternEngine(db)
        rate = engine._endgame_conversion()
        assert rate == 50.0  # 1/2 converted

    def test_blunder_by_move_bucket(self, db):
        """Blunders should be bucketed by move number ranges."""
        make_game(db, id="g1", platform_id="g1")
        # Bucket "1-10" (ply 0-19): 2 moves, 1 blunder
        make_move_analysis(db, game_id="g1", move_number=5, classification="good")
        make_move_analysis(db, game_id="g1", move_number=10, classification="blunder", centipawn_loss=200)
        # Bucket "21-30" (ply 40-59): 1 move, 0 blunders
        make_move_analysis(db, game_id="g1", move_number=45, classification="good")

        engine = PatternEngine(db)
        buckets = engine._blunder_by_move_bucket()
        assert buckets["1-10"] == 50.0
        assert buckets["21-30"] == 0.0

    def test_worst_blunders_ordered_by_cpl(self, db):
        """Example positions should be sorted by centipawn loss descending."""
        make_game(db, id="g1", platform_id="g1")
        make_move_analysis(db, game_id="g1", move_number=0, classification="blunder", centipawn_loss=200)
        make_move_analysis(db, game_id="g1", move_number=2, classification="blunder", centipawn_loss=500)
        make_move_analysis(db, game_id="g1", move_number=4, classification="blunder", centipawn_loss=300)

        engine = PatternEngine(db)
        examples = engine._worst_blunders()
        cpls = [e["centipawn_loss"] for e in examples]
        assert cpls == sorted(cpls, reverse=True)
        assert cpls[0] == 500

    def test_full_report_structure(self, db):
        """generate_report() should return all expected keys."""
        engine = PatternEngine(db)
        report = engine.generate_report()
        expected_keys = {
            "opening_stats", "worst_openings", "phase_accuracy",
            "phase_blunder_rate", "missed_tactics", "blunder_rate_normal",
            "blunder_rate_time_trouble", "white_stats", "black_stats",
            "endgame_conversion_rate", "blunder_by_move_bucket", "example_positions",
        }
        assert set(report.keys()) == expected_keys
