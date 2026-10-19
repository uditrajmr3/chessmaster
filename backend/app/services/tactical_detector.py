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

    opponent_color = not moving_color

    # Fork detection: the moved piece attacks 2+ opponent pieces worth >= knight
    if piece_moving.piece_type in (chess.KNIGHT, chess.QUEEN, chess.PAWN):
        targets = []
        for sq in board_copy.attacks(best_move.to_square):
            target = board_copy.piece_at(sq)
            if target and target.color != moving_color:
                if target.piece_type in (
                    chess.QUEEN, chess.ROOK, chess.KING, chess.BISHOP, chess.KNIGHT
                ):
                    targets.append(sq)
        if len(targets) >= 2:
            if piece_moving.piece_type == chess.QUEEN:
                # A queen "fork" of defended pieces is not a real fork: require
                # the king or at least one undefended target.
                real = any(
                    board_copy.piece_at(sq).piece_type == chess.KING
                    or not board_copy.is_attacked_by(opponent_color, sq)
                    for sq in targets
                )
            else:
                real = True
            if real:
                motifs.append("fork")

    # Pin detection: only pins NEWLY created by the best move, on non-pawn pieces
    for sq in chess.SQUARES:
        piece = board_copy.piece_at(sq)
        if (
            piece
            and piece.color == opponent_color
            and piece.piece_type not in (chess.PAWN, chess.KING)
            and board_copy.is_pinned(opponent_color, sq)
            and not board.is_pinned(opponent_color, sq)
        ):
            motifs.append("pin")
            break

    # Back rank: rook/queen check along the back rank and the king has no
    # flight squares off the back rank (or it is mate).
    back_rank = 7 if opponent_color == chess.BLACK else 0
    if board_copy.is_check():
        king_sq = board_copy.king(opponent_color)
        if king_sq is not None and chess.square_rank(king_sq) == back_rank:
            rank_checker = any(
                board_copy.piece_at(c).piece_type in (chess.ROOK, chess.QUEEN)
                and chess.square_rank(c) == back_rank
                for c in board_copy.checkers()
            )
            if rank_checker:
                if board_copy.is_checkmate():
                    motifs.append("back_rank")
                else:
                    has_flight = False
                    for sq in board_copy.attacks(king_sq):
                        if chess.square_rank(sq) == back_rank:
                            continue
                        occ = board_copy.piece_at(sq)
                        if occ and occ.color == opponent_color:
                            continue
                        if not board_copy.is_attacked_by(moving_color, sq):
                            has_flight = True
                            break
                    if not has_flight:
                        motifs.append("back_rank")

    # Discovered attack: a slider other than the moved piece now attacks a
    # queen/rook/king THROUGH the vacated from-square, and did not before.
    if not is_capture:
        for sq in chess.SQUARES:
            p = board_copy.piece_at(sq)
            if (
                p is None
                or p.color != moving_color
                or p.piece_type not in (chess.ROOK, chess.BISHOP, chess.QUEEN)
                or sq == best_move.to_square
            ):
                continue
            for target_sq in board_copy.attacks(sq):
                target = board_copy.piece_at(target_sq)
                if (
                    target
                    and target.color == opponent_color
                    and target.piece_type in (chess.QUEEN, chess.ROOK, chess.KING)
                    and best_move.from_square in chess.SquareSet(chess.between(sq, target_sq))
                    and target_sq not in board.attacks(sq)
                ):
                    motifs.append("discovered_attack")
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
