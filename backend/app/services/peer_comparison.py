"""Peer Comparison: compare user stats against typical players at their rating band."""

from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


# Benchmark data for different rating bands.
# These are approximations based on chess statistics research.
# Format: {rating_band: {metric: value}}
BENCHMARKS = {
    "0-600": {
        "blunder_rate": 18.0,
        "avg_cpl": 120,
        "opening_cpl": 80,
        "middlegame_cpl": 140,
        "endgame_cpl": 150,
        "win_rate": 50.0,
        "avg_game_length": 28,
    },
    "600-800": {
        "blunder_rate": 14.0,
        "avg_cpl": 95,
        "opening_cpl": 60,
        "middlegame_cpl": 110,
        "endgame_cpl": 120,
        "win_rate": 50.0,
        "avg_game_length": 30,
    },
    "800-1000": {
        "blunder_rate": 11.0,
        "avg_cpl": 75,
        "opening_cpl": 45,
        "middlegame_cpl": 85,
        "endgame_cpl": 100,
        "win_rate": 50.0,
        "avg_game_length": 32,
    },
    "1000-1200": {
        "blunder_rate": 8.5,
        "avg_cpl": 58,
        "opening_cpl": 35,
        "middlegame_cpl": 65,
        "endgame_cpl": 80,
        "win_rate": 50.0,
        "avg_game_length": 34,
    },
    "1200-1400": {
        "blunder_rate": 6.5,
        "avg_cpl": 45,
        "opening_cpl": 28,
        "middlegame_cpl": 50,
        "endgame_cpl": 62,
        "win_rate": 50.0,
        "avg_game_length": 36,
    },
    "1400-1600": {
        "blunder_rate": 5.0,
        "avg_cpl": 35,
        "opening_cpl": 22,
        "middlegame_cpl": 40,
        "endgame_cpl": 48,
        "win_rate": 50.0,
        "avg_game_length": 38,
    },
    "1600-1800": {
        "blunder_rate": 3.8,
        "avg_cpl": 28,
        "opening_cpl": 18,
        "middlegame_cpl": 32,
        "endgame_cpl": 38,
        "win_rate": 50.0,
        "avg_game_length": 40,
    },
    "1800-2000": {
        "blunder_rate": 2.8,
        "avg_cpl": 22,
        "opening_cpl": 14,
        "middlegame_cpl": 25,
        "endgame_cpl": 30,
        "win_rate": 50.0,
        "avg_game_length": 42,
    },
    "2000+": {
        "blunder_rate": 2.0,
        "avg_cpl": 18,
        "opening_cpl": 10,
        "middlegame_cpl": 20,
        "endgame_cpl": 24,
        "win_rate": 50.0,
        "avg_game_length": 44,
    },
}


def _get_rating_band(rating: int) -> str:
    if rating < 600:
        return "0-600"
    elif rating < 800:
        return "600-800"
    elif rating < 1000:
        return "800-1000"
    elif rating < 1200:
        return "1000-1200"
    elif rating < 1400:
        return "1200-1400"
    elif rating < 1600:
        return "1400-1600"
    elif rating < 1800:
        return "1600-1800"
    elif rating < 2000:
        return "1800-2000"
    else:
        return "2000+"


