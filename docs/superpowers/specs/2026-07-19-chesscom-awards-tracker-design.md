# Chess.com Awards Tracker — Design

**Date:** 2026-07-19
**Status:** Approved, pending implementation
**Scope:** A public (no-auth) section at `/awards` that tells a Chess.com player which awards they have earned, which they have not, and exactly how to earn the rest.

---

## 1. Problem

Chess.com grants players several hundred awards across six categories. The site shows you the ones you have, but gives you no aggregate progress, no guidance on what to chase next, and no explanation of how the obscure ones are triggered.

No third-party Chess.com awards tracker exists. Verified: `gh search repos "chess.com awards json"` returns `[]`, and no repo surfaced across five query variants. This is an unoccupied niche with real search demand.

## 2. Hard constraints discovered during research

These findings shaped the entire design and must not be re-litigated during implementation.

**The Chess.com public API exposes zero award data.** Verified directly against `api.chess.com/pub/player/hikaru`: the profile object contains `avatar, player_id, name, username, title, followers, country, location, status, league, joined, is_streamer` and nothing award-related. `/stats` carries ratings, W/L/D records, `tactics` and `puzzle_rush` only.

**Award data is not scrapeable.** `chess.com/awards` and `chess.com/member/{user}/awards` both return HTTP 200 but serve an empty client-side shell (`<div id="achievements-modal"></div>`). Probed callback endpoints (`/callback/member/awards/{user}`, `/callback/awards`) return HTTP 404.

**There is no country index endpoint.** `api.chess.com/pub/country/US` works; `api.chess.com/pub/country` returns 404 with `"Data provider not found"`. Countries are fetchable only one at a time.

**Data availability differs sharply by category:**

| Category | Names obtainable | Criteria obtainable | Decision |
|---|---|---|---|
| Achievements | ~90–130, cross-referenced across two live fan blogs | Mostly yes | **Build fully** |
| Books | All 33 opening names | No — official docs vague | **Build, criteria marked `inferred`** |
| Passports | No canonical list; Chess.com declined to publish one | N/A | **Build, ISO-3166 as approximate target set** |
| Badges | ~84 claimed, 2 names exist anywhere | No | **Explainer stub** |
| Cheers | ~110 claimed, 4 names exist anywhere | No | **Explainer stub** |
| Medals | No static catalog — tournament-specific per Chess.com docs | N/A | **Explainer stub** |

We ship only what we can substantiate. Award names are never invented.

## 3. Core architectural decision

**The backend does not know what an award is.** It is a pure measurement engine over a player's public data. The frontend owns the award catalog and maps measurements to progress.

```
Chess.com public API  →  backend: parse games, emit measurements
                                        ↓
                         frontend: catalog JSON + threshold logic  →  UI
```

Rationale:

- Adding or correcting an award is a one-line JSON edit with **no backend deploy** and no migration.
- The catalog exists in exactly one place. Frontend and backend deploy separately (`render.yaml`), so a shared dataset would otherwise need duplication plus a sync check.
- Per-award static pages need the catalog at build time anyway.
- The measurement surface is small and stable; the catalog is large and volatile. Coupling them would make the volatile part expensive to change.

## 4. Backend

### 4.1 Measurement contract

The scan result payload. This is the integration boundary — frontend and backend agree on this shape and nothing else.

```json
{
  "username": "string",
  "platform": "chesscom",
  "scanned_at": "ISO-8601",
  "games_parsed": 8431,
  "games_skipped": 3,
  "truncated": false,
  "measurements": {
    "games": { "live": 847, "daily": 12, "total": 859 },
    "wins":  { "live": 421, "daily": 7,  "total": 428 },
    "ratings_peak": { "blitz": 1420, "bullet": 1310, "rapid": 1502, "daily": 1200 },
    "puzzles": { "rating_best": 2100, "rush_best": 34 },
    "mates_by_piece": { "queen": 340, "rook": 91, "bishop": 30, "knight": 22, "pawn": 5, "king": 0 },
    "mate_by_castling": 0,
    "variants": { "chess960": 4, "crazyhouse": 0, "kingofthehill": 2, "threecheck": 0, "bughouse": 0 },
    "countries_played": ["US", "IN", "DE"],
    "eco_played": { "B01": 40, "C50": 12 },
    "min_clock_win_ms": 800,
    "flawless_wins": 3,
    "quick_knockouts": 2,
    "marathon_games": 1,
    "promotions": { "queen": 88, "underpromotion": 1 }
  }
}
```

Every key is a measurement, never a verdict. `"nick_of_time_earned": true` would be a layering violation; `min_clock_win_ms` is correct.

### 4.2 Endpoints

New router `backend/app/routers/awards.py`, mounted in `main.py` under the existing `/api` prefix.

```
POST /api/awards/scan          body: {platform, username}  → 202 {job_id, cached: bool}
GET  /api/awards/scan/{job_id}                             → {status, progress, result?, error?}
```

`status` ∈ `queued | running | done | error`. `progress` is `{months_done, months_total}` for a determinate progress bar.

**This is the first public router in the codebase.** Every existing router depends on `current_verified_user` from `backend/app/auth/deps.py`. This one must not. That makes the following non-optional:

