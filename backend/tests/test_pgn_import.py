"""Tests for PGN Import feature."""

import io

import pytest

from app.models import Game
from app.services.pgn_import import import_pgn, _classify_time_control


SAMPLE_PGN = """[Event "Casual Game"]
[Site "OTB"]
[Date "2025.06.15"]
[White "testuser"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "1200"]
[BlackElo "1100"]
[ECO "B12"]
[Opening "Caro-Kann Defense"]
[TimeControl "600"]

1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 Nd7 1-0
"""

MULTI_GAME_PGN = """[Event "Game 1"]
[White "testuser"]
[Black "Opp1"]
[Result "1-0"]
[Date "2025.06.10"]
[WhiteElo "1200"]
[BlackElo "1100"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "Game 2"]
[White "Opp2"]
[Black "testuser"]
[Result "0-1"]
[Date "2025.06.11"]
[WhiteElo "1150"]
[BlackElo "1200"]

1. d4 d5 2. c4 e6 0-1
"""


class TestPgnImport:
    def test_imports_single_game(self, db):
        result = import_pgn(db, SAMPLE_PGN, "testuser")

        assert result["imported"] == 1
        assert result["skipped"] == 0

        game = db.query(Game).first()
        assert game is not None
        assert game.platform == "pgn"
        assert game.white_username == "testuser"
        assert game.player_color == "white"
        assert game.result == "win"
        assert game.player_rating == 1200
        assert game.opponent_rating == 1100
        assert game.opening_eco == "B12"

    def test_imports_multiple_games(self, db):
        result = import_pgn(db, MULTI_GAME_PGN, "testuser")

        assert result["imported"] == 2
        games = db.query(Game).all()
        assert len(games) == 2

        # First game: testuser is white, wins
        g1 = [g for g in games if g.white_username == "testuser"][0]
        assert g1.result == "win"
        assert g1.player_color == "white"

        # Second game: testuser is black, wins (0-1)
        g2 = [g for g in games if g.black_username == "testuser"][0]
        assert g2.result == "win"
        assert g2.player_color == "black"

    def test_handles_unknown_username(self, db):
        result = import_pgn(db, SAMPLE_PGN, "unknownuser")

        assert result["imported"] == 1
        game = db.query(Game).first()
        # Defaults to white when username doesn't match
        assert game.player_color == "white"

    def test_handles_empty_pgn(self, db):
        result = import_pgn(db, "", "testuser")

        assert result["imported"] == 0
        assert result["skipped"] == 0

    def test_handles_draw_result(self, db):
        pgn = SAMPLE_PGN.replace("1-0", "1/2-1/2")
        result = import_pgn(db, pgn, "testuser")

        game = db.query(Game).first()
        assert game.result == "draw"

    def test_handles_loss_result(self, db):
        pgn = SAMPLE_PGN.replace("1-0", "0-1")
        result = import_pgn(db, pgn, "testuser")

        game = db.query(Game).first()
        assert game.result == "loss"

    def test_parses_date(self, db):
        result = import_pgn(db, SAMPLE_PGN, "testuser")
        game = db.query(Game).first()
        assert game.played_at.year == 2025
        assert game.played_at.month == 6
        assert game.played_at.day == 15


class TestTimeClassification:
    def test_bullet(self):
        assert _classify_time_control("60") == "bullet"
        assert _classify_time_control("120+1") == "bullet"

    def test_blitz(self):
        assert _classify_time_control("300") == "blitz"
        assert _classify_time_control("180+2") == "blitz"

    def test_rapid(self):
        assert _classify_time_control("600") == "rapid"
        assert _classify_time_control("900+10") == "rapid"

    def test_classical(self):
        assert _classify_time_control("3600") == "classical"
        assert _classify_time_control("-") == "classical"


class TestPgnImportAPI:
    def test_import_pgn_text(self, client, db):
        resp = client.post("/api/import/pgn-text", json={
            "pgn": SAMPLE_PGN,
            "username": "testuser",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 1

    def test_import_pgn_file(self, client, db):
        resp = client.post(
            "/api/import/pgn",
            files={"file": ("test.pgn", SAMPLE_PGN.encode(), "text/plain")},
            data={"username": "testuser"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 1
