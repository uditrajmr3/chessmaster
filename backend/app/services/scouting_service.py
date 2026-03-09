from collections import Counter, defaultdict

from sqlalchemy.orm import Session

from ..models import Game
from .chesscom_client import ChessComClient
from .lichess_client import LichessClient


class ScoutingService:
    def __init__(self, db: Session):
        self.db = db
        self._chesscom = ChessComClient()
        self._lichess = LichessClient()

    async def scout_opponent(
        self,
        opponent_username: str,
        platform: str,
        max_games: int = 100,
    ) -> dict:
        """Fetch opponent's recent games and cross-reference with user's data."""
        # Fetch opponent games
        if platform == "chesscom":
            opp_games = await self._chesscom.fetch_recent_games(opponent_username, max_games)
        else:
            opp_games = await self._lichess.fetch_recent_games(opponent_username, max_games)

        if not opp_games:
            return self._empty_report(opponent_username, platform)

        # Build opponent profile
        opponent_profile = self._build_profile(opp_games, opponent_username, platform)
        white_openings = self._opening_breakdown(opp_games, "white")
        black_openings = self._opening_breakdown(opp_games, "black")

        # Cross-reference with user's data
        cross_ref = {
            "your_record_vs_their_white_openings": self._cross_reference(white_openings),
            "your_record_vs_their_black_openings": self._cross_reference(black_openings),
        }

        # Generate recommendations
        recommendations = self._generate_recommendations(
            white_openings, black_openings, cross_ref, opponent_profile
        )

        return {
            "opponent": opponent_profile,
            "opponent_white_openings": white_openings,
            "opponent_black_openings": black_openings,
            "cross_reference": cross_ref,
            "recommendations": recommendations,
        }

    def _build_profile(self, games: list[dict], username: str, platform: str) -> dict:
        """Build summary profile of the opponent."""
        white_games = [g for g in games if g["player_color"] == "white"]
        black_games = [g for g in games if g["player_color"] == "black"]

        white_wins = sum(1 for g in white_games if g["result"] == "win")
        black_wins = sum(1 for g in black_games if g["result"] == "win")

        # Most recent rating
        rating = games[0]["player_rating"] if games else 0

        # Favorite time class
        tc_counts = Counter(g["time_class"] for g in games if g["time_class"])
        favorite_tc = tc_counts.most_common(1)[0][0] if tc_counts else ""

        return {
            "username": username,
            "platform": platform,
            "games_analyzed": len(games),
            "rating": rating,
            "white_win_rate": round(white_wins / len(white_games) * 100, 1) if white_games else 0,
            "black_win_rate": round(black_wins / len(black_games) * 100, 1) if black_games else 0,
            "favorite_time_class": favorite_tc,
        }

    def _opening_breakdown(self, games: list[dict], color: str) -> list[dict]:
        """Break down openings for a given color."""
        color_games = [g for g in games if g["player_color"] == color]
        if not color_games:
            return []

        openings: dict[str, dict] = defaultdict(
            lambda: {"eco": "", "name": "", "games": 0, "wins": 0, "losses": 0, "draws": 0}
        )

        for g in color_games:
            eco = g.get("opening_eco")
            if not eco:
                continue
            o = openings[eco]
            o["eco"] = eco
            o["name"] = g.get("opening_name") or eco
            o["games"] += 1
            if g["result"] == "win":
                o["wins"] += 1
            elif g["result"] == "loss":
                o["losses"] += 1
            else:
                o["draws"] += 1

        total = len(color_games)
        result = []
        for o in sorted(openings.values(), key=lambda x: x["games"], reverse=True):
            o["frequency_pct"] = round(o["games"] / total * 100, 1)
            result.append(o)

        return result[:10]  # Top 10 openings

    def _cross_reference(self, opponent_openings: list[dict]) -> list[dict]:
        """Cross-reference opponent's openings with user's game history."""
        results = []
        for opp_opening in opponent_openings:
            eco = opp_opening["eco"]
            user_games = self.db.query(Game).filter(Game.opening_eco == eco).all()

            if user_games:
                user_wins = sum(1 for g in user_games if g.result == "win")
                win_rate = round(user_wins / len(user_games) * 100, 1)
            else:
                win_rate = None

            results.append({
                "eco": eco,
                "name": opp_opening["name"],
                "opponent_plays_pct": opp_opening["frequency_pct"],
                "your_games": len(user_games),
                "your_win_rate": win_rate,
            })

        return results

    def _generate_recommendations(
        self,
        white_openings: list[dict],
        black_openings: list[dict],
        cross_ref: dict,
        profile: dict,
    ) -> list[str]:
        """Generate actionable pre-game recommendations."""
        recs = []

        # Describe opponent's main opening tendencies
        if black_openings:
            top = black_openings[0]
            recs.append(
                f"As black, opponent favors {top['name']} ({top['eco']}) — "
                f"played in {top['frequency_pct']}% of games "
                f"({top['wins']}W/{top['losses']}L/{top['draws']}D)."
            )
        if white_openings:
            top = white_openings[0]
            recs.append(
                f"As white, opponent favors {top['name']} ({top['eco']}) — "
                f"played in {top['frequency_pct']}% of games "
                f"({top['wins']}W/{top['losses']}L/{top['draws']}D)."
            )

        # Check opponent's openings as black vs user's performance
        for entry in cross_ref.get("your_record_vs_their_black_openings", []):
            if entry["opponent_plays_pct"] >= 10 and entry["your_games"] >= 2:
                if entry["your_win_rate"] is not None and entry["your_win_rate"] < 45:
                    eco = entry["eco"]
                    if eco.startswith(("B", "C")):
                        recs.append(
                            f"You win only {entry['your_win_rate']}% against {entry['name']} ({eco}), "
                            f"which this opponent plays in {entry['opponent_plays_pct']}% of games as black. "
                            f"Consider playing 1.d4 instead of 1.e4."
                        )
                    elif eco.startswith(("D", "E")):
                        recs.append(
                            f"You win only {entry['your_win_rate']}% against {entry['name']} ({eco}), "
                            f"which this opponent plays in {entry['opponent_plays_pct']}% of games as black. "
                            f"Consider playing 1.e4 instead of 1.d4."
                        )
                    else:
                        recs.append(
                            f"You win only {entry['your_win_rate']}% against {entry['name']} ({eco}), "
                            f"which this opponent plays in {entry['opponent_plays_pct']}% of games as black. "
                            f"Prepare an alternative."
                        )
                    break

        # Check opponent's openings as white vs user's performance
        for entry in cross_ref.get("your_record_vs_their_white_openings", []):
            if entry["opponent_plays_pct"] >= 10 and entry["your_games"] >= 2:
                if entry["your_win_rate"] is not None and entry["your_win_rate"] < 45:
                    recs.append(
                        f"You win only {entry['your_win_rate']}% against {entry['name']} ({entry['eco']}), "
                        f"which this opponent plays in {entry['opponent_plays_pct']}% of games as white. "
                        f"Prepare a specific defense."
                    )
                    break

        # Highlight user's strengths
        for entry in cross_ref.get("your_record_vs_their_black_openings", []):
            if entry["your_games"] >= 2 and entry["your_win_rate"] is not None and entry["your_win_rate"] >= 55:
                if entry["opponent_plays_pct"] >= 10:
                    recs.append(
                        f"You perform well against {entry['name']} ({entry['eco']}) "
                        f"with a {entry['your_win_rate']}% win rate — "
                        f"try to steer into this opening."
                    )
                    break

        for entry in cross_ref.get("your_record_vs_their_white_openings", []):
            if entry["your_games"] >= 2 and entry["your_win_rate"] is not None and entry["your_win_rate"] >= 55:
                if entry["opponent_plays_pct"] >= 10:
                    recs.append(
                        f"You handle {entry['name']} ({entry['eco']}) well "
                        f"({entry['your_win_rate']}% win rate) — you should be comfortable here."
                    )
                    break

        # Highlight openings user has no experience with
        no_exp = []
        for side in ("your_record_vs_their_black_openings", "your_record_vs_their_white_openings"):
            for entry in cross_ref.get(side, []):
                if entry["your_games"] == 0 and entry["opponent_plays_pct"] >= 10:
                    no_exp.append(f"{entry['name']} ({entry['eco']})")
        if no_exp:
            recs.append(
                f"You have no experience against: {', '.join(no_exp[:3])}. "
                f"Consider studying these lines before the game."
            )

        # Color strength comparison
        white_wr = profile.get("white_win_rate", 0)
        black_wr = profile.get("black_win_rate", 0)
        if white_wr > black_wr + 8:
            recs.append(
                f"Opponent is stronger as white ({white_wr}%) than black ({black_wr}%). "
                f"Try to get white if possible."
            )
        elif black_wr > white_wr + 8:
            recs.append(
                f"Opponent is stronger as black ({black_wr}%) than white ({white_wr}%). "
                f"Try to get black to neutralize their advantage."
            )

        # Opponent's weakest opening (lowest win rate with enough games)
        for openings, color_label in [(white_openings, "white"), (black_openings, "black")]:
            for o in openings:
                if o["games"] >= 3:
                    opp_wr = round(o["wins"] / o["games"] * 100, 1) if o["games"] > 0 else 0
                    if opp_wr < 35:
                        recs.append(
                            f"Opponent struggles with {o['name']} ({o['eco']}) as {color_label} — "
                            f"only {opp_wr}% win rate in {o['games']} games. Exploit this."
                        )
                        break

        return recs

    def _empty_report(self, username: str, platform: str) -> dict:
        return {
            "opponent": {
                "username": username,
                "platform": platform,
                "games_analyzed": 0,
                "rating": 0,
                "white_win_rate": 0,
                "black_win_rate": 0,
                "favorite_time_class": "",
            },
            "opponent_white_openings": [],
            "opponent_black_openings": [],
            "cross_reference": {
                "your_record_vs_their_white_openings": [],
                "your_record_vs_their_black_openings": [],
            },
            "recommendations": ["No games found for this opponent."],
        }
