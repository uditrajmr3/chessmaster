"""Accuracy formula parity (shared fixture with frontend jest test) + ingest wiring."""

import json
import pathlib

import pytest

from app.services.accuracy import game_accuracy

FIXTURE = json.loads(
    (pathlib.Path(__file__).parent / "fixtures" / "accuracy_fixture.json").read_text()
)


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda c: c["name"])
def test_fixture_parity(case):
    got = game_accuracy(case["moves"])
    if case["expected"] is None:
        assert got is None
    else:
        assert got == pytest.approx(case["expected"], abs=1e-9)


def _eval(n, is_player, b, a):
    from app.schemas import MoveEval

    START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    return MoveEval(
        move_number=n, is_player_move=is_player, fen_before=START_FEN,
        move_uci="e2e4", move_san="e4", eval_before=b, eval_after=a,
        best_move_uci="e2e4",
    )


def test_ingest_sets_accuracy_white(db):
    from app.services.analysis_ingest import store_results
    from app.schemas import AnalyzeResultsIn
    from tests.conftest import TEST_USER_ID, make_game

    g = make_game(db, id="acc_w", platform_id="acc_w", user_id=TEST_USER_ID)
    assert g.accuracy is None
    store_results(db, TEST_USER_ID, AnalyzeResultsIn(game_id=g.id, depth=10, moves=[
        _eval(0, 1, 20, 15), _eval(1, 0, 15, 15), _eval(2, 1, 30, 25),
    ]))
    db.refresh(g)
    expected = game_accuracy([
        {"eval_before": 20, "eval_after": 15, "is_player_move": 1},
        {"eval_before": 30, "eval_after": 25, "is_player_move": 1},
    ])
    assert g.accuracy == pytest.approx(expected)


def test_ingest_accuracy_black_pov_flip(db):
    from app.services.analysis_ingest import store_results
    from app.schemas import AnalyzeResultsIn
    from tests.conftest import TEST_USER_ID, make_game

    g = make_game(db, id="acc_b", platform_id="acc_b", user_id=TEST_USER_ID, player_color="black")
    # White-POV +300 -> +100 means black improved; player-POV -300 -> -100 (no drop)
    store_results(db, TEST_USER_ID, AnalyzeResultsIn(game_id=g.id, depth=10, moves=[
        _eval(1, 1, 300, 100),
    ]))
    db.refresh(g)
    assert g.accuracy == pytest.approx(game_accuracy([
        {"eval_before": -300, "eval_after": -100, "is_player_move": 1}]))
    assert g.accuracy > 99


def test_ingest_accuracy_none_when_no_evals(db):
    from app.services.analysis_ingest import store_results
    from app.schemas import AnalyzeResultsIn
    from tests.conftest import TEST_USER_ID, make_game

    g = make_game(db, id="acc_n", platform_id="acc_n", user_id=TEST_USER_ID)
    store_results(db, TEST_USER_ID, AnalyzeResultsIn(game_id=g.id, depth=10, moves=[
        _eval(0, 1, None, None),
    ]))
    db.refresh(g)
    assert g.accuracy is None
