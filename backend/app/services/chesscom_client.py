import io
import re
from datetime import datetime

import chess.pgn
import httpx


class ChessComClient:
    BASE = "https://api.chess.com/pub"
    HEADERS = {"User-Agent": "ChessMaster/1.0 (chess analysis app)"}

    async def fetch_games(self, username: str) -> list[dict]:
        """Fetch all games for a user from Chess.com."""
        async with httpx.AsyncClient(headers=self.HEADERS, timeout=30) as client:
            # Get archive list
            resp = await client.get(f"{self.BASE}/player/{username}/games/archives")
            resp.raise_for_status()
            archives = resp.json().get("archives", [])

            all_games = []
            for archive_url in archives:
                resp = await client.get(archive_url)
                resp.raise_for_status()
                month_games = resp.json().get("games", [])

                for g in month_games:
                    if g.get("rules") != "chess":
                        continue

                    parsed = self._parse_game(g, username)
                    if parsed:
                        all_games.append(parsed)

            return all_games

    def _parse_game(self, g: dict, username: str) -> dict | None:
        pgn_str = g.get("pgn")
        if not pgn_str:
            return None

        white = g.get("white", {})
        black = g.get("black", {})
        white_name = white.get("username", "").lower()
        black_name = black.get("username", "").lower()
        is_white = white_name == username.lower()

        player = white if is_white else black
        opponent = black if is_white else white

        player_result = player.get("result", "")
        if player_result == "win":
            result = "win"
        elif player_result in (
            "checkmated", "timeout", "resigned", "abandoned",
            "kingofthehill", "threecheck",
        ):
            result = "loss"
        else:
            result = "draw"

        # Parse ECO from PGN headers
        eco = None
        opening_name = None
        try:
            game = chess.pgn.read_game(io.StringIO(pgn_str))
            if game:
                eco = game.headers.get("ECO")
                eco_url = game.headers.get("ECOUrl", "")
                if eco_url:
                    opening_name = eco_url.split("/")[-1].replace("-", " ").title()
                elif game.headers.get("Opening"):
                    opening_name = game.headers.get("Opening")
                # Count moves
                num_moves = sum(1 for _ in game.mainline_moves())
        except Exception:
            num_moves = 0

        end_time = g.get("end_time", 0)
        played_at = datetime.utcfromtimestamp(end_time) if end_time else datetime.utcnow()

        accuracies = g.get("accuracies", {})
        player_accuracy = accuracies.get("white" if is_white else "black")

        return {
            "platform": "chesscom",
            "platform_id": g.get("uuid", str(g.get("url", ""))),
            "pgn": pgn_str,
            "white_username": white_name,
            "black_username": black_name,
            "player_color": "white" if is_white else "black",
            "time_class": g.get("time_class", ""),
            "time_control": g.get("time_control", ""),
            "result": result,
            "result_detail": player_result,
            "player_rating": player.get("rating", 0),
            "opponent_rating": opponent.get("rating", 0),
            "opening_eco": eco,
            "opening_name": opening_name,
            "num_moves": num_moves,
            "played_at": played_at,
            "platform_accuracy": player_accuracy,
        }
