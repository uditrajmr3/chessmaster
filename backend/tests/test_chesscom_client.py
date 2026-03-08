"""Tests for Chess.com API client game parsing."""

from app.services.chesscom_client import ChessComClient


class TestChessComParsing:
    """Test the _parse_game method with various Chess.com API response shapes."""

    def setup_method(self):
        self.client = ChessComClient()

    def test_parse_win_as_white(self):
        game_data = {
            "pgn": '[Event "Rated"]\n[White "csense2653"]\n[Black "opponent"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
            "white": {"username": "csense2653", "rating": 1500, "result": "win"},
            "black": {"username": "opponent", "rating": 1480, "result": "checkmated"},
            "time_class": "rapid",
            "time_control": "600",
            "rules": "chess",
            "uuid": "abc-123",
            "end_time": 1700000000,
            "accuracies": {"white": 85.3, "black": 72.1},
        }
        result = self.client._parse_game(game_data, "csense2653")
        assert result is not None
        assert result["platform"] == "chesscom"
        assert result["player_color"] == "white"
        assert result["result"] == "win"
        assert result["player_rating"] == 1500
        assert result["opponent_rating"] == 1480
        assert result["platform_accuracy"] == 85.3

    def test_parse_loss_as_black(self):
        game_data = {
            "pgn": '[Event "Rated"]\n[White "opponent"]\n[Black "csense2653"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
            "white": {"username": "opponent", "rating": 1600, "result": "win"},
            "black": {"username": "csense2653", "rating": 1500, "result": "checkmated"},
            "time_class": "rapid",
            "time_control": "600",
            "rules": "chess",
            "uuid": "def-456",
            "end_time": 1700000000,
        }
        result = self.client._parse_game(game_data, "csense2653")
        assert result is not None
        assert result["player_color"] == "black"
        assert result["result"] == "loss"
        assert result["player_rating"] == 1500
        assert result["opponent_rating"] == 1600

    def test_parse_draw(self):
        game_data = {
            "pgn": '[Event "Rated"]\n[White "csense2653"]\n[Black "opp"]\n[Result "1/2-1/2"]\n\n1. e4 e5 1/2-1/2',
            "white": {"username": "csense2653", "rating": 1500, "result": "stalemate"},
            "black": {"username": "opp", "rating": 1500, "result": "stalemate"},
            "time_class": "rapid",
            "time_control": "600",
            "rules": "chess",
            "uuid": "ghi-789",
            "end_time": 1700000000,
        }
        result = self.client._parse_game(game_data, "csense2653")
        assert result is not None
        assert result["result"] == "draw"

    def test_no_pgn_returns_none(self):
        game_data = {
            "white": {"username": "csense2653", "rating": 1500, "result": "win"},
            "black": {"username": "opp", "rating": 1500, "result": "checkmated"},
            "time_class": "rapid",
        }
        result = self.client._parse_game(game_data, "csense2653")
        assert result is None

    def test_case_insensitive_username(self):
        game_data = {
            "pgn": '[Event "Rated"]\n[Result "1-0"]\n\n1. e4 1-0',
            "white": {"username": "CSense2653", "rating": 1500, "result": "win"},
            "black": {"username": "Opponent", "rating": 1480, "result": "checkmated"},
            "time_class": "rapid",
            "time_control": "600",
            "rules": "chess",
            "uuid": "xxx",
            "end_time": 1700000000,
        }
        result = self.client._parse_game(game_data, "csense2653")
        assert result is not None
        assert result["player_color"] == "white"

    def test_loss_by_timeout(self):
        game_data = {
            "pgn": '[Event "Rated"]\n[Result "0-1"]\n\n1. e4 e5 0-1',
            "white": {"username": "csense2653", "rating": 1500, "result": "timeout"},
            "black": {"username": "opp", "rating": 1480, "result": "win"},
            "time_class": "rapid",
            "time_control": "600",
            "rules": "chess",
            "uuid": "timeout1",
            "end_time": 1700000000,
        }
        result = self.client._parse_game(game_data, "csense2653")
        assert result is not None
        assert result["result"] == "loss"

    def test_loss_by_resignation(self):
        game_data = {
            "pgn": '[Event "Rated"]\n[Result "0-1"]\n\n1. e4 e5 0-1',
            "white": {"username": "csense2653", "rating": 1500, "result": "resigned"},
            "black": {"username": "opp", "rating": 1480, "result": "win"},
            "time_class": "rapid",
            "time_control": "600",
            "rules": "chess",
            "uuid": "resign1",
            "end_time": 1700000000,
        }
        result = self.client._parse_game(game_data, "csense2653")
        assert result["result"] == "loss"
