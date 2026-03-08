import json
from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class PatternEngine:
    def __init__(self, db: Session):
        self.db = db

    def generate_report(self) -> dict:
        """Aggregate analysis across all games to find recurring patterns."""
        return {
            "opening_stats": self._opening_stats(),
            "worst_openings": self._worst_openings(),
            "phase_accuracy": self._phase_accuracy(),
            "phase_blunder_rate": self._phase_blunder_rate(),
            "missed_tactics": self._missed_tactics(),
            "blunder_rate_normal": self._blunder_rate_by_time(trouble=False),
            "blunder_rate_time_trouble": self._blunder_rate_by_time(trouble=True),
            "white_stats": self._color_stats("white"),
            "black_stats": self._color_stats("black"),
            "endgame_conversion_rate": self._endgame_conversion(),
            "blunder_by_move_bucket": self._blunder_by_move_bucket(),
            "example_positions": self._worst_blunders(),
        }

    def _opening_stats(self) -> list[dict]:
        """Win/loss/draw and avg CPL per opening."""
        games = self.db.query(Game).filter(Game.opening_eco.isnot(None)).all()
        openings: dict[str, dict] = defaultdict(
            lambda: {"eco": "", "name": "", "games": 0, "wins": 0, "losses": 0, "draws": 0, "total_cpl": 0, "cpl_count": 0}
        )

        for g in games:
            key = g.opening_eco
            o = openings[key]
            o["eco"] = g.opening_eco
            o["name"] = g.opening_name or g.opening_eco
            o["games"] += 1
            if g.result == "win":
                o["wins"] += 1
            elif g.result == "loss":
                o["losses"] += 1
            else:
                o["draws"] += 1

        # Add avg CPL from move analyses (opening phase only)
        for eco, o in openings.items():
            game_ids = [g.id for g in games if g.opening_eco == eco]
            if game_ids:
                avg_cpl = (
                    self.db.query(func.avg(MoveAnalysis.centipawn_loss))
                    .filter(
                        MoveAnalysis.game_id.in_(game_ids),
                        MoveAnalysis.is_player_move == 1,
                        MoveAnalysis.game_phase == "opening",
                    )
                    .scalar()
                )
                o["avg_cpl"] = round(avg_cpl, 1) if avg_cpl else None

        result = sorted(openings.values(), key=lambda x: x["games"], reverse=True)
        return result

    def _worst_openings(self) -> list[dict]:
        """Openings with worst win rate (min 3 games)."""
        stats = self._opening_stats()
        filtered = [o for o in stats if o["games"] >= 3]
        for o in filtered:
            o["win_rate"] = o["wins"] / o["games"] if o["games"] > 0 else 0
        return sorted(filtered, key=lambda x: x["win_rate"])[:5]

    def _phase_accuracy(self) -> dict[str, float]:
        """Average centipawn loss per game phase."""
        result = {}
        for phase in ("opening", "middlegame", "endgame"):
            avg = (
                self.db.query(func.avg(MoveAnalysis.centipawn_loss))
                .filter(
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.game_phase == phase,
                )
                .scalar()
            )
            result[phase] = round(float(avg), 1) if avg else 0.0
        return result

    def _phase_blunder_rate(self) -> dict[str, float]:
        """Blunders per player move per game phase."""
        result = {}
        for phase in ("opening", "middlegame", "endgame"):
            total = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.game_phase == phase,
                )
                .scalar()
                or 0
            )
            blunders = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.game_phase == phase,
                    MoveAnalysis.classification == "blunder",
                )
                .scalar()
                or 0
            )
            result[phase] = round(blunders / total * 100, 2) if total > 0 else 0.0
        return result

    def _missed_tactics(self) -> dict[str, int]:
        """Count of missed tactical motifs across all games."""
        rows = (
            self.db.query(MoveAnalysis.tactical_motifs)
            .filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.tactical_motifs.isnot(None),
            )
            .all()
        )
        counts: dict[str, int] = defaultdict(int)
        for (motifs_json,) in rows:
            if motifs_json:
                for motif in json.loads(motifs_json):
                    counts[motif] += 1
        return dict(counts)

    def _blunder_rate_by_time(self, trouble: bool) -> float:
        """Blunder rate in time trouble (<60s) vs normal time."""
        if trouble:
            condition = MoveAnalysis.time_remaining < 60
        else:
            condition = MoveAnalysis.time_remaining >= 60

        total = (
            self.db.query(func.count(MoveAnalysis.id))
            .filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.time_remaining.isnot(None),
                condition,
            )
            .scalar()
            or 0
        )
        blunders = (
            self.db.query(func.count(MoveAnalysis.id))
            .filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.time_remaining.isnot(None),
                condition,
                MoveAnalysis.classification == "blunder",
            )
            .scalar()
            or 0
        )
        return round(blunders / total * 100, 2) if total > 0 else 0.0

    def _color_stats(self, color: str) -> dict[str, float]:
        """Win rate and avg CPL for a specific color."""
        games = self.db.query(Game).filter(Game.player_color == color).all()
        total = len(games)
        if total == 0:
            return {"win_rate": 0, "avg_cpl": 0, "games": 0}

        wins = sum(1 for g in games if g.result == "win")
        game_ids = [g.id for g in games]

        avg_cpl = (
            self.db.query(func.avg(MoveAnalysis.centipawn_loss))
            .filter(
                MoveAnalysis.game_id.in_(game_ids),
                MoveAnalysis.is_player_move == 1,
            )
            .scalar()
        )

        return {
            "win_rate": round(wins / total * 100, 1),
            "avg_cpl": round(float(avg_cpl), 1) if avg_cpl else 0,
            "games": total,
        }

    def _endgame_conversion(self) -> float:
        """Percentage of games where player had advantage entering endgame and won."""
        # Find games that have endgame moves
        endgame_games = (
            self.db.query(MoveAnalysis.game_id)
            .filter(
                MoveAnalysis.game_phase == "endgame",
                MoveAnalysis.is_player_move == 1,
            )
            .distinct()
            .all()
        )

        won_from_advantage = 0
        had_advantage = 0

        for (game_id,) in endgame_games:
            # Find the first endgame move's eval
            first_endgame = (
                self.db.query(MoveAnalysis)
                .filter(
                    MoveAnalysis.game_id == game_id,
                    MoveAnalysis.game_phase == "endgame",
                    MoveAnalysis.is_player_move == 1,
                )
                .order_by(MoveAnalysis.move_number)
                .first()
            )

            if first_endgame and first_endgame.eval_before and first_endgame.eval_before >= 200:
                had_advantage += 1
                game = self.db.query(Game).filter(Game.id == game_id).first()
                if game and game.result == "win":
                    won_from_advantage += 1

        return round(won_from_advantage / had_advantage * 100, 1) if had_advantage > 0 else 0.0

    def _blunder_by_move_bucket(self) -> dict[str, float]:
        """Blunder rate by move number ranges."""
        buckets = {
            "1-10": (0, 20),      # ply 0-19
            "11-20": (20, 40),
            "21-30": (40, 60),
            "31-40": (60, 80),
            "41+": (80, 999),
        }
        result = {}
        for label, (ply_start, ply_end) in buckets.items():
            total = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.move_number >= ply_start,
                    MoveAnalysis.move_number < ply_end,
                )
                .scalar()
                or 0
            )
            blunders = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.move_number >= ply_start,
                    MoveAnalysis.move_number < ply_end,
                    MoveAnalysis.classification == "blunder",
                )
                .scalar()
                or 0
            )
            result[label] = round(blunders / total * 100, 2) if total > 0 else 0.0
        return result

    def _worst_blunders(self, limit: int = 10) -> list[dict]:
        """Get the worst blunders as example positions."""
        blunders = (
            self.db.query(MoveAnalysis)
            .filter(
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.classification == "blunder",
            )
            .order_by(MoveAnalysis.centipawn_loss.desc())
            .limit(limit)
            .all()
        )

        examples = []
        for b in blunders:
            game = self.db.query(Game).filter(Game.id == b.game_id).first()
            motifs = json.loads(b.tactical_motifs) if b.tactical_motifs else []
            examples.append({
                "game_id": b.game_id,
                "fen": b.fen_before,
                "player_move": b.move_san,
                "best_move": b.best_move_san,
                "centipawn_loss": b.centipawn_loss,
                "game_phase": b.game_phase,
                "tactical_motifs": motifs,
                "opponent": game.black_username if game and game.player_color == "white" else (game.white_username if game else ""),
                "date": game.played_at.isoformat() if game else "",
            })
        return examples
