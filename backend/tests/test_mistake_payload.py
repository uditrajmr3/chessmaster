"""Tests for MistakeOut builder / refutation helper."""

from sqlalchemy import event

from app.models import MoveAnalysis
from app.services.mistake_payload import build_mistakes, refutation_for
from tests.conftest import TEST_USER_ID, make_game, make_move_analysis

OTHER_USER = "00000000-0000-0000-0000-000000000002"


def _ma(db, game_id, n, **kw):
    return make_move_analysis(db, game_id=game_id, move_number=n, **kw)


def _set(db, m, **kw):
    for k, v in kw.items():
        setattr(m, k, v)
    db.commit()


def test_refutation_is_next_ply_best_move(db):
    make_game(db)
    a = _ma(db, "chesscom_test1", 4)
    b = _ma(db, "chesscom_test1", 5, is_player_move=0)
    _set(db, b, best_move_uci="d7d5")
    assert refutation_for(db, a) == "d7d5"
    [out] = build_mistakes(db, TEST_USER_ID, [a.id])
    assert out.refutation_uci == "d7d5"


def test_refutation_none_at_game_end(db):
    make_game(db)
    a = _ma(db, "chesscom_test1", 9)
    assert refutation_for(db, a) is None
    assert build_mistakes(db, TEST_USER_ID, [a.id])[0].refutation_uci is None


def test_refutation_none_when_next_has_no_best_move(db):
    make_game(db)
    a = _ma(db, "chesscom_test1", 4)
    b = _ma(db, "chesscom_test1", 5, is_player_move=0)
    _set(db, b, best_move_uci=None)
    assert build_mistakes(db, TEST_USER_ID, [a.id])[0].refutation_uci is None


def test_cross_user_isolation(db):
    make_game(db)
    a = _ma(db, "chesscom_test1", 4)
    assert build_mistakes(db, OTHER_USER, [a.id]) == []
    assert build_mistakes(db, TEST_USER_ID, []) == []
    assert build_mistakes(db, TEST_USER_ID, [999999]) == []


def test_order_preserved_and_unknown_dropped(db):
    make_game(db)
    ms = [_ma(db, "chesscom_test1", n) for n in (2, 6, 4)]
    ids = [ms[1].id, 987654, ms[2].id, ms[0].id]
    out = build_mistakes(db, TEST_USER_ID, ids)
    assert [o.move_analysis_id for o in out] == [ms[1].id, ms[2].id, ms[0].id]


def test_motifs_parsing(db):
    make_game(db)
    a = _ma(db, "chesscom_test1", 2, tactical_motifs=["fork", "pin"])
    b = _ma(db, "chesscom_test1", 4)
    c = _ma(db, "chesscom_test1", 6)
    d = _ma(db, "chesscom_test1", 8)
    _set(db, c, tactical_motifs="{not json")
    _set(db, d, tactical_motifs='{"a": 1}')
    out = {o.move_analysis_id: o for o in build_mistakes(db, TEST_USER_ID, [a.id, b.id, c.id, d.id])}
    assert out[a.id].tactical_motifs == ["fork", "pin"]
    assert out[b.id].tactical_motifs == []
    assert out[c.id].tactical_motifs == []
    assert out[d.id].tactical_motifs == []


def test_opponent_for_both_colours(db):
    make_game(db, id="g_w", platform_id="w", player_color="white")
    make_game(db, id="g_b", platform_id="b", player_color="black")
    w = _ma(db, "g_w", 2)
    b = _ma(db, "g_b", 2)
    out = {o.game_id: o for o in build_mistakes(db, TEST_USER_ID, [w.id, b.id])}
    assert out["g_w"].opponent == "opponent" and out["g_w"].player_color == "white"
    assert out["g_b"].opponent == "opponent" and out["g_b"].player_color == "black"
    assert out["g_w"].played_at is not None


def test_time_spent_derivation(db):
    make_game(db)
    _ma(db, "chesscom_test1", 2, time_remaining=100.0)
    cur = _ma(db, "chesscom_test1", 4, time_remaining=88.5)
    first = _ma(db, "chesscom_test1", 0, time_remaining=60.0)
    inc = _ma(db, "chesscom_test1", 6, time_remaining=95.0)  # clock went up (increment)
    nocl = _ma(db, "chesscom_test1", 8, time_remaining=None)
    out = {o.move_analysis_id: o for o in build_mistakes(db, TEST_USER_ID, [cur.id, first.id, inc.id, nocl.id])}
    assert out[cur.id].time_spent == 11.5
    assert out[cur.id].time_remaining == 88.5
    assert out[first.id].time_spent is None
    assert out[inc.id].time_spent == 0.0
    assert out[nocl.id].time_spent is None


def test_query_count_bounded(db):
    make_game(db)
    ids = [_ma(db, "chesscom_test1", n).id for n in range(0, 20, 2)]
    db.expire_all()
    count = {"n": 0}

    def _count(*_a, **_k):
        count["n"] += 1

    eng = db.get_bind()
    event.listen(eng, "before_cursor_execute", _count)
    try:
        out = build_mistakes(db, TEST_USER_ID, ids)
    finally:
        event.remove(eng, "before_cursor_execute", _count)
    assert len(out) == 10
    assert count["n"] <= 3
