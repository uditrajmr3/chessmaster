"""Weekly Digest: compile a summary of recent chess performance."""

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class DigestService:
    def __init__(self, db: Session):
        self.db = db

    def get_digest(
        self,
        days: int = 7,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict:
        """Generate a digest of the last N days of play."""
        cutoff = datetime.now() - timedelta(days=days)
        games = self._get_games(cutoff, platform, time_class)

        if not games:
            return self._empty_digest(days)

        summary = self._game_summary(games)
        openings = self._opening_summary(games)
        accuracy = self._accuracy_summary(games)
        improvement = self._improvement_check(games, cutoff, platform, time_class)
        highlights = self._highlights(games)

        return {
            "period_days": days,
            "period_start": cutoff.strftime("%Y-%m-%d"),
            "period_end": datetime.now().strftime("%Y-%m-%d"),
            "summary": summary,
            "openings": openings,
            "accuracy": accuracy,
            "improvement": improvement,
            "highlights": highlights,
            "digest_text": self._format_text(summary, openings, accuracy, improvement, highlights, days),
        }

    def _get_games(
        self,
        cutoff: datetime,
        platform: str | None,
        time_class: str | None,
    ) -> list:
        q = self.db.query(Game).filter(Game.played_at >= cutoff)
        if platform:
            q = q.filter(Game.platform == platform)
        if time_class:
            q = q.filter(Game.time_class == time_class)
        return q.order_by(Game.played_at).all()

    def _game_summary(self, games: list) -> dict:
        wins = sum(1 for g in games if g.result == "win")
        losses = sum(1 for g in games if g.result == "loss")
        draws = len(games) - wins - losses
        win_rate = round(wins / len(games) * 100, 1) if games else 0

        ratings = [g.player_rating for g in games if g.player_rating]
        rating_start = ratings[0] if ratings else 0
        rating_end = ratings[-1] if ratings else 0
        rating_change = rating_end - rating_start

        return {
            "total_games": len(games),
            "wins": wins,
            "losses": losses,
            "draws": draws,
            "win_rate": win_rate,
            "rating_start": rating_start,
            "rating_end": rating_end,
            "rating_change": rating_change,
        }

    def _opening_summary(self, games: list) -> list[dict]:
        """Most played openings in the period."""
        openings: dict[str, dict] = defaultdict(
            lambda: {"eco": "", "name": "", "games": 0, "wins": 0, "losses": 0}
        )
        for g in games:
            eco = g.opening_eco
            if not eco:
                continue
            o = openings[eco]
            o["eco"] = eco
            o["name"] = g.opening_name or eco
            o["games"] += 1
            if g.result == "win":
                o["wins"] += 1
            elif g.result == "loss":
                o["losses"] += 1

        result = sorted(openings.values(), key=lambda x: x["games"], reverse=True)
        return result[:5]

    def _accuracy_summary(self, games: list) -> dict:
        """CPL stats for the period."""
        game_ids = [g.id for g in games]
        if not game_ids:
            return {"avg_cpl": 0, "blunders": 0, "mistakes": 0, "missed_tactics": 0}

        moves = (
            self.db.query(MoveAnalysis)
            .filter(
                MoveAnalysis.game_id.in_(game_ids),
                MoveAnalysis.is_player_move == 1,
            )
            .all()
        )

        if not moves:
            return {"avg_cpl": 0, "blunders": 0, "mistakes": 0, "missed_tactics": 0}

        avg_cpl = round(sum(m.centipawn_loss for m in moves) / len(moves), 1)
        blunders = sum(1 for m in moves if m.classification == "blunder")
        mistakes = sum(1 for m in moves if m.classification == "mistake")
        missed_tactics = sum(
            1 for m in moves
            if m.tactical_motifs and m.centipawn_loss > 50
        )

        return {
            "avg_cpl": avg_cpl,
            "blunders": blunders,
            "mistakes": mistakes,
            "missed_tactics": missed_tactics,
        }

    def _improvement_check(
        self,
        current_games: list,
        cutoff: datetime,
        platform: str | None,
        time_class: str | None,
    ) -> dict:
        """Compare this period to the previous period."""
        prev_cutoff = cutoff - (datetime.now() - cutoff)
        prev_games = self._get_games(prev_cutoff, platform, time_class)
        # Only keep games from previous period (before cutoff)
        prev_games = [g for g in prev_games if g.played_at < cutoff]

        if not prev_games:
            return {"has_comparison": False}

        curr_summary = self._game_summary(current_games)
        prev_summary = self._game_summary(prev_games)
        curr_accuracy = self._accuracy_summary(current_games)
        prev_accuracy = self._accuracy_summary(prev_games)

        return {
            "has_comparison": True,
            "win_rate_change": round(curr_summary["win_rate"] - prev_summary["win_rate"], 1),
            "cpl_change": round(curr_accuracy["avg_cpl"] - prev_accuracy["avg_cpl"], 1),
            "games_change": curr_summary["total_games"] - prev_summary["total_games"],
            "prev_win_rate": prev_summary["win_rate"],
            "prev_avg_cpl": prev_accuracy["avg_cpl"],
        }

    def _highlights(self, games: list) -> list[dict]:
        """Notable games from the period."""
        highlights = []

        # Best win (highest rated opponent beaten)
        wins = [g for g in games if g.result == "win"]
        if wins:
            best_win = max(wins, key=lambda g: g.opponent_rating or 0)
            highlights.append({
                "type": "best_win",
                "game_id": best_win.id,
                "description": f"Beat {best_win.opponent_rating}-rated opponent",
                "opponent_rating": best_win.opponent_rating,
            })

        # Biggest upset (largest rating gap win)
        upsets = [g for g in wins if g.opponent_rating and g.player_rating
                  and g.opponent_rating > g.player_rating + 50]
        if upsets:
            biggest = max(upsets, key=lambda g: g.opponent_rating - g.player_rating)
            gap = biggest.opponent_rating - biggest.player_rating
            highlights.append({
                "type": "upset",
                "game_id": biggest.id,
                "description": f"Upset win against +{gap} rated opponent",
                "rating_gap": gap,
            })

        # Longest game
        longest = max(games, key=lambda g: g.num_moves or 0)
        if longest.num_moves and longest.num_moves > 40:
            highlights.append({
                "type": "longest_game",
                "game_id": longest.id,
                "description": f"Longest game: {longest.num_moves} moves ({longest.result})",
                "num_moves": longest.num_moves,
            })

        return highlights

    def _format_text(
        self,
        summary: dict,
        openings: list[dict],
        accuracy: dict,
        improvement: dict,
        highlights: list[dict],
        days: int,
    ) -> str:
        """Format digest as readable text (for email or display)."""
        lines = [f"Your {days}-Day Chess Digest", "=" * 30, ""]

        lines.append(
            f"Games: {summary['total_games']} "
            f"({summary['wins']}W / {summary['losses']}L / {summary['draws']}D) — "
            f"{summary['win_rate']}% win rate"
        )

        if summary["rating_change"] != 0:
            sign = "+" if summary["rating_change"] > 0 else ""
            lines.append(
                f"Rating: {summary['rating_start']} → {summary['rating_end']} "
                f"({sign}{summary['rating_change']})"
            )

        lines.append("")

        if accuracy["avg_cpl"] > 0:
            lines.append(f"Average CPL: {accuracy['avg_cpl']}")
            lines.append(
                f"Blunders: {accuracy['blunders']} | "
                f"Mistakes: {accuracy['mistakes']} | "
                f"Missed tactics: {accuracy['missed_tactics']}"
            )
            lines.append("")

        if openings:
            lines.append("Top Openings:")
            for o in openings[:3]:
                lines.append(
                    f"  {o['name']} ({o['eco']}): "
                    f"{o['games']} games, {o['wins']}W/{o['losses']}L"
                )
            lines.append("")

        if improvement.get("has_comparison"):
            lines.append("vs. Previous Period:")
            wr_sign = "+" if improvement["win_rate_change"] >= 0 else ""
            lines.append(f"  Win rate: {wr_sign}{improvement['win_rate_change']}%")
            cpl_sign = "+" if improvement["cpl_change"] >= 0 else ""
            cpl_note = " (worse)" if improvement["cpl_change"] > 0 else " (better)" if improvement["cpl_change"] < 0 else ""
            lines.append(f"  Avg CPL: {cpl_sign}{improvement['cpl_change']}{cpl_note}")
            lines.append("")

        if highlights:
            lines.append("Highlights:")
            for h in highlights:
                lines.append(f"  {h['description']}")

        return "\n".join(lines)

    def _empty_digest(self, days: int) -> dict:
        return {
            "period_days": days,
            "period_start": (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d"),
            "period_end": datetime.now().strftime("%Y-%m-%d"),
            "summary": {
                "total_games": 0, "wins": 0, "losses": 0, "draws": 0,
                "win_rate": 0, "rating_start": 0, "rating_end": 0, "rating_change": 0,
            },
            "openings": [],
            "accuracy": {"avg_cpl": 0, "blunders": 0, "mistakes": 0, "missed_tactics": 0},
            "improvement": {"has_comparison": False},
            "highlights": [],
            "digest_text": f"No games played in the last {days} days.",
        }
