"""Recompute stored tactical motifs for already-analysed player moves.

Run inside the api container:
    python -m app.scripts.retag_motifs [--apply] [--batch-size N]

Default is a DRY RUN (no writes). Mirrors the ingest rule in
app/services/analysis_ingest.py: motifs are only computed for player moves
with cpl > 50 and a best move.
"""

import argparse
import json
from collections import Counter

import chess
from sqlalchemy import select

from app.models import MoveAnalysis
from app.services.tactical_detector import detect_tactical_motifs


def compute_motifs(fen_before: str, best_move_uci: str) -> str | None:
    """Return the JSON string to store (or None), raising on bad FEN/move."""
    motifs = detect_tactical_motifs(
        chess.Board(fen_before), chess.Move.from_uci(best_move_uci)
    )
    return json.dumps(motifs) if motifs else None


def _count(counter: Counter, raw: str | None) -> None:
    if not raw:
        return
    try:
        for m in json.loads(raw):
            counter[m] += 1
    except (ValueError, TypeError):
        pass


def retag(session, *, apply: bool = False, batch_size: int = 2000) -> dict:
    stats = {"scanned": 0, "changed": 0, "errors": 0}
    before: Counter = Counter()
    after: Counter = Counter()
    last_id = 0
    while True:
        rows = session.execute(
            select(
                MoveAnalysis.id,
                MoveAnalysis.fen_before,
                MoveAnalysis.best_move_uci,
                MoveAnalysis.tactical_motifs,
            )
            .where(
                MoveAnalysis.id > last_id,
                MoveAnalysis.is_player_move == 1,
                MoveAnalysis.centipawn_loss > 50,
                MoveAnalysis.best_move_uci.is_not(None),
            )
            .order_by(MoveAnalysis.id)
            .limit(batch_size)
        ).all()
        if not rows:
            break
        updates = []
        for row_id, fen, best, old in rows:
            last_id = row_id
            stats["scanned"] += 1
            _count(before, old)
            try:
                new = compute_motifs(fen, best)
            except Exception:
                stats["errors"] += 1
                _count(after, old)  # untouched
                continue
            _count(after, new)
            if new != old:
                stats["changed"] += 1
                updates.append({"id": row_id, "tactical_motifs": new})
        if apply and updates:
            session.bulk_update_mappings(MoveAnalysis, updates)
            session.commit()
        session.expire_all()
    stats["before"] = dict(before)
    stats["after"] = dict(after)
    return stats


def _report(stats: dict, apply: bool) -> None:
    print(f"Mode: {'APPLY' if apply else 'DRY RUN (no writes)'}")
    print(f"Rows scanned: {stats['scanned']}")
    print(f"Rows changed: {stats['changed']}")
    print(f"Errors:       {stats['errors']}")
    print(f"{'motif':<24}{'before':>10}{'after':>10}")
    for m in sorted(set(stats["before"]) | set(stats["after"])):
        print(f"{m:<24}{stats['before'].get(m, 0):>10}{stats['after'].get(m, 0):>10}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    p.add_argument("--batch-size", type=int, default=2000)
    args = p.parse_args()

    from app.database import SessionLocal

    with SessionLocal() as session:
        stats = retag(session, apply=args.apply, batch_size=args.batch_size)
    _report(stats, args.apply)


if __name__ == "__main__":
    main()
