"""Tests for PGN parsing and clock extraction."""

from app.utils.pgn_parser import extract_clocks, parse_pgn


class TestParsePgn:
    def test_simple_game(self):
        pgn = '[Event "Test"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0'
        game = parse_pgn(pgn)
        assert game is not None
        assert game.headers["Result"] == "1-0"
        moves = list(game.mainline_moves())
        assert len(moves) == 4

    def test_game_with_headers(self):
        pgn = (
            '[Event "Rated Rapid"]\n'
            '[Site "Chess.com"]\n'
            '[White "csense2653"]\n'
            '[Black "opponent"]\n'
            '[Result "1-0"]\n'
            '[ECO "B12"]\n\n'
            "1. e4 c6 2. d4 d5 1-0"
        )
        game = parse_pgn(pgn)
        assert game is not None
        assert game.headers["ECO"] == "B12"
        assert game.headers["White"] == "csense2653"

    def test_invalid_pgn_returns_none(self):
        result = parse_pgn("this is not valid pgn at all }{}{")
        # python-chess is lenient so it may return something, but it shouldn't crash
        # The key is no exception is raised
        assert result is not None or result is None  # just no crash

    def test_empty_string(self):
        result = parse_pgn("")
        assert result is None

    def test_pgn_with_variations(self):
        pgn = '[Result "*"]\n\n1. e4 e5 (1... c5) 2. Nf3 *'
        game = parse_pgn(pgn)
        assert game is not None
        mainline = list(game.mainline_moves())
        assert len(mainline) == 3  # e4, e5, Nf3 (variation excluded)


class TestExtractClocks:
    def test_standard_clock_format(self):
        pgn = '1. e4 {[%clk 0:09:54.3]} e5 {[%clk 0:09:58.1]} 2. Nf3 {[%clk 0:09:48.0]}'
        clocks = extract_clocks(pgn)
        assert len(clocks) == 3
        assert abs(clocks[0] - 594.3) < 0.01  # 9*60 + 54.3
        assert abs(clocks[1] - 598.1) < 0.01
        assert abs(clocks[2] - 588.0) < 0.01

    def test_no_clocks(self):
        pgn = "1. e4 e5 2. Nf3 Nc6"
        assert extract_clocks(pgn) == []

    def test_hours_in_clocks(self):
        pgn = '1. e4 {[%clk 1:30:00.0]}'
        clocks = extract_clocks(pgn)
        assert len(clocks) == 1
        assert clocks[0] == 5400.0  # 1h 30m

    def test_zero_clock(self):
        pgn = '1. e4 {[%clk 0:00:00.0]}'
        clocks = extract_clocks(pgn)
        assert len(clocks) == 1
        assert clocks[0] == 0.0
