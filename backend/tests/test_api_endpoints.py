"""Tests for FastAPI API endpoints."""

import json

import pytest

from app.models import AnalysisJob, MoveAnalysis
from tests.conftest import make_game, make_move_analysis


class TestHealthEndpoint:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "stockfish_available" in data


class TestSyncEndpoints:
    def test_sync_status_initial(self, client):
        resp = client.get("/api/sync/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("idle", "syncing", "done", "error")

    def test_sync_status_schema(self, client):
        resp = client.get("/api/sync/status")
        data = resp.json()
        assert "status" in data
        assert "games_fetched" in data
        assert "message" in data


class TestGamesEndpoints:
    def test_list_games_empty(self, client):
        resp = client.get("/api/games")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_games_with_data(self, client, db):
        make_game(db)
        resp = client.get("/api/games")
        assert resp.status_code == 200
        games = resp.json()
        assert len(games) == 1
        assert games[0]["id"] == "chesscom_test1"
        assert games[0]["result"] == "win"
        assert games[0]["opponent_name"] == "opponent"

    def test_list_games_filter_by_platform(self, client, db):
        make_game(db, id="cc1", platform_id="cc1", platform="chesscom")
        make_game(db, id="li1", platform_id="li1", platform="lichess")
        resp = client.get("/api/games?platform=lichess")
        games = resp.json()
        assert len(games) == 1
        assert games[0]["platform"] == "lichess"

    def test_list_games_filter_by_result(self, client, db):
        make_game(db, id="w1", platform_id="w1", result="win")
        make_game(db, id="l1", platform_id="l1", result="loss")
        resp = client.get("/api/games?result=win")
        games = resp.json()
        assert len(games) == 1
        assert games[0]["result"] == "win"

    def test_list_games_shows_analyzed_status(self, client, db):
        make_game(db, id="g1", platform_id="g1")
        # Mark as analyzed
        job = AnalysisJob(game_id="g1", status="completed")
        db.add(job)
        db.commit()

        resp = client.get("/api/games")
        games = resp.json()
        assert games[0]["is_analyzed"] is True

    def test_list_games_pagination(self, client, db):
        for i in range(5):
            make_game(db, id=f"g{i}", platform_id=f"g{i}")
        resp = client.get("/api/games?per_page=2&page=1")
        assert len(resp.json()) == 2
        resp2 = client.get("/api/games?per_page=2&page=2")
        assert len(resp2.json()) == 2

    def test_get_game_not_found(self, client):
        resp = client.get("/api/games/nonexistent")
        assert resp.status_code == 404

    def test_get_game_detail(self, client, db):
        make_game(db)
        make_move_analysis(db, game_id="chesscom_test1", move_number=0)
        make_move_analysis(db, game_id="chesscom_test1", move_number=1, is_player_move=0)

        resp = client.get("/api/games/chesscom_test1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "chesscom_test1"
        assert len(data["moves"]) == 2
        assert data["moves"][0]["move_san"] == "e4"

    def test_get_game_detail_with_tactics(self, client, db):
        make_game(db)
        make_move_analysis(
            db, game_id="chesscom_test1", move_number=0,
            tactical_motifs=["fork", "pin"],
        )
        resp = client.get("/api/games/chesscom_test1")
        data = resp.json()
        assert data["moves"][0]["tactical_motifs"] == ["fork", "pin"]


class TestStatsEndpoints:
    def test_overview_empty(self, client):
        resp = client.get("/api/stats/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_games"] == 0
        assert data["wins"] == 0

    def test_overview_with_games(self, client, db):
        make_game(db, id="w1", platform_id="w1", result="win", platform_accuracy=85.0)
        make_game(db, id="l1", platform_id="l1", result="loss", platform_accuracy=65.0)
        make_game(db, id="d1", platform_id="d1", result="draw")

        resp = client.get("/api/stats/overview")
        data = resp.json()
        assert data["total_games"] == 3
        assert data["wins"] == 1
        assert data["losses"] == 1
        assert data["draws"] == 1
        assert data["avg_accuracy"] == 75.0  # (85+65)/2
        assert len(data["rating_history"]) == 3

    def test_overview_platforms(self, client, db):
        make_game(db, id="cc1", platform_id="cc1", platform="chesscom")
        make_game(db, id="cc2", platform_id="cc2", platform="chesscom")
        make_game(db, id="li1", platform_id="li1", platform="lichess")

        resp = client.get("/api/stats/overview")
        data = resp.json()
        assert data["platforms"]["chesscom"] == 2
        assert data["platforms"]["lichess"] == 1


class TestPatternsEndpoint:
    def test_patterns_empty(self, client):
        resp = client.get("/api/patterns")
        assert resp.status_code == 200
        data = resp.json()
        assert "phase_accuracy" in data
        assert "missed_tactics" in data

    def test_patterns_with_data(self, client, db):
        make_game(db, id="g1", platform_id="g1", opening_eco="B12")
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening", centipawn_loss=15)

        resp = client.get("/api/patterns")
        data = resp.json()
        assert len(data["opening_stats"]) == 1
        assert data["phase_accuracy"]["opening"] == 15.0


class TestOpeningsEndpoint:
    def test_openings_empty(self, client):
        resp = client.get("/api/openings/tree")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_openings_tree(self, client, db):
        make_game(db, id="g1", platform_id="g1", opening_eco="B12", result="win")
        make_game(db, id="g2", platform_id="g2", opening_eco="B12", result="loss")
        make_game(db, id="g3", platform_id="g3", opening_eco="C50", result="win")

        resp = client.get("/api/openings/tree")
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
