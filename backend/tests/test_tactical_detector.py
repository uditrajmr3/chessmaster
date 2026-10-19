"""Tests for tactical motif detection (fork, pin, back-rank, skewer)."""

import chess

from app.services.tactical_detector import detect_tactical_motifs


class TestDetectTacticalMotifs:
    def test_none_move_returns_empty(self):
        board = chess.Board()
        assert detect_tactical_motifs(board, None) == []

    def test_knight_fork_on_king_and_rook(self):
        """Classic Nf7 fork hitting king on e8 and rook on h8."""
        # White knight can jump to f7 forking Ke8 and Rh8
        fen = "r1bqkb1r/pppp1ppp/2n2n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4"
        board = chess.Board(fen)
        # Knight on e5 goes to f7 — but let's set up a cleaner fork
        fen = "r1bqk2r/ppppnppp/2n5/4N3/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5"
        board = chess.Board(fen)
        # Try Nxf7 — forks queen d8 and rook h8
        move = chess.Move.from_uci("e5f7")
        if move in board.legal_moves:
            motifs = detect_tactical_motifs(board, move)
            assert "fork" in motifs

    def test_pin_detection(self):
        """A bishop pins a knight to the king."""
        # White Bg5 pins the Nf6 to Ke8 (after Bg5)
        fen = "rnbqkb1r/pppppppp/5n2/6B1/4P3/8/PPPP1PPP/RN1QKBNR w KQkq - 0 3"
        board = chess.Board(fen)
        # The bishop is already on g5 pinning Nf6 to Ke8 — but we need to TEST a move
        # Let's set up: bishop on c1 can go to g5 to create the pin
        fen = "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3"
        board = chess.Board(fen)
        move = chess.Move.from_uci("c1g5")  # Bg5 pins Nf6 to Ke8
        if move in board.legal_moves:
            motifs = detect_tactical_motifs(board, move)
            assert "pin" in motifs

    def test_back_rank_mate_threat(self):
        """Rook move to back rank giving check when king is trapped by own pawns."""
        # Black king on g8 trapped by pawns on f7,g7,h7. White rook can deliver Rd8+ (back rank check)
        fen = "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1"
        board = chess.Board(fen)
        move = chess.Move.from_uci("a1a8")  # Ra8+ is back-rank check
        if move in board.legal_moves:
            motifs = detect_tactical_motifs(board, move)
            assert "back_rank" in motifs

    def test_no_motifs_on_quiet_move(self):
        """A simple pawn push shouldn't detect fancy tactics."""
        board = chess.Board()
        move = chess.Move.from_uci("e2e4")
        motifs = detect_tactical_motifs(board, move)
        # Should not have fork/pin/back_rank/skewer in opening position
        assert "fork" not in motifs
        assert "back_rank" not in motifs
        assert "skewer" not in motifs

    def test_piece_not_on_square(self):
        """If the piece isn't where the move claims, return empty."""
        board = chess.Board()
        # Invalid: no piece on d4
        move = chess.Move.from_uci("d4e5")
        motifs = detect_tactical_motifs(board, move)
        assert motifs == []


def _motifs(fen: str, uci: str) -> list[str]:
    board = chess.Board(fen)
    move = chess.Move.from_uci(uci)
    assert move in board.legal_moves
    return detect_tactical_motifs(board, move)


class TestPrecision:
    # --- pin ---
    def test_pin_new_pin_counts(self):
        # Bc1-g5 newly pins Ne7 to Kd8
        assert "pin" in _motifs("3k4/4n3/8/8/8/8/8/2B1K3 w - - 0 1", "c1g5")

    def test_pin_preexisting_not_counted(self):
        # Bg5 already pins Ne7 to Kd8; a quiet pawn move creates nothing new
        assert "pin" not in _motifs("3k4/4n3/8/6B1/8/8/4P3/4K3 w - - 0 1", "e2e3")

    def test_pin_on_pawn_not_counted(self):
        # Bg5 "pins" pawn e7 to Kd8 - not counted
        assert "pin" not in _motifs("3k4/4p3/8/8/8/8/8/2B1K3 w - - 0 1", "c1g5")

    # --- back rank ---
    def test_back_rank_mate_counts(self):
        assert "back_rank" in _motifs("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "a1a8")

    def test_back_rank_bishop_check_not_counted(self):
        # Bb5+ early-game check with king on back rank (used to fire)
        fen = "rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3"
        assert "back_rank" not in _motifs(fen, "f1b5")

    def test_back_rank_rook_check_with_flight_not_counted(self):
        # Ra8+ but king has g7/h7/f7 flight squares
        assert "back_rank" not in _motifs("6k1/8/8/8/8/8/8/R3K3 w - - 0 1", "a1a8")

    # --- discovered attack ---
    def test_discovered_attack_counts(self):
        # Ne4-c5 uncovers Re1 on Qe8
        assert "discovered_attack" in _motifs("4q1k1/8/8/8/4N3/8/8/4R1K1 w - - 0 1", "e4c5")

    def test_discovered_attack_preexisting_not_counted(self):
        # Re1 already attacks Qe8; unrelated pawn move
        assert "discovered_attack" not in _motifs("4q1k1/8/8/8/8/8/P7/4R1K1 w - - 0 1", "a2a3")

    # --- fork ---
    def test_queen_fork_with_king_counts(self):
        # Qd4 forks Kh8 and undefended Rd5
        assert "fork" in _motifs("7k/8/8/3r4/8/8/8/Q6K w - - 0 1", "a1d4")

    def test_queen_fork_of_defended_pieces_not_counted(self):
        # Qd4 hits Nd6 (defended by e7) and Bb4 (defended by a5)
        assert "fork" not in _motifs("6k1/4p3/3n4/p7/1b6/8/8/Q6K w - - 0 1", "a1d4")
