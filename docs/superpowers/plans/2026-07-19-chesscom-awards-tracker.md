# Chess.com Awards Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, no-auth `/awards` section that scans a Chess.com username and shows which awards they have earned, which they have not, and how to earn the rest.

**Architecture:** The backend is a pure measurement engine — it fetches a player's public game archives, parses each game exactly once into a feature record, aggregates those into a flat measurements payload, and caches it. The frontend owns the award catalog as JSON and evaluates catalog rules against the measurements. The backend never knows what an award is.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Alembic + `python-chess` (already a dependency) on the backend. Next.js 16 App Router + React 19 + Tailwind v4 + next-intl 4 on the frontend.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-19-chesscom-awards-tracker-design.md`. Read it before starting any task.
- **Never invent award names or criteria.** Every catalog entry carries `provenance` ∈ `verified | community | inferred`. If a name cannot be sourced, it does not ship.
- Backend measurement payloads contain measurements, never verdicts. `min_clock_win_ms` is correct; `nick_of_time_earned` is a layering violation.
- The awards router is the **only** public router in the codebase. It must not depend on `current_verified_user`.
- No new Python or npm dependencies. `python-chess>=1.10.0` is already present in `backend/pyproject.toml`.
- Alembic: the current head is `d2e3f4a5b6c7`. Any new migration sets `down_revision = 'd2e3f4a5b6c7'`.
- Award names and criteria are English-only. UI chrome is translated across `en`, `hi`, `gu`.
- Chess.com username validation regex, applied before any outbound call: `^[A-Za-z0-9_-]{3,25}$`.
- Tailwind v4 with existing tokens from `frontend/src/app/globals.css`. Reuse `.surface-card`, `.card-hover`, `.btn-press` and the primitives in `frontend/src/components/ui/page-kit.tsx`.
- Commit after every task. Conventional commits, scope `awards`.

---

## File Structure

**Backend — created:**
- `backend/app/services/awards/__init__.py`
- `backend/app/services/awards/pgn_features.py` — one game → `GameFeature`
- `backend/app/services/awards/aggregate.py` — `[GameFeature]` → measurements dict
- `backend/app/services/awards/ratelimit.py` — in-process sliding window
- `backend/app/services/awards/scanner.py` — orchestration
- `backend/app/routers/awards.py` — public router
- `backend/alembic/versions/e3f4a5b6c7d8_award_scan.py`
- `backend/tests/fixtures/awards/*.pgn`
- `backend/tests/test_awards_*.py`

**Backend — modified:**
- `backend/app/models.py` — add `AwardScan`
- `backend/app/main.py` — mount the router

**Frontend — created:**
- `frontend/src/data/awards/{achievements,books,passports}.json`
- `frontend/src/lib/awards/{types.ts,catalog.ts,evaluate.ts,measurements.ts}`
- `frontend/src/components/ui/ProgressBar.tsx`
- `frontend/src/components/awards/{ScanPanel.tsx,AwardCard.tsx,AwardGrid.tsx,ProvenanceBadge.tsx}`
- `frontend/src/app/awards/page.tsx` and the category/detail/stub routes
- `.github/ISSUE_TEMPLATE/award-correction.yml`

**Frontend — modified:**
- `frontend/src/components/AuthGuard.tsx`, `frontend/src/app/sitemap.ts`, `frontend/src/app/robots.ts`
- `frontend/src/messages/{en,hi,gu}.json`

---

### Task 1: Measurement contract

The shared vocabulary between backend and frontend. Everything downstream references these keys, so this lands first.

**Files:**
- Create: `frontend/src/lib/awards/measurements.ts`
- Create: `frontend/src/lib/awards/types.ts`
- Test: `frontend/src/lib/awards/__tests__/measurements.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `MEASUREMENT_KEYS: readonly string[]`, `isValidMeasurementKey(k: string): boolean`, types `Measurements`, `ScanResult`, `AwardEntry`, `AwardRule`, `AwardStatus`, `Provenance`

- [ ] **Step 1: Write the failing test**

```ts
import { MEASUREMENT_KEYS, isValidMeasurementKey } from "../measurements";

