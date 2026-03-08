import chess


def detect_tactical_motifs(
    board: chess.Board, best_move: chess.Move | None
) -> list[str]:
    """Detect tactical motifs in the best move that was missed by the player.

    Args:
        board: Position BEFORE the best move
        best_move: The engine's recommended move
    Returns:
        List of motif names found
    """
    if best_move is None:
        return []

    motifs = []
    board_copy = board.copy()

    # Apply the best move
    piece_moving = board_copy.piece_at(best_move.from_square)
    if piece_moving is None:
        return []

    is_capture = board_copy.is_capture(best_move)
    moving_color = board_copy.turn

    board_copy.push(best_move)

    # Fork detection: the moved piece attacks 2+ opponent pieces worth >= knight
    if piece_moving.piece_type in (chess.KNIGHT, chess.QUEEN, chess.PAWN):
        attacked_valuable = 0
        for sq in board_copy.attacks(best_move.to_square):
            target = board_copy.piece_at(sq)
            if target and target.color != moving_color:
                if target.piece_type in (
                    chess.QUEEN, chess.ROOK, chess.KING, chess.BISHOP, chess.KNIGHT
                ):
                    attacked_valuable += 1
        if attacked_valuable >= 2:
            motifs.append("fork")

    # Pin detection: check if any opponent piece is now pinned
    opponent_color = not moving_color
    for sq in chess.SQUARES:
        piece = board_copy.piece_at(sq)
        if piece and piece.color == opponent_color:
            if board_copy.is_pinned(opponent_color, sq):
                motifs.append("pin")
                break

    # Back rank threat
    back_rank = 7 if opponent_color == chess.BLACK else 0
    if board_copy.is_check():
        king_sq = board_copy.king(opponent_color)
        if king_sq is not None and chess.square_rank(king_sq) == back_rank:
            motifs.append("back_rank")

    # Discovered attack: the moved piece reveals an attack from another piece
    # Simplified: check if a piece on the from-square's file/rank/diagonal now attacks something
    if not is_capture:
        # Check if any piece behind the moved piece now has new attacks
        for direction_pieces in [chess.ROOK, chess.BISHOP, chess.QUEEN]:
            for sq in chess.SQUARES:
                p = board_copy.piece_at(sq)
                if p and p.color == moving_color and p.piece_type == direction_pieces:
                    if sq != best_move.to_square:
                        # Check if this piece attacks valuable opponent pieces through the vacated square
                        for attacked_sq in board_copy.attacks(sq):
                            target = board_copy.piece_at(attacked_sq)
                            if (
                                target
                                and target.color == opponent_color
                                and target.piece_type
                                in (chess.QUEEN, chess.ROOK, chess.KING)
                            ):
                                # Verify the attack goes through the vacated square's line
                                motifs.append("discovered_attack")
                                break
                    if "discovered_attack" in motifs:
                        break
            if "discovered_attack" in motifs:
                break

    # Skewer: attack on a valuable piece that reveals a less valuable piece behind it
    if piece_moving.piece_type in (chess.ROOK, chess.BISHOP, chess.QUEEN):
        for attacked_sq in board_copy.attacks(best_move.to_square):
            target = board_copy.piece_at(attacked_sq)
            if target and target.color == opponent_color:
                if target.piece_type in (chess.KING, chess.QUEEN):
                    # Check if there's a piece behind it on the same ray
                    ray_dir = _ray_direction(best_move.to_square, attacked_sq)
                    if ray_dir is not None:
                        behind = attacked_sq
                        for _ in range(8):
                            behind = _step(behind, ray_dir)
                            if behind is None:
                                break
                            behind_piece = board_copy.piece_at(behind)
                            if behind_piece:
                                if behind_piece.color == opponent_color:
                                    motifs.append("skewer")
                                break

    return list(set(motifs))


def _ray_direction(from_sq: int, to_sq: int) -> tuple[int, int] | None:
    """Get the ray direction from from_sq to to_sq."""
    fr, ff = chess.square_rank(from_sq), chess.square_file(from_sq)
    tr, tf = chess.square_rank(to_sq), chess.square_file(to_sq)
    dr = tr - fr
    df = tf - ff
    if dr == 0 and df != 0:
        return (0, 1 if df > 0 else -1)
    if df == 0 and dr != 0:
        return (1 if dr > 0 else -1, 0)
    if abs(dr) == abs(df) and dr != 0:
        return (1 if dr > 0 else -1, 1 if df > 0 else -1)
    return None


def _step(sq: int, direction: tuple[int, int]) -> int | None:
    """Step one square in the given direction."""
    r = chess.square_rank(sq) + direction[0]
    f = chess.square_file(sq) + direction[1]
    if 0 <= r <= 7 and 0 <= f <= 7:
        return chess.square(f, r)
    return None
