# ChessMaster → Multi-User SaaS — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning

## Goal

Convert ChessMaster from a single-user personal tool into a public, multi-user
SaaS. Each user registers with email + password, links their *own* Lichess and
Chess.com usernames, and sees only their own games, analysis, puzzles, reports,
and stats. Stockfish engine search moves off the server and into the user's
browser.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Scale | Public SaaS — anyone can register |
| Auth | Email + password via **FastAPI-Users** |
| Email | Verification **and** password reset (provider: Resend; SMTP fallback acceptable) |
| Sessions | JWT access + refresh in httpOnly Secure cookies |
| Existing data | **Wipe and start fresh** — no migration of current single-user data |
| Database | **Postgres** (replaces SQLite); SQLAlchemy retained, Alembic migrations |
| Sequencing | All workstreams in one change (DB + auth + multi-user + client analysis) |
| Stockfish | **Client-side WASM** in the browser; server runs zero engine search |

Out of scope (future): teams/orgs, OAuth/social login, billing, advanced
abuse/rate-limit hardening, per-user engine-depth tuning.

---

## 1. Database & Multi-Tenancy

### Postgres
- Replace SQLite with Postgres. Swap SQLAlchemy URL/driver to `psycopg`
  (`postgresql+psycopg://...`). Drop `aiosqlite`.
- Add `docker-compose.yml` with a Postgres service for local dev.
- Adopt **Alembic** for versioned migrations (already a declared dependency).
  Replace the `Base.metadata.create_all()` call in `main.py` lifespan with
  Alembic-managed schema; create an initial migration for all tables.

### `users` table (new)
Owned/managed by FastAPI-Users, extended with app fields:
- `id` (UUID, PK)
- `email` (unique, indexed)
- `hashed_password`
- `is_active`, `is_verified`, `is_superuser` (FastAPI-Users standard)
- `created_at`
- `lichess_username` (nullable)
- `chesscom_username` (nullable)

### User scoping on existing tables
Add `user_id` (UUID FK → `users.id`, indexed) to:
- `games`
- `analysis_jobs`
- `reports`
- `puzzle_progress`

`move_analyses` is scoped through its parent `game` (filter via join/`game_id`
ownership check). `sync_state` PK changes from `platform` to composite
`(user_id, platform)`.

### Game identity fix
Current `Game.id = "chesscom_{id}"` is globally unique and would collide when
two users played each other (same platform game in both accounts). Change to:
- Surrogate `id` (UUID or `f"{user_id}_{platform}_{platform_id}"`)
- `UniqueConstraint(user_id, platform, platform_id)`

Update all foreign references (`MoveAnalysis.game_id`, `AnalysisJob.game_id`,
`PuzzleProgress.move_analysis_id` chain) accordingly.

### Query scoping
Every read/write across the ~18 routers and ~17 services must filter by the
authenticated `current_user.id`. A shared `get_current_user` dependency yields
the user; routers pass `user_id` into service calls; services add
`.filter(Model.user_id == user_id)` to every query. This is the bulk of the
mechanical work and the highest-risk area for data leaks — every endpoint must
be covered.

---

## 2. Authentication (FastAPI-Users)

- Integrate **FastAPI-Users** with the SQLAlchemy adapter and the `users` model.
- **Strategy:** JWT access token + refresh token delivered as **httpOnly,
  Secure, SameSite** cookies (not localStorage).
- **Email verification:** new users must verify before accessing app data
  (login allowed but data endpoints return 403 until verified, OR verification
  required to log in — pick "verify before data access" so users can re-request
  the email while logged in).
- **Password reset:** standard forgot/reset flow.
- **Email provider:** Resend via its HTTP API (API key + verified from-address
  in env). Abstract behind a small `EmailService` so SMTP can swap in.

### Endpoints (under `/api/auth`)
- `POST /register`
- `POST /login`, `POST /logout`
- `POST /verify-email` (+ request-verification)
- `POST /forgot-password`, `POST /reset-password`
- `GET /me` (profile incl. linked usernames), `PATCH /me`

### Config additions (`config.py` / `.env`)
`secret_key` (JWT signing), `resend_api_key`, `email_from`, `frontend_url`
(for links in emails), cookie/security flags. CORS `allow_credentials=True`
already set; ensure exact origin list (no `*` with credentials).

