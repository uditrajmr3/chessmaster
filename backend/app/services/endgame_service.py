"""Endgame Drill Detection: classify endgame types and find conversion failures."""

from collections import defaultdict

import chess
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


# Advantage threshold in centipawns (from Stockfish eval)
ADVANTAGE_THRESHOLD = 150  # 1.5 pawns


def classify_endgame(fen: str) -> str:
    """Classify the endgame type from a FEN position.

    Returns a human-readable endgame type like:
    'King + Pawn', 'Rook Endgame', 'Bishop vs Knight', etc.
    """
    board = chess.Board(fen)

    pieces = {
        "white": _count_pieces(board, chess.WHITE),
        "black": _count_pieces(board, chess.BLACK),
    }

    w, b = pieces["white"], pieces["black"]

    # Pure pawn endgames (no pieces besides kings and pawns)
    if w["total_pieces"] == 0 and b["total_pieces"] == 0:
        return "King + Pawn"

    # Rook endgames
    if w["R"] + b["R"] > 0 and w["Q"] + b["Q"] == 0 and w["B"] + b["B"] == 0 and w["N"] + b["N"] == 0:
        return "Rook Endgame"

    # Queen endgames
    if w["Q"] + b["Q"] > 0 and w["R"] + b["R"] == 0 and w["B"] + b["B"] == 0 and w["N"] + b["N"] == 0:
        return "Queen Endgame"

    # Bishop endgames (same or opposite color)
    if w["B"] + b["B"] > 0 and w["R"] + b["R"] == 0 and w["Q"] + b["Q"] == 0 and w["N"] + b["N"] == 0:
        return "Bishop Endgame"

    # Knight endgames
    if w["N"] + b["N"] > 0 and w["R"] + b["R"] == 0 and w["Q"] + b["Q"] == 0 and w["B"] + b["B"] == 0:
        return "Knight Endgame"

    # Bishop vs Knight
    if (w["B"] > 0 and b["N"] > 0 and w["N"] == 0 and b["B"] == 0
        and w["R"] + b["R"] == 0 and w["Q"] + b["Q"] == 0):
        return "Bishop vs Knight"
    if (w["N"] > 0 and b["B"] > 0 and w["B"] == 0 and b["N"] == 0
        and w["R"] + b["R"] == 0 and w["Q"] + b["Q"] == 0):
        return "Bishop vs Knight"

    # Rook + minor piece
    if w["R"] + b["R"] > 0 and (w["B"] + b["B"] + w["N"] + b["N"] > 0) and w["Q"] + b["Q"] == 0:
        return "Rook + Minor Piece"

    return "Complex Endgame"


def _count_pieces(board: chess.Board, color: chess.Color) -> dict:
    """Count pieces for a given color."""
    counts = {
        "Q": len(board.pieces(chess.QUEEN, color)),
        "R": len(board.pieces(chess.ROOK, color)),
        "B": len(board.pieces(chess.BISHOP, color)),
        "N": len(board.pieces(chess.KNIGHT, color)),
        "P": len(board.pieces(chess.PAWN, color)),
    }
    counts["total_pieces"] = counts["Q"] + counts["R"] + counts["B"] + counts["N"]
    return counts


