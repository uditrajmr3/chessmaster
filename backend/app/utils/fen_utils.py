import chess

# Piece values for material counting
PIECE_VALUES = {
    chess.QUEEN: 9,
    chess.ROOK: 5,
    chess.BISHOP: 3,
    chess.KNIGHT: 3,
    chess.PAWN: 1,
}


def get_game_phase(board: chess.Board) -> str:
    """Determine game phase from board position."""
    # Count non-pawn, non-king material for both sides
    total_material = 0
    queens = 0
    for piece_type in (chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT):
        count = len(board.pieces(piece_type, chess.WHITE)) + len(
            board.pieces(piece_type, chess.BLACK)
        )
        total_material += count * PIECE_VALUES[piece_type]
        if piece_type == chess.QUEEN:
            queens = count

    fullmove = board.fullmove_number

    # Opening: early moves with most pieces still on the board
    if fullmove <= 10 and total_material >= 50:
        return "opening"

    # Endgame: low material
    if total_material <= 26 or (queens == 0 and total_material <= 30):
        return "endgame"

    return "middlegame"


def material_balance(board: chess.Board) -> int:
    """Return material balance in centipawns (positive = white advantage)."""
    balance = 0
    for piece_type, value in PIECE_VALUES.items():
        white_count = len(board.pieces(piece_type, chess.WHITE))
        black_count = len(board.pieces(piece_type, chess.BLACK))
        balance += (white_count - black_count) * value * 100
    return balance