---

## 3. Linked Accounts (per-user Lichess / Chess.com usernames)

- `GET /me` returns `lichess_username`, `chesscom_username`.
- `PATCH /me` updates either/both. Each optional; **at least one required** to
  run a sync (enforced server-side with a clear 400 message).
- **Sync no longer accepts a username in the request body.** `POST /api/sync`
  reads the current user's stored usernames and syncs both linked platforms.
  Per-user sync status (replace the module-global `_sync_status` with
  per-user state, e.g. keyed by `user_id` in a dict or persisted on
  `sync_state`).
- Same change for PGN import (`/api/pgn/import` uses `current_user`, not a
  body username).
- Changing a linked username does not delete prior games; subsequent syncs use
  the new username.

---

## 4. Stockfish → Client-Side WASM

### Rationale
Engine search (`engine.analyse()` at depth 20 per position) is the only
expensive step; `classify_move` + `detect_tactical_motifs` are cheap. Move the
search to the browser; keep classification on the server.

### Frontend
- Add `stockfish.wasm` (and its loader) to `frontend/public`; run it in a
  **Web Worker** wrapped by a small `engine.ts` (init, `analyse(fen, depth) →
  {scoreCp, bestMoveUci}`).
- Use existing `chess.js` to walk PGN move-by-move and produce FENs.
- Reuse the server's single-eval optimization: eval each position once
  (`eval_after` of move N = `eval_before` of move N+1).

### Flow
1. `GET /api/analyze/pending` → list of the user's unanalyzed games (id + PGN).
2. Browser, per game: parse PGN, evaluate each position via WASM, collect
   per-move records `{ply, fen_before, move_uci, move_san, eval_before,
   eval_after, best_move_uci}`.
3. `POST /api/analyze/results` with `{game_id, depth, moves: [...]}`.
4. **Server** verifies game ownership, runs the existing `classify_move` +
   `detect_tactical_motifs` (reconstructing boards from FENs), computes
   centipawn loss, writes `MoveAnalysis` rows, marks `AnalysisJob` completed.
5. Browser shows progress (current game / total) locally; status optionally
   persisted via `AnalysisJob`.

### Server changes
- Retire the engine loop in `StockfishAnalyzer._analyze_*`. Split out the
  classification/storage half into a service consumed by
  `POST /analyze/results`. Remove `STOCKFISH_PATH` server dependency and the
  bundled binary from the deploy path (keep dev-only if desired).
- `mate` handling, checkmate/stalemate eval conventions (±10000 / 0) must match
  between browser eval and server expectations.

---

## 5. Frontend

- **New pages:** `/login`, `/register`, `/verify-email`, `/forgot-password`,
  `/reset-password`, `/settings` (linked usernames + account).
- **Auth context/provider:** holds current user; `useAuth()` hook. App layout
  guards routes — unauthenticated users redirect to `/login`; unverified users
  see a "verify your email" gate.
- **API client (`lib/api.ts`):** send credentials (cookies) on every request;
  central `401 → redirect to /login` handling; drop the `username` argument
  from `startSync` and `importPgnText`.
- Remove the global username input from the sync UI; surface linked usernames
  from `/settings` instead. Sidebar/StatusBar show the logged-in user + logout.

---

## 6. Testing

- **Backend:** auth flows (register/verify/login/reset), tenant isolation
  (user A cannot read/write user B's games/analysis/puzzles/reports — explicit
  cross-user 403/404 tests), sync uses stored usernames, `analyze/results`
  ownership check + correct classification from posted evals.
- **Frontend:** auth context/guard redirects, settings update, engine worker
  wrapper (mock), analysis submit flow.
- Update existing tests that assumed global/single-user data.

---

## Risks & Notes

- **Tenant isolation is security-critical** — a single unscoped query leaks
  another user's data. Every endpoint must be audited.
- **Cross-origin cookies** require correct CORS (`allow_credentials`, exact
  origins) + cookie `SameSite`/`Secure` settings in both dev and prod.
- **Browser analysis UX:** tab must stay open; slow client machines analyze
  slowly. Acceptable for v1; surface clear progress + resumability via
  `analyze/pending`.
- **All-at-once delivery** raises debugging difficulty; plan should still land
  in reviewable phases (DB+models → auth → scoping → client analysis →
  frontend) even within one branch.
