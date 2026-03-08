"""Tests for game phase detection and material balance."""

import chess

from app.utils.fen_utils import get_game_phase, material_balance


class TestGetGamePhase:
    def test_starting_position_is_opening(self):
        board = chess.Board()  # starting position, fullmove=1
        assert get_game_phase(board) == "opening"

    def test_early_game_after_few_moves(self):
        """After a few opening moves, still opening (fullmove <= 10, full material)."""
        board = chess.Board()
        board.push_san("e4")
        board.push_san("e5")
        board.push_san("Nf3")
        board.push_san("Nc6")
        assert get_game_phase(board) == "opening"

    def test_middlegame_after_exchanges(self):
        """Position at move 15 with most material → middlegame."""
        # Set fullmove > 10, still lots of material
        fen = "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 11"
        board = chess.Board(fen)
        assert get_game_phase(board) == "middlegame"

    def test_endgame_king_and_pawns(self):
        """King + pawns only → endgame."""
        fen = "8/5pk1/6p1/8/8/6P1/5PK1/8 w - - 0 40"
        board = chess.Board(fen)
        assert get_game_phase(board) == "endgame"

    def test_endgame_rook_ending(self):
        """Rook endgame (material <= 26)."""
        fen = "8/5pk1/6p1/8/8/6P1/4RPK1/4r3 w - - 0 35"
        board = chess.Board(fen)
        # Material: R(5)+R(5) = 10 total non-pawn < 26
        assert get_game_phase(board) == "endgame"

    def test_endgame_no_queens_low_material(self):
        """No queens, minor pieces only, material <= 30 → endgame."""
        fen = "8/5pk1/3b2p1/8/3B4/6P1/5PK1/8 w - - 0 30"
        board = chess.Board(fen)
        # B(3) + B(3) = 6, no queens → endgame condition (queens==0 and total<=30)
        assert get_game_phase(board) == "endgame"

    def test_middlegame_with_queens(self):
        """Queens present, decent material, move > 10 → middlegame."""
        fen = "r1bq1rk1/ppp2ppp/2n2n2/3pp3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 12"
        board = chess.Board(fen)
        assert get_game_phase(board) == "middlegame"


class TestMaterialBalance:
    def test_starting_position_is_balanced(self):
        board = chess.Board()
        assert material_balance(board) == 0

    def test_white_up_a_queen(self):
        """White has an extra queen → +900 centipawns."""
        fen = "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        board = chess.Board(fen)
        # Black queen is missing → +9*100 = +900
        assert material_balance(board) == 900

    def test_black_up_a_knight(self):
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 1"
        board = chess.Board(fen)
        # White is missing a knight → -300
        assert material_balance(board) == -300

    def test_equal_material_exchange(self):
        """Both sides missing a rook → still 0."""
        fen = "1nbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kk - 0 1"
        board = chess.Board(fen)
        assert material_balance(board) == 0
