"""Tests for Lichess API client game parsing."""

from app.services.lichess_client import LichessClient


class TestLichessParsing:
    def setup_method(self):
        self.client = LichessClient()

    def _base_game(self, **overrides):
        data = {
            "id": "abc12345",
            "variant": "standard",
            "speed": "rapid",
            "status": "resign",
            "winner": "white",
            "players": {
                "white": {
                    "user": {"name": "csense2653", "id": "csense2653"},
                    "rating": 1500,
                },
                "black": {
                    "user": {"name": "opponent", "id": "opponent"},
                    "rating": 1480,
                },
            },
            "opening": {"eco": "C50", "name": "Italian Game"},
            "pgn": "1. e4 e5 2. Nf3 Nc6 1-0",
            "moves": "e2e4 e7e5 g1f3 b8c6",
            "createdAt": 1700000000000,
            "clock": {"initial": 600, "increment": 0},
        }
        data.update(overrides)
        return data

    def test_parse_win_as_white(self):
        result = self.client._parse_game(self._base_game(), "csense2653")
        assert result is not None
        assert result["platform"] == "lichess"
        assert result["player_color"] == "white"
        assert result["result"] == "win"
        assert result["player_rating"] == 1500
        assert result["opening_eco"] == "C50"
        assert result["opening_name"] == "Italian Game"

    def test_parse_loss_as_black(self):
        game = self._base_game(
            winner="white",
            players={
                "white": {"user": {"name": "opponent", "id": "opponent"}, "rating": 1600},
                "black": {"user": {"name": "csense2653", "id": "csense2653"}, "rating": 1500},
            },
        )
        result = self.client._parse_game(game, "csense2653")
        assert result is not None
        assert result["player_color"] == "black"
        assert result["result"] == "loss"

    def test_parse_draw(self):
        game = self._base_game(winner=None, status="draw")
        # Remove 'winner' key entirely for draws
        del game["winner"]
        result = self.client._parse_game(game, "csense2653")
        assert result is not None
        assert result["result"] == "draw"

    def test_non_standard_variant_skipped(self):
        game = self._base_game(variant="chess960")
        result = self.client._parse_game(game, "csense2653")
        assert result is None

    def test_username_not_found_returns_none(self):
        game = self._base_game()
        result = self.client._parse_game(game, "unknownplayer")
        assert result is None

    def test_move_count(self):
        game = self._base_game(moves="e2e4 e7e5 g1f3 b8c6 f1c4 f8c5")
        result = self.client._parse_game(game, "csense2653")
        assert result["num_moves"] == 6

    def test_empty_moves(self):
        game = self._base_game(moves="")
        result = self.client._parse_game(game, "csense2653")
        assert result["num_moves"] == 0

    def test_time_control_with_increment(self):
        game = self._base_game(clock={"initial": 600, "increment": 5})
        result = self.client._parse_game(game, "csense2653")
        assert result["time_control"] == "600+5"

    def test_time_control_without_increment(self):
        game = self._base_game(clock={"initial": 900, "increment": 0})
        result = self.client._parse_game(game, "csense2653")
        assert result["time_control"] == "900"

    def test_case_insensitive_username(self):
        game = self._base_game()
        game["players"]["white"]["user"]["name"] = "CSense2653"
        result = self.client._parse_game(game, "csense2653")
        assert result is not None
        assert result["player_color"] == "white"
