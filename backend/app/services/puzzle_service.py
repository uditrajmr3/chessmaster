import json
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis, PuzzleProgress


class PuzzleService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_puzzles_exist(self) -> int:
        """Create PuzzleProgress rows for blunders that don't have one yet.
        Returns the number of new puzzles created."""
        existing = (
            self.db.query(PuzzleProgress.move_analysis_id)
            .subquery()
        )

        new_blunders = (
            self.db.query(MoveAnalysis)
            .filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.classification.in_(["blunder", "mistake"]),
                MoveAnalysis.best_move_uci.isnot(None),
                # Exclude moves that are checkmate (false positives from eval sign flip)
                ~MoveAnalysis.move_san.like("%#"),
                ~MoveAnalysis.id.in_(self.db.query(existing.c.move_analysis_id)),
            )
            .all()
        )

        for ma in new_blunders:
            self.db.add(PuzzleProgress(move_analysis_id=ma.id))

        if new_blunders:
            self.db.commit()

        return len(new_blunders)

    def get_next_puzzle(
        self,
        phase: str | None = None,
        motif: str | None = None,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict | None:
        """Get the next puzzle to solve, prioritizing:
        1. Due for review (next_review <= now)
        2. Never attempted
        3. Worst blunders first
        """
        self.ensure_puzzles_exist()

        now = datetime.utcnow()

        # Base query joining PuzzleProgress -> MoveAnalysis -> Game
        base = (
            self.db.query(PuzzleProgress, MoveAnalysis, Game)
            .join(MoveAnalysis, PuzzleProgress.move_analysis_id == MoveAnalysis.id)
            .join(Game, MoveAnalysis.game_id == Game.id)
        )

        if phase:
            base = base.filter(MoveAnalysis.game_phase == phase)
        if motif:
            base = base.filter(MoveAnalysis.tactical_motifs.contains(f'"{motif}"'))
        if platform:
            base = base.filter(Game.platform == platform)
        if time_class:
            base = base.filter(Game.time_class == time_class)

        # Priority 1: Due for review
        due = (
            base.filter(PuzzleProgress.next_review <= now)
            .order_by(PuzzleProgress.next_review)
            .first()
        )
        if due:
            return self._to_puzzle_dict(*due)

        # Priority 2: Never attempted (sorted by worst blunder first)
        unseen = (
            base.filter(PuzzleProgress.attempts == 0)
            .order_by(MoveAnalysis.centipawn_loss.desc())
            .first()
        )
        if unseen:
            return self._to_puzzle_dict(*unseen)

        # Priority 3: Any puzzle not mastered, longest since last seen
        unmastered = (
            base.filter(
                PuzzleProgress.next_review > now,
            )
            .order_by(PuzzleProgress.last_seen.asc())
            .first()
        )
        if unmastered:
            return self._to_puzzle_dict(*unmastered)

        return None

    def submit_answer(self, puzzle_id: int, move_uci: str) -> dict:
        """Check an answer and update spaced repetition state."""
        progress = self.db.query(PuzzleProgress).filter(PuzzleProgress.id == puzzle_id).first()
        if not progress:
            raise ValueError("Puzzle not found")

        ma = self.db.query(MoveAnalysis).filter(MoveAnalysis.id == progress.move_analysis_id).first()
        if not ma:
            raise ValueError("Move analysis not found")

        correct = move_uci == ma.best_move_uci
        now = datetime.utcnow()

        progress.attempts += 1
        progress.last_seen = now
        if correct:
            progress.successes += 1

        # SM-2 spaced repetition update
        self._update_schedule(progress, correct)
        self.db.commit()

        motifs = json.loads(ma.tactical_motifs) if ma.tactical_motifs else []

        return {
            "correct": correct,
            "best_move_uci": ma.best_move_uci,
            "best_move_san": ma.best_move_san,
            "player_move_san": ma.move_san,
            "centipawn_loss": ma.centipawn_loss,
            "tactical_motifs": motifs,
        }

    def get_stats(self) -> dict:
        """Get overall puzzle training statistics."""
        self.ensure_puzzles_exist()
        now = datetime.utcnow()

        total = self.db.query(func.count(PuzzleProgress.id)).scalar() or 0
        attempted = (
            self.db.query(func.count(PuzzleProgress.id))
            .filter(PuzzleProgress.attempts > 0)
            .scalar() or 0
        )

        # Mastered: >= 3 attempts with >= 80% success
        mastered = 0
        if attempted > 0:
            all_attempted = (
                self.db.query(PuzzleProgress)
                .filter(PuzzleProgress.attempts >= 3)
                .all()
            )
            mastered = sum(
                1 for p in all_attempted
                if p.successes / p.attempts >= 0.8
            )

        due_for_review = (
            self.db.query(func.count(PuzzleProgress.id))
            .filter(
                PuzzleProgress.next_review <= now,
                PuzzleProgress.attempts > 0,
            )
            .scalar() or 0
        )

        total_attempts = (
            self.db.query(func.sum(PuzzleProgress.attempts)).scalar() or 0
        )
        total_successes = (
            self.db.query(func.sum(PuzzleProgress.successes)).scalar() or 0
        )
        accuracy = (
            round(total_successes / total_attempts * 100, 1)
            if total_attempts > 0 else 0.0
        )

        # Breakdown by phase
        phase_counts: dict[str, int] = {}
        for phase in ("opening", "middlegame", "endgame"):
            count = (
                self.db.query(func.count(PuzzleProgress.id))
                .join(MoveAnalysis, PuzzleProgress.move_analysis_id == MoveAnalysis.id)
                .filter(MoveAnalysis.game_phase == phase)
                .scalar() or 0
            )
            phase_counts[phase] = count

        # Breakdown by motif
        motif_rows = (
            self.db.query(MoveAnalysis.tactical_motifs)
            .join(PuzzleProgress, PuzzleProgress.move_analysis_id == MoveAnalysis.id)
            .filter(MoveAnalysis.tactical_motifs.isnot(None))
            .all()
        )
        motif_counts: dict[str, int] = {}
        for (motifs_json,) in motif_rows:
            if motifs_json:
                for motif in json.loads(motifs_json):
                    motif_counts[motif] = motif_counts.get(motif, 0) + 1

        return {
            "total_puzzles": total,
            "attempted": attempted,
            "mastered": mastered,
            "due_for_review": due_for_review,
            "accuracy": accuracy,
            "by_phase": phase_counts,
            "by_motif": motif_counts,
        }

    def _update_schedule(self, progress: PuzzleProgress, correct: bool):
        """Update review schedule using simplified SM-2 algorithm."""
        now = datetime.utcnow()

        if correct:
            if progress.interval_days == 0:
                progress.interval_days = 1
            elif progress.interval_days == 1:
                progress.interval_days = 3
            else:
                progress.interval_days = progress.interval_days * progress.ease_factor

            # Increase ease (max 3.0)
            progress.ease_factor = min(3.0, progress.ease_factor + 0.1)
        else:
            # Reset interval on wrong answer
            progress.interval_days = 0
            # Decrease ease (min 1.3)
            progress.ease_factor = max(1.3, progress.ease_factor - 0.2)

        progress.next_review = now + timedelta(days=progress.interval_days)

    def _to_puzzle_dict(
        self,
        progress: PuzzleProgress,
        ma: MoveAnalysis,
        game: Game,
    ) -> dict:
        motifs = json.loads(ma.tactical_motifs) if ma.tactical_motifs else []
        opponent = (
            game.black_username
            if game.player_color == "white"
            else game.white_username
        )
        return {
            "id": progress.id,
            "move_analysis_id": ma.id,
            "fen": ma.fen_before,
            "best_move_uci": ma.best_move_uci,
            "best_move_san": ma.best_move_san,
            "player_move_san": ma.move_san,
            "centipawn_loss": ma.centipawn_loss,
            "game_phase": ma.game_phase,
            "tactical_motifs": motifs,
            "game_id": game.id,
            "opponent": opponent,
            "played_at": game.played_at.isoformat() if game.played_at else None,
            "attempts": progress.attempts,
            "successes": progress.successes,
        }
