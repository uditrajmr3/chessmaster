"""Tests for analysis_ingest service (Task 14: client-side Stockfish, server ingest only)."""

import pathlib

import pytest
from fastapi import HTTPException

from app.models import AnalysisJob, MoveAnalysis
from app.schemas import AnalyzeResultsIn, MoveEval
from tests.conftest import TEST_USER_ID, make_game

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
OTHER_USER_ID = "00000000-0000-0000-0000-000000000000"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def seeded_user_game(db):
    """A game owned by TEST_USER_ID."""
    return make_game(db, id="ingest_test_game", platform_id="ingest_test", user_id=TEST_USER_ID)


# ── store_results unit tests ──────────────────────────────────────────────────

def test_store_results_classifies_and_marks_complete(db, seeded_user_game):
    """store_results creates MoveAnalysis rows with classification and sets job to completed."""
    from app.services.analysis_ingest import store_results

    payload = AnalyzeResultsIn(
        game_id=seeded_user_game.id,
        depth=12,
        moves=[
            MoveEval(
                move_number=0,
                is_player_move=1,
                fen_before=START_FEN,
                move_uci="e2e4",
                move_san="e4",
                eval_before=20,
                eval_after=15,
                best_move_uci="e2e4",
            )
        ],
    )
    store_results(db, seeded_user_game.user_id, payload)

    rows = db.query(MoveAnalysis).filter_by(game_id=seeded_user_game.id).all()
    assert len(rows) == 1
    assert rows[0].classification  # non-empty string

    job = db.query(AnalysisJob).filter_by(game_id=seeded_user_game.id).first()
    assert job is not None
    assert job.status == "completed"


def test_store_results_rejects_other_users_game(db, seeded_user_game):
    """store_results raises HTTPException(404) when user_id doesn't match game owner."""
    from app.services.analysis_ingest import store_results

    with pytest.raises(HTTPException) as exc_info:
        store_results(
            db,
            OTHER_USER_ID,
            AnalyzeResultsIn(game_id=seeded_user_game.id, depth=12, moves=[]),
        )
    assert exc_info.value.status_code == 404


def test_store_results_deletes_existing_rows_before_insert(db, seeded_user_game):
    """Calling store_results twice replaces the old MoveAnalysis rows."""
    from app.services.analysis_ingest import store_results

    payload = AnalyzeResultsIn(
        game_id=seeded_user_game.id,
        depth=10,
        moves=[
            MoveEval(
                move_number=0,
                is_player_move=1,
                fen_before=START_FEN,
                move_uci="e2e4",
                move_san="e4",
                eval_before=20,
                eval_after=15,
                best_move_uci="e2e4",
            )
        ],
    )
    store_results(db, seeded_user_game.user_id, payload)
    store_results(db, seeded_user_game.user_id, payload)

    rows = db.query(MoveAnalysis).filter_by(game_id=seeded_user_game.id).all()
    assert len(rows) == 1  # not doubled


def test_store_results_opponent_move_no_cpl(db, seeded_user_game):
    """Opponent moves (is_player_move=0) should have centipawn_loss=0."""
    from app.services.analysis_ingest import store_results

    payload = AnalyzeResultsIn(
        game_id=seeded_user_game.id,
        depth=10,
        moves=[
            MoveEval(
                move_number=0,
                is_player_move=0,
                fen_before=START_FEN,
                move_uci="e2e4",
                move_san="e4",
                eval_before=20,
                eval_after=15,
                best_move_uci="e2e4",
            )
        ],
    )
    store_results(db, seeded_user_game.user_id, payload)

    row = db.query(MoveAnalysis).filter_by(game_id=seeded_user_game.id).first()
    assert row.centipawn_loss == 0.0


def test_store_results_user_id_string_or_uuid(db, seeded_user_game):
    """store_results accepts user_id as a string (UUID)."""
    from app.services.analysis_ingest import store_results

    payload = AnalyzeResultsIn(
        game_id=seeded_user_game.id,
        depth=10,
        moves=[],
    )
    # Should not raise — game belongs to TEST_USER_ID
    store_results(db, str(seeded_user_game.user_id), payload)


