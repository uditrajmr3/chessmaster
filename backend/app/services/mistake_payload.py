"""Build the canonical MistakeOut payload from MoveAnalysis rows."""

import json

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..models import Game, MoveAnalysis
from ..schemas import MistakeOut


def _parse_motifs(raw) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(data, list):
        return []
    return [str(x) for x in data]


def _opponent(game: Game) -> str | None:
    return game.black_username if game.player_color == "white" else game.white_username


def refutation_for(db: Session, move: MoveAnalysis) -> str | None:
    """best_move_uci of the next ply in the same game (None if missing)."""
    return db.execute(
        select(MoveAnalysis.best_move_uci).where(
            MoveAnalysis.game_id == move.game_id,
            MoveAnalysis.move_number == move.move_number + 1,
        )
    ).scalar_one_or_none()


def time_spent_between(prev_remaining: float | None, remaining: float | None) -> float | None:
    """Approximate seconds spent: previous own clock minus this clock, clamped >= 0."""
    if prev_remaining is None or remaining is None:
        return None
    return max(0.0, prev_remaining - remaining)


def to_mistake(
    move: MoveAnalysis,
    game: Game,
    refutation_uci: str | None,
    time_spent: float | None = None,
) -> MistakeOut:
    """Pure builder for callers that already hold the rows."""
    return MistakeOut(
        move_analysis_id=move.id,
        game_id=move.game_id,
        move_number=move.move_number,
        player_color=game.player_color,
        fen_before=move.fen_before,
        move_uci=move.move_uci,
        move_san=move.move_san,
        best_move_uci=move.best_move_uci,
        best_move_san=move.best_move_san,
        refutation_uci=refutation_uci,
        eval_before=move.eval_before,
        eval_after=move.eval_after,
        centipawn_loss=move.centipawn_loss,
        classification=move.classification,
        game_phase=move.game_phase,
        tactical_motifs=_parse_motifs(move.tactical_motifs),
        time_spent=time_spent,
        time_remaining=move.time_remaining,
        opponent=_opponent(game),
        played_at=game.played_at,
    )


def build_mistakes(db: Session, user_id, move_ids: list[int]) -> list[MistakeOut]:
    """Batch-build MistakeOut for the user's own moves; input order preserved.

    Ids not owned by user_id (or missing) are silently dropped. Three queries total.
    """
    if not move_ids:
        return []

    rows = db.execute(
        select(MoveAnalysis, Game)
        .join(Game, Game.id == MoveAnalysis.game_id)
        .where(MoveAnalysis.id.in_(set(move_ids)), Game.user_id == user_id)
    ).all()
    by_id = {m.id: (m, g) for m, g in rows}
    if not by_id:
        return []

    # Neighbouring plies: next (refutation) and previous own move (time_spent).
    pairs = set()
    for m, _ in by_id.values():
        pairs.add((m.game_id, m.move_number + 1))
        pairs.add((m.game_id, m.move_number - 2))
    neighbours = db.execute(
        select(
            MoveAnalysis.game_id,
            MoveAnalysis.move_number,
            MoveAnalysis.best_move_uci,
            MoveAnalysis.time_remaining,
        ).where(
            or_(
                *[
                    and_(MoveAnalysis.game_id == gid, MoveAnalysis.move_number == n)
                    for gid, n in pairs
                ]
            )
        )
    ).all()
    nb = {(gid, n): (best, tr) for gid, n, best, tr in neighbours}

    out: list[MistakeOut] = []
    for mid in move_ids:
        hit = by_id.get(mid)
        if hit is None:
            continue
        m, g = hit
        refutation = nb.get((m.game_id, m.move_number + 1), (None, None))[0]
        prev_tr = nb.get((m.game_id, m.move_number - 2), (None, None))[1]
        out.append(
            to_mistake(m, g, refutation, time_spent_between(prev_tr, m.time_remaining))
        )
    return out
