"""Tests for the retag_motifs maintenance script."""

import json

from app.models import MoveAnalysis
from app.scripts.retag_motifs import retag
from tests.conftest import make_game, make_move_analysis


def _seed(db):
    make_game(db)
    stale = make_move_analysis(db, move_number=0, centipawn_loss=120.0, tactical_motifs=["pin"])
    low = make_move_analysis(db, move_number=2, centipawn_loss=10.0, tactical_motifs=["pin"])
    bad = make_move_analysis(db, move_number=4, centipawn_loss=120.0)
    bad.fen_before = "not a fen"
    db.commit()
    return stale.id, low.id, bad.id


def _motifs(db, id_):
    db.expire_all()
    return db.get(MoveAnalysis, id_).tactical_motifs


def test_dry_run_changes_nothing(db):
    stale, low, bad = _seed(db)
    stats = retag(db, apply=False, batch_size=1)
    assert stats["scanned"] == 2  # low-cpl row skipped
    assert stats["changed"] == 1
    assert stats["errors"] == 1
    assert stats["before"] == {"pin": 1}
    assert stats["after"] == {}  # stale pin would be dropped
    assert json.loads(_motifs(db, stale)) == ["pin"]


def test_apply_rewrites_stale_pin(db):
    stale, low, bad = _seed(db)
    stats = retag(db, apply=True, batch_size=1)
    assert stats["changed"] == 1
    assert _motifs(db, stale) is None
    assert json.loads(_motifs(db, low)) == ["pin"]  # out of scope, untouched
    assert _motifs(db, bad) is None
