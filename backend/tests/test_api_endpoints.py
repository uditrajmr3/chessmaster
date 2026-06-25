"""Tests for FastAPI API endpoints."""

import json

import pytest

from app.models import AnalysisJob, MoveAnalysis
from tests.conftest import TEST_USER_ID, make_game, make_move_analysis


class TestHealthEndpoint:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "stockfish_available" in data


class TestSyncEndpoints:
    def test_sync_status_requires_auth(self, client):
        """Unauthenticated GET /api/sync/status → 401 (endpoints are now auth-gated)."""
        resp = client.get("/api/sync/status")
        assert resp.status_code == 401

    def test_sync_status_initial_authenticated(self, verified_user_client):
        """Authenticated GET /api/sync/status → 200 with idle status."""
        resp = verified_user_client.get("/api/sync/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("idle", "syncing", "done", "error")

    def test_sync_status_schema(self, verified_user_client):
        resp = verified_user_client.get("/api/sync/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "games_fetched" in data
        assert "message" in data


class TestGamesEndpoints:
    def test_list_games_empty(self, verified_user_client):  # noqa: F811
        resp = verified_user_client.get("/api/games")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_games_with_data(self, verified_user_client, db):  # noqa: F811
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, user_id=uid)
        resp = verified_user_client.get("/api/games")
        assert resp.status_code == 200
        games = resp.json()
        assert len(games) == 1
        assert games[0]["id"] == "chesscom_test1"
        assert games[0]["result"] == "win"
        assert games[0]["opponent_name"] == "opponent"

    def test_list_games_filter_by_platform(self, verified_user_client, db):  # noqa: F811
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="cc1", platform_id="cc1", platform="chesscom", user_id=uid)
        make_game(db, id="li1", platform_id="li1", platform="lichess", user_id=uid)
        resp = verified_user_client.get("/api/games?platform=lichess")
        games = resp.json()
        assert len(games) == 1
        assert games[0]["platform"] == "lichess"

    def test_list_games_filter_by_result(self, verified_user_client, db):  # noqa: F811
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="w1", platform_id="w1", result="win", user_id=uid)
        make_game(db, id="l1", platform_id="l1", result="loss", user_id=uid)
        resp = verified_user_client.get("/api/games?result=win")
        games = resp.json()
        assert len(games) == 1
        assert games[0]["result"] == "win"

    def test_list_games_shows_analyzed_status(self, verified_user_client, db):  # noqa: F811
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", user_id=uid)
        # Mark as analyzed (AnalysisJob also scoped to same user)
        job = AnalysisJob(game_id="g1", status="completed", user_id=uid)
        db.add(job)
        db.commit()

        resp = verified_user_client.get("/api/games")
        games = resp.json()
        assert games[0]["is_analyzed"] is True

    def test_list_games_pagination(self, verified_user_client, db):  # noqa: F811
        uid = verified_user_client.get("/api/users/me").json()["id"]
        for i in range(5):
            make_game(db, id=f"g{i}", platform_id=f"g{i}", user_id=uid)
        resp = verified_user_client.get("/api/games?per_page=2&page=1")
        assert len(resp.json()) == 2
        resp2 = verified_user_client.get("/api/games?per_page=2&page=2")
        assert len(resp2.json()) == 2

    def test_get_game_not_found(self, verified_user_client):  # noqa: F811
        resp = verified_user_client.get("/api/games/nonexistent")
        assert resp.status_code == 404

    def test_get_game_detail(self, verified_user_client, db):  # noqa: F811
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, user_id=uid)
        make_move_analysis(db, game_id="chesscom_test1", move_number=0)
        make_move_analysis(db, game_id="chesscom_test1", move_number=1, is_player_move=0)

        resp = verified_user_client.get("/api/games/chesscom_test1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "chesscom_test1"
        assert len(data["moves"]) == 2
        assert data["moves"][0]["move_san"] == "e4"

    def test_get_game_detail_with_tactics(self, verified_user_client, db):  # noqa: F811
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, user_id=uid)
        make_move_analysis(
            db, game_id="chesscom_test1", move_number=0,
            tactical_motifs=["fork", "pin"],
        )
        resp = verified_user_client.get("/api/games/chesscom_test1")
        data = resp.json()
        assert data["moves"][0]["tactical_motifs"] == ["fork", "pin"]


class TestStatsEndpoints:
    def test_overview_empty(self, verified_user_client):
        resp = verified_user_client.get("/api/stats/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_games"] == 0
        assert data["wins"] == 0

    def test_overview_with_games(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="w1", platform_id="w1", result="win", platform_accuracy=85.0, user_id=uid)
        make_game(db, id="l1", platform_id="l1", result="loss", platform_accuracy=65.0, user_id=uid)
        make_game(db, id="d1", platform_id="d1", result="draw", user_id=uid)

        resp = verified_user_client.get("/api/stats/overview")
        data = resp.json()
        assert data["total_games"] == 3
        assert data["wins"] == 1
        assert data["losses"] == 1
        assert data["draws"] == 1
        assert data["avg_accuracy"] == 75.0  # (85+65)/2
        assert len(data["rating_history"]) == 3

    def test_overview_platforms(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="cc1", platform_id="cc1", platform="chesscom", user_id=uid)
        make_game(db, id="cc2", platform_id="cc2", platform="chesscom", user_id=uid)
        make_game(db, id="li1", platform_id="li1", platform="lichess", user_id=uid)

        resp = verified_user_client.get("/api/stats/overview")
        data = resp.json()
        assert data["platforms"]["chesscom"] == 2
        assert data["platforms"]["lichess"] == 1


class TestPatternsEndpoint:
    def test_patterns_empty(self, verified_user_client):
        resp = verified_user_client.get("/api/patterns")
        assert resp.status_code == 200
        data = resp.json()
        assert "phase_accuracy" in data
        assert "missed_tactics" in data

    def test_patterns_with_data(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", opening_eco="B12", user_id=uid)
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening", centipawn_loss=15)

        resp = verified_user_client.get("/api/patterns")
        data = resp.json()
        assert len(data["opening_stats"]) == 1
        assert data["phase_accuracy"]["opening"] == 15.0


class TestOpeningsEndpoint:
    def test_openings_empty(self, verified_user_client):
        resp = verified_user_client.get("/api/openings/tree")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_openings_tree(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", opening_eco="B12", result="win", user_id=uid)
        make_game(db, id="g2", platform_id="g2", opening_eco="B12", result="loss", user_id=uid)
        make_game(db, id="g3", platform_id="g3", opening_eco="C50", result="win", user_id=uid)

        resp = verified_user_client.get("/api/openings/tree")
        data = resp.json()
        assert len(data) == 2
        b12 = next(o for o in data if o["eco"] == "B12")
        assert b12["games"] == 2
        assert b12["wins"] == 1


class TestAnalyzeEndpoints:
    def test_analyze_status_initial(self, client):
        resp = client.get("/api/analyze/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "total" in data
        assert "completed" in data


class TestReportEndpoints:
    def test_latest_report_empty(self, client):
        resp = client.get("/api/report/latest")
        assert resp.status_code == 200
        # No report yet — should return null
        assert resp.json() is None
