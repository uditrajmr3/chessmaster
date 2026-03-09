"""Tests for Rating Predictor feature."""

from datetime import datetime, timedelta

import pytest

from app.services.rating_predictor import RatingPredictor

from .conftest import make_game, make_move_analysis


def _make_games_over_time(db, count=10, start_rating=1000, rating_step=5,
                          start_date=None, platform="chesscom",
                          time_class="rapid"):
    """Create a series of games spread over time with rising rating."""
    start = start_date or datetime(2025, 1, 1)
    for i in range(count):
        make_game(
            db,
            id=f"g{i}",
            platform_id=f"g{i}",
            player_rating=start_rating + i * rating_step,
            played_at=start + timedelta(days=i * 3),
            result="win" if i % 2 == 0 else "loss",
            platform=platform,
            time_class=time_class,
        )


class TestTrajectory:
    def test_computes_basic_trajectory(self, db):
        _make_games_over_time(db, count=10, start_rating=1000, rating_step=10)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()
        t = report["trajectory"]

        assert t["current_rating"] == 1090
        assert t["starting_rating"] == 1000
        assert t["total_change"] == 90
        assert t["games_played"] == 10
        assert t["rate_per_month"] > 0

    def test_peak_and_valley(self, db):
        _make_games_over_time(db, count=10, start_rating=1000, rating_step=10)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()
        t = report["trajectory"]

        assert t["peak_rating"] == 1090
        assert t["valley_rating"] == 1000

    def test_declining_trajectory(self, db):
        _make_games_over_time(db, count=10, start_rating=1500, rating_step=-10)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()
        t = report["trajectory"]

        assert t["rate_per_month"] < 0
        assert t["total_change"] == -90

    def test_not_enough_games(self, db):
        _make_games_over_time(db, count=3)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()

        assert report["trajectory"]["games_played"] == 0
        assert report["milestones"] == []
        assert "Not enough" in report["recommendations"][0]


class TestMilestones:
    def test_projects_milestones(self, db):
        _make_games_over_time(db, count=20, start_rating=1100, rating_step=5)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()

        assert len(report["milestones"]) > 0
        first = report["milestones"][0]
        assert first["target_rating"] > 1100 + 19 * 5  # > current rating
        assert first["months_away"] > 0
        assert first["projected_date"] > datetime.now().strftime("%Y-%m-%d")

    def test_no_milestones_when_declining(self, db):
        _make_games_over_time(db, count=10, start_rating=1500, rating_step=-10)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()

        assert report["milestones"] == []


class TestWeaknessTrends:
    def test_tracks_cpl_by_phase(self, db):
        # Create games spread across 2 months
        for i in range(6):
            month = 1 if i < 3 else 2
            gid = f"g{i}"
            make_game(
                db, id=gid, platform_id=gid,
                played_at=datetime(2025, month, 10 + i),
                player_rating=1000 + i * 5,
            )
            make_move_analysis(
                db, game_id=gid, move_number=5,
                game_phase="opening", centipawn_loss=30.0 - i * 2,
            )
            make_move_analysis(
                db, game_id=gid, move_number=15,
                game_phase="middlegame", centipawn_loss=50.0 - i * 3,
            )

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()
        trends = report["weakness_trends"]

        assert len(trends["opening_cpl"]) == 2
        assert len(trends["middlegame_cpl"]) == 2
        # CPL should decrease over months
        assert trends["opening_cpl"][1]["avg_cpl"] < trends["opening_cpl"][0]["avg_cpl"]


class TestMonthlyPerformance:
    def test_groups_by_month(self, db):
        for i in range(4):
            make_game(
                db, id=f"g{i}", platform_id=f"g{i}",
                played_at=datetime(2025, 1, 10 + i),
                player_rating=1000 + i * 5,
                result="win" if i < 3 else "loss",
            )
        make_game(
            db, id="g4", platform_id="g4",
            played_at=datetime(2025, 2, 10),
            player_rating=1020,
            result="win",
        )

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()
        monthly = report["monthly_performance"]

        assert len(monthly) == 2
        assert monthly[0]["month"] == "2025-01"
        assert monthly[0]["games"] == 4
        assert monthly[0]["wins"] == 3
        assert monthly[0]["losses"] == 1
        assert monthly[1]["month"] == "2025-02"
        assert monthly[1]["games"] == 1


class TestRecommendations:
    def test_positive_trend_recommendation(self, db):
        _make_games_over_time(db, count=10, start_rating=1000, rating_step=10)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()

        assert any("gaining" in r.lower() for r in report["recommendations"])

    def test_declining_trend_recommendation(self, db):
        _make_games_over_time(db, count=10, start_rating=1500, rating_step=-10)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()

        assert any("declining" in r.lower() for r in report["recommendations"])

    def test_near_peak_recommendation(self, db):
        _make_games_over_time(db, count=10, start_rating=1000, rating_step=10)

        predictor = RatingPredictor(db)
        report = predictor.get_prediction()

        assert any("peak" in r.lower() for r in report["recommendations"])


class TestFilters:
    def test_platform_filter(self, db):
        _make_games_over_time(db, count=6, platform="chesscom")
        # Use different IDs for lichess games
        start = datetime(2025, 1, 1)
        for i in range(6):
            make_game(
                db, id=f"li{i}", platform_id=f"li{i}",
                player_rating=1200 + i * 8,
                played_at=start + timedelta(days=i * 3),
                result="win" if i % 2 == 0 else "loss",
                platform="lichess",
            )

        predictor = RatingPredictor(db)
        cc_report = predictor.get_prediction(platform="chesscom")
        li_report = predictor.get_prediction(platform="lichess")

        assert cc_report["trajectory"]["starting_rating"] == 1000
        assert li_report["trajectory"]["starting_rating"] == 1200

    def test_time_class_filter(self, db):
        _make_games_over_time(db, count=6, time_class="blitz")

        predictor = RatingPredictor(db)
        blitz = predictor.get_prediction(time_class="blitz")
        rapid = predictor.get_prediction(time_class="rapid")

        assert blitz["trajectory"]["games_played"] == 6
        assert rapid["trajectory"]["games_played"] == 0


class TestRatingPredictorAPI:
    def test_get_prediction_empty(self, client):
        resp = client.get("/api/rating-predictor")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trajectory"]["games_played"] == 0
        assert data["milestones"] == []

    def test_get_prediction_with_data(self, client, db):
        _make_games_over_time(db, count=10, start_rating=1000, rating_step=10)

        resp = client.get("/api/rating-predictor")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trajectory"]["current_rating"] == 1090
        assert data["trajectory"]["games_played"] == 10
        assert len(data["recommendations"]) > 0

    def test_get_prediction_with_filters(self, client, db):
        _make_games_over_time(db, count=6, time_class="blitz")

        resp = client.get("/api/rating-predictor?time_class=rapid")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trajectory"]["games_played"] == 0
