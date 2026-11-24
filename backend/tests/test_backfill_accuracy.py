"""Tests for the backfill_accuracy maintenance script."""

import pytest

from app.models import Game
from app.schemas import AnalyzeResultsIn, MoveEval
from app.scripts.backfill_accuracy import backfill
from app.services.accuracy import game_accuracy
from tests.conftest import make_game, make_move_analysis

START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def _acc(db, gid):
    db.expire_all()
    return db.get(Game, gid).accuracy


@pytest.fixture()
def seeded(db):
    make_game(db, id="g1", platform_id="1")
    make_game(db, id="g2", platform_id="2")
    make_game(db, id="g3", platform_id="3")  # no analysis rows
    rows = [(0, 1, 50, 20), (1, 0, 20, 90), (2, 1, 30, -200)]
    for gid in ("g1", "g2"):
        for n, pm, eb, ea in rows:
            make_move_analysis(db, game_id=gid, move_number=n, is_player_move=pm,
                               eval_before=eb, eval_after=ea)
    return db


def test_dry_run_writes_nothing_and_reports(seeded):
    stats = backfill(seeded, dry_run=True, batch_size=1)
    assert stats == {"scanned": 2, "changed": 2, "skipped_no_evals": 0}
    assert _acc(seeded, "g1") is None and _acc(seeded, "g2") is None


def test_real_run_sets_values(seeded):
    stats = backfill(seeded, batch_size=1)
    assert stats["changed"] == 2
    expected = game_accuracy(
        [{"eval_before": b, "eval_after": a, "is_player_move": p}
         for _, p, b, a in [(0, 1, 50, 20), (1, 0, 20, 90), (2, 1, 30, -200)]]
    )
    assert _acc(seeded, "g1") == pytest.approx(expected)
    assert _acc(seeded, "g2") == pytest.approx(expected)


def test_second_run_changes_nothing(seeded):
    backfill(seeded)
    assert backfill(seeded)["changed"] == 0


def test_game_without_evals_stays_null(db):
    make_game(db, id="g1", platform_id="1")
    make_game(db, id="g2", platform_id="2")
    make_move_analysis(db, game_id="g1", move_number=0, eval_before=None, eval_after=None)
    make_move_analysis(db, game_id="g2", move_number=0, is_player_move=0)
    stats = backfill(db)
    assert stats == {"scanned": 2, "changed": 0, "skipped_no_evals": 2}
    assert _acc(db, "g1") is None and _acc(db, "g2") is None


def test_parity_with_ingest_for_black_player(db):
    from app.services.analysis_ingest import store_results

    g = make_game(db, id="blk", platform_id="b", player_color="black")
    moves = [
        MoveEval(move_number=0, is_player_move=0, fen_before=START_FEN, move_uci="e2e4",
                 move_san="e4", eval_before=20, eval_after=30, best_move_uci="e2e4"),
        MoveEval(move_number=1, is_player_move=1, fen_before=START_FEN, move_uci="e7e5",
                 move_san="e5", eval_before=30, eval_after=180, best_move_uci="e7e5"),
        MoveEval(move_number=2, is_player_move=1, fen_before=START_FEN, move_uci="g8f6",
                 move_san="Nf6", eval_before=150, eval_after=60, best_move_uci="g8f6"),
    ]
    store_results(db, g.user_id, AnalyzeResultsIn(game_id="blk", depth=12, moves=moves))
    ingested = _acc(db, "blk")
    assert ingested is not None
    db.get(Game, "blk").accuracy = None
    db.commit()
    assert backfill(db)["changed"] == 1
    assert _acc(db, "blk") == pytest.approx(ingested)
    assert backfill(db)["changed"] == 0
