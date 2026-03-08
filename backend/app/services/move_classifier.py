def classify_move(
    centipawn_loss: float,
    eval_before: float | None,
    eval_after: float | None,
    is_best_move: bool,
) -> str:
    """Classify a move based on centipawn loss.

    Returns one of: brilliant, great, good, book, inaccuracy, mistake, blunder
    """
    if centipawn_loss <= 0:
        centipawn_loss = 0

    if is_best_move and centipawn_loss == 0:
        # Check if it's a "brilliant" move: player was worse, now better after a sacrifice
        if eval_before is not None and eval_after is not None:
            if eval_before < -50 and eval_after > 50:
                return "brilliant"
        return "great"

    if centipawn_loss <= 10:
        return "good"
    elif centipawn_loss <= 25:
        return "good"
    elif centipawn_loss <= 50:
        return "inaccuracy"
    elif centipawn_loss <= 150:
        return "mistake"
    else:
        return "blunder"