class PeerComparisonService:
    def __init__(self, db: Session):
        self.db = db

    def get_comparison(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict:
        """Compare user's stats against their rating band benchmarks."""
        user_stats = self._compute_user_stats(platform, time_class)

        if user_stats["games_played"] < 5:
            return self._empty_report()

        rating = user_stats["avg_rating"]
        band = _get_rating_band(rating)
        benchmark = BENCHMARKS[band]

        comparisons = self._build_comparisons(user_stats, benchmark)
        strengths, weaknesses = self._classify(comparisons)

        return {
            "rating_band": band,
            "avg_rating": rating,
            "games_analyzed": user_stats["games_played"],
            "comparisons": comparisons,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "recommendations": self._generate_recommendations(
                comparisons, strengths, weaknesses, band
            ),
        }

    def _compute_user_stats(
        self,
        platform: str | None,
        time_class: str | None,
    ) -> dict:
        """Compute the user's actual stats from their games."""
        q = self.db.query(Game)
        if platform:
            q = q.filter(Game.platform == platform)
        if time_class:
            q = q.filter(Game.time_class == time_class)
        games = q.all()

        if not games:
            return {"games_played": 0}

        ratings = [g.player_rating for g in games if g.player_rating]
        avg_rating = round(sum(ratings) / len(ratings)) if ratings else 0

        wins = sum(1 for g in games if g.result == "win")
        win_rate = round(wins / len(games) * 100, 1)
        avg_game_length = round(
            sum(g.num_moves for g in games if g.num_moves) / len(games)
        ) if games else 0

        # Get move-level stats
        game_ids = [g.id for g in games]
        moves = (
            self.db.query(MoveAnalysis)
            .filter(
                MoveAnalysis.game_id.in_(game_ids),
                MoveAnalysis.is_player_move == 1,
            )
            .all()
        )

        if not moves:
            return {
                "games_played": len(games),
                "avg_rating": avg_rating,
                "win_rate": win_rate,
                "avg_game_length": avg_game_length,
                "avg_cpl": 0,
                "blunder_rate": 0,
                "opening_cpl": 0,
                "middlegame_cpl": 0,
                "endgame_cpl": 0,
            }

        total_moves = len(moves)
        blunders = sum(1 for m in moves if m.classification == "blunder")
        blunder_rate = round(blunders / total_moves * 100, 1)
        avg_cpl = round(sum(m.centipawn_loss for m in moves) / total_moves, 1)

        # Phase-specific CPL
        phase_cpls: dict[str, list[float]] = defaultdict(list)
        for m in moves:
            if m.game_phase:
                phase_cpls[m.game_phase].append(m.centipawn_loss)

        opening_cpl = round(
            sum(phase_cpls["opening"]) / len(phase_cpls["opening"]), 1
        ) if phase_cpls["opening"] else 0
        middlegame_cpl = round(
            sum(phase_cpls["middlegame"]) / len(phase_cpls["middlegame"]), 1
        ) if phase_cpls["middlegame"] else 0
        endgame_cpl = round(
            sum(phase_cpls["endgame"]) / len(phase_cpls["endgame"]), 1
        ) if phase_cpls["endgame"] else 0

        return {
            "games_played": len(games),
            "avg_rating": avg_rating,
            "win_rate": win_rate,
            "avg_game_length": avg_game_length,
            "avg_cpl": avg_cpl,
            "blunder_rate": blunder_rate,
            "opening_cpl": opening_cpl,
            "middlegame_cpl": middlegame_cpl,
            "endgame_cpl": endgame_cpl,
        }

    def _build_comparisons(self, user: dict, benchmark: dict) -> list[dict]:
        """Build comparison entries for each metric."""
        metrics = [
            ("Blunder Rate", "blunder_rate", "%", "lower"),
            ("Average CPL", "avg_cpl", "", "lower"),
            ("Opening CPL", "opening_cpl", "", "lower"),
            ("Middlegame CPL", "middlegame_cpl", "", "lower"),
            ("Endgame CPL", "endgame_cpl", "", "lower"),
            ("Win Rate", "win_rate", "%", "higher"),
            ("Avg Game Length", "avg_game_length", " moves", "neutral"),
        ]

        comparisons = []
        for label, key, suffix, direction in metrics:
            user_val = user.get(key, 0)
            bench_val = benchmark.get(key, 0)

            if bench_val > 0:
                diff_pct = round((user_val - bench_val) / bench_val * 100, 1)
            else:
                diff_pct = 0

            if direction == "lower":
                verdict = "better" if user_val < bench_val else "worse" if user_val > bench_val else "average"
            elif direction == "higher":
                verdict = "better" if user_val > bench_val else "worse" if user_val < bench_val else "average"
            else:
                verdict = "average"

            comparisons.append({
                "metric": label,
                "your_value": user_val,
                "peer_average": bench_val,
                "difference_pct": diff_pct,
                "suffix": suffix,
                "verdict": verdict,
            })

        return comparisons

    def _classify(self, comparisons: list[dict]) -> tuple[list[str], list[str]]:
        """Classify metrics into strengths and weaknesses."""
        strengths = []
        weaknesses = []

        for c in comparisons:
            if c["verdict"] == "better" and abs(c["difference_pct"]) >= 10:
                strengths.append(c["metric"])
            elif c["verdict"] == "worse" and abs(c["difference_pct"]) >= 10:
                weaknesses.append(c["metric"])

        return strengths, weaknesses

    def _generate_recommendations(
        self,
        comparisons: list[dict],
        strengths: list[str],
        weaknesses: list[str],
        band: str,
    ) -> list[str]:
        recs = []

        if weaknesses:
            worst = max(
                (c for c in comparisons if c["metric"] in weaknesses),
                key=lambda c: abs(c["difference_pct"]),
            )
            recs.append(
                f"Your biggest area for improvement is {worst['metric']} — "
                f"yours is {worst['your_value']}{worst['suffix']} vs "
                f"{worst['peer_average']}{worst['suffix']} peer average "
                f"({abs(worst['difference_pct'])}% {'higher' if worst['difference_pct'] > 0 else 'lower'} than peers)."
            )

        if strengths:
            best = max(
                (c for c in comparisons if c["metric"] in strengths),
                key=lambda c: abs(c["difference_pct"]),
            )
            recs.append(
                f"Your strongest area is {best['metric']} — "
                f"{best['your_value']}{best['suffix']} vs "
                f"{best['peer_average']}{best['suffix']} peer average. "
                f"This is a competitive advantage at the {band} level."
            )

        # Phase-specific advice
        comp_map = {c["metric"]: c for c in comparisons}
        phases = ["Opening CPL", "Middlegame CPL", "Endgame CPL"]
        worst_phase = max(
            (comp_map[p] for p in phases if p in comp_map and comp_map[p]["verdict"] == "worse"),
            key=lambda c: abs(c["difference_pct"]),
            default=None,
        )
        if worst_phase:
            phase_name = worst_phase["metric"].replace(" CPL", "").lower()
            recs.append(
                f"Your {phase_name} play is weaker than typical {band}-rated players. "
                f"Focus your study on {phase_name} positions."
            )

        if not recs:
            recs.append(
                f"Your stats are competitive for the {band} rating band. "
                f"Keep analyzing and you'll continue improving."
            )

        return recs

    def _empty_report(self) -> dict:
        return {
            "rating_band": "",
            "avg_rating": 0,
            "games_analyzed": 0,
            "comparisons": [],
            "strengths": [],
            "weaknesses": [],
            "recommendations": [
                "Not enough analyzed games for comparison. Play and analyze at least 5 games."
            ],
        }
