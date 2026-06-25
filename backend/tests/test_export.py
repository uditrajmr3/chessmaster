"""Tests for Export & Sharing feature."""

import csv
import io
import json

import pytest

from app.services.export_service import ExportService

from .conftest import TEST_USER_ID, make_game, make_move_analysis


class TestExportGamesCsv:
    def test_exports_games(self, db):
        make_game(db, id="g1", platform_id="g1")
        make_game(db, id="g2", platform_id="g2", result="loss")

        service = ExportService(db, user_id=TEST_USER_ID)
        csv_data = service.export_games_csv()

        reader = csv.reader(io.StringIO(csv_data))
        rows = list(reader)
        assert len(rows) == 3  # header + 2 games
        assert rows[0][0] == "id"
        assert rows[1][0] == "g1"

    def test_platform_filter(self, db):
        make_game(db, id="g1", platform_id="g1", platform="chesscom")
        make_game(db, id="g2", platform_id="g2", platform="lichess")

        service = ExportService(db, user_id=TEST_USER_ID)
        csv_data = service.export_games_csv(platform="chesscom")

        reader = csv.reader(io.StringIO(csv_data))
        rows = list(reader)
        assert len(rows) == 2  # header + 1 game

    def test_empty_export(self, db):
        service = ExportService(db, user_id=TEST_USER_ID)
        csv_data = service.export_games_csv()

        reader = csv.reader(io.StringIO(csv_data))
        rows = list(reader)
        assert len(rows) == 1  # header only


class TestExportAnalysisCsv:
    def test_exports_analysis(self, db):
        make_game(db, id="g1", platform_id="g1")
        make_move_analysis(db, game_id="g1", move_number=1,
                          classification="good", centipawn_loss=5.0)
        make_move_analysis(db, game_id="g1", move_number=2,
                          classification="blunder", centipawn_loss=200.0)

        service = ExportService(db, user_id=TEST_USER_ID)
        csv_data = service.export_analysis_csv()

        reader = csv.reader(io.StringIO(csv_data))
        rows = list(reader)
        assert len(rows) == 3  # header + 2 moves

    def test_filter_by_game_id(self, db):
        make_game(db, id="g1", platform_id="g1")
        make_game(db, id="g2", platform_id="g2")
        make_move_analysis(db, game_id="g1", move_number=1)
        make_move_analysis(db, game_id="g2", move_number=1)

        service = ExportService(db, user_id=TEST_USER_ID)
        csv_data = service.export_analysis_csv(game_id="g1")

        reader = csv.reader(io.StringIO(csv_data))
        rows = list(reader)
        assert len(rows) == 2  # header + 1 move


class TestExportGamesJson:
    def test_exports_json(self, db):
        make_game(db, id="g1", platform_id="g1")

        service = ExportService(db, user_id=TEST_USER_ID)
        data = service.export_games_json()

        assert len(data) == 1
        assert data[0]["id"] == "g1"
        assert "pgn" in data[0]


class TestExportSummary:
    def test_generates_summary(self, db):
        make_game(db, id="g1", platform_id="g1", result="win")
        make_game(db, id="g2", platform_id="g2", result="loss")
        make_move_analysis(db, game_id="g1", move_number=1, centipawn_loss=10.0)
        make_move_analysis(db, game_id="g2", move_number=1,
                          centipawn_loss=200.0, classification="blunder")

        service = ExportService(db, user_id=TEST_USER_ID)
        summary = service.export_summary()

        assert summary["total_games"] == 2
        assert summary["wins"] == 1
        assert summary["losses"] == 1
        assert summary["total_blunders"] == 1
        assert summary["avg_cpl"] > 0

    def test_empty_summary(self, db):
        service = ExportService(db, user_id=TEST_USER_ID)
        summary = service.export_summary()
        assert summary["total_games"] == 0


class TestExportAPI:
    def test_export_games_csv(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", user_id=uid)

        resp = verified_user_client.get("/api/export/games/csv")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        assert "g1" in resp.text

    def test_export_analysis_csv(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", user_id=uid)
        make_move_analysis(db, game_id="g1", move_number=1)

        resp = verified_user_client.get("/api/export/analysis/csv")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]

    def test_export_games_json(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", user_id=uid)

        resp = verified_user_client.get("/api/export/games/json")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_export_summary(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", user_id=uid)

        resp = verified_user_client.get("/api/export/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_games"] == 1

    def test_export_with_filters(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", time_class="blitz", user_id=uid)

        resp = verified_user_client.get("/api/export/games/csv?time_class=rapid")
        assert resp.status_code == 200
        # Should only have header (no games match)
        lines = resp.text.strip().split("\n")
        assert len(lines) == 1
