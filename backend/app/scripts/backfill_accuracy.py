"""Backfill games.accuracy from stored MoveAnalysis rows.

Run inside the api container:
    python -m app.scripts.backfill_accuracy [--dry-run] [--batch-size N]

Uses the same game_accuracy() as the ingest (evals in MoveAnalysis are already
player-POV). Idempotent: only writes when the value differs. Games whose
moves yield no accuracy (no usable evals) are skipped and left untouched.
"""

import argparse

from sqlalchemy import exists, select

from app.models import Game, MoveAnalysis
from app.services.accuracy import game_accuracy

_EPS = 1e-9


def backfill(session, *, dry_run: bool = False, batch_size: int = 200) -> dict:
    stats = {"scanned": 0, "changed": 0, "skipped_no_evals": 0}
    last_id = ""
    while True:
        games = session.execute(
            select(Game.id, Game.accuracy)
            .where(Game.id > last_id, exists().where(MoveAnalysis.game_id == Game.id))
            .order_by(Game.id)
            .limit(batch_size)
        ).all()
        if not games:
            break
        updates = []
        for game_id, current in games:
            last_id = game_id
            stats["scanned"] += 1
            moves = session.execute(
                select(
                    MoveAnalysis.eval_before,
                    MoveAnalysis.eval_after,
                    MoveAnalysis.is_player_move,
                ).where(MoveAnalysis.game_id == game_id)
            ).all()
            new = game_accuracy(
                {"eval_before": b, "eval_after": a, "is_player_move": p}
                for b, a, p in moves
            )
            if new is None:
                stats["skipped_no_evals"] += 1
                continue
            if current is None or abs(current - new) > _EPS:
                stats["changed"] += 1
                updates.append({"id": game_id, "accuracy": new})
        if not dry_run and updates:
            session.bulk_update_mappings(Game, updates)
            session.commit()
        session.expire_all()
    return stats


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--dry-run", action="store_true", help="compute and report, write nothing")
    p.add_argument("--batch-size", type=int, default=200)
    args = p.parse_args()

    from app.database import SessionLocal

    with SessionLocal() as session:
        stats = backfill(session, dry_run=args.dry_run, batch_size=args.batch_size)
    print(f"Mode: {'DRY RUN (no writes)' if args.dry_run else 'APPLY'}")
    print(f"Games scanned:          {stats['scanned']}")
    print(f"Games {'that would change' if args.dry_run else 'changed'}: {stats['changed']}")
    print(f"Skipped (no evals):     {stats['skipped_no_evals']}")


if __name__ == "__main__":
    main()