- **Per-IP rate limiting.** No rate-limiting dependency exists (no `slowapi`, no Redis — verified in `pyproject.toml`). Implement a small in-process sliding-window limiter in `backend/app/services/awards/ratelimit.py`. Cap scans at 5/hour/IP. In-process is acceptable because the limiter is a safety valve, not a billing control; the cache below absorbs the real load. Document the single-instance assumption in a module docstring, consistent with the existing notes in `sync.py` and `report.py`.
- **Username validation before any outbound call.** Chess.com usernames match `^[A-Za-z0-9_-]{3,25}$`. Reject anything else with 422 rather than forwarding it — this endpoint proxies user input to a third party.
- **No PII persisted.** The cache stores a public username and derived counts. No opponent lists beyond ISO country codes.

### 4.3 Caching and incremental scans

New table `award_scan`:

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `platform` | text | `chesscom` (schema allows future `lichess`) |
| `username` | text | lowercased; unique together with `platform` |
| `measurements` | JSONB | latest full payload |
| `archive_watermark` | text | last fully-processed archive, `YYYY/MM` |
| `games_parsed` | int | |
| `scanned_at` | timestamptz | |

Alembic migration: `down_revision = 'd2e3f4a5b6c7'` (current head, verified).

Incremental behaviour: on rescan, fetch `/player/{u}/games/archives`, process only months strictly after `archive_watermark`, and fold the new measurements into the stored ones. The current month is always reprocessed (it is still accumulating games), so the watermark advances only to the last *completed* month.

This is what makes the feature affordable. A returning active user costs one archive-list call plus one month, not 120 month-fetches.

A scan is served straight from cache when `scanned_at` is under 6 hours old; the response sets `cached: true`.

### 4.4 Measurement engine

```
backend/app/services/awards/
  ratelimit.py      in-process sliding window
  pgn_features.py   one game  → GameFeature
  aggregate.py      [GameFeature] → measurements dict
  scanner.py        orchestration: archives → features → aggregate → persist
```

`python-chess>=1.10.0` is already a dependency (verified in `pyproject.toml`) — no new packages needed.

**Each game is parsed exactly once** into a compact `GameFeature` dataclass, then all measurements are derived from the aggregate. Re-walking the move list per award would be quadratic in awards; this is linear in games.

`GameFeature` fields: `rules`, `time_class`, `result_for_player`, `player_color`, `opponent_username`, `mating_piece`, `mate_by_castling`, `final_clock_ms`, `moves`, `pieces_lost`, `eco`, `promotions`.

Extraction notes that will otherwise cost debugging time:

- **Mating piece** — replay to the final position, confirm `board.is_checkmate()`, then inspect the piece type of the last move's destination square. A promoted pawn delivering mate counts as the promoted piece, matching Chess.com's own "promoted pieces count for Pawn" note only for the Pawn award; treat this case as `inferred` provenance in the catalog rather than encoding a guess in the engine.
- **Final clock** — Chess.com PGNs carry `[%clk H:MM:SS.f]` comments. Parse the player's last clock comment. Absent on daily games; emit `None`, never `0`.
- **Flawless win** — a win where the player lost zero pieces. Count captures against the player across the game rather than reading the final position, since a piece can be captured and its square later reoccupied.
- **Opponent country** — requires `GET /pub/player/{opponent}` per distinct opponent. Deduplicate aggressively and cap concurrency; this is the single most expensive part of a scan. Persist resolved country codes in a process-level memo so popular opponents are fetched once.

### 4.5 Failure handling

- Unknown username → Chess.com returns 404 → surface as 404 with a clear message, do not create a job.
- Chess.com rate-limits or 5xx → mark job `error` with a retryable flag; never write a partial watermark.
- A single unparseable game must not fail the scan. Count it in `games_skipped` and continue.
- Scan exceeding a hard ceiling (25k games) → process newest archives first up to the ceiling and set `truncated: true`, surfaced in the UI. Silent truncation would misreport "you have 0 of these" as fact.

## 5. Frontend

### 5.1 Routes

```
/awards                        hub — username input, overall progress, category cards
/awards/achievements           filterable grid (~130)
/awards/achievements/[slug]    per-award detail
/awards/passports              country grid, played vs remaining
/awards/books                  33 openings
/awards/books/[slug]           per-book detail
/awards/badges                 explainer stub
/awards/cheers                 explainer stub
/awards/medals                 explainer stub
```

Static routes take precedence over dynamic ones in the App Router, so explicit category folders avoid any collision with `[slug]`.

`generateStaticParams` produces roughly 163 detail pages at build time. These are the SEO asset: *"how to get the Nick of Time award chess.com"* currently has no good result anywhere.

### 5.2 Catalog dataset

Canonical location: `frontend/src/data/awards/{achievements,books,passports}.json`.

Entry schema:

```json
{
  "id": "killer-knight",
  "slug": "killer-knight",
  "name": "Killer Knight",
  "category": "achievements",
  "description": "Deliver checkmate with a knight.",
  "howTo": "Knight mates usually need the enemy king boxed in...",
  "provenance": "community",
  "hidden": false,
  "rule": { "measurement": "mates_by_piece.knight", "op": ">=", "target": 1 }
}
```

