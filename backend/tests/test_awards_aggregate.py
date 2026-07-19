from app.services.awards.aggregate import aggregate, merge
from app.services.awards.pgn_features import GameFeature

def gf(**kw) -> GameFeature:
    return GameFeature(**kw)

def test_counts_live_and_daily_games_separately():
    m = aggregate([gf(time_class="blitz"), gf(time_class="daily")], {}, {})
    assert m["games"] == {"live": 1, "daily": 1, "total": 2}

def test_tallies_mates_by_piece():
    m = aggregate([gf(result="win", mating_piece="knight"),
                   gf(result="win", mating_piece="knight"),
                   gf(result="win", mating_piece="queen")], {}, {})
    assert m["mates_by_piece"]["knight"] == 2
    assert m["mates_by_piece"]["queen"] == 1
    assert m["mates_by_piece"]["bishop"] == 0

def test_min_clock_win_ignores_losses_and_missing_clocks():
    m = aggregate([gf(result="win", final_clock_ms=5000),
                   gf(result="win", final_clock_ms=800),
                   gf(result="loss", final_clock_ms=10),
                   gf(result="win", final_clock_ms=None)], {}, {})
    assert m["min_clock_win_ms"] == 800

def test_min_clock_win_is_none_when_no_clocked_win_exists():
    assert aggregate([gf(result="win", final_clock_ms=None)], {}, {})["min_clock_win_ms"] is None

def test_flawless_wins_require_a_win_and_zero_losses():
    m = aggregate([gf(result="win", pieces_lost=0),
                   gf(result="win", pieces_lost=1),
                   gf(result="loss", pieces_lost=0)], {}, {})
    assert m["flawless_wins"] == 1

def test_countries_played_is_a_sorted_unique_list():
    feats = [gf(opponent_username="Bob"), gf(opponent_username="cara"), gf(opponent_username="bob")]
    m = aggregate(feats, {"bob": "US", "cara": "IN"}, {})
    assert m["countries_played"] == ["IN", "US"]

def test_ratings_peak_and_puzzles_read_from_stats():
    stats = {"chess_blitz": {"best": {"rating": 1420}},
             "tactics": {"highest": {"rating": 2100}},
             "puzzle_rush": {"best": {"score": 34}}}
    m = aggregate([], {}, stats)
    assert m["ratings_peak"]["blitz"] == 1420
    assert m["puzzles"] == {"rating_best": 2100, "rush_best": 34}

def test_merge_sums_counts_and_unions_sets():
    a = aggregate([gf(time_class="blitz", result="win", mating_piece="queen",
                      final_clock_ms=900, opponent_username="bob")], {"bob": "US"}, {})
    b = aggregate([gf(time_class="blitz", result="win", mating_piece="queen",
                      final_clock_ms=400, opponent_username="cara")], {"cara": "IN"}, {})
    m = merge(a, b)
    assert m["games"]["total"] == 2
    assert m["mates_by_piece"]["queen"] == 2
    assert m["min_clock_win_ms"] == 400          # min, not sum
    assert m["countries_played"] == ["IN", "US"] # union, not concat
