"""Tests for Tilt & Streak Detection feature."""

from datetime import datetime, timedelta

from app.services.tilt_detector import TiltDetector

from .conftest import make_blunder, make_game, make_move_analysis


class TestStreaks:
    def test_empty_games(self, db):
        detector = TiltDetector(db)
        report = detector.analyze()
        assert report["streaks"]["max_win_streak"] == 0
        assert report["streaks"]["max_loss_streak"] == 0

    def test_win_streak(self, db):
        base = datetime(2025, 6, 1, 10, 0)
        for i in range(5):
            make_game(db, id=f"g{i}", platform_id=f"g{i}", result="win",
                      played_at=base + timedelta(minutes=i * 10))

        detector = TiltDetector(db)
        report = detector.analyze()
        assert report["streaks"]["max_win_streak"] == 5

    def test_loss_streak(self, db):
        base = datetime(2025, 6, 1, 10, 0)
        for i in range(4):
            make_game(db, id=f"g{i}", platform_id=f"g{i}", result="loss",
                      played_at=base + timedelta(minutes=i * 10))

        detector = TiltDetector(db)
        report = detector.analyze()
        assert report["streaks"]["max_loss_streak"] == 4

    def test_mixed_streaks(self, db):
        base = datetime(2025, 6, 1, 10, 0)
        results = ["win", "win", "win", "loss", "loss", "win"]
        for i, r in enumerate(results):
            make_game(db, id=f"g{i}", platform_id=f"g{i}", result=r,
                      played_at=base + timedelta(minutes=i * 10))

        detector = TiltDetector(db)
        report = detector.analyze()
        assert report["streaks"]["max_win_streak"] == 3
        assert report["streaks"]["max_loss_streak"] == 2

    def test_draw_breaks_streak(self, db):
        base = datetime(2025, 6, 1, 10, 0)
        results = ["win", "win", "draw", "win"]
        for i, r in enumerate(results):
            make_game(db, id=f"g{i}", platform_id=f"g{i}", result=r,
                      played_at=base + timedelta(minutes=i * 10))

        detector = TiltDetector(db)
        report = detector.analyze()
        assert report["streaks"]["max_win_streak"] == 2


class TestBlunderByStreak:
    def test_blunder_rate_increases_with_losses(self, db):
        base = datetime(2025, 6, 1, 10, 0)

        # Game 0: no prior losses, good play
        make_game(db, id="g0", platform_id="g0", result="loss",
                  played_at=base)
        make_move_analysis(db, game_id="g0", move_number=0, classification="good")
        make_move_analysis(db, game_id="g0", move_number=2, classification="good")
        make_move_analysis(db, game_id="g0", move_number=4, classification="good")

        # Game 1: after 1 loss, more blunders
        make_game(db, id="g1", platform_id="g1", result="loss",
                  played_at=base + timedelta(minutes=10))
        make_move_analysis(db, game_id="g1", move_number=0, classification="blunder",
                           centipawn_loss=200)
        make_move_analysis(db, game_id="g1", move_number=2, classification="blunder",
                           centipawn_loss=200)
        make_move_analysis(db, game_id="g1", move_number=4, classification="good")

        detector = TiltDetector(db)
        report = detector.analyze()

        data = report["blunder_by_losing_streak"]
        assert "0" in data
        assert "1" in data
        # After 0 losses: 0 blunders out of 3 moves
        assert data["0"]["blunder_rate"] == 0.0
        # After 1 loss: 2 blunders out of 3 moves
        assert data["1"]["blunder_rate"] > 0

    def test_win_resets_streak(self, db):
        base = datetime(2025, 6, 1, 10, 0)

        make_game(db, id="g0", platform_id="g0", result="loss",
                  played_at=base)
        make_move_analysis(db, game_id="g0", move_number=0)

        make_game(db, id="g1", platform_id="g1", result="win",
                  played_at=base + timedelta(minutes=10))
        make_move_analysis(db, game_id="g1", move_number=0)

        # This game should have 0 consecutive losses before it
        make_game(db, id="g2", platform_id="g2", result="loss",
                  played_at=base + timedelta(minutes=20))
        make_move_analysis(db, game_id="g2", move_number=0)

        detector = TiltDetector(db)
        report = detector.analyze()
        data = report["blunder_by_losing_streak"]
        # g0 had 0 prior losses, g1 had 1 prior loss, g2 had 0 (reset by win)
        assert data["0"]["games"] == 2
        assert data["1"]["games"] == 1


