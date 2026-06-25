"""Tests for Opening Book Integration feature."""

import pytest

from app.services.opening_book import OpeningBookService

from .conftest import TEST_USER_ID, make_game, make_move_analysis


class TestBookAnalysis:
    def _setup_game_with_opening(self, db):
        """Create a game with opening moves and similar games for the book."""
        # The main game
        make_game(db, id="target", platform_id="target")
        make_move_analysis(
            db, game_id="target", move_number=0,
            game_phase="opening", classification="good", centipawn_loss=5.0,
        )
        make_move_analysis(
            db, game_id="target", move_number=1,
            game_phase="opening", classification="good", centipawn_loss=3.0,
            is_player_move=0,
        )
        make_move_analysis(
            db, game_id="target", move_number=2,
            game_phase="middlegame", classification="good", centipawn_loss=10.0,
        )

        # Other games to build the book
        for i in range(3):
            gid = f"book{i}"
            make_game(db, id=gid, platform_id=gid)
            make_move_analysis(
                db, game_id=gid, move_number=0,
                game_phase="opening", classification="good", centipawn_loss=5.0,
            )

    def test_returns_moves(self, db):
        self._setup_game_with_opening(db)

        service = OpeningBookService(db, user_id=TEST_USER_ID)
        result = service.get_book_analysis("target")

        assert result["game_id"] == "target"
        assert len(result["moves"]) > 0

    def test_identifies_book_moves(self, db):
        self._setup_game_with_opening(db)

        service = OpeningBookService(db, user_id=TEST_USER_ID)
        result = service.get_book_analysis("target")

        # First move should be in book since all games share the same FEN
        first_move = result["moves"][0]
        assert first_move["in_book"] is True

    def test_stops_at_middlegame(self, db):
        self._setup_game_with_opening(db)

        service = OpeningBookService(db, user_id=TEST_USER_ID)
        result = service.get_book_analysis("target")

        # Should stop when hitting middlegame phase
        phases = [m["game_phase"] for m in result["moves"]]
        assert "middlegame" in phases  # Includes the first non-opening move
        # But shouldn't go past it
        middlegame_idx = phases.index("middlegame")
        assert middlegame_idx == len(phases) - 1

    def test_game_not_found(self, db):
        service = OpeningBookService(db, user_id=TEST_USER_ID)
        result = service.get_book_analysis("nonexistent")

        assert result is None

    def test_includes_alternatives(self, db):
        self._setup_game_with_opening(db)

        service = OpeningBookService(db, user_id=TEST_USER_ID)
        result = service.get_book_analysis("target")

        first_move = result["moves"][0]
        if first_move["in_book"]:
            assert "alternatives" in first_move


class TestRepertoire:
    def test_returns_repertoire(self, db):
        for i in range(5):
            gid = f"g{i}"
            make_game(db, id=gid, platform_id=gid)
            make_move_analysis(
                db, game_id=gid, move_number=0,
                game_phase="opening", classification="good",
            )

        service = OpeningBookService(db, user_id=TEST_USER_ID)
        lines = service.get_repertoire()

        # Should return some lines
        assert isinstance(lines, list)

    def test_empty_repertoire(self, db):
        service = OpeningBookService(db, user_id=TEST_USER_ID)
        lines = service.get_repertoire()
        assert lines == []


class TestOpeningBookAPI:
    def test_get_book_analysis(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", user_id=uid)
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening")

        resp = verified_user_client.get("/api/opening-book/g1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["game_id"] == "g1"

    def test_get_book_analysis_not_found(self, verified_user_client):
        resp = verified_user_client.get("/api/opening-book/nonexistent")
        assert resp.status_code == 404

    def test_get_repertoire(self, verified_user_client, db):
        uid = verified_user_client.get("/api/users/me").json()["id"]
        make_game(db, id="g1", platform_id="g1", user_id=uid)
        make_move_analysis(db, game_id="g1", move_number=0, game_phase="opening")

        resp = verified_user_client.get("/api/opening-book")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
