"""Server-side analysis ingest: classify + store browser-computed evals.

The browser runs Stockfish and POSTs per-move evaluations.  This module
handles the cheap server-side work: ownership verification, classification,
tactical-motif detection, clock extraction, and persistence.

The server never calls the engine; Stockfish runs in the browser.
"""

import json
from datetime import datetime

import chess
import chess.pgn

from fastapi import HTTPException

from ..models import AnalysisJob, Game, MoveAnalysis
from ..schemas import AnalyzeResultsIn
from ..utils.fen_utils import get_game_phase
from ..utils.pgn_parser import extract_clocks
from .move_classifier import classify_move
from .tactical_detector import detect_tactical_motifs


def store_results(db, user_id, payload: AnalyzeResultsIn) -> None:
    """Verify ownership, classify moves, persist MoveAnalysis rows, upsert AnalysisJob.

    Args:
        db: SQLAlchemy session.
        user_id: The authenticated user's ID (string or UUID).
        payload: Browser-computed per-move eval data.

    Raises:
        HTTPException(404): If the game does not exist or belongs to a different user.
    """
    user_id_str = str(user_id)

    # ── 1. Ownership check (no existence leak: same 404 for both missing and wrong owner) ──
    game = (
        db.query(Game)
        .filter(Game.id == payload.game_id, Game.user_id == user_id_str)
        .first()
    )
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    # ── 2. Extract clock times from the stored PGN (indexed by ply) ──
    clocks = extract_clocks(game.pgn)

    # ── 3. Delete existing MoveAnalysis rows for this game ──
    db.query(MoveAnalysis).filter(MoveAnalysis.game_id == payload.game_id).delete()
    db.flush()

    # ── 4. Classify and persist each move ──
    for move_eval in payload.moves:
        is_player_turn = bool(move_eval.is_player_move)
        eval_before = move_eval.eval_before
        eval_after = move_eval.eval_after

        # Centipawn loss only meaningful for player moves
        cpl = 0.0
        if is_player_turn and eval_before is not None and eval_after is not None:
            cpl = max(0.0, eval_before - eval_after)

        # Determine if this was the best move
        # When CPL is 0 and a best_move_uci was provided, treat as best move
        is_best = (
            move_eval.best_move_uci is not None
            and move_eval.best_move_uci == move_eval.move_uci
        )

        # Board state after the move (for checkmate detection)
        try:
            board_after = chess.Board(move_eval.fen_before)
            board_after.push(chess.Move.from_uci(move_eval.move_uci))
            is_checkmate = board_after.is_checkmate()
        except Exception:
            is_checkmate = False

        classification = classify_move(
            cpl,
            eval_before,
            eval_after,
            is_best,
            is_checkmate=is_checkmate,
        )

        # Tactical motif detection (player moves with significant CPL and a best move)
        motifs: list[str] = []
        if is_player_turn and cpl > 50 and move_eval.best_move_uci:
            try:
                board_before = chess.Board(move_eval.fen_before)
                best_move = chess.Move.from_uci(move_eval.best_move_uci)
                motifs = detect_tactical_motifs(board_before, best_move)
            except Exception:
                motifs = []

        # Resolve best-move SAN from FEN
        best_move_san: str | None = None
        if move_eval.best_move_uci:
            try:
                best_board = chess.Board(move_eval.fen_before)
                best_move_san = best_board.san(chess.Move.from_uci(move_eval.best_move_uci))
            except Exception:
                pass

        # Game phase from FEN
        try:
            phase = get_game_phase(chess.Board(move_eval.fen_before))
        except Exception:
            phase = "middlegame"

        # Clock time (by ply index == move_number)
        clock_time: float | None = None
        ply = move_eval.move_number
        if ply < len(clocks):
            clock_time = clocks[ply]

        analysis = MoveAnalysis(
            game_id=payload.game_id,
            move_number=ply,
            is_player_move=move_eval.is_player_move,
            fen_before=move_eval.fen_before,
            move_uci=move_eval.move_uci,
            move_san=move_eval.move_san,
            eval_before=eval_before,
            eval_after=eval_after,
            best_move_uci=move_eval.best_move_uci,
            best_move_san=best_move_san,
            centipawn_loss=cpl,
            classification=classification,
            game_phase=phase,
            time_remaining=clock_time,
            tactical_motifs=json.dumps(motifs) if motifs else None,
        )
        db.add(analysis)

    # ── 5. Upsert AnalysisJob ──
    job = db.query(AnalysisJob).filter(AnalysisJob.game_id == payload.game_id).first()
    if job is None:
        job = AnalysisJob(
            game_id=payload.game_id,
            user_id=user_id_str,
            status="completed",
            engine_depth=payload.depth,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        db.add(job)
    else:
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        job.engine_depth = payload.depth

    db.commit()
