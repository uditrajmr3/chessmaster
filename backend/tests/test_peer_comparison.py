"""Tests for Peer Comparison feature."""

import pytest

from app.services.peer_comparison import PeerComparisonService, _get_rating_band

from .conftest import make_game, make_move_analysis


class TestRatingBand:
    def test_low_rating(self):
        assert _get_rating_band(400) == "0-600"

    def test_mid_rating(self):
        assert _get_rating_band(1100) == "1000-1200"

    def test_high_rating(self):
        assert _get_rating_band(2100) == "2000+"

    def test_boundary(self):
        assert _get_rating_band(1000) == "1000-1200"
        assert _get_rating_band(999) == "800-1000"


class TestPeerComparison:
    def _setup_games(self, db, count=6, rating=1100, blunder_pct=0.3):
        for i in range(count):
            gid = f"g{i}"
            make_game(
                db, id=gid, platform_id=gid,
                player_rating=rating,
                result="win" if i < count // 2 else "loss",
            )
            # Add some moves
            make_move_analysis(
                db, game_id=gid, move_number=5,
                game_phase="opening", centipawn_loss=20.0,
                classification="good",
            )
            make_move_analysis(
                db, game_id=gid, move_number=15,
                game_phase="middlegame", centipawn_loss=40.0,
                classification="good" if i < count * (1 - blunder_pct) else "blunder",
            )
            make_move_analysis(
                db, game_id=gid, move_number=30,
                game_phase="endgame", centipawn_loss=60.0,
                classification="good",
            )

    def test_returns_comparison(self, db):
        self._setup_games(db)

        service = PeerComparisonService(db)
        report = service.get_comparison()

        assert report["rating_band"] == "1000-1200"
        assert report["games_analyzed"] == 6
        assert len(report["comparisons"]) == 7  # 7 metrics

    def test_identifies_strengths(self, db):
        # Create games with very low blunder rate (better than peers)
        for i in range(6):
            gid = f"g{i}"
            make_game(db, id=gid, platform_id=gid, player_rating=1100)
            make_move_analysis(
                db, game_id=gid, move_number=10,
                game_phase="middlegame", centipawn_loss=5.0,
                classification="good",
            )

        service = PeerComparisonService(db)
        report = service.get_comparison()

        # With 0% blunder rate and 5 CPL, should have strengths
        assert len(report["strengths"]) > 0

    def test_identifies_weaknesses(self, db):
        # Create games with very high CPL (worse than peers)
        for i in range(6):
            gid = f"g{i}"
            make_game(db, id=gid, platform_id=gid, player_rating=1100)
            make_move_analysis(
                db, game_id=gid, move_number=10,
                game_phase="middlegame", centipawn_loss=200.0,
                classification="blunder",
            )

        service = PeerComparisonService(db)
        report = service.get_comparison()

        assert len(report["weaknesses"]) > 0

    def test_not_enough_games(self, db):
        make_game(db, id="g0", platform_id="g0", player_rating=1100)

        service = PeerComparisonService(db)
        report = service.get_comparison()

        assert report["games_analyzed"] == 0
        assert "Not enough" in report["recommendations"][0]

    def test_recommendations_generated(self, db):
        self._setup_games(db)

        service = PeerComparisonService(db)
        report = service.get_comparison()

        assert len(report["recommendations"]) > 0

    def test_verdicts_correct(self, db):
        # Create games where user CPL is much lower than benchmark
        for i in range(6):
            gid = f"g{i}"
            make_game(db, id=gid, platform_id=gid, player_rating=1100)
            make_move_analysis(
                db, game_id=gid, move_number=5,
                game_phase="opening", centipawn_loss=5.0,
                classification="good",
            )

        service = PeerComparisonService(db)
        report = service.get_comparison()

        cpl_comp = next(c for c in report["comparisons"] if c["metric"] == "Average CPL")
        assert cpl_comp["verdict"] == "better"  # lower CPL is better


class TestPeerFilters:
    def test_platform_filter(self, db):
        for i in range(6):
            make_game(db, id=f"cc{i}", platform_id=f"cc{i}",
                      platform="chesscom", player_rating=1100)
            make_move_analysis(db, game_id=f"cc{i}", move_number=5,
                              game_phase="opening", centipawn_loss=20.0)
        for i in range(6):
            make_game(db, id=f"li{i}", platform_id=f"li{i}",
                      platform="lichess", player_rating=1500)
            make_move_analysis(db, game_id=f"li{i}", move_number=5,
                              game_phase="opening", centipawn_loss=20.0)

        service = PeerComparisonService(db)
        cc = service.get_comparison(platform="chesscom")
        li = service.get_comparison(platform="lichess")

        assert cc["rating_band"] == "1000-1200"
        assert li["rating_band"] == "1400-1600"


class TestPeerAPI:
    def test_get_comparison_empty(self, client):
        resp = client.get("/api/peer-comparison")
        assert resp.status_code == 200
        data = resp.json()
        assert data["games_analyzed"] == 0

    def test_get_comparison_with_data(self, client, db):
        for i in range(6):
            gid = f"g{i}"
            make_game(db, id=gid, platform_id=gid, player_rating=1100)
            make_move_analysis(db, game_id=gid, move_number=5,
                              game_phase="opening", centipawn_loss=20.0)

        resp = client.get("/api/peer-comparison")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rating_band"] == "1000-1200"
        assert len(data["comparisons"]) == 7

    def test_get_comparison_with_filters(self, client, db):
        for i in range(6):
            gid = f"g{i}"
            make_game(db, id=gid, platform_id=gid, player_rating=1100,
                      time_class="blitz")
            make_move_analysis(db, game_id=gid, move_number=5,
                              game_phase="opening", centipawn_loss=20.0)

        resp = client.get("/api/peer-comparison?time_class=rapid")
        assert resp.status_code == 200
        assert resp.json()["games_analyzed"] == 0
