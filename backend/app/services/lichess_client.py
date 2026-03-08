from datetime import datetime

import httpx


class LichessClient:
    BASE = "https://lichess.org/api"

    async def fetch_games(self, username: str) -> list[dict]:
        """Fetch all games from Lichess via NDJSON streaming."""
        url = f"{self.BASE}/games/user/{username}"
        params = {
            "clocks": "true",
            "opening": "true",
            "evals": "true",
            "pgnInJson": "true",
        }
        headers = {"Accept": "application/x-ndjson"}

        all_games = []
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("GET", url, params=params, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    import json
                    g = json.loads(line)
                    parsed = self._parse_game(g, username)
                    if parsed:
                        all_games.append(parsed)

        return all_games

    def _parse_game(self, g: dict, username: str) -> dict | None:
        if g.get("variant") != "standard":
            return None

        players = g.get("players", {})
        white_info = players.get("white", {})
        black_info = players.get("black", {})
        white_user = white_info.get("user", {})
        black_user = black_info.get("user", {})
        white_name = white_user.get("name", "").lower()
        black_name = black_user.get("name", "").lower()

        is_white = white_name == username.lower()
        if not is_white and black_name != username.lower():
            # Username doesn't match either side (shouldn't happen)
            return None

        winner = g.get("winner")
        if winner is None:
            result = "draw"
        elif (winner == "white" and is_white) or (winner == "black" and not is_white):
            result = "win"
        else:
            result = "loss"

        player_info = white_info if is_white else black_info
        opponent_info = black_info if is_white else white_info

        opening = g.get("opening", {})
        pgn = g.get("pgn", "")

        # Count moves from the moves string
        moves_str = g.get("moves", "")
        num_moves = len(moves_str.split()) if moves_str else 0

        created = g.get("createdAt", 0)
        played_at = datetime.utcfromtimestamp(created / 1000) if created else datetime.utcnow()

        accuracy = g.get("players", {})
        player_acc = None
        if "analysis" in player_info:
            player_acc = player_info.get("accuracy")

        speed = g.get("speed", "")

        return {
            "platform": "lichess",
            "platform_id": g.get("id", ""),
            "pgn": pgn,
            "white_username": white_name,
            "black_username": black_name,
            "player_color": "white" if is_white else "black",
            "time_class": speed,
            "time_control": self._format_time_control(g.get("clock", {})),
            "result": result,
            "result_detail": g.get("status", ""),
            "player_rating": player_info.get("rating", 0),
            "opponent_rating": opponent_info.get("rating", 0),
            "opening_eco": opening.get("eco"),
            "opening_name": opening.get("name"),
            "num_moves": num_moves,
            "played_at": played_at,
            "platform_accuracy": player_acc,
        }

    def _format_time_control(self, clock: dict) -> str:
        initial = clock.get("initial", 0)
        increment = clock.get("increment", 0)
        if increment:
            return f"{initial}+{increment}"
        return str(initial)
