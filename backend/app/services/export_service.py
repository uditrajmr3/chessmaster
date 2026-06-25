"""Export & Sharing: export game data and analysis as CSV or JSON."""

import csv
import io
import json
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class ExportService:
    def __init__(self, db: Session, user_id=None):
        if user_id is None:
            raise ValueError("user_id is required for tenant scoping")
        self.db = db
        self._user_id = user_id

    def export_games_csv(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> str:
        """Export games as CSV."""
        games = self._get_games(platform, time_class)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "platform", "white", "black", "player_color",
            "result", "result_detail", "time_class", "time_control",
            "player_rating", "opponent_rating", "opening_eco", "opening_name",
            "num_moves", "played_at",
        ])

        for g in games:
            writer.writerow([
                g.id, g.platform, g.white_username, g.black_username,
                g.player_color, g.result, g.result_detail,
                g.time_class, g.time_control,
                g.player_rating, g.opponent_rating,
                g.opening_eco or "", g.opening_name or "",
                g.num_moves, g.played_at.isoformat() if g.played_at else "",
            ])

        return output.getvalue()

    def export_analysis_csv(
        self,
        game_id: str | None = None,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> str:
        """Export move analysis as CSV."""
        q = self.db.query(MoveAnalysis).filter(MoveAnalysis.is_player_move == 1)

        if game_id:
            # Verify the game belongs to this user before using its id
            game = self.db.query(Game).filter(Game.id == game_id, Game.user_id == self._user_id).first()
            if not game:
                return ""
            q = q.filter(MoveAnalysis.game_id == game_id)
        else:
            # Always scope to the user's games — pass through any platform/time_class filters.
            # This also covers the no-filter default path, preventing a cross-tenant leak.
            game_ids = [g.id for g in self._get_games(platform, time_class)]
            if not game_ids:
                return ""
            q = q.filter(MoveAnalysis.game_id.in_(game_ids))

        moves = q.order_by(MoveAnalysis.game_id, MoveAnalysis.move_number).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "game_id", "move_number", "move_san", "fen_before",
            "eval_before", "eval_after", "centipawn_loss",
            "classification", "game_phase", "best_move_san",
            "time_remaining", "tactical_motifs",
        ])

        for m in moves:
            motifs = ""
            if m.tactical_motifs:
                try:
                    motifs = ";".join(json.loads(m.tactical_motifs))
                except (json.JSONDecodeError, TypeError):
                    motifs = m.tactical_motifs

            writer.writerow([
                m.game_id, m.move_number, m.move_san, m.fen_before,
                m.eval_before, m.eval_after, m.centipawn_loss,
                m.classification, m.game_phase, m.best_move_san or "",
                m.time_remaining or "", motifs,
            ])

        return output.getvalue()

    def export_games_json(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> list[dict]:
        """Export games as JSON."""
        games = self._get_games(platform, time_class)
        return [
            {
                "id": g.id,
                "platform": g.platform,
                "white": g.white_username,
                "black": g.black_username,
                "player_color": g.player_color,
                "result": g.result,
                "result_detail": g.result_detail,
                "time_class": g.time_class,
                "time_control": g.time_control,
                "player_rating": g.player_rating,
                "opponent_rating": g.opponent_rating,
                "opening_eco": g.opening_eco,
                "opening_name": g.opening_name,
                "num_moves": g.num_moves,
                "played_at": g.played_at.isoformat() if g.played_at else "",
                "pgn": g.pgn,
            }
            for g in games
        ]

    def export_summary(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict:
        """Export a shareable summary of the user's stats."""
        games = self._get_games(platform, time_class)
        if not games:
            return {"total_games": 0, "message": "No games to export"}

        wins = sum(1 for g in games if g.result == "win")
        losses = sum(1 for g in games if g.result == "loss")
        draws = len(games) - wins - losses
        ratings = [g.player_rating for g in games if g.player_rating]

        game_ids = [g.id for g in games]
        moves = (
            self.db.query(MoveAnalysis)
            .filter(
                MoveAnalysis.game_id.in_(game_ids),
                MoveAnalysis.is_player_move == 1,
            )
            .all()
        )

        avg_cpl = round(
            sum(m.centipawn_loss for m in moves) / len(moves), 1
        ) if moves else 0
        blunders = sum(1 for m in moves if m.classification == "blunder")

        return {
            "total_games": len(games),
            "wins": wins,
            "losses": losses,
            "draws": draws,
            "win_rate": round(wins / len(games) * 100, 1) if games else 0,
            "current_rating": ratings[-1] if ratings else 0,
            "peak_rating": max(ratings) if ratings else 0,
            "avg_cpl": avg_cpl,
            "total_blunders": blunders,
            "games_analyzed": len(set(m.game_id for m in moves)),
            "platforms": list(set(g.platform for g in games)),
            "date_range": {
                "from": games[0].played_at.isoformat() if games[0].played_at else "",
                "to": games[-1].played_at.isoformat() if games[-1].played_at else "",
            },
        }

    def _get_games(
        self,
        platform: str | None,
        time_class: str | None,
    ) -> list:
        q = self.db.query(Game).filter(Game.user_id == self._user_id)
        if platform:
            q = q.filter(Game.platform == platform)
        if time_class:
            q = q.filter(Game.time_class == time_class)
        return q.order_by(Game.played_at).all()
