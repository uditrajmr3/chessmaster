"""Tests for Endgame Drill Detection feature."""

from datetime import datetime

import pytest

from app.services.endgame_service import EndgameService, classify_endgame

from .conftest import make_game, make_move_analysis


class TestClassifyEndgame:
    def test_king_pawn(self):
        # K+P vs K
        assert classify_endgame("8/8/4k3/8/8/8/4PK2/8 w - - 0 1") == "King + Pawn"

    def test_rook_endgame(self):
        # R+P vs R+P
        assert classify_endgame("8/5pk1/8/8/8/8/5PK1/r6R w - - 0 1") == "Rook Endgame"

    def test_queen_endgame(self):
        # Q vs Q+P
        assert classify_endgame("8/5pk1/8/8/8/8/5PK1/Q6q w - - 0 1") == "Queen Endgame"

    def test_bishop_endgame(self):
        # B+P vs B+P
        assert classify_endgame("8/5pk1/8/8/8/2B5/5PK1/5b2 w - - 0 1") == "Bishop Endgame"

    def test_knight_endgame(self):
        # N+P vs N
        assert classify_endgame("8/5pk1/8/8/8/2N5/5PK1/5n2 w - - 0 1") == "Knight Endgame"

    def test_bishop_vs_knight(self):
        # B vs N
        assert classify_endgame("8/5pk1/8/8/8/2B5/5PK1/5n2 w - - 0 1") == "Bishop vs Knight"

    def test_rook_minor_piece(self):
        # R+B vs R
        assert classify_endgame("8/5pk1/8/8/8/2B5/5PK1/r6R w - - 0 1") == "Rook + Minor Piece"

    def test_complex_endgame(self):
        # Q+R vs Q+R (complex)
        assert classify_endgame("8/5pk1/8/8/8/8/5PK1/Qr4Rq w - - 0 1") == "Complex Endgame"


class TestEndgameService:
    def _make_endgame_game(self, db, game_id, result, eval_before=300.0,
                           fen="8/5pk1/8/8/8/8/5PK1/r6R w - - 0 1",
                           cpl=10.0, classification="good"):
        """Helper to create a game with endgame moves."""
        make_game(db, id=game_id, platform_id=game_id, result=result)
        make_move_analysis(
            db, game_id=game_id, move_number=40,
            game_phase="endgame", eval_before=eval_before,
            centipawn_loss=cpl, classification=classification,
        )
        # Override fen_before for endgame type classification
        from app.models import MoveAnalysis
        m = db.query(MoveAnalysis).filter(
            MoveAnalysis.game_id == game_id,
            MoveAnalysis.move_number == 40,
        ).first()
        m.fen_before = fen
        db.commit()

    def test_finds_conversion_failures(self, db):
        # Game with advantage that was lost
        self._make_endgame_game(db, "g1", result="loss", eval_before=300.0)
        # Game with advantage that was won
        self._make_endgame_game(db, "g2", result="win", eval_before=300.0)

        service = EndgameService(db)
        report = service.get_report()
        assert report["overall"]["games_with_endgame"] == 2
        assert len(report["worst_games"]) == 1
        assert report["worst_games"][0]["game_id"] == "g1"

    def test_aggregates_by_type(self, db):
        # Two rook endgames
        self._make_endgame_game(db, "g1", result="loss", eval_before=300.0)
        self._make_endgame_game(db, "g2", result="win", eval_before=200.0)
        # One pawn endgame
        self._make_endgame_game(
            db, "g3", result="draw", eval_before=250.0,
            fen="8/8/4k3/8/8/8/4PK2/8 w - - 0 1",
        )

        service = EndgameService(db)
        report = service.get_report()
        types = {t["type"]: t for t in report["by_type"]}
        assert "Rook Endgame" in types
        assert types["Rook Endgame"]["games"] == 2
        assert types["Rook Endgame"]["had_advantage"] == 2
        assert types["Rook Endgame"]["converted"] == 1
        assert types["Rook Endgame"]["failed"] == 1

    def test_no_advantage_not_counted_as_failure(self, db):
        # Game without advantage that was lost
        self._make_endgame_game(db, "g1", result="loss", eval_before=50.0)

        service = EndgameService(db)
        report = service.get_report()
        assert len(report["worst_games"]) == 0
        assert report["by_type"][0]["failed"] == 0

    def test_recommendations_for_low_conversion(self, db):
        # Multiple failures in rook endgames
        for i in range(3):
            self._make_endgame_game(db, f"gf{i}", result="loss", eval_before=300.0)
        self._make_endgame_game(db, "gw1", result="win", eval_before=300.0)

        service = EndgameService(db)
        report = service.get_report()
        assert any("rook endgame" in r.lower() for r in report["recommendations"])

    def test_recommendations_for_blunders(self, db):
        for i in range(3):
            self._make_endgame_game(
                db, f"gb{i}", result="loss", eval_before=300.0,
                cpl=200.0, classification="blunder",
            )

        service = EndgameService(db)
        report = service.get_report()
        assert any("blunder" in r.lower() for r in report["recommendations"])

    def test_empty_report(self, db):
        service = EndgameService(db)
        report = service.get_report()
        assert report["overall"]["games_with_endgame"] == 0
        assert report["by_type"] == []
        assert report["worst_games"] == []
        assert len(report["recommendations"]) > 0

    def test_platform_filter(self, db):
        self._make_endgame_game(db, "g1", result="loss", eval_before=300.0)

        service = EndgameService(db)
        # Our test games use platform="chesscom"
        report_cc = service.get_report(platform="chesscom")
        assert report_cc["overall"]["games_with_endgame"] == 1

        report_li = service.get_report(platform="lichess")
        assert report_li["overall"]["games_with_endgame"] == 0


class TestEndgameAPI:
    def test_get_endgame_report_empty(self, client):
        resp = client.get("/api/endgame")
        assert resp.status_code == 200
        data = resp.json()
        assert data["overall"]["games_with_endgame"] == 0

    def test_get_endgame_report_with_data(self, client, db):
        make_game(db, id="g1", platform_id="g1", result="loss")
        make_move_analysis(
            db, game_id="g1", move_number=40,
            game_phase="endgame", eval_before=300.0,
            centipawn_loss=200.0, classification="blunder",
        )

        resp = client.get("/api/endgame")
        assert resp.status_code == 200
        data = resp.json()
        assert data["overall"]["games_with_endgame"] == 1
        assert len(data["by_type"]) > 0
        assert len(data["worst_games"]) > 0

    def test_get_endgame_report_with_filters(self, client, db):
        make_game(db, id="g1", platform_id="g1", result="loss", time_class="blitz")
        make_move_analysis(
            db, game_id="g1", move_number=40,
            game_phase="endgame", eval_before=300.0,
        )

        resp = client.get("/api/endgame?time_class=rapid")
        assert resp.status_code == 200
        data = resp.json()
        assert data["overall"]["games_with_endgame"] == 0
