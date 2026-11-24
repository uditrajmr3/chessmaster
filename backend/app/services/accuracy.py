"""Per-move / per-game accuracy.

Exact port of the frontend formula in ``frontend/src/lib/accuracy.ts``; both are
checked against ``tests/fixtures/accuracy_fixture.json`` so they cannot drift.

Evals are PLAYER-POV centipawns (positive = good for the player). The ingest
already negates white-POV evals for black players before storing them.
"""

import math
from typing import Iterable, Optional


def win_pct(cp: float) -> float:
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def move_accuracy(eval_before: float, eval_after: float, is_player_move: bool) -> float:
    before = win_pct(eval_before)
    after = win_pct(eval_after)
    drop = max(0.0, before - after) if is_player_move else max(0.0, after - before)
    return max(0.0, min(100.0, 103.1668 * math.exp(-0.04354 * drop) - 3.1669))


def game_accuracy(moves: Iterable) -> Optional[float]:
    """Mean accuracy over the player's own moves; None if no move qualifies.

    ``moves`` items need ``eval_before``, ``eval_after``, ``is_player_move``
    (attributes or dict keys). Moves with a null eval are skipped.
    """
    total = 0.0
    n = 0
    for m in moves:
        get = (lambda k: m[k]) if isinstance(m, dict) else (lambda k: getattr(m, k))
        if not get("is_player_move"):
            continue
        eb, ea = get("eval_before"), get("eval_after")
        if eb is None or ea is None:
            continue
        total += move_accuracy(eb, ea, True)
        n += 1
    return total / n if n else None
