"""Rating Predictor: project future rating from improvement trajectory."""

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class RatingPredictor:
    def __init__(self, db: Session):
        self.db = db

    def get_prediction(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> dict:
        """Build rating prediction report."""
        games = self._get_games(platform, time_class)

        if len(games) < 5:
            return self._empty_report()

        trajectory = self._compute_trajectory(games)
        milestones = self._project_milestones(trajectory)
        trends = self._weakness_trends(games, platform, time_class)
        monthly = self._monthly_stats(games)

        return {
            "trajectory": trajectory,
            "milestones": milestones,
            "weakness_trends": trends,
            "monthly_performance": monthly,
            "recommendations": self._generate_recommendations(
                trajectory, trends, monthly
            ),
        }

    def _get_games(
        self,
        platform: str | None = None,
        time_class: str | None = None,
    ) -> list:
        q = self.db.query(Game).filter(
            Game.played_at.isnot(None),
            Game.player_rating.isnot(None),
        )
        if platform:
            q = q.filter(Game.platform == platform)
        if time_class:
            q = q.filter(Game.time_class == time_class)
        return q.order_by(Game.played_at).all()

    def _compute_trajectory(self, games: list) -> dict:
        """Compute rating trajectory using linear regression."""
        if not games:
            return self._empty_trajectory()

        first_game = games[0]
        last_game = games[-1]
        current_rating = last_game.player_rating
        starting_rating = first_game.player_rating
        total_change = current_rating - starting_rating

        # Days span
        days_span = (last_game.played_at - first_game.played_at).days
        if days_span == 0:
            days_span = 1

        # Linear regression: rating vs day number
        n = len(games)
        xs = [(g.played_at - first_game.played_at).days for g in games]
        ys = [g.player_rating for g in games]

        mean_x = sum(xs) / n
        mean_y = sum(ys) / n

        ss_xx = sum((x - mean_x) ** 2 for x in xs)
        ss_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))

        if ss_xx == 0:
            slope = 0.0
        else:
            slope = ss_xy / ss_xx

        # Rating per month (30 days)
        rate_per_month = round(slope * 30, 1)

        # Recent trend (last 30 games vs prior 30)
        recent_n = min(30, len(games))
        recent_games = games[-recent_n:]
        recent_avg = sum(g.player_rating for g in recent_games) / len(recent_games)

        if len(games) > recent_n:
            prior_games = games[-(2 * recent_n):-recent_n]
            if prior_games:
                prior_avg = sum(g.player_rating for g in prior_games) / len(prior_games)
                recent_momentum = round(recent_avg - prior_avg, 1)
            else:
                recent_momentum = 0.0
        else:
            recent_momentum = 0.0

        # Peak and valley
        peak_rating = max(g.player_rating for g in games)
        valley_rating = min(g.player_rating for g in games)

        # Win rate over last 30 games
        recent_wins = sum(1 for g in recent_games if g.result == "win")
        recent_win_rate = round(recent_wins / len(recent_games) * 100, 1)

        return {
            "current_rating": current_rating,
            "starting_rating": starting_rating,
            "total_change": total_change,
            "days_tracked": days_span,
            "games_played": n,
            "rate_per_month": rate_per_month,
            "recent_momentum": recent_momentum,
            "peak_rating": peak_rating,
            "valley_rating": valley_rating,
            "recent_win_rate": recent_win_rate,
        }

    def _project_milestones(self, trajectory: dict) -> list[dict]:
        """Project when player will hit rating milestones."""
        current = trajectory["current_rating"]
        rate = trajectory["rate_per_month"]

        if rate <= 0:
            return []

        milestones = []
        targets = [800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
                    1600, 1700, 1800, 1900, 2000, 2100, 2200]

        for target in targets:
            if target <= current:
                continue
            months_needed = (target - current) / rate
            if months_needed > 36:  # Cap at 3 years
                break
            projected_date = datetime.now() + timedelta(days=months_needed * 30)
            milestones.append({
                "target_rating": target,
                "months_away": round(months_needed, 1),
                "projected_date": projected_date.strftime("%Y-%m-%d"),
            })

        return milestones

    def _weakness_trends(
        self,
        games: list,
        platform: str | None,
        time_class: str | None,
    ) -> dict:
        """Track how weaknesses change over time (monthly CPL by phase)."""
        if not games:
            return {"opening_cpl": [], "middlegame_cpl": [], "endgame_cpl": []}

        game_ids = [g.id for g in games]

        # Get move analyses grouped by month
        moves = (
            self.db.query(MoveAnalysis)
            .filter(
                MoveAnalysis.game_id.in_(game_ids),
                MoveAnalysis.is_player_move == 1,
            )
            .all()
        )

        # Build game_id -> played_at mapping
        game_dates = {g.id: g.played_at for g in games}

        monthly_phase: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )

        for m in moves:
            played_at = game_dates.get(m.game_id)
            if not played_at or not m.game_phase:
                continue
            month_key = played_at.strftime("%Y-%m")
            monthly_phase[month_key][m.game_phase].append(m.centipawn_loss)

        result = {"opening_cpl": [], "middlegame_cpl": [], "endgame_cpl": []}

        for month in sorted(monthly_phase.keys()):
            phases = monthly_phase[month]
            for phase in ("opening", "middlegame", "endgame"):
                cpls = phases.get(phase, [])
                if cpls:
                    avg = round(sum(cpls) / len(cpls), 1)
                    result[f"{phase}_cpl"].append({
                        "month": month,
                        "avg_cpl": avg,
                        "moves": len(cpls),
                    })

        return result

    def _monthly_stats(self, games: list) -> list[dict]:
        """Compute monthly performance stats."""
        monthly: dict[str, dict] = defaultdict(
            lambda: {"games": 0, "wins": 0, "losses": 0, "draws": 0,
                      "ratings": [], "month": ""}
        )

        for g in games:
            if not g.played_at:
                continue
            month_key = g.played_at.strftime("%Y-%m")
            m = monthly[month_key]
            m["month"] = month_key
            m["games"] += 1
            m["ratings"].append(g.player_rating)
            if g.result == "win":
                m["wins"] += 1
            elif g.result == "loss":
                m["losses"] += 1
            else:
                m["draws"] += 1

        result = []
        for month in sorted(monthly.keys()):
            m = monthly[month]
            ratings = m["ratings"]
            result.append({
                "month": m["month"],
                "games": m["games"],
                "wins": m["wins"],
                "losses": m["losses"],
                "draws": m["draws"],
                "win_rate": round(m["wins"] / m["games"] * 100, 1) if m["games"] > 0 else 0,
                "avg_rating": round(sum(ratings) / len(ratings)) if ratings else 0,
                "peak_rating": max(ratings) if ratings else 0,
                "rating_change": ratings[-1] - ratings[0] if len(ratings) >= 2 else 0,
            })

        return result

    def _generate_recommendations(
        self,
        trajectory: dict,
        trends: dict,
        monthly: list[dict],
    ) -> list[str]:
        """Generate motivational and actionable recommendations."""
        recs = []

        rate = trajectory.get("rate_per_month", 0)
        momentum = trajectory.get("recent_momentum", 0)
        current = trajectory.get("current_rating", 0)
        peak = trajectory.get("peak_rating", 0)

        # Overall trend
        if rate > 0:
            recs.append(
                f"You're gaining ~{rate} rating points per month. "
                f"Keep up the consistent play!"
            )
        elif rate < -5:
            recs.append(
                f"Your rating trend is declining ({rate} points/month). "
                f"Focus on studying your weak areas rather than playing more games."
            )

        # Recent momentum
        if momentum > 20:
            recs.append(
                f"Strong recent momentum (+{momentum} rating in your last batch of games). "
                f"Your improvement is accelerating."
            )
        elif momentum < -20:
            recs.append(
                f"Your recent performance shows a dip ({momentum} rating). "
                f"This could be a plateau — review your recent losses for patterns."
            )

        # Near peak
        if current >= peak - 10 and peak > 0:
            recs.append(
                f"You're at or near your all-time peak of {peak}! "
                f"Stay focused to break through."
            )
        elif peak - current > 100:
            recs.append(
                f"You're {peak - current} points below your peak of {peak}. "
                f"Review what worked when you were playing your best."
            )

        # CPL trend analysis
        for phase in ("opening", "middlegame", "endgame"):
            data = trends.get(f"{phase}_cpl", [])
            if len(data) >= 3:
                recent_avg = sum(d["avg_cpl"] for d in data[-2:]) / 2
                earlier_avg = sum(d["avg_cpl"] for d in data[:2]) / 2
                if recent_avg < earlier_avg - 5:
                    recs.append(
                        f"Your {phase} play is improving — CPL dropped from "
                        f"{earlier_avg:.0f} to {recent_avg:.0f}."
                    )
                elif recent_avg > earlier_avg + 10:
                    recs.append(
                        f"Your {phase} CPL has increased from {earlier_avg:.0f} to "
                        f"{recent_avg:.0f}. Focus on {phase} training."
                    )

        # Win rate trend
        if len(monthly) >= 2:
            last_wr = monthly[-1]["win_rate"]
            prev_wr = monthly[-2]["win_rate"]
            if last_wr > prev_wr + 10:
                recs.append(
                    f"Win rate improved from {prev_wr}% to {last_wr}% this month."
                )

        if not recs:
            recs.append(
                "Keep playing and analyzing your games to build a stronger "
                "prediction model."
            )

        return recs

    def _empty_report(self) -> dict:
        return {
            "trajectory": self._empty_trajectory(),
            "milestones": [],
            "weakness_trends": {"opening_cpl": [], "middlegame_cpl": [], "endgame_cpl": []},
            "monthly_performance": [],
            "recommendations": [
                "Not enough games for prediction. Play at least 5 analyzed games."
            ],
        }

    def _empty_trajectory(self) -> dict:
        return {
            "current_rating": 0,
            "starting_rating": 0,
            "total_change": 0,
            "days_tracked": 0,
            "games_played": 0,
            "rate_per_month": 0,
            "recent_momentum": 0,
            "peak_rating": 0,
            "valley_rating": 0,
            "recent_win_rate": 0,
        }
