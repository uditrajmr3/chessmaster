import json
from datetime import datetime

import chess
import chess.engine
import chess.pgn

from ..config import settings
from ..database import SessionLocal
from ..models import AnalysisJob, Game, MoveAnalysis
from ..utils.fen_utils import get_game_phase
from ..utils.pgn_parser import extract_clocks, parse_pgn
from .move_classifier import classify_move
from .tactical_detector import detect_tactical_motifs


class StockfishAnalyzer:
    def __init__(self):
        self.depth = settings.stockfish_depth
        self.sf_path = settings.resolve_stockfish()

    async def analyze_all(self, status: dict):
        """Analyze all un-analyzed games."""
        import asyncio

        if not self.sf_path:
            raise RuntimeError(
                "Stockfish not found. Set STOCKFISH_PATH in .env or place the binary in backend/stockfish/"
            )

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._analyze_all_sync, status)

    def _analyze_all_sync(self, status: dict):
        """Synchronous analysis loop — runs in a thread pool."""
        db = SessionLocal()
        try:
            analyzed_ids = {
                row.game_id
                for row in db.query(AnalysisJob.game_id)
                .filter(AnalysisJob.status == "completed")
                .all()
            }
            all_games = db.query(Game).all()
            pending = [g for g in all_games if g.id not in analyzed_ids]

            status["total"] = len(pending)
            status["completed"] = 0

            engine = chess.engine.SimpleEngine.popen_uci(self.sf_path)
            try:
                for game_model in pending:
                    status["current_game"] = game_model.id

                    job = db.query(AnalysisJob).filter(
                        AnalysisJob.game_id == game_model.id
                    ).first()
                    if not job:
                        job = AnalysisJob(
                            game_id=game_model.id,
                            status="running",
                            engine_depth=self.depth,
                            started_at=datetime.utcnow(),
                        )
                        db.add(job)
                    else:
                        job.status = "running"
                        job.started_at = datetime.utcnow()
                    db.commit()

                    try:
                        db.query(MoveAnalysis).filter(
                            MoveAnalysis.game_id == game_model.id
                        ).delete()
                        db.commit()

                        self._analyze_game(db, engine, game_model)
                        job.status = "completed"
                        job.completed_at = datetime.utcnow()
                    except Exception as e:
                        db.rollback()
                        job = db.query(AnalysisJob).filter(
                            AnalysisJob.game_id == game_model.id
                        ).first()
                        if job:
                            job.status = "failed"
                            job.error = str(e)

                    db.commit()
                    status["completed"] += 1
            finally:
                engine.quit()
        finally:
            db.close()

    def _analyze_game(
        self, db, engine: chess.engine.SimpleEngine, game_model: Game
    ):
        """Analyze a single game move by move.

        Optimization: evaluate each position only ONCE. The eval after move N
        equals the eval before move N+1, so we carry it forward.
        """
        game = parse_pgn(game_model.pgn)
        if not game:
            raise ValueError("Failed to parse PGN")

        clocks = extract_clocks(game_model.pgn)
        is_white = game_model.player_color == "white"

        board = game.board()
        moves_list = list(game.mainline_moves())

        # Evaluate the starting position once
        info = engine.analyse(board, chess.engine.Limit(depth=self.depth))
        current_eval = self._score_to_cp(info.get("score"), is_white)
        current_best = info.get("pv", [None])[0]

        for ply, move in enumerate(moves_list):
            is_player_turn = (board.turn == chess.WHITE) == is_white
            fen_before = board.fen()
            phase = get_game_phase(board)

            eval_before = current_eval
            best_move = current_best

            # Make the move
            move_san = board.san(move)
            move_uci = move.uci()
            board.push(move)

            # Evaluate the new position (this becomes eval_before for the next move)
            if board.is_checkmate():
                # Side to move is checkmated — the side that just moved wins
                current_eval = 10000 if is_player_turn else -10000
                current_best = None
            elif board.is_game_over():
                # Stalemate or draw
                current_eval = 0.0
                current_best = None
            else:
                info = engine.analyse(board, chess.engine.Limit(depth=self.depth))
                current_eval = self._score_to_cp(info.get("score"), is_white)
                current_best = info.get("pv", [None])[0]

            eval_after = current_eval

            # Calculate centipawn loss (only for player moves)
            cpl = 0.0
            if is_player_turn and eval_before is not None and eval_after is not None:
                cpl = max(0, eval_before - eval_after)

            # Classify move
            is_best = best_move is not None and move == best_move
            classification = classify_move(
                cpl, eval_before, eval_after, is_best,
                is_checkmate=board.is_checkmate(),
            )

            # Detect tactics on error moves (only for player moves with significant CPL)
            motifs = []
            if is_player_turn and cpl > 50 and best_move:
                board_before = chess.Board(fen_before)
                motifs = detect_tactical_motifs(board_before, best_move)

            # Get best move SAN
            best_san = None
            if best_move:
                try:
                    best_board = chess.Board(fen_before)
                    best_san = best_board.san(best_move)
                except Exception:
                    pass

            # Clock time
            clock_time = None
            if ply < len(clocks):
                clock_time = clocks[ply]

            analysis = MoveAnalysis(
                game_id=game_model.id,
                move_number=ply,
                is_player_move=1 if is_player_turn else 0,
                fen_before=fen_before,
                move_uci=move_uci,
                move_san=move_san,
                eval_before=eval_before,
                eval_after=eval_after,
                best_move_uci=best_move.uci() if best_move else None,
                best_move_san=best_san,
                centipawn_loss=cpl,
                classification=classification,
                game_phase=phase,
                time_remaining=clock_time,
                tactical_motifs=json.dumps(motifs) if motifs else None,
            )
            db.add(analysis)

        db.commit()

    def _score_to_cp(self, score, is_white: bool) -> float | None:
        """Convert engine score to centipawns from the player's perspective."""
        if score is None:
            return None
        pov = score.white() if is_white else score.black()
        if pov.is_mate():
            mate_in = pov.mate()
            return 10000 if mate_in > 0 else -10000
        return float(pov.score())
