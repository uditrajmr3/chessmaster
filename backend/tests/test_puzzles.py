"""Tests for the Puzzle Trainer feature: service logic and API endpoints."""

from datetime import datetime, timedelta

import pytest

from app.models import PuzzleProgress
from app.services.puzzle_service import PuzzleService

from .conftest import make_blunder, make_game


class TestPuzzleService:
    def test_ensure_puzzles_creates_from_blunders(self, db):
        make_game(db)
        make_blunder(db, move_number=0, centipawn_loss=200)
        make_blunder(db, move_number=2, centipawn_loss=300)

        service = PuzzleService(db)
        created = service.ensure_puzzles_exist()

        assert created == 2
        assert db.query(PuzzleProgress).count() == 2

    def test_ensure_puzzles_idempotent(self, db):
        make_game(db)
        make_blunder(db, move_number=0)

        service = PuzzleService(db)
        service.ensure_puzzles_exist()
        created = service.ensure_puzzles_exist()

        assert created == 0
        assert db.query(PuzzleProgress).count() == 1

    def test_get_next_puzzle_unseen_first(self, db):
        make_game(db)
        make_blunder(db, move_number=0, centipawn_loss=100)
        make_blunder(db, move_number=2, centipawn_loss=500)

        service = PuzzleService(db)
        puzzle = service.get_next_puzzle()

        assert puzzle is not None
        # Should return worst blunder first (highest CPL)
        assert puzzle["centipawn_loss"] == 500

    def test_get_next_puzzle_returns_none_when_empty(self, db):
        service = PuzzleService(db)
        puzzle = service.get_next_puzzle()
        assert puzzle is None

    def test_get_next_puzzle_filter_by_phase(self, db):
        make_game(db)
        make_blunder(db, move_number=0, game_phase="opening")
        make_blunder(db, move_number=2, game_phase="endgame")

        service = PuzzleService(db)
        puzzle = service.get_next_puzzle(phase="endgame")

        assert puzzle is not None
        assert puzzle["game_phase"] == "endgame"

    def test_get_next_puzzle_filter_by_motif(self, db):
        make_game(db)
        make_blunder(db, move_number=0, tactical_motifs=["fork"])
        make_blunder(db, move_number=2, tactical_motifs=["pin"])

        service = PuzzleService(db)
        puzzle = service.get_next_puzzle(motif="pin")

        assert puzzle is not None
        assert "pin" in puzzle["tactical_motifs"]

    def test_submit_correct_answer(self, db):
        make_game(db)
        ma = make_blunder(db, move_number=0, best_move_uci="d2d4")

        service = PuzzleService(db)
        service.ensure_puzzles_exist()

        puzzle = service.get_next_puzzle()
        result = service.submit_answer(puzzle["id"], "d2d4")

        assert result["correct"] is True
        assert result["best_move_uci"] == "d2d4"

        progress = db.query(PuzzleProgress).first()
        assert progress.attempts == 1
        assert progress.successes == 1
        assert progress.interval_days == 1  # first correct -> 1 day

    def test_submit_wrong_answer(self, db):
        make_game(db)
        make_blunder(db, move_number=0, best_move_uci="d2d4")

        service = PuzzleService(db)
        service.ensure_puzzles_exist()

        puzzle = service.get_next_puzzle()
        result = service.submit_answer(puzzle["id"], "a2a3")

        assert result["correct"] is False

        progress = db.query(PuzzleProgress).first()
        assert progress.attempts == 1
        assert progress.successes == 0
        assert progress.interval_days == 0  # reset on wrong

    def test_spaced_repetition_intervals_grow(self, db):
        make_game(db)
        make_blunder(db, move_number=0, best_move_uci="d2d4")

        service = PuzzleService(db)
        service.ensure_puzzles_exist()
        puzzle = service.get_next_puzzle()
        pid = puzzle["id"]

        # Correct answers should grow intervals: 0 -> 1 -> 3 -> 3*ef
        service.submit_answer(pid, "d2d4")
        p = db.query(PuzzleProgress).first()
        assert p.interval_days == 1

        service.submit_answer(pid, "d2d4")
        db.refresh(p)
        assert p.interval_days == 3

        service.submit_answer(pid, "d2d4")
        db.refresh(p)
        assert p.interval_days > 3  # 3 * ease_factor

    def test_wrong_answer_resets_interval(self, db):
        make_game(db)
        make_blunder(db, move_number=0, best_move_uci="d2d4")

        service = PuzzleService(db)
        service.ensure_puzzles_exist()
        puzzle = service.get_next_puzzle()
        pid = puzzle["id"]

        # Build up interval
        service.submit_answer(pid, "d2d4")
        service.submit_answer(pid, "d2d4")

        # Wrong answer resets
        service.submit_answer(pid, "a2a3")
        p = db.query(PuzzleProgress).first()
        assert p.interval_days == 0

    def test_due_puzzles_prioritized(self, db):
        make_game(db)
        make_blunder(db, move_number=0, centipawn_loss=100, best_move_uci="d2d4")
        make_blunder(db, move_number=2, centipawn_loss=500, best_move_uci="e2e4")

        service = PuzzleService(db)
        service.ensure_puzzles_exist()

        # Attempt puzzle with CPL 500 and get it wrong (so it's due immediately)
        p500 = service.get_next_puzzle()  # gets CPL 500 (unseen, worst first)
        service.submit_answer(p500["id"], "a2a3")  # wrong

        # Next puzzle should be the due one (CPL 500, wrong answer -> interval 0)
        next_puzzle = service.get_next_puzzle()
        assert next_puzzle["id"] == p500["id"]

    def test_get_stats(self, db):
        make_game(db)
        make_blunder(db, move_number=0, game_phase="middlegame", tactical_motifs=["fork"])
        make_blunder(db, move_number=2, game_phase="endgame")

        service = PuzzleService(db)
        stats = service.get_stats()

        assert stats["total_puzzles"] == 2
        assert stats["attempted"] == 0
        assert stats["mastered"] == 0
        assert stats["accuracy"] == 0.0
        assert stats["by_phase"]["middlegame"] == 1
        assert stats["by_phase"]["endgame"] == 1
        assert stats["by_motif"].get("fork") == 1

    def test_submit_nonexistent_puzzle(self, db):
        service = PuzzleService(db)
        with pytest.raises(ValueError, match="Puzzle not found"):
            service.submit_answer(999, "e2e4")