def test_store_results_upsert_corrects_stale_user_id(db, seeded_user_game):
    """AnalysisJob upsert is scoped by user_id: a row with a different user_id
    is never silently adopted — re-submitting creates a correctly-stamped job."""
    from app.services.analysis_ingest import store_results

    # Pre-seed an AnalysisJob for the same game_id but with a DIFFERENT user_id
    stale_job = AnalysisJob(
        game_id=seeded_user_game.id,
        user_id=OTHER_USER_ID,  # wrong owner
        status="completed",
    )
    db.add(stale_job)
    db.commit()

    payload = AnalyzeResultsIn(game_id=seeded_user_game.id, depth=10, moves=[])
    store_results(db, seeded_user_game.user_id, payload)

    # There should now be a job stamped with the CORRECT user_id
    correct_job = (
        db.query(AnalysisJob)
        .filter_by(game_id=seeded_user_game.id, user_id=str(seeded_user_game.user_id))
        .first()
    )
    assert correct_job is not None, "Expected a job stamped with the correct user_id"
    assert correct_job.status == "completed"


# ── /analyze/pending endpoint tests ───────────────────────────────────────────

def test_pending_requires_auth(client):
    """GET /api/analyze/pending must return 401 for unauthenticated users."""
    resp = client.get("/api/analyze/pending")
    assert resp.status_code == 401


def test_results_requires_auth(client):
    """POST /api/analyze/results must return 401 for unauthenticated users."""
    resp = client.post("/api/analyze/results", json={
        "game_id": "whatever",
        "depth": 12,
        "moves": [],
    })
    assert resp.status_code == 401


def test_pending_only_returns_own_unanalyzed_games(verified_user_client, db):
    """GET /api/analyze/pending only returns authed user's games without a completed AnalysisJob."""
    uid = verified_user_client.get("/api/users/me").json()["id"]

    # Authed user: 2 games, one already analyzed
    make_game(db, id="pg1", platform_id="pg1", user_id=uid)
    make_game(db, id="pg2", platform_id="pg2", user_id=uid)
    job = AnalysisJob(game_id="pg1", status="completed", user_id=uid)
    db.add(job)
    db.commit()

    # Another user: 1 game (must not appear)
    other_uid = "00000000-0000-0000-0000-000000000099"
    make_game(db, id="other_pg1", platform_id="other_pg1", user_id=other_uid)

    resp = verified_user_client.get("/api/analyze/pending")
    assert resp.status_code == 200
    data = resp.json()

    game_ids = [g["game_id"] for g in data]
    assert "pg2" in game_ids          # own unanalyzed game
    assert "pg1" not in game_ids      # own but already analyzed
    assert "other_pg1" not in game_ids  # other user's game


def test_pending_response_includes_player_color(verified_user_client, db):
    """GET /api/analyze/pending response items include player_color."""
    uid = verified_user_client.get("/api/users/me").json()["id"]
    make_game(db, id="color_pg1", platform_id="color_pg1", user_id=uid, player_color="black")

    resp = verified_user_client.get("/api/analyze/pending")
    assert resp.status_code == 200
    data = resp.json()
    item = next(g for g in data if g["game_id"] == "color_pg1")
    assert item["player_color"] == "black"


def test_results_stores_analysis_for_authed_user(verified_user_client, db):
    """POST /api/analyze/results stores MoveAnalysis and marks AnalysisJob completed."""
    uid = verified_user_client.get("/api/users/me").json()["id"]
    make_game(db, id="res_pg1", platform_id="res_pg1", user_id=uid)

    payload = {
        "game_id": "res_pg1",
        "depth": 12,
        "moves": [
            {
                "move_number": 0,
                "is_player_move": 1,
                "fen_before": START_FEN,
                "move_uci": "e2e4",
                "move_san": "e4",
                "eval_before": 20,
                "eval_after": 10,
                "best_move_uci": "e2e4",
            }
        ],
    }
    resp = verified_user_client.post("/api/analyze/results", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    rows = db.query(MoveAnalysis).filter_by(game_id="res_pg1").all()
    assert len(rows) == 1
    job = db.query(AnalysisJob).filter_by(game_id="res_pg1").first()
    assert job is not None
    assert job.status == "completed"


def test_results_rejects_other_users_game_via_api(verified_user_client, db):
    """POST /api/analyze/results for another user's game_id returns 404."""
    other_uid = "00000000-0000-0000-0000-000000000099"
    make_game(db, id="other_res_g1", platform_id="other_res_g1", user_id=other_uid)

    payload = {
        "game_id": "other_res_g1",
        "depth": 12,
        "moves": [],
    }
    resp = verified_user_client.post("/api/analyze/results", json=payload)
    assert resp.status_code == 404


# ── Guard test: no chess.engine in request paths ──────────────────────────────

def test_no_engine_import_in_request_paths():
    """No module under backend/app may import chess.engine (Stockfish moved to browser)."""
    app_dir = pathlib.Path(__file__).parent.parent / "app"
    offenders = [p for p in app_dir.rglob("*.py") if "chess.engine" in p.read_text()]
    assert not offenders, f"chess.engine found in request paths: {offenders}"