class EndgameService:
    def __init__(self, db: Session):
        self.db = db

    def get_report(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict:
        """Analyze endgame performance across all games."""
        # Get all games with endgame moves where user had advantage
        failures = self._find_conversion_failures(platform, time_class)
        type_stats = self._aggregate_by_type(failures)
        worst_games = self._worst_endgame_games(failures)
        overall = self._overall_stats(platform, time_class)

        return {
            "overall": overall,
            "by_type": type_stats,
            "worst_games": worst_games,
            "recommendations": self._generate_recommendations(type_stats, overall),
        }

    def _find_conversion_failures(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> list[dict]:
        """Find games where player had endgame advantage but didn't win."""
        # Get distinct games that have endgame moves
        q = (
            self.db.query(MoveAnalysis.game_id)
            .filter(
                MoveAnalysis.game_phase == "endgame",
                MoveAnalysis.is_player_move == 1,
            )
            .distinct()
        )

        if platform or time_class:
            q = q.join(Game, MoveAnalysis.game_id == Game.id)
            if platform:
                q = q.filter(Game.platform == platform)
            if time_class:
                q = q.filter(Game.time_class == time_class)

        game_ids = [gid for (gid,) in q.all()]

        failures = []
        for game_id in game_ids:
            game = self.db.query(Game).filter(Game.id == game_id).first()
            if not game:
                continue

            # Get the first endgame move to classify type and check advantage
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

            if not first_endgame or not first_endgame.eval_before or not first_endgame.fen_before:
                continue

            had_advantage = first_endgame.eval_before >= ADVANTAGE_THRESHOLD
            endgame_type = classify_endgame(first_endgame.fen_before)

            # Get endgame CPL stats
            endgame_moves = (
                self.db.query(MoveAnalysis)
                .filter(
                    MoveAnalysis.game_id == game_id,
                    MoveAnalysis.game_phase == "endgame",
                    MoveAnalysis.is_player_move == 1,
                )
                .all()
            )

            avg_cpl = sum(m.centipawn_loss for m in endgame_moves) / len(endgame_moves) if endgame_moves else 0
            blunders = sum(1 for m in endgame_moves if m.classification == "blunder")

            entry = {
                "game_id": game_id,
                "result": game.result,
                "endgame_type": endgame_type,
                "had_advantage": had_advantage,
                "entering_eval": first_endgame.eval_before,
                "endgame_moves": len(endgame_moves),
                "avg_cpl": round(avg_cpl, 1),
                "blunders": blunders,
                "opponent": (game.black_username if game.player_color == "white"
                             else game.white_username),
                "played_at": game.played_at.isoformat() if game.played_at else "",
                "fen": first_endgame.fen_before,
            }

            # Mark as failure: had advantage but didn't win
            if had_advantage and game.result != "win":
                entry["is_failure"] = True
            else:
                entry["is_failure"] = False

            failures.append(entry)

        return failures

    def _aggregate_by_type(self, entries: list[dict]) -> list[dict]:
        """Group endgame stats by type."""
        types: dict[str, dict] = defaultdict(
            lambda: {"type": "", "total": 0, "had_advantage": 0, "converted": 0,
                      "failed": 0, "total_cpl": 0, "total_blunders": 0}
        )

        for e in entries:
            t = types[e["endgame_type"]]
            t["type"] = e["endgame_type"]
            t["total"] += 1
            t["total_cpl"] += e["avg_cpl"]
            t["total_blunders"] += e["blunders"]
            if e["had_advantage"]:
                t["had_advantage"] += 1
                if e["result"] == "win":
                    t["converted"] += 1
                else:
                    t["failed"] += 1

        result = []
        for t in sorted(types.values(), key=lambda x: x["total"], reverse=True):
            conversion = (
                round(t["converted"] / t["had_advantage"] * 100, 1)
                if t["had_advantage"] > 0 else None
            )
            result.append({
                "type": t["type"],
                "games": t["total"],
                "had_advantage": t["had_advantage"],
                "converted": t["converted"],
                "failed": t["failed"],
                "conversion_rate": conversion,
                "avg_cpl": round(t["total_cpl"] / t["total"], 1) if t["total"] > 0 else 0,
                "total_blunders": t["total_blunders"],
            })

        return result

    def _worst_endgame_games(self, entries: list[dict], limit: int = 10) -> list[dict]:
        """Return the worst endgame failures (had advantage, lost/drew)."""
        failures = [e for e in entries if e["is_failure"]]
        # Sort by entering eval descending (bigger advantage squandered = worse)
        failures.sort(key=lambda x: x["entering_eval"], reverse=True)
        return [
            {
                "game_id": f["game_id"],
                "endgame_type": f["endgame_type"],
                "result": f["result"],
                "entering_eval": f["entering_eval"],
                "avg_cpl": f["avg_cpl"],
                "blunders": f["blunders"],
                "opponent": f["opponent"],
                "played_at": f["played_at"],
                "fen": f["fen"],
            }
            for f in failures[:limit]
        ]

    def _overall_stats(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict:
        """Overall endgame statistics."""
        q = self.db.query(func.count(func.distinct(MoveAnalysis.game_id))).filter(
            MoveAnalysis.game_phase == "endgame",
            MoveAnalysis.is_player_move == 1,
        )
        if platform or time_class:
            q = q.join(Game, MoveAnalysis.game_id == Game.id)
            if platform:
                q = q.filter(Game.platform == platform)
            if time_class:
                q = q.filter(Game.time_class == time_class)

        total_endgame_games = q.scalar() or 0

        # Average CPL in endgames
        cpl_q = self.db.query(func.avg(MoveAnalysis.centipawn_loss)).filter(
            MoveAnalysis.game_phase == "endgame",
            MoveAnalysis.is_player_move == 1,
        )
        if platform or time_class:
            cpl_q = cpl_q.join(Game, MoveAnalysis.game_id == Game.id)
            if platform:
                cpl_q = cpl_q.filter(Game.platform == platform)
            if time_class:
                cpl_q = cpl_q.filter(Game.time_class == time_class)

        avg_cpl = cpl_q.scalar()

        return {
            "games_with_endgame": total_endgame_games,
            "avg_endgame_cpl": round(float(avg_cpl), 1) if avg_cpl else 0,
        }

    def _generate_recommendations(self, type_stats: list[dict], overall: dict) -> list[str]:
        """Generate study recommendations based on endgame weaknesses."""
        recs = []

        # Find endgame types with worst conversion rates
        for t in type_stats:
            if t["had_advantage"] >= 2 and t["conversion_rate"] is not None and t["conversion_rate"] < 60:
                recs.append(
                    f"You convert only {t['conversion_rate']}% of winning {t['type']}s "
                    f"({t['converted']}/{t['had_advantage']}). "
                    f"Study {t['type'].lower()} technique."
                )

        # Find types with highest blunder count
        for t in sorted(type_stats, key=lambda x: x["total_blunders"], reverse=True):
            if t["total_blunders"] >= 3 and t["games"] >= 2:
                recs.append(
                    f"You've made {t['total_blunders']} blunders in {t['type']}s "
                    f"across {t['games']} games. This is a priority area."
                )
                break

        # Find types with high CPL
        for t in type_stats:
            if t["games"] >= 3 and t["avg_cpl"] > 40:
                recs.append(
                    f"Your average centipawn loss in {t['type']}s is {t['avg_cpl']} — "
                    f"consider practicing these positions."
                )

        if not recs:
            if overall["games_with_endgame"] == 0:
                recs.append("No endgame data yet. Sync and analyze your games first.")
            else:
                recs.append(
                    "Your endgame conversion looks solid. Keep practicing to maintain your edge."
                )

        return recs
