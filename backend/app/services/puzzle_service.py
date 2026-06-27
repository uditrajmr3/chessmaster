import json
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis, PuzzleProgress

# A real puzzle is a recoverable tactical blunder, not a mate-score swing. The
# analysis encodes checkmate as ±10000 cp, so any move into/out of a mate line
# produces a centipawn_loss in the thousands. Those aren't learnable one-move
# tactics (and flood the pool), so exclude anything above this ceiling.
MAX_PUZZLE_CPL = 2000


class PuzzleService:
    def __init__(self, db: Session, user_id: str | None = None):
        if user_id is None:
            raise ValueError("user_id is required for tenant scoping")
        self.db = db
        self._user_id = user_id

    def _user_game_ids_query(self):
        """Query returning game IDs owned by the authenticated user."""
        return self.db.query(Game.id).filter(Game.user_id == self._user_id)

    def ensure_puzzles_exist(self) -> int:
        """Create PuzzleProgress rows for blunders that don't have one yet.
        Returns the number of new puzzles created."""
        # Only consider puzzles already belonging to this user
        existing_ids = (
            self.db.query(PuzzleProgress.move_analysis_id)
            .filter(PuzzleProgress.user_id == self._user_id)
        )

        user_game_ids = self._user_game_ids_query()

        new_blunders = (
            self.db.query(MoveAnalysis)
            .filter(
                MoveAnalysis.game_id.in_(user_game_ids),
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.classification.in_(["blunder", "mistake"]),
                MoveAnalysis.best_move_uci.isnot(None),
                # Exclude moves that are checkmate (false positives from eval sign flip)
                ~MoveAnalysis.move_san.like("%#"),
                # Exclude mate-score swings — not real one-move tactics
                MoveAnalysis.centipawn_loss <= MAX_PUZZLE_CPL,
                ~MoveAnalysis.id.in_(existing_ids),
            )
            .all()
        )

        for ma in new_blunders:
            # Derive user_id from the parent Game row
            game = self.db.query(Game).filter(Game.id == ma.game_id).first()
            if game is None:
                # Skip orphaned MoveAnalysis rows to avoid writing NULL into
                # PuzzleProgress.user_id (NOT NULL on Postgres)
                continue
            self.db.add(PuzzleProgress(move_analysis_id=ma.id, user_id=game.user_id))

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

        # Base query joining PuzzleProgress -> MoveAnalysis -> Game, scoped to this user
        base = (
            self.db.query(PuzzleProgress, MoveAnalysis, Game)
            .join(MoveAnalysis, PuzzleProgress.move_analysis_id == MoveAnalysis.id)
            .join(Game, MoveAnalysis.game_id == Game.id)
            .filter(
                PuzzleProgress.user_id == self._user_id,
                MoveAnalysis.centipawn_loss <= MAX_PUZZLE_CPL,
            )
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
        progress = (
            self.db.query(PuzzleProgress)
            .filter(PuzzleProgress.id == puzzle_id, PuzzleProgress.user_id == self._user_id)
            .first()
        )
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

    def _puzzle_pool(self):
        """PuzzleProgress rows that are real, solvable puzzles for this user —
        mate-score artifacts excluded. Joined to MoveAnalysis so callers can
        filter/aggregate on either table."""
        return (
            self.db.query(PuzzleProgress)
            .join(MoveAnalysis, PuzzleProgress.move_analysis_id == MoveAnalysis.id)
            .filter(
                PuzzleProgress.user_id == self._user_id,
                MoveAnalysis.centipawn_loss <= MAX_PUZZLE_CPL,
            )
        )

    def get_stats(self) -> dict:
        """Get overall puzzle training statistics."""
        self.ensure_puzzles_exist()
        now = datetime.utcnow()

        total = self._puzzle_pool().count()
        attempted = self._puzzle_pool().filter(PuzzleProgress.attempts > 0).count()

        # Mastered: >= 3 attempts with >= 80% success
        mastered = 0
        if attempted > 0:
            all_attempted = self._puzzle_pool().filter(PuzzleProgress.attempts >= 3).all()
            mastered = sum(
                1 for p in all_attempted
                if p.successes / p.attempts >= 0.8
            )

        due_for_review = (
            self._puzzle_pool()
            .filter(PuzzleProgress.next_review <= now, PuzzleProgress.attempts > 0)
            .count()
        )

        total_attempts = (
            self._puzzle_pool()
            .with_entities(func.coalesce(func.sum(PuzzleProgress.attempts), 0))
            .scalar() or 0
        )
        total_successes = (
            self._puzzle_pool()
            .with_entities(func.coalesce(func.sum(PuzzleProgress.successes), 0))
            .scalar() or 0
        )
        accuracy = (
            round(total_successes / total_attempts * 100, 1)
            if total_attempts > 0 else 0.0
        )

        # Breakdown by phase
        phase_counts: dict[str, int] = {}
        for phase in ("opening", "middlegame", "endgame"):
            phase_counts[phase] = (
                self._puzzle_pool().filter(MoveAnalysis.game_phase == phase).count()
            )

        # Breakdown by motif
        motif_rows = (
            self._puzzle_pool()
            .with_entities(MoveAnalysis.tactical_motifs)
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