describe("measurement keys", () => {
  it("accepts a known dotted key", () => {
    expect(isValidMeasurementKey("mates_by_piece.knight")).toBe(true);
  });
  it("rejects an unknown key", () => {
    expect(isValidMeasurementKey("mates_by_piece.dragon")).toBe(false);
  });
  it("has no duplicates", () => {
    expect(new Set(MEASUREMENT_KEYS).size).toBe(MEASUREMENT_KEYS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/lib/awards`
Expected: FAIL — cannot resolve `../measurements`.

The frontend uses **Jest + ts-jest** (verified: `npm test` → `jest`). `describe`/`it`/`expect` are globals — do not import them, and do not add vitest. `resolveJsonModule` is already enabled in `tsconfig.json`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/lib/awards/measurements.ts
export const PIECES = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;
export const TIME_CLASSES = ["bullet", "blitz", "rapid", "daily"] as const;
export const VARIANTS = [
  "chess960", "crazyhouse", "kingofthehill", "threecheck", "bughouse", "oddschess",
] as const;

export const MEASUREMENT_KEYS = [
  "games.live", "games.daily", "games.total",
  "wins.live", "wins.daily", "wins.total",
  ...TIME_CLASSES.map((c) => `ratings_peak.${c}`),
  "puzzles.rating_best", "puzzles.rush_best",
  ...PIECES.map((p) => `mates_by_piece.${p}`),
  "mates_by_king_discovery",
  "mate_by_castling",
  ...VARIANTS.map((v) => `variants.${v}`),
  "countries_played",
  "eco_played",
  "min_clock_win_ms",
  "flawless_wins",
  "quick_knockouts",
  "marathon_games",
  "promotions.queen", "promotions.underpromotion",
] as const;

const KEY_SET = new Set<string>(MEASUREMENT_KEYS);

/** `eco_played.B01` is valid: the ECO code is data, not a fixed key. */
export function isValidMeasurementKey(key: string): boolean {
  if (KEY_SET.has(key)) return true;
  if (key.startsWith("eco_played.")) return /^eco_played\.[A-E]\d{2}$/.test(key);
  return false;
}

/** Resolve a dotted path against a measurements object. */
export function readMeasurement(m: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined),
    m,
  );
}
```

```ts
// frontend/src/lib/awards/types.ts
export type Provenance = "verified" | "community" | "inferred";
export type RuleOp = ">=" | ">" | "<=" | "<" | "==" | "set_size" | "has_key";

export interface AwardRule {
  measurement: string;
  op: RuleOp;
  target: number;
}

export interface AwardEntry {
  id: string;
  slug: string;
  name: string;
  category: "achievements" | "books" | "passports";
  description: string;
  howTo: string;
  provenance: Provenance;
  hidden: boolean;
  rule?: AwardRule;
}

export interface Measurements { [k: string]: unknown }

export interface ScanResult {
  username: string;
  platform: "chesscom";
  scanned_at: string;
  games_parsed: number;
  games_skipped: number;
  truncated: boolean;
  measurements: Measurements;
}

export interface AwardStatus {
  id: string;
  earned: boolean;
  manual: boolean;
  progress: { current: number; target: number } | null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest src/lib/awards`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/awards
git commit -m "feat(awards): define the measurement contract shared by scanner and catalog"
```

---

### Task 2: PGN feature extraction

The trickiest code in the feature. Each game is parsed once into a `GameFeature`; every measurement derives from these.

**Files:**
- Create: `backend/app/services/awards/__init__.py` (empty), `backend/app/services/awards/pgn_features.py`
- Create: `backend/tests/fixtures/awards/` (see Step 1)
- Test: `backend/tests/test_awards_pgn_features.py`

**Interfaces:**
- Consumes: nothing
- Produces: `@dataclass GameFeature`, `extract_features(pgn_text: str, player: str) -> GameFeature | None` (returns `None` for unparseable input — callers count these as skipped)

**Semantics that will otherwise cost debugging time:**

- The **mating piece is the checking piece**, not the piece that moved. Use `board.checkers()` on the final position. A discovered mate has a checker that is not the last move's destination.
- A king can never give direct check, so "mate delivered by king" means the king moved and revealed a discovered check. That is `mates_by_king_discovery`, tracked separately from `mates_by_piece`.
- **Pieces lost** counts captures made *against* the player across the whole game. Do not read the final position — a captured piece's square can be reoccupied later.
- **Clock** comes from `[%clk H:MM:SS.f]` comments. Daily games have none; emit `None`, never `0`. `0` would falsely satisfy a "win with under a second left" rule.

- [ ] **Step 1: Create fixtures**

Create these files under `backend/tests/fixtures/awards/`. Generate them with `python-chess` rather than hand-writing move text, so the positions are guaranteed legal:

```python
# Run once from backend/, then delete this scratch script.
import chess, chess.pgn, io, pathlib
out = pathlib.Path("tests/fixtures/awards"); out.mkdir(parents=True, exist_ok=True)

def write(name, moves_san, headers, clocks=None):
    g = chess.pgn.Game(); g.headers.update(headers)
    node, b = g, chess.Board()
    for i, san in enumerate(moves_san):
        mv = b.parse_san(san); b.push(mv); node = node.add_variation(mv)
        if clocks and i < len(clocks) and clocks[i]:
            node.comment = f"[%clk {clocks[i]}]"
    (out / name).write_text(str(g))

base = {"White": "alice", "Black": "bob", "Site": "Chess.com", "Result": "1-0"}
# Scholar's mate — queen delivers mate, alice (White) wins.
write("mate_by_queen.pgn", ["e4","e5","Bc4","Nc6","Qh5","Nf6","Qxf7#"], {**base, "ECO": "C50"})
# Smothered mate — knight delivers mate.
write("mate_by_knight.pgn", ["e4","c5","Ne2","Nc6","d4","cxd4","Nxd4","Nf6","Nc3","Ne5","Ndb5","a6","Nd6#"], {**base, "ECO": "B27"})
# Fool's mate — bob (Black) wins with the queen; asserts player-colour handling.
write("mate_black_wins.pgn", ["f3","e5","g4","Qh4#"], {**base, "Result": "0-1"})
# Clock comments, final white clock under one second.
write("win_low_clock.pgn", ["e4","e5","Bc4","Nc6","Qh5","Nf6","Qxf7#"],
      {**base, "TimeControl": "60"},
      clocks=["0:00:30","0:00:29","0:00:12","0:00:11","0:00:04","0:00:03","0:00:00.8"])
(out / "malformed.pgn").write_text("this is not a pgn {{{ ")
```

Also create `mate_by_castling.pgn` and `flawless_win.pgn` the same way. For castling mate, use a known composition; verify with `board.is_checkmate()` before committing the fixture. Scholar's mate above is already flawless for White (White loses no pieces), so reuse it as the flawless fixture rather than authoring a duplicate.

- [ ] **Step 2: Write the failing test**

```python
import pathlib
import pytest
from app.services.awards.pgn_features import extract_features

FIX = pathlib.Path(__file__).parent / "fixtures" / "awards"

def read(name: str) -> str:
    return (FIX / name).read_text()

def test_queen_mate_attributed_to_queen():
    f = extract_features(read("mate_by_queen.pgn"), "alice")
    assert f.result == "win"
    assert f.player_color == "white"
    assert f.mating_piece == "queen"
    assert f.opponent_username == "bob"

def test_knight_mate_attributed_to_knight():
    assert extract_features(read("mate_by_knight.pgn"), "alice").mating_piece == "knight"

def test_player_colour_resolved_from_headers():
    f = extract_features(read("mate_black_wins.pgn"), "bob")
    assert f.player_color == "black"
    assert f.result == "win"
    assert f.mating_piece == "queen"

def test_losing_side_gets_loss_and_no_mating_piece_credit():
    f = extract_features(read("mate_black_wins.pgn"), "alice")
    assert f.result == "loss"

def test_final_clock_parsed_in_milliseconds():
    f = extract_features(read("win_low_clock.pgn"), "alice")
    assert f.final_clock_ms == 800

def test_daily_game_without_clocks_yields_none_not_zero():
    f = extract_features(read("mate_by_queen.pgn"), "alice")
    assert f.final_clock_ms is None

def test_flawless_win_loses_no_pieces():
    assert extract_features(read("mate_by_queen.pgn"), "alice").pieces_lost == 0

def test_malformed_pgn_returns_none_rather_than_raising():
    assert extract_features(read("malformed.pgn"), "alice") is None

def test_username_matching_is_case_insensitive():
    assert extract_features(read("mate_by_queen.pgn"), "ALICE").player_color == "white"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pytest tests/test_awards_pgn_features.py -v`
Expected: FAIL — `ModuleNotFoundError: app.services.awards.pgn_features`.

- [ ] **Step 4: Write the implementation**

```python
"""Parse one Chess.com PGN into a compact feature record.

Each game is parsed exactly once; every measurement is derived from the
aggregate of these records. Re-walking move lists per award would be
quadratic in the number of awards.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import chess
import chess.pgn

_CLK = re.compile(r"\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]")

_PIECE_NAMES = {
    chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop",
    chess.ROOK: "rook", chess.QUEEN: "queen", chess.KING: "king",
}


@dataclass
class GameFeature:
    rules: str = "chess"
    time_class: str = "unknown"
    result: str = "draw"                  # win | loss | draw
    player_color: str = "white"
    opponent_username: str = ""
    mating_piece: str | None = None       # checking piece on the final position
    mate_by_king_discovery: bool = False
    mate_by_castling: bool = False
    final_clock_ms: int | None = None
    moves: int = 0
    pieces_lost: int = 0
    eco: str | None = None
    promotions: dict[str, int] = field(default_factory=dict)
    player_rating: int | None = None


def _clock_ms(comment: str) -> int | None:
    m = _CLK.search(comment or "")
    if not m:
        return None
    h, mi, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return int((h * 3600 + mi * 60 + s) * 1000)


def extract_features(pgn_text: str, player: str) -> GameFeature | None:
    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
    except Exception:
        return None
    if game is None:
        return None

    h = game.headers
    white, black = (h.get("White") or "").lower(), (h.get("Black") or "").lower()
    p = player.lower()
    if p not in (white, black):
        return None

    f = GameFeature()
    f.player_color = "white" if p == white else "black"
    player_is_white = f.player_color == "white"
    f.opponent_username = h.get("Black") if player_is_white else h.get("White")
    f.eco = h.get("ECO") or None
    f.rules = (h.get("Variant") or "chess").lower().replace(" ", "")

    res = h.get("Result", "*")
    if res == "1/2-1/2":
        f.result = "draw"
    elif res in ("1-0", "0-1"):
        won = (res == "1-0") == player_is_white
        f.result = "win" if won else "loss"

    rating_key = "WhiteElo" if player_is_white else "BlackElo"
    try:
        f.player_rating = int(h.get(rating_key, ""))
    except (TypeError, ValueError):
        f.player_rating = None

    player_color = chess.WHITE if player_is_white else chess.BLACK
    board = game.board()
    last_move = None
    last_clock = None

    for node in game.mainline():
        move = node.move
        mover = board.turn
        if board.is_capture(move) and mover != player_color:
            f.pieces_lost += 1
        if move.promotion and mover == player_color:
            name = _PIECE_NAMES[move.promotion]
            f.promotions[name] = f.promotions.get(name, 0) + 1
        if mover == player_color:
            c = _clock_ms(node.comment)
            if c is not None:
                last_clock = c
        was_castling = board.is_castling(move)
        board.push(move)
        last_move, f.moves = move, f.moves + 1
        if board.is_checkmate() and mover == player_color:
            f.mate_by_castling = was_castling

    f.final_clock_ms = last_clock

    # Mate attribution: the checking piece, not the piece that moved.
    if board.is_checkmate() and f.result == "win":
        checkers = list(board.checkers())
        if len(checkers) == 1:
            sq = checkers[0]
            piece = board.piece_at(sq)
            if piece is not None:
                f.mating_piece = _PIECE_NAMES[piece.piece_type]
            # A king cannot give direct check, so a king that moved while not
            # being a checker revealed a discovered mate.
            if last_move is not None and sq != last_move.to_square:
                moved = board.piece_at(last_move.to_square)
                if moved is not None and moved.piece_type == chess.KING:
                    f.mate_by_king_discovery = True
        elif len(checkers) > 1 and last_move is not None:
            moved = board.piece_at(last_move.to_square)
            if moved is not None:
                f.mating_piece = _PIECE_NAMES[moved.piece_type]

    return f
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_awards_pgn_features.py -v`
Expected: 9 passing. If a fixture assertion fails, fix the *fixture* (regenerate and verify `is_checkmate()`), not the assertion.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/awards backend/tests/test_awards_pgn_features.py backend/tests/fixtures/awards
git commit -m "feat(awards): extract per-game features from Chess.com PGNs"
```

---

### Task 3: Aggregation into measurements

**Files:**
- Create: `backend/app/services/awards/aggregate.py`
- Test: `backend/tests/test_awards_aggregate.py`

**Interfaces:**
- Consumes: `GameFeature` from Task 2
- Produces: `aggregate(features: list[GameFeature], countries: dict[str, str], stats: dict) -> dict` returning the `measurements` object; `merge(base: dict, incr: dict) -> dict` for incremental rescans

`countries` maps lowercased opponent username → ISO alpha-2. `stats` is the raw `/pub/player/{u}/stats` body, used for `ratings_peak` and `puzzles` which are cheaper to read there than to derive.

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_awards_aggregate.py -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Write the implementation**

Key rules, which the tests above pin down: counts sum; `min_clock_win_ms` takes the minimum and ignores `None`; `countries_played` is a sorted union; `eco_played` merges by summing per-code counts. `quick_knockouts` counts wins in under 20 moves (`moves < 40`, since `moves` counts plies); `marathon_games` counts games of 100+ full moves (`moves >= 200`).

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_awards_aggregate.py -v`
Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/awards/aggregate.py backend/tests/test_awards_aggregate.py
git commit -m "feat(awards): aggregate game features into the measurement payload"
```

---

### Task 4: Persistence — `AwardScan` model and migration

**Files:**
- Modify: `backend/app/models.py`
- Create: `backend/alembic/versions/e3f4a5b6c7d8_award_scan.py`
- Test: `backend/tests/test_awards_model.py`

**Interfaces:**
- Produces: `AwardScan` ORM model with columns `id, platform, username, measurements, archive_watermark, games_parsed, scanned_at`

- [ ] **Step 1: Read the existing model file for conventions**

Run: `sed -n '1,60p' backend/app/models.py`
Match the existing import style, base class, and UUID/timestamp column conventions exactly. Do not introduce a different UUID or timestamp approach than the file already uses.

- [ ] **Step 2: Write the failing test**

```python
from app.models import AwardScan

def test_award_scan_table_shape():
    cols = AwardScan.__table__.columns
    for name in ("id", "platform", "username", "measurements",
                 "archive_watermark", "games_parsed", "scanned_at"):
        assert name in cols, f"missing column {name}"

def test_platform_and_username_are_uniquely_constrained():
    constraints = {
        tuple(sorted(c.columns.keys()))
        for c in AwardScan.__table__.constraints
        if hasattr(c, "columns") and len(c.columns) == 2
    }
    assert ("platform", "username") in constraints
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pytest tests/test_awards_model.py -v`
Expected: FAIL — `ImportError: cannot import name 'AwardScan'`.

- [ ] **Step 4: Add the model**

Append to `backend/app/models.py`, adapting the base class and column idioms to match what is already in the file:

```python
class AwardScan(Base):
    """Cached measurement payload for one public profile.

    Holds only public data: a username and derived counts. No opponent
    identities are persisted beyond ISO country codes.
    """
    __tablename__ = "award_scan"
    __table_args__ = (UniqueConstraint("platform", "username", name="uq_award_scan_platform_username"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    platform: Mapped[str] = mapped_column(String(16), nullable=False, default="chesscom")
    username: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    measurements: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    archive_watermark: Mapped[str | None] = mapped_column(String(7), nullable=True)
    games_parsed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

`username` is stored lowercased by the scanner so the unique constraint is meaningful.

- [ ] **Step 5: Generate and review the migration**

```bash
cd backend && alembic revision --autogenerate -m "award_scan"
```

Open the generated file. Set `revision = 'e3f4a5b6c7d8'` and `down_revision = 'd2e3f4a5b6c7'`. Delete any autogenerated operations that touch tables other than `award_scan` — autogenerate often picks up unrelated drift.

- [ ] **Step 6: Verify the migration applies and reverses**

```bash
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head
```
Expected: three clean runs, no errors. Then `pytest tests/test_awards_model.py -v` → 2 passing.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models.py backend/alembic/versions/e3f4a5b6c7d8_award_scan.py backend/tests/test_awards_model.py
git commit -m "feat(awards): persist cached scans in award_scan"
```

---

### Task 5: In-process rate limiter

**Files:**
- Create: `backend/app/services/awards/ratelimit.py`
- Test: `backend/tests/test_awards_ratelimit.py`

**Interfaces:**
- Produces: `class SlidingWindowLimiter(max_events: int, window_seconds: int)` with `allow(key: str, now: float | None = None) -> bool`

- [ ] **Step 1: Write the failing test**

```python
from app.services.awards.ratelimit import SlidingWindowLimiter

def test_allows_up_to_the_cap():
    lim = SlidingWindowLimiter(max_events=3, window_seconds=60)
    assert [lim.allow("ip", now=t) for t in (0, 1, 2)] == [True, True, True]

def test_blocks_beyond_the_cap_within_the_window():
    lim = SlidingWindowLimiter(max_events=2, window_seconds=60)
    lim.allow("ip", now=0); lim.allow("ip", now=1)
    assert lim.allow("ip", now=2) is False

def test_allows_again_once_the_window_slides_past():
    lim = SlidingWindowLimiter(max_events=1, window_seconds=60)
    lim.allow("ip", now=0)
    assert lim.allow("ip", now=61) is True

def test_keys_are_tracked_independently():
    lim = SlidingWindowLimiter(max_events=1, window_seconds=60)
    lim.allow("a", now=0)
    assert lim.allow("b", now=0) is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_awards_ratelimit.py -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Write the implementation**

```python
"""Per-IP sliding-window limiter for the public awards endpoint.

SINGLE-INSTANCE ASSUMPTION: state is in-process, so with multiple workers
the effective cap is per worker. This is a safety valve against runaway
scanning, not a billing control — the 6-hour scan cache absorbs real load.
Move to a shared store (Redis/DB) for scale-out, as noted in sync.py and
report.py.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: int) -> None:
        self.max_events = max_events
        self.window = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float | None = None) -> bool:
        t = time.monotonic() if now is None else now
        q = self._events[key]
        cutoff = t - self.window
        while q and q[0] <= cutoff:
            q.popleft()
        if len(q) >= self.max_events:
            return False
        q.append(t)
        return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_awards_ratelimit.py -v`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/awards/ratelimit.py backend/tests/test_awards_ratelimit.py
git commit -m "feat(awards): add a per-IP sliding-window limiter for public scans"
```

---

### Task 6: Scanner orchestration

**Files:**
- Create: `backend/app/services/awards/scanner.py`
- Test: `backend/tests/test_awards_scanner.py`

**Interfaces:**
- Consumes: `extract_features`, `aggregate`, `merge`, `AwardScan`, and `ChessComClient` from `backend/app/services/chesscom_client.py`
- Produces: `async def run_scan(platform: str, username: str, db, progress_cb) -> dict` returning the full `ScanResult` payload; `MAX_GAMES = 25_000`

- [ ] **Step 1: Read the existing Chess.com client**

Run: `sed -n '1,80p' backend/app/services/chesscom_client.py`
Reuse its session, base URL, and User-Agent handling rather than issuing raw HTTP calls. Note how `sync.py` calls it and follow that pattern.

- [ ] **Step 2: Write the failing test**

Use a fake client so tests make no network calls.

```python
import pytest
from app.services.awards import scanner

class FakeClient:
    def __init__(self, archives, games, stats, countries):
        self.archives, self.games, self.stats, self.countries = archives, games, stats, countries
        self.fetched = []
    async def get_archives(self, u): return self.archives
    async def get_archive_games(self, url):
        self.fetched.append(url); return self.games.get(url, [])
    async def get_stats(self, u): return self.stats
    async def get_player(self, u):
        return {"country": f"https://api.chess.com/pub/country/{self.countries.get(u.lower(), 'US')}"}

QUEEN_MATE_PGN = open("tests/fixtures/awards/mate_by_queen.pgn").read()

@pytest.mark.asyncio
async def test_scan_parses_games_and_returns_measurements():
    url = "https://api.chess.com/pub/player/alice/games/2026/06"
    client = FakeClient([url], {url: [{"pgn": QUEEN_MATE_PGN, "time_class": "blitz", "rules": "chess"}]},
                        {}, {"bob": "IN"})
    out = await scanner.run_scan("chesscom", "alice", db=None, client=client)
    assert out["games_parsed"] == 1
    assert out["measurements"]["mates_by_piece"]["queen"] == 1
    assert out["measurements"]["countries_played"] == ["IN"]

@pytest.mark.asyncio
async def test_unparseable_games_are_skipped_not_fatal():
    url = "https://api.chess.com/pub/player/alice/games/2026/06"
    client = FakeClient([url], {url: [{"pgn": "garbage {{{", "time_class": "blitz", "rules": "chess"}]}, {}, {})
    out = await scanner.run_scan("chesscom", "alice", db=None, client=client)
    assert out["games_skipped"] == 1
    assert out["games_parsed"] == 0

@pytest.mark.asyncio
async def test_opponent_countries_are_fetched_once_per_distinct_opponent():
    url = "https://api.chess.com/pub/player/alice/games/2026/06"
    games = [{"pgn": QUEEN_MATE_PGN, "time_class": "blitz", "rules": "chess"}] * 5
    client = FakeClient([url], {url: games}, {}, {"bob": "IN"})
    calls = []
    orig = client.get_player
    async def counting(u):
        calls.append(u); return await orig(u)
    client.get_player = counting
    await scanner.run_scan("chesscom", "alice", db=None, client=client)
    assert len(calls) == 1, "opponent country lookups must be memoised"

@pytest.mark.asyncio
async def test_watermark_excludes_the_current_month():
    """The current month is still accumulating games, so it is always rescanned."""
    urls = [f"https://api.chess.com/pub/player/alice/games/2026/0{m}" for m in (5, 6)]
    client = FakeClient(urls, {u: [] for u in urls}, {}, {})
    out = await scanner.run_scan("chesscom", "alice", db=None, client=client, current_month="2026/06")
    assert out["archive_watermark"] == "2026/05"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pytest tests/test_awards_scanner.py -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 4: Implement the scanner**

Required behaviour, each pinned by a test above:

1. Fetch `/player/{u}/games/archives`. If a cached `AwardScan` row exists, keep only archives strictly after `archive_watermark`, plus the current month.
2. For each archive, fetch games; call `extract_features(game["pgn"], username)`. `None` increments `games_skipped`; otherwise append and overwrite `time_class`/`rules` from the JSON (more reliable than PGN headers).
3. Collect distinct lowercased opponent usernames. Resolve each to an ISO code via `get_player`, **memoised in a module-level dict** so popular opponents are fetched once per process. Cap concurrency at 8 with an `asyncio.Semaphore`.
4. `aggregate(features, countries, stats)`. If a cached row existed, `merge(cached, fresh)`.
5. Set `archive_watermark` to the last **completed** month processed — never the current month.
6. If total games exceed `MAX_GAMES = 25_000`, process newest archives first, stop at the ceiling, and set `truncated: True`.
7. Call `progress_cb(months_done, months_total)` after each archive.
8. Persist to `AwardScan` (upsert on `platform, username`) when `db` is not `None`. Tests pass `db=None`.
9. On a Chess.com 404 for the player, raise `PlayerNotFound`. On 429/5xx raise `UpstreamError(retryable=True)`. Never write a watermark on a failed scan.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_awards_scanner.py -v`
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/awards/scanner.py backend/tests/test_awards_scanner.py
git commit -m "feat(awards): orchestrate incremental scans with memoised country lookups"
```

---

### Task 7: Public awards router

**Files:**
- Create: `backend/app/routers/awards.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_awards_router.py`

**Interfaces:**
- Consumes: `run_scan`, `SlidingWindowLimiter`, `AwardScan`
- Produces: `POST /api/awards/scan`, `GET /api/awards/scan/{job_id}`

**This router must not import or depend on `current_verified_user`.** A test asserts that.

- [ ] **Step 1: Write the failing test**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_scan_endpoint_requires_no_authentication():
    r = client.post("/api/awards/scan", json={"platform": "chesscom", "username": "alice"})
    assert r.status_code != 401 and r.status_code != 403

@pytest.mark.parametrize("bad", ["ab", "a" * 26, "bad user", "drop;table", "../etc"])
def test_invalid_usernames_are_rejected_before_any_outbound_call(bad):
    r = client.post("/api/awards/scan", json={"platform": "chesscom", "username": bad})
    assert r.status_code == 422

def test_unknown_job_id_returns_404():
    assert client.get("/api/awards/scan/00000000-0000-0000-0000-000000000000").status_code == 404

def test_router_does_not_depend_on_auth():
    import app.routers.awards as mod
    src = open(mod.__file__).read()
    assert "current_verified_user" not in src, "the awards router must stay public"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_awards_router.py -v`
Expected: FAIL — router not mounted, 404 on POST.

- [ ] **Step 3: Implement the router**

```python
"""Public awards scanning. NO AUTHENTICATION — the only such router here.

Everything user-supplied is validated before it reaches Chess.com, and the
per-IP limiter plus the 6-hour cache bound outbound traffic.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import get_db
from app.models import AwardScan
from app.services.awards.ratelimit import SlidingWindowLimiter
from app.services.awards.scanner import PlayerNotFound, UpstreamError, run_scan

router = APIRouter(prefix="/awards", tags=["awards"])

_limiter = SlidingWindowLimiter(max_events=5, window_seconds=3600)
_jobs: dict[str, dict] = {}
CACHE_TTL = timedelta(hours=6)


class ScanRequest(BaseModel):
    platform: str = Field(default="chesscom", pattern="^(chesscom)$")
    username: str = Field(pattern=r"^[A-Za-z0-9_-]{3,25}$")


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


@router.post("/scan", status_code=202)
async def start_scan(body: ScanRequest, request: Request, db=Depends(get_db)):
    username = body.username.lower()

    row = db.execute(
        select(AwardScan).where(AwardScan.platform == body.platform, AwardScan.username == username)
    ).scalar_one_or_none()
    if row and datetime.now(timezone.utc) - row.scanned_at < CACHE_TTL:
        job_id = str(uuid.uuid4())
        _jobs[job_id] = {
            "status": "done",
            "progress": {"months_done": 0, "months_total": 0},
            "result": {
                "username": row.username, "platform": row.platform,
                "scanned_at": row.scanned_at.isoformat(), "games_parsed": row.games_parsed,
                "games_skipped": 0, "truncated": False, "measurements": row.measurements,
            },
        }
        return {"job_id": job_id, "cached": True}

    if not _limiter.allow(_client_ip(request)):
        raise HTTPException(429, "Too many scans from this address. Try again later.")

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "queued", "progress": {"months_done": 0, "months_total": 0}}
    asyncio.create_task(_run(job_id, body.platform, username))
    return {"job_id": job_id, "cached": False}


async def _run(job_id: str, platform: str, username: str) -> None:
    job = _jobs[job_id]
    job["status"] = "running"

    def progress(done: int, total: int) -> None:
        job["progress"] = {"months_done": done, "months_total": total}

    try:
        job["result"] = await run_scan(platform, username, db=None, progress_cb=progress)
        job["status"] = "done"
    except PlayerNotFound:
        job.update(status="error", error="No such player on Chess.com.", retryable=False)
    except UpstreamError:
        job.update(status="error", error="Chess.com is not responding. Try again shortly.", retryable=True)
    except Exception:
        job.update(status="error", error="The scan failed unexpectedly.", retryable=True)


@router.get("/scan/{job_id}")
async def get_scan(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Unknown scan.")
    return job
```

`_run` passes `db=None` because the request-scoped session is closed by then; the scanner opens its own session for persistence. Follow the session pattern already used by the background work in `sync.py`.

- [ ] **Step 4: Mount the router**

In `backend/app/main.py`, next to the existing includes:

```python
from app.routers import awards
app.include_router(awards.router, prefix="/api")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/test_awards_router.py -v`
Expected: 8 passing (4 parametrised).

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/awards.py backend/app/main.py backend/tests/test_awards_router.py
git commit -m "feat(awards): expose the public scan endpoint"
```

---

### Task 8: Award catalog dataset

The data authoring task. **This is where the no-invented-names rule matters most.**

**Files:**
- Create: `frontend/src/data/awards/achievements.json`, `books.json`, `passports.json`
- Create: `frontend/src/lib/awards/catalog.ts`
- Test: `frontend/src/lib/awards/__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `AwardEntry`, `isValidMeasurementKey` from Task 1
- Produces: `getCatalog(category): AwardEntry[]`, `getAllAwards(): AwardEntry[]`, `getAward(category, slug): AwardEntry | undefined`

**Sourcing rules — do not deviate:**

- Achievements: source names and criteria from these two live pages, and mark an entry `community` only when **both** corroborate it:
  - `https://www.chess.com/blog/ChampoftheCommieCamp/complete-guide-to-achievements-regular-edition`
  - `https://www.chess.com/blog/Nevisaurus_Rex/list-of-all-achievements-1`
- Mark `verified` only for entries confirmed on a `support.chess.com` article.
- Mark `inferred` where the name is sourced but the criteria are our reading.
- If a name appears in only one source and cannot be corroborated, **omit it**. A shorter honest catalog beats a padded one.
- Books: names from `https://www.chess.com/blog/The-Black-Horseman/how-to-unlock-all-chess-com-books-2026-edition` (all 33 enumerated). Official docs give no unlock counts, so every book entry is `provenance: "inferred"` with a rule of `{measurement: "eco_played.<code>", op: ">=", target: 1}` using the ECO code for that opening's main line.
- Passports: build from the **ISO-3166-1 alpha-2** standard list (249 codes) — a real standard, not invented data. Country names via `Intl.DisplayNames`. Each entry gets `provenance: "inferred"` and a note in `howTo` that Chess.com also awards passports for sub-regions such as Basque Country and Catalonia, which are not in ISO-3166 and therefore not tracked here.

Target roughly 90–130 achievements, exactly 33 books, 249 passports. If fewer achievements survive corroboration, that is the correct outcome — record the final count in the commit message.

- [ ] **Step 1: Write the failing test**

```ts
import { getAllAwards, getCatalog } from "../catalog";
import { isValidMeasurementKey } from "../measurements";

const all = getAllAwards();

describe("award catalog", () => {
  it("has unique ids", () => {
    const ids = all.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique slugs within each category", () => {
    for (const cat of ["achievements", "books", "passports"] as const) {
      const slugs = getCatalog(cat).map((a) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("uses url-safe slugs", () => {
    for (const a of all) expect(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("tags every entry with provenance", () => {
    for (const a of all) expect(["verified", "community", "inferred"]).toContain(a.provenance);
  });

  it("only references measurements the backend actually emits", () => {
    for (const a of all) {
      if (!a.rule) continue;
      expect(isValidMeasurementKey(a.rule.measurement), `${a.id} -> ${a.rule.measurement}`).toBe(true);
    }
  });

  it("gives every entry non-empty guidance", () => {
    for (const a of all) {
      expect(a.name.length, a.id).toBeGreaterThan(0);
      expect(a.howTo.length, a.id).toBeGreaterThan(20);
    }
  });

  it("has exactly 33 books", () => {
    expect(getCatalog("books")).toHaveLength(33);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/lib/awards`
Expected: FAIL — cannot resolve `../catalog`.

- [ ] **Step 3: Build the catalog loader**

```ts
// frontend/src/lib/awards/catalog.ts
import achievements from "@/data/awards/achievements.json";
import books from "@/data/awards/books.json";
import passports from "@/data/awards/passports.json";
import type { AwardEntry } from "./types";

const BY_CATEGORY: Record<string, AwardEntry[]> = {
  achievements: achievements as AwardEntry[],
  books: books as AwardEntry[],
  passports: passports as AwardEntry[],
};

export type AwardCategory = keyof typeof BY_CATEGORY;

export function getCatalog(category: string): AwardEntry[] {
  return BY_CATEGORY[category] ?? [];
}

export function getAllAwards(): AwardEntry[] {
  return Object.values(BY_CATEGORY).flat();
}

export function getAward(category: string, slug: string): AwardEntry | undefined {
  return getCatalog(category).find((a) => a.slug === slug);
}
```

Ensure `resolveJsonModule` is enabled in `frontend/tsconfig.json`; add it if absent.

- [ ] **Step 4: Author the data**

Fetch the sources above, extract names and criteria, and write the three JSON files. Example entry shape:

```json
{
  "id": "killer-knight",
  "slug": "killer-knight",
  "name": "Killer Knight",
  "category": "achievements",
  "description": "Deliver checkmate with a knight.",
  "howTo": "Knight mates need the enemy king boxed in by its own pieces — smothered mates on f7/f2 are the most common route. Play sharp open games and look for the queen sacrifice that forces the rook to block the escape square.",
  "provenance": "community",
  "hidden": false,
  "rule": { "measurement": "mates_by_piece.knight", "op": ">=", "target": 1 }
}
```

Omit `rule` for anything undetectable from the measurement contract — those become manual checkboxes automatically.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx jest src/lib/awards`
Expected: all passing. The measurement-reference test is the important one: a typo like `mates_by_piece.horse` fails the build rather than silently reading `false`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/awards frontend/src/lib/awards/catalog.ts frontend/src/lib/awards/__tests__/catalog.test.ts
git commit -m "feat(awards): add the award catalog with provenance tagging"
```

---

### Task 9: Rule evaluation

**Files:**
- Create: `frontend/src/lib/awards/evaluate.ts`
- Test: `frontend/src/lib/awards/__tests__/evaluate.test.ts`

**Interfaces:**
- Consumes: `AwardEntry`, `AwardStatus`, `Measurements`, `readMeasurement`
- Produces: `evaluate(catalog: AwardEntry[], measurements: Measurements | null, manual: Record<string, boolean>): AwardStatus[]`

- [ ] **Step 1: Write the failing test**

```ts
import { evaluate } from "../evaluate";
import type { AwardEntry } from "../types";

const award = (over: Partial<AwardEntry>): AwardEntry => ({
  id: "x", slug: "x", name: "X", category: "achievements",
  description: "", howTo: "", provenance: "community", hidden: false, ...over,
});

describe("evaluate", () => {
  it("marks an award earned when the threshold is met", () => {
    const c = [award({ rule: { measurement: "games.total", op: ">=", target: 100 } })];
    expect(evaluate(c, { games: { total: 150 } }, {})[0].earned).toBe(true);
  });

  it("reports partial progress toward a threshold", () => {
    const c = [award({ rule: { measurement: "games.total", op: ">=", target: 1000 } })];
    const s = evaluate(c, { games: { total: 847 } }, {})[0];
    expect(s.earned).toBe(false);
    expect(s.progress).toEqual({ current: 847, target: 1000 });
  });

  it("handles set_size against countries_played", () => {
    const c = [award({ rule: { measurement: "countries_played", op: "set_size", target: 10 } })];
    const s = evaluate(c, { countries_played: ["US", "IN", "DE"] }, {})[0];
    expect(s.progress).toEqual({ current: 3, target: 10 });
  });

  it("treats a lower min_clock as better for <= rules", () => {
    const c = [award({ rule: { measurement: "min_clock_win_ms", op: "<=", target: 1000 } })];
    expect(evaluate(c, { min_clock_win_ms: 800 }, {})[0].earned).toBe(true);
    expect(evaluate(c, { min_clock_win_ms: 5000 }, {})[0].earned).toBe(false);
  });

  it("does not treat a null measurement as satisfying a <= rule", () => {
    const c = [award({ rule: { measurement: "min_clock_win_ms", op: "<=", target: 1000 } })];
    expect(evaluate(c, { min_clock_win_ms: null }, {})[0].earned).toBe(false);
  });

  it("falls back to the manual checkbox when there is no rule", () => {
    const c = [award({ id: "social", rule: undefined })];
    const s = evaluate(c, {}, { social: true })[0];
    expect(s.manual).toBe(true);
    expect(s.earned).toBe(true);
  });

  it("returns unearned with no progress when no scan has run", () => {
    const c = [award({ rule: { measurement: "games.total", op: ">=", target: 10 } })];
    const s = evaluate(c, null, {})[0];
    expect(s.earned).toBe(false);
    expect(s.progress).toBeNull();
  });
});
```

The null-measurement test matters: `null <= 1000` is `true` in JavaScript, so a naive implementation would award "win with under a second on the clock" to every player who has never had a clocked win.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/lib/awards`
Expected: FAIL — cannot resolve `../evaluate`.

- [ ] **Step 3: Write the implementation**

```ts
import { readMeasurement } from "./measurements";
import type { AwardEntry, AwardStatus, Measurements } from "./types";

function numeric(raw: unknown, op: string): number | null {
  if (op === "set_size") return Array.isArray(raw) ? raw.length : null;
  if (op === "has_key") return raw === undefined || raw === null ? 0 : 1;
  return typeof raw === "number" ? raw : null;
}

function satisfied(value: number, op: string, target: number): boolean {
  switch (op) {
    case ">=": case "set_size": return value >= target;
    case ">":  return value > target;
    case "<=": return value <= target;
    case "<":  return value < target;
    case "==": return value === target;
    case "has_key": return value >= 1;
    default: return false;
  }
}

export function evaluate(
  catalog: AwardEntry[],
  measurements: Measurements | null,
  manual: Record<string, boolean>,
): AwardStatus[] {
  return catalog.map((a) => {
    if (!a.rule) {
      return { id: a.id, earned: Boolean(manual[a.id]), manual: true, progress: null };
    }
    if (!measurements) {
      return { id: a.id, earned: false, manual: false, progress: null };
    }

    const raw = readMeasurement(measurements, a.rule.measurement);
    const value = numeric(raw, a.rule.op);

    // A missing measurement is never a pass. `null <= target` is true in JS.
    if (value === null) {
      return { id: a.id, earned: false, manual: false, progress: null };
    }

    const earned = satisfied(value, a.rule.op, a.rule.target);
    // Progress bars only make sense for accumulating rules.
    const showProgress = a.rule.op === ">=" || a.rule.op === ">" || a.rule.op === "set_size";
    return {
      id: a.id,
      earned,
      manual: false,
      progress: showProgress ? { current: value, target: a.rule.target } : null,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest src/lib/awards`
Expected: 7 passing plus the earlier suites.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/awards/evaluate.ts frontend/src/lib/awards/__tests__/evaluate.test.ts
git commit -m "feat(awards): evaluate catalog rules against scan measurements"
```

---

### Task 10: Scan UI — progress bar, scan panel, hub page

**Files:**
- Create: `frontend/src/components/ui/ProgressBar.tsx`
- Create: `frontend/src/components/awards/ScanPanel.tsx`, `ProvenanceBadge.tsx`
- Create: `frontend/src/lib/awards/useScan.ts`, `frontend/src/lib/awards/manual.ts`
- Create: `frontend/src/app/awards/page.tsx`

**Interfaces:**
- Consumes: `evaluate`, `getAllAwards`, `ScanResult`
- Produces: `<ProgressBar value={number} max={number} label?: string />`; `useScan()` returning `{scan, status, progress, error, start(username), clear()}`; `readManual()/writeManual(id, on)` over `localStorage` key `chessint.awards.manual.v1`

- [ ] **Step 1: Read an existing page for conventions**

Run: `sed -n '1,80p' frontend/src/app/learn/page.tsx`
Match its metadata export, `getTranslations` usage, and JSON-LD placement.

- [ ] **Step 2: Build `ProgressBar`**

The only new UI primitive this feature adds. Server-safe, no client hooks:

```tsx
export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full">
      {label && <div className="mb-1 flex justify-between text-xs text-ink-400"><span>{label}</span><span>{value}/{max}</span></div>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800"
           role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}
           aria-label={label ?? "progress"}>
        <div className="h-full rounded-full bg-accent-400 transition-[width] duration-500 ease-out"
             style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```

Confirm `bg-ink-800` and `bg-accent-400` exist in `globals.css`; substitute the nearest defined tokens if not.

- [ ] **Step 3: Build `useScan`**

A client hook that POSTs to `/api/awards/scan`, then polls `GET /api/awards/scan/{job_id}` every 1500ms until `done` or `error`. It must clear its interval on unmount and stop polling after 5 minutes. Persist the last successful username and result to `localStorage` under `chessint.awards.scan.v1` so a return visit restores instantly without re-scanning.

- [ ] **Step 4: Build `ScanPanel`**

A client component: username input, Scan button, determinate `ProgressBar` driven by `progress.months_done / months_total` while running, an error state carrying the server's message, and a "truncated" notice when `result.truncated` is true. Never show a spinner with no numbers — the scan can take a minute and silent waiting reads as broken.

- [ ] **Step 5: Build the hub page**

`/awards` — server component with `metadata` (canonical `https://chessmaster.cyou/awards`), a `<ScanPanel />`, an overall earned/total `ProgressBar`, and six category cards linking onward. JSON-LD `@graph` with `BreadcrumbList` + `ItemList` of the six categories, matching the pattern in `learn/how-to-play-chess/page.tsx`.

- [ ] **Step 6: Verify manually**

```bash
cd frontend && npm run dev
```
Open `http://localhost:3000/awards`, scan a real username (`hikaru` works and is heavily cached upstream), confirm the progress bar advances and results render. **Then stop the dev server** — do not leave it running.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ui/ProgressBar.tsx frontend/src/components/awards frontend/src/lib/awards frontend/src/app/awards
git commit -m "feat(awards): add the scan flow and awards hub page"
```

---

### Task 11: Category and detail pages

**Files:**
- Create: `frontend/src/app/awards/{achievements,passports,books}/page.tsx`
- Create: `frontend/src/app/awards/{achievements,books}/[slug]/page.tsx`
- Create: `frontend/src/components/awards/{AwardCard.tsx,AwardGrid.tsx}`

**Interfaces:**
- Consumes: `getCatalog`, `getAward`, `evaluate`, `ProgressBar`, `ProvenanceBadge`

- [ ] **Step 1: Build `AwardCard` and `AwardGrid`**

`AwardCard` shows name, description, an earned/locked state, a `ProgressBar` when `status.progress` is non-null, a `ProvenanceBadge`, and a manual checkbox when `status.manual`. `AwardGrid` is a client component with a text filter and earned/unearned/all toggle buttons — buttons, not a new tabs abstraction.

- [ ] **Step 2: Build the three category pages**

Each is a server component rendering `PageHeader` plus `AwardGrid` over its catalog. `/awards/passports` renders a country grid instead, marking played countries from `measurements.countries_played`, and states plainly that sub-regions like Catalonia are not tracked.

- [ ] **Step 3: Build detail pages with `generateStaticParams`**

```tsx
export function generateStaticParams() {
  return getCatalog("achievements").map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getAward("achievements", slug);
  if (!a) return {};
  return {
    title: `How to get the ${a.name} award on Chess.com`,
    description: a.description,
    alternates: { canonical: `https://chessmaster.cyou/awards/achievements/${a.slug}` },
    openGraph: { title: `${a.name} — Chess.com award guide`, description: a.description },
  };
}
```

Each detail page emits JSON-LD `HowTo` (name, description, and the `howTo` text as steps) plus `BreadcrumbList`. Call `notFound()` for unknown slugs. Passports do not get detail pages — 249 thin pages would be doorway content and a ranking liability.

- [ ] **Step 4: Verify the build generates the pages**

```bash
cd frontend && npm run build
```
Expected: the build log lists the achievement and book detail routes as static. Confirm the count roughly matches catalog size.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/awards frontend/src/components/awards
git commit -m "feat(awards): add category grids and per-award guide pages"
```

---

### Task 12: Explainer stubs and i18n

**Files:**
- Create: `frontend/src/app/awards/{badges,cheers,medals}/page.tsx`
- Modify: `frontend/src/messages/{en,hi,gu}.json`

- [ ] **Step 1: Write the three stub pages**

Each explains what the category is, why the tracker cannot detect it, and how to earn them. Content, drawn from the research (cite the support articles as outbound links):

- **Badges** — game-related, sent by an opponent after a game. Not on any public API and not visible on public profile HTML.
- **Cheers** — sent player-to-player outside gameplay. Two are auto-earned: "Welcome to Chess.com!" and "Successful Referral!".
- **Medals** — awarded for finishing 1st/2nd/3rd in a tournament. Chess.com's own docs state medals carry custom, tournament-specific images rather than a fixed named catalog, so there is nothing stable to enumerate.

Be direct that these are not tracked and why. That honesty is the differentiator — every competing page would rather bluff.

- [ ] **Step 2: Add the `awards` i18n namespace**

Add an `awards` namespace to all three message files covering UI chrome only: page titles, the scan panel (placeholder, button, running, error, truncated), filter labels, earned/locked, provenance badge labels, and stub-page headings. **Award names and criteria stay English and live in the catalog JSON, not here.**

- [ ] **Step 3: Verify no locale is missing keys**

```bash
cd frontend && node -e "
const en=require('./src/messages/en.json').awards;
for (const l of ['hi','gu']) {
  const m=require('./src/messages/'+l+'.json').awards||{};
  const missing=Object.keys(en).filter(k=>!(k in m));
  if (missing.length) { console.error(l,'missing:',missing); process.exit(1); }
}
console.log('all locales complete');
"
```
Expected: `all locales complete`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/awards frontend/src/messages
git commit -m "feat(awards): add explainer stubs and translate the awards UI"
```

---

### Task 13: Public-route plumbing and the correction path

**Files:**
- Modify: `frontend/src/components/AuthGuard.tsx`, `frontend/src/app/sitemap.ts`, `frontend/src/app/robots.ts`
- Create: `.github/ISSUE_TEMPLATE/award-correction.yml`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";

describe("awards is wired up as a public section", () => {
  it("is allowed by AuthGuard", () => {
    expect(readFileSync("src/components/AuthGuard.tsx", "utf8")).toContain('"/awards"');
  });
  it("is allowed by robots", () => {
    expect(readFileSync("src/app/robots.ts", "utf8")).toContain("/awards");
  });
});
```

- [ ] **Step 2: Make the three synchronized edits**

1. `AuthGuard.tsx` — add `"/awards"` to `CONTENT_ROUTES`. Prefix matching covers every sub-route.
2. `robots.ts` — add `/awards` to the allow list.
3. `sitemap.ts` — append `/awards`, the six category routes, and every detail slug **generated from the catalog**, not hand-listed:

```ts
import { getCatalog } from "@/lib/awards/catalog";

const awardRoutes = [
  "/awards", "/awards/achievements", "/awards/passports", "/awards/books",
  "/awards/badges", "/awards/cheers", "/awards/medals",
  ...getCatalog("achievements").map((a) => `/awards/achievements/${a.slug}`),
  ...getCatalog("books").map((a) => `/awards/books/${a.slug}`),
].map((path) => ({ url: `https://chessmaster.cyou${path}`, lastModified: new Date() }));
```

- [ ] **Step 3: Add the correction issue template**

`.github/ISSUE_TEMPLATE/award-correction.yml` with fields: award ID, what is wrong (name / criteria / it does not exist), the correct information, and a source link. `ProvenanceBadge` links here for `inferred` entries.

- [ ] **Step 4: Verify**

```bash
cd frontend && npm test && npm run build
```
Expected: all tests pass; build succeeds. Confirm `/awards` renders signed-out without redirecting to `/login`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AuthGuard.tsx frontend/src/app/sitemap.ts frontend/src/app/robots.ts .github/ISSUE_TEMPLATE
git commit -m "feat(awards): publish /awards as a public indexable section"
```

---

## Self-Review

**Spec coverage:** §3 architecture → Tasks 1/8/9. §4.1 contract → Task 1, mirrored in Task 3. §4.2 endpoints → Task 7. §4.3 caching → Tasks 4 and 6. §4.4 engine → Tasks 2, 3, 6. §4.5 failures → Task 6 step 4 items 6/9 and Task 7. §5.1 routes → Tasks 10–12. §5.2 catalog → Task 8. §5.3 evaluation → Task 9. §5.4 manual → Tasks 9 and 10. §5.5 plumbing → Task 13. §5.6 styling → Task 10. §5.7 i18n → Task 12. §6 testing → every task. No gaps.

**Type consistency:** `AwardEntry`/`AwardStatus`/`AwardRule` defined once in Task 1 and used unchanged after. `readMeasurement` (Task 1) is consumed in Task 9. `GameFeature` (Task 2) is consumed by `aggregate` (Task 3) and `run_scan` (Task 6). Measurement key strings agree between `MEASUREMENT_KEYS` (Task 1) and `_empty()` (Task 3) — if Task 3 adds a key, Task 1 must gain it or Task 8's validation test fails, which is the intended coupling.

**Toolchain verified before dispatch:** frontend tests run on Jest + ts-jest (`npm test`), `resolveJsonModule` is already enabled, `python-chess>=1.10.0` is already a backend dependency, and the Alembic head is `d2e3f4a5b6c7`. No new dependencies are needed in either service.