`provenance` ∈ `verified | community | inferred`:

- `verified` — confirmed on an official Chess.com support page.
- `community` — cross-referenced across two independent fan sources.
- `inferred` — name is known, criteria are our best reading.

Provenance renders as a subtle badge in the UI, and `inferred` entries carry a "help us confirm this" link to a GitHub issue template. The repo is intentionally public; the dataset becoming community-maintained is a feature, not a leak. Over time this dataset is the moat — it is the thing that does not exist anywhere else.

`rule` is omitted for awards that cannot be detected. Those render as manual checkboxes.

### 5.3 Rule evaluation

`frontend/src/lib/awards/evaluate.ts` — a pure function `(catalog, measurements) → AwardStatus[]`, where `AwardStatus` is `{ id, earned, progress: {current, target} | null, manual: boolean }`.

Supported ops: `>=`, `>`, `<=`, `<`, `==`, `set_size` (for `countries_played`), `has_key` (for `eco_played`). Deliberately small. A `rule` referencing a measurement key that does not exist is a **build-time test failure**, not a silent `false`.

### 5.4 Manual tracking

Awards without a `rule` get a checkbox persisted to `localStorage` under `chessint.awards.manual.v1` as `{[awardId]: true}`. No auth, no backend, no sync. Scoped by version key so a future schema change can migrate cleanly.

The scanned username is also persisted so a return visit restores state without retyping.

### 5.5 Public-route plumbing

Three synchronized edits, matching the existing pattern for public sections:

1. `frontend/src/components/AuthGuard.tsx` — add `"/awards"` to `CONTENT_ROUTES` (prefix-matched, covers all sub-routes).
2. `frontend/src/app/sitemap.ts` — enumerate `/awards`, the six category pages, and all detail slugs (generated from the catalog, not hand-listed).
3. `frontend/src/app/robots.ts` — add `/awards` to the allow list.

Per-page `metadata` with `alternates.canonical` and `openGraph`, plus JSON-LD. Detail pages use `HowTo` schema — a natural fit for "how to earn X" and eligible for rich results. Hub and category pages use `BreadcrumbList` + `ItemList`.

### 5.6 Styling

Tailwind v4, existing tokens from `frontend/src/app/globals.css` (`--color-accent-*`, `--color-ink-*`), existing `.surface-card` / `.card-hover` / `.btn-press` utilities, and the `PageHeader` / `Section` / `Stat` / `EmptyState` primitives from `frontend/src/components/ui/page-kit.tsx`.

No tabs, accordion, or progress-bar primitive exists in the codebase. This feature needs a progress bar in several places, so add exactly one: `frontend/src/components/ui/ProgressBar.tsx`. Category filtering uses buttons, not a new tabs abstraction.

### 5.7 Internationalisation

UI chrome (headings, buttons, empty states, the scan flow) goes through `next-intl` in the `awards` namespace across `en`, `hi`, `gu`, matching the existing setup in `frontend/src/i18n/request.ts`.

**Award names and criteria stay English-only, by decision.** Chess.com displays these names in English to every user regardless of locale — a Hindi user still sees "Killer Knight" on their own profile, so translating it actively breaks recognition. Translating 163 names plus criteria across three locales would also push `en.json` well past 200KB from its current ~53KB, slowing every page in the app for negative user value.

## 6. Testing

Backend, TDD with fixture PGNs committed under `backend/tests/fixtures/awards/`:

- a game mated by knight, by queen, by promoted pawn, by castling
- a win with sub-second clock remaining
- a flawless win, and a near-miss where one piece was captured then its square reoccupied
- a Chess960 game, a daily game with no clock comments
- a malformed PGN that must be skipped without failing the scan

Aggregation tests assert the measurement payload shape exactly, since it is the contract.

Frontend:

- catalog validation: unique `id`s, `slug` matches `id` format, every entry has `provenance`, every `rule.measurement` resolves against the measurement schema
- `evaluate.ts` unit tests: earned, partial progress, manual, and unknown-measurement cases

## 7. Explicitly out of scope

- Lichess awards (the schema allows a `platform` column; nothing more)
- Server-side persistence of manual checkmarks (localStorage only)
- Auth-gated features of any kind — this section is public end to end
- Live scan progress via websockets — polling is sufficient
- Badges, Cheers and Medals catalogs — explainer stubs only, until real data exists

## 8. Risks

| Risk | Mitigation |
|---|---|
| Catalog criteria are wrong (fan-sourced) | Provenance badges + public correction path; never present `inferred` as fact |
| Scan is slow for heavy accounts | Incremental watermark, opponent-country memoisation, determinate progress bar, 25k ceiling with visible `truncated` flag |
| Public endpoint abused | Per-IP limit, 6h cache, username validation, hard game ceiling |
| Chess.com changes or blocks the public API | Cached scans keep serving; catalog pages are static and remain useful with zero API access |
| In-process rate limiter defeated by scale-out | Documented single-instance assumption; cache is the real load absorber |
