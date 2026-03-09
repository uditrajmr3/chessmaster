"""Tests for Weekly Digest feature."""

from datetime import datetime, timedelta

import pytest

from app.services.digest_service import DigestService

from .conftest import make_game, make_move_analysis


def _recent_date(days_ago=0):
    return datetime.now() - timedelta(days=days_ago)


class TestDigestSummary:
    def test_basic_summary(self, db):
        for i in range(5):
            make_game(
                db, id=f"g{i}", platform_id=f"g{i}",
                result="win" if i < 3 else "loss",
                played_at=_recent_date(i),
                player_rating=1000 + i * 5,
            )

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert digest["summary"]["total_games"] == 5
        assert digest["summary"]["wins"] == 3
        assert digest["summary"]["losses"] == 2
        assert digest["summary"]["win_rate"] == 60.0

    def test_rating_change(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(5),
                  player_rating=1000)
        make_game(db, id="g1", platform_id="g1", played_at=_recent_date(1),
                  player_rating=1050)

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert digest["summary"]["rating_start"] == 1000
        assert digest["summary"]["rating_end"] == 1050
        assert digest["summary"]["rating_change"] == 50

    def test_empty_digest(self, db):
        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert digest["summary"]["total_games"] == 0
        assert "No games" in digest["digest_text"]

    def test_excludes_old_games(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(10))
        make_game(db, id="g1", platform_id="g1", played_at=_recent_date(2))

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert digest["summary"]["total_games"] == 1


class TestDigestOpenings:
    def test_top_openings(self, db):
        for i in range(3):
            make_game(db, id=f"s{i}", platform_id=f"s{i}",
                      opening_eco="B20", opening_name="Sicilian",
                      played_at=_recent_date(i))
        make_game(db, id="i0", platform_id="i0",
                  opening_eco="C50", opening_name="Italian",
                  played_at=_recent_date(1))

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert len(digest["openings"]) == 2
        assert digest["openings"][0]["eco"] == "B20"
        assert digest["openings"][0]["games"] == 3


class TestDigestAccuracy:
    def test_accuracy_stats(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(1))
        make_move_analysis(db, game_id="g0", move_number=1,
                          centipawn_loss=10.0, classification="good")
        make_move_analysis(db, game_id="g0", move_number=2,
                          centipawn_loss=200.0, classification="blunder")
        make_move_analysis(db, game_id="g0", move_number=3,
                          centipawn_loss=80.0, classification="mistake")

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert digest["accuracy"]["blunders"] == 1
        assert digest["accuracy"]["mistakes"] == 1
        assert digest["accuracy"]["avg_cpl"] == pytest.approx(96.7, abs=0.1)


class TestDigestImprovement:
    def test_compares_to_previous_period(self, db):
        # Previous period (8-14 days ago)
        for i in range(3):
            make_game(db, id=f"prev{i}", platform_id=f"prev{i}",
                      played_at=_recent_date(10 + i), result="loss")
        # Current period (0-7 days ago)
        for i in range(3):
            make_game(db, id=f"curr{i}", platform_id=f"curr{i}",
                      played_at=_recent_date(i + 1), result="win")

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert digest["improvement"]["has_comparison"] is True
        assert digest["improvement"]["win_rate_change"] > 0

    def test_no_comparison_without_previous(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(1))

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert digest["improvement"]["has_comparison"] is False


class TestDigestHighlights:
    def test_best_win(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(1),
                  result="win", opponent_rating=1800, player_rating=1500)
        make_game(db, id="g1", platform_id="g1", played_at=_recent_date(2),
                  result="win", opponent_rating=1600, player_rating=1500)

        service = DigestService(db)
        digest = service.get_digest(days=7)

        best_wins = [h for h in digest["highlights"] if h["type"] == "best_win"]
        assert len(best_wins) == 1
        assert best_wins[0]["game_id"] == "g0"

    def test_upset_detection(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(1),
                  result="win", opponent_rating=1700, player_rating=1500)

        service = DigestService(db)
        digest = service.get_digest(days=7)

        upsets = [h for h in digest["highlights"] if h["type"] == "upset"]
        assert len(upsets) == 1
        assert upsets[0]["description"].startswith("Upset win")


class TestDigestText:
    def test_generates_readable_text(self, db):
        for i in range(3):
            make_game(db, id=f"g{i}", platform_id=f"g{i}",
                      played_at=_recent_date(i + 1), result="win",
                      player_rating=1000 + i * 10)

        service = DigestService(db)
        digest = service.get_digest(days=7)

        assert "7-Day Chess Digest" in digest["digest_text"]
        assert "3W" in digest["digest_text"]
        assert "100.0% win rate" in digest["digest_text"]


class TestDigestFilters:
    def test_platform_filter(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(1),
                  platform="chesscom")
        make_game(db, id="g1", platform_id="g1", played_at=_recent_date(1),
                  platform="lichess")

        service = DigestService(db)
        cc = service.get_digest(days=7, platform="chesscom")
        li = service.get_digest(days=7, platform="lichess")

        assert cc["summary"]["total_games"] == 1
        assert li["summary"]["total_games"] == 1

    def test_custom_days(self, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(20))
        make_game(db, id="g1", platform_id="g1", played_at=_recent_date(5))

        service = DigestService(db)
        d7 = service.get_digest(days=7)
        d30 = service.get_digest(days=30)

        assert d7["summary"]["total_games"] == 1
        assert d30["summary"]["total_games"] == 2


class TestDigestAPI:
    def test_get_digest_empty(self, client):
        resp = client.get("/api/digest")
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["total_games"] == 0

    def test_get_digest_with_data(self, client, db):
        for i in range(3):
            make_game(db, id=f"g{i}", platform_id=f"g{i}",
                      played_at=_recent_date(i + 1))

        resp = client.get("/api/digest")
        assert resp.status_code == 200
        data = resp.json()
        assert data["summary"]["total_games"] == 3

    def test_get_digest_custom_days(self, client, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(20))

        resp = client.get("/api/digest?days=30")
        assert resp.status_code == 200
        assert resp.json()["summary"]["total_games"] == 1

        resp = client.get("/api/digest?days=7")
        assert resp.status_code == 200
        assert resp.json()["summary"]["total_games"] == 0

    def test_get_digest_with_filters(self, client, db):
        make_game(db, id="g0", platform_id="g0", played_at=_recent_date(1),
                  time_class="blitz")

        resp = client.get("/api/digest?time_class=rapid")
        assert resp.status_code == 200
        assert resp.json()["summary"]["total_games"] == 0
