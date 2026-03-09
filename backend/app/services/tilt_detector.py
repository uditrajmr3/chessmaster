import json
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis


class TiltDetector:
    def __init__(self, db: Session):
        self.db = db

    def analyze(self) -> dict:
        games = (
            self.db.query(Game)
            .order_by(Game.played_at)
            .all()
        )

        if not games:
            return self._empty_report()

        streaks = self._compute_streaks(games)
        blunder_by_streak = self._blunder_rate_by_losing_streak(games)
        sessions = self._detect_sessions(games)
        session_stats = self._session_performance(sessions)
        rating_drops = self._tilt_rating_drops(games)
        recommendations = self._generate_recommendations(
            blunder_by_streak, session_stats, rating_drops
        )

        return {
            "streaks": streaks,
            "blunder_by_losing_streak": blunder_by_streak,
            "sessions": session_stats,
            "rating_drops": rating_drops,
            "recommendations": recommendations,
        }

    def _compute_streaks(self, games: list[Game]) -> dict:
        """Compute win/loss streak statistics."""
        current_streak = 0
        max_win_streak = 0
        max_loss_streak = 0
        win_streaks: list[int] = []
        loss_streaks: list[int] = []
        streak_type = None

        for g in games:
            if g.result == "win":
                if streak_type == "win":
                    current_streak += 1
                else:
                    if streak_type == "loss" and current_streak > 0:
                        loss_streaks.append(current_streak)
                    streak_type = "win"
                    current_streak = 1
            elif g.result == "loss":
                if streak_type == "loss":
                    current_streak += 1
                else:
                    if streak_type == "win" and current_streak > 0:
                        win_streaks.append(current_streak)
                    streak_type = "loss"
                    current_streak = 1
            else:
                # Draw breaks streak
                if streak_type == "win" and current_streak > 0:
                    win_streaks.append(current_streak)
                elif streak_type == "loss" and current_streak > 0:
                    loss_streaks.append(current_streak)
                streak_type = None
                current_streak = 0

        # Close final streak
        if streak_type == "win" and current_streak > 0:
            win_streaks.append(current_streak)
        elif streak_type == "loss" and current_streak > 0:
            loss_streaks.append(current_streak)

        max_win_streak = max(win_streaks) if win_streaks else 0
        max_loss_streak = max(loss_streaks) if loss_streaks else 0
        avg_win_streak = (
            round(sum(win_streaks) / len(win_streaks), 1) if win_streaks else 0
        )
        avg_loss_streak = (
            round(sum(loss_streaks) / len(loss_streaks), 1) if loss_streaks else 0
        )

        return {
            "max_win_streak": max_win_streak,
            "max_loss_streak": max_loss_streak,
            "avg_win_streak": avg_win_streak,
            "avg_loss_streak": avg_loss_streak,
            "total_win_streaks": len(win_streaks),
            "total_loss_streaks": len(loss_streaks),
        }

    def _blunder_rate_by_losing_streak(self, games: list[Game]) -> dict:
        """Calculate blunder rate based on how many consecutive losses preceded a game."""
        consecutive_losses = 0
        # Map: consecutive_losses_before -> list of game_ids
        games_by_streak: dict[int, list[str]] = defaultdict(list)

        for g in games:
            games_by_streak[consecutive_losses].append(g.id)
            if g.result == "loss":
                consecutive_losses += 1
            else:
                consecutive_losses = 0

        result = {}
        for streak_len, game_ids in sorted(games_by_streak.items()):
            if streak_len > 5:
                continue  # Cap at 5+ for readability
            total_moves = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.game_id.in_(game_ids),
                    MoveAnalysis.is_player_move == 1,
                )
                .scalar() or 0
            )
            blunders = (
                self.db.query(func.count(MoveAnalysis.id))
                .filter(
                    MoveAnalysis.game_id.in_(game_ids),
                    MoveAnalysis.is_player_move == 1,
                    MoveAnalysis.classification == "blunder",
                )
                .scalar() or 0
            )
            rate = round(blunders / total_moves * 100, 2) if total_moves > 0 else 0.0
            label = f"{streak_len}" if streak_len < 5 else "5+"
            result[label] = {
                "blunder_rate": rate,
                "games": len(game_ids),
                "total_moves": total_moves,
                "blunders": blunders,
            }

        return result

    def _detect_sessions(self, games: list[Game]) -> list[list[Game]]:
        """Group games into sessions (games played within 30 min of each other)."""
        if not games:
            return []

        sessions: list[list[Game]] = [[games[0]]]
        for g in games[1:]:
            prev = sessions[-1][-1]
            gap = (g.played_at - prev.played_at).total_seconds()
            if gap <= 1800:  # 30 minutes
                sessions[-1].append(g)
            else:
                sessions.append([g])

        return sessions

    def _session_performance(self, sessions: list[list[Game]]) -> list[dict]:
        """Analyze performance degradation within sessions."""
        session_summaries = []

        for session in sessions:
            if len(session) < 2:
                continue

            games_data = []
            cumulative_losses = 0
            for i, g in enumerate(session):
                game_ids = [g.id]
                total = (
                    self.db.query(func.count(MoveAnalysis.id))
                    .filter(
                        MoveAnalysis.game_id.in_(game_ids),
                        MoveAnalysis.is_player_move == 1,
                    )
                    .scalar() or 0
                )
                blunders = (
                    self.db.query(func.count(MoveAnalysis.id))
                    .filter(
                        MoveAnalysis.game_id.in_(game_ids),
                        MoveAnalysis.is_player_move == 1,
                        MoveAnalysis.classification == "blunder",
                    )
                    .scalar() or 0
                )
                blunder_rate = round(blunders / total * 100, 2) if total > 0 else 0

                if g.result == "loss":
                    cumulative_losses += 1

                games_data.append({
                    "game_number": i + 1,
                    "result": g.result,
                    "rating": g.player_rating,
                    "blunder_rate": blunder_rate,
                    "cumulative_losses": cumulative_losses,
                })

            first_rating = session[0].player_rating
            last_rating = session[-1].player_rating
            wins = sum(1 for g in session if g.result == "win")
            losses = sum(1 for g in session if g.result == "loss")

            session_summaries.append({
                "date": session[0].played_at.isoformat(),
                "game_count": len(session),
                "wins": wins,
                "losses": losses,
                "rating_change": last_rating - first_rating,
                "games": games_data,
            })

        # Only return the 20 most recent sessions
        return session_summaries[-20:]

    def _tilt_rating_drops(self, games: list[Game]) -> list[dict]:
        """Find significant rating drops within a single session."""
        sessions = self._detect_sessions(games)
        drops = []

        for session in sessions:
            if len(session) < 3:
                continue

            peak_rating = session[0].player_rating
            max_drop = 0
            drop_start = session[0]
            drop_end = session[0]

            for g in session:
                if g.player_rating > peak_rating:
                    peak_rating = g.player_rating
                    drop_start = g
                current_drop = peak_rating - g.player_rating
                if current_drop > max_drop:
                    max_drop = current_drop
                    drop_end = g

            if max_drop >= 50:
                losses_in_session = sum(1 for g in session if g.result == "loss")
                drops.append({
                    "date": session[0].played_at.isoformat(),
                    "games_in_session": len(session),
                    "rating_drop": max_drop,
                    "peak_rating": peak_rating,
                    "low_rating": peak_rating - max_drop,
                    "losses": losses_in_session,
                })

        return sorted(drops, key=lambda d: d["rating_drop"], reverse=True)[:10]

    def _generate_recommendations(
        self,
        blunder_by_streak: dict,
        session_stats: list[dict],
        rating_drops: list[dict],
    ) -> list[str]:
        """Generate actionable behavioral recommendations."""
        recs = []

        # Check if blunder rate increases with consecutive losses
        baseline = blunder_by_streak.get("0", {}).get("blunder_rate", 0)
        for streak_len in ["1", "2", "3"]:
            data = blunder_by_streak.get(streak_len, {})
            if data.get("games", 0) >= 5 and data.get("blunder_rate", 0) > baseline * 1.3:
                increase = round(data["blunder_rate"] / baseline, 1) if baseline > 0 else 0
                recs.append(
                    f"After {streak_len} consecutive loss{'es' if streak_len != '1' else ''}, "
                    f"your blunder rate is {data['blunder_rate']}% "
                    f"({increase}x your baseline of {baseline}%). "
                    f"Consider taking a break after {streak_len} loss{'es' if streak_len != '1' else ''}."
                )
                break  # Only show the most relevant threshold

        # Check for long sessions degrading performance
        degrading_sessions = 0
        for s in session_stats:
            if s["game_count"] >= 5 and s["rating_change"] < -30:
                degrading_sessions += 1
        if degrading_sessions >= 3:
            recs.append(
                f"You had {degrading_sessions} sessions with 5+ games that ended with "
                f"significant rating drops. Try limiting sessions to 3-4 games."
            )

        # Check for severe tilt episodes
        if rating_drops:
            worst = rating_drops[0]
            recs.append(
                f"Your worst tilt session dropped {worst['rating_drop']} rating points "
                f"({worst['peak_rating']} to {worst['low_rating']}) in {worst['games_in_session']} games. "
                f"Set a hard stop-loss rule: quit after losing {min(3, worst['losses'])} games."
            )

        if not recs:
            recs.append(
                "Your tilt patterns look manageable. Keep monitoring your streaks "
                "and take breaks when you notice frustration building."
            )

        return recs

    def _empty_report(self) -> dict:
        return {
            "streaks": {
                "max_win_streak": 0, "max_loss_streak": 0,
                "avg_win_streak": 0, "avg_loss_streak": 0,
                "total_win_streaks": 0, "total_loss_streaks": 0,
            },
            "blunder_by_losing_streak": {},
            "sessions": [],
            "rating_drops": [],
            "recommendations": ["Sync and analyze your games to see tilt data."],
        }
