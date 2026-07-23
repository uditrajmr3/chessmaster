from __future__ import annotations

from .pgn_features import GameFeature

PIECES = ["pawn", "knight", "bishop", "rook", "queen", "king"]
VARIANTS = ["chess960", "crazyhouse", "kingofthehill", "threecheck", "bughouse", "oddschess"]
_STATS_KEYS = {"bullet": "chess_bullet", "blitz": "chess_blitz",
               "rapid": "chess_rapid", "daily": "chess_daily"}


def _empty() -> dict:
    return {
        "games": {"live": 0, "daily": 0, "total": 0},
        "wins": {"live": 0, "daily": 0, "total": 0},
        "ratings_peak": {k: None for k in _STATS_KEYS},
        "puzzles": {"rating_best": None, "rush_best": None},
        "mates_by_piece": {p: 0 for p in PIECES},
        "mates_by_king_discovery": 0,
        "mate_by_castling": 0,
        "variants": {v: 0 for v in VARIANTS},
        "countries_played": [],
        "eco_played": {},
        "min_clock_win_ms": None,
        "flawless_wins": 0,
        "quick_knockouts": 0,
        "marathon_games": 0,
        "promotions": {"queen": 0, "underpromotion": 0},
    }


def aggregate(features: list[GameFeature], countries: dict[str, str], stats: dict) -> dict:
    m = _empty()
    seen: set[str] = set()

    for f in features:
        bucket = "daily" if f.time_class == "daily" else "live"
        m["games"][bucket] += 1
        m["games"]["total"] += 1
        if f.result == "win":
            m["wins"][bucket] += 1
            m["wins"]["total"] += 1
            if f.mating_piece:
                m["mates_by_piece"][f.mating_piece] += 1
            if f.mate_by_king_discovery:
                m["mates_by_king_discovery"] += 1
            if f.mate_by_castling:
                m["mate_by_castling"] += 1
            if f.pieces_lost == 0:
                m["flawless_wins"] += 1
            if f.moves < 40:
                m["quick_knockouts"] += 1
            if f.final_clock_ms is not None:
                cur = m["min_clock_win_ms"]
                m["min_clock_win_ms"] = f.final_clock_ms if cur is None else min(cur, f.final_clock_ms)

        if f.moves >= 200:
            m["marathon_games"] += 1
        if f.rules in m["variants"]:
            m["variants"][f.rules] += 1
        if f.eco:
            m["eco_played"][f.eco] = m["eco_played"].get(f.eco, 0) + 1
        for name, n in f.promotions.items():
            key = "queen" if name == "queen" else "underpromotion"
            m["promotions"][key] += n
        if f.opponent_username:
            seen.add(f.opponent_username.lower())

    m["countries_played"] = sorted({countries[u] for u in seen if u in countries})

    for label, key in _STATS_KEYS.items():
        m["ratings_peak"][label] = (stats.get(key) or {}).get("best", {}).get("rating")
    m["puzzles"]["rating_best"] = (stats.get("tactics") or {}).get("highest", {}).get("rating")
    m["puzzles"]["rush_best"] = (stats.get("puzzle_rush") or {}).get("best", {}).get("score")
    return m


def merge(base: dict, incr: dict) -> dict:
    """Fold an incremental scan into a stored one. Counts sum, minima take the
    minimum, country sets union, and stats-derived fields take the newer value."""
    out = dict(base)
    for group in ("games", "wins"):
        out[group] = {k: base[group][k] + incr[group][k] for k in base[group]}
    out["mates_by_piece"] = {p: base["mates_by_piece"][p] + incr["mates_by_piece"][p] for p in PIECES}
    out["variants"] = {v: base["variants"][v] + incr["variants"][v] for v in VARIANTS}
    for k in ("mates_by_king_discovery", "mate_by_castling", "flawless_wins",
              "quick_knockouts", "marathon_games"):
        out[k] = base[k] + incr[k]
    out["promotions"] = {k: base["promotions"][k] + incr["promotions"][k] for k in base["promotions"]}

    eco = dict(base["eco_played"])
    for code, n in incr["eco_played"].items():
        eco[code] = eco.get(code, 0) + n
    out["eco_played"] = eco

    out["countries_played"] = sorted(set(base["countries_played"]) | set(incr["countries_played"]))

    clocks = [c for c in (base["min_clock_win_ms"], incr["min_clock_win_ms"]) if c is not None]
    out["min_clock_win_ms"] = min(clocks) if clocks else None

    out["ratings_peak"] = incr["ratings_peak"]
    out["puzzles"] = incr["puzzles"]
    return out