class TestPuzzleAPI:
    def test_get_next_puzzle_empty(self, client):
        resp = client.get("/api/puzzles/next")
        assert resp.status_code == 200
        assert resp.json() is None

    def test_get_next_puzzle_with_data(self, client, db):
        make_game(db)
        make_blunder(db, move_number=0)

        resp = client.get("/api/puzzles/next")
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        assert "fen" in data
        assert "best_move_uci" in data

    def test_submit_correct(self, client, db):
        make_game(db)
        make_blunder(db, move_number=0, best_move_uci="d2d4")

        # Get the puzzle first
        resp = client.get("/api/puzzles/next")
        puzzle = resp.json()

        # Submit correct answer
        resp = client.post(
            f"/api/puzzles/{puzzle['id']}/submit",
            json={"move_uci": "d2d4"},
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is True

    def test_submit_wrong(self, client, db):
        make_game(db)
        make_blunder(db, move_number=0, best_move_uci="d2d4")

        resp = client.get("/api/puzzles/next")
        puzzle = resp.json()

        resp = client.post(
            f"/api/puzzles/{puzzle['id']}/submit",
            json={"move_uci": "a2a3"},
        )
        assert resp.status_code == 200
        assert resp.json()["correct"] is False

    def test_submit_nonexistent(self, client):
        resp = client.post(
            "/api/puzzles/999/submit",
            json={"move_uci": "e2e4"},
        )
        assert resp.status_code == 404

    def test_get_stats(self, client, db):
        make_game(db)
        make_blunder(db, move_number=0)

        resp = client.get("/api/puzzles/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_puzzles"] == 1
        assert "by_phase" in data

    def test_filter_by_phase(self, client, db):
        make_game(db)
        make_blunder(db, move_number=0, game_phase="opening")
        make_blunder(db, move_number=2, game_phase="endgame")

        resp = client.get("/api/puzzles/next?phase=endgame")
        data = resp.json()
        assert data["game_phase"] == "endgame"

    def test_filter_by_motif(self, client, db):
        make_game(db)
        make_blunder(db, move_number=0, tactical_motifs=["fork"])
        make_blunder(db, move_number=2, tactical_motifs=["pin"])

        resp = client.get("/api/puzzles/next?motif=fork")
        data = resp.json()
        assert "fork" in data["tactical_motifs"]