class TestSessions:
    def test_session_grouping(self, db):
        base = datetime(2025, 6, 1, 10, 0)

        # Session 1: 3 games within 30 min
        for i in range(3):
            make_game(db, id=f"s1g{i}", platform_id=f"s1g{i}",
                      result="win", played_at=base + timedelta(minutes=i * 10))
            make_move_analysis(db, game_id=f"s1g{i}", move_number=0)

        # Session 2: 2 games, 2 hours later
        for i in range(2):
            make_game(db, id=f"s2g{i}", platform_id=f"s2g{i}",
                      result="loss", played_at=base + timedelta(hours=2, minutes=i * 10))
            make_move_analysis(db, game_id=f"s2g{i}", move_number=0)

        detector = TiltDetector(db)
        report = detector.analyze()

        # Should have 2 sessions (single-game sessions are excluded from summary)
        assert len(report["sessions"]) == 2

    def test_session_rating_change(self, db):
        base = datetime(2025, 6, 1, 10, 0)

        make_game(db, id="g0", platform_id="g0", result="loss",
                  player_rating=1000, played_at=base)
        make_move_analysis(db, game_id="g0", move_number=0)
        make_game(db, id="g1", platform_id="g1", result="loss",
                  player_rating=980, played_at=base + timedelta(minutes=5))
        make_move_analysis(db, game_id="g1", move_number=0)
        make_game(db, id="g2", platform_id="g2", result="loss",
                  player_rating=960, played_at=base + timedelta(minutes=10))
        make_move_analysis(db, game_id="g2", move_number=0)

        detector = TiltDetector(db)
        report = detector.analyze()
        assert report["sessions"][0]["rating_change"] == -40


class TestRatingDrops:
    def test_detects_significant_drops(self, db):
        base = datetime(2025, 6, 1, 10, 0)
        ratings = [1000, 1010, 990, 970, 940]  # Drop of 70 from peak 1010
        for i, rating in enumerate(ratings):
            result = "win" if i == 1 else "loss"
            make_game(db, id=f"g{i}", platform_id=f"g{i}", result=result,
                      player_rating=rating, played_at=base + timedelta(minutes=i * 5))

        detector = TiltDetector(db)
        report = detector.analyze()
        assert len(report["rating_drops"]) == 1
        assert report["rating_drops"][0]["rating_drop"] == 70

    def test_ignores_small_drops(self, db):
        base = datetime(2025, 6, 1, 10, 0)
        ratings = [1000, 990, 980]  # Drop of 20, below threshold
        for i, rating in enumerate(ratings):
            make_game(db, id=f"g{i}", platform_id=f"g{i}", result="loss",
                      player_rating=rating, played_at=base + timedelta(minutes=i * 5))

        detector = TiltDetector(db)
        report = detector.analyze()
        assert len(report["rating_drops"]) == 0


class TestRecommendations:
    def test_generates_recommendations(self, db):
        base = datetime(2025, 6, 1, 10, 0)
        # Create enough data for a recommendation
        for i in range(10):
            result = "loss"
            make_game(db, id=f"g{i}", platform_id=f"g{i}", result=result,
                      player_rating=1000 - i * 10,
                      played_at=base + timedelta(minutes=i * 5))
            make_move_analysis(db, game_id=f"g{i}", move_number=0,
                               classification="blunder", centipawn_loss=200)

        detector = TiltDetector(db)
        report = detector.analyze()
        assert len(report["recommendations"]) > 0


class TestTiltAPI:
    def test_get_tilt_report_empty(self, client):
        resp = client.get("/api/tilt")
        assert resp.status_code == 200
        data = resp.json()
        assert data["streaks"]["max_win_streak"] == 0
        assert data["recommendations"]

    def test_get_tilt_report_with_data(self, client, db):
        base = datetime(2025, 6, 1, 10, 0)
        for i in range(3):
            make_game(db, id=f"g{i}", platform_id=f"g{i}",
                      result="win" if i < 2 else "loss",
                      played_at=base + timedelta(minutes=i * 10))
            make_move_analysis(db, game_id=f"g{i}", move_number=0)

        resp = client.get("/api/tilt")
        assert resp.status_code == 200
        data = resp.json()
        assert data["streaks"]["max_win_streak"] == 2
        assert "blunder_by_losing_streak" in data
