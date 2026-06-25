# Architecture

## System Overview

ChessMaster is a multi-user SaaS application. A Next.js frontend communicates with a FastAPI backend via REST APIs. Every data row is owned by a user; all queries are tenant-scoped. Stockfish analysis runs client-side as WebAssembly — the server classifies and stores the results but never invokes a local engine.

```
┌─────────────────────────────────────────────┐
│            Next.js Frontend                  │
│  (React, TypeScript, Tailwind)               │
│            localhost:3000                    │
│                                             │
│   ┌──────────────────────────────────┐      │
│   │  AuthProvider / AuthGuard        │      │
│   │  (cookie session, /login guard)  │      │
│   └──────────────────────────────────┘      │
│                                             │
│   ┌──────────────────────────────────┐      │
│   │  Stockfish WASM Worker           │      │
│   │  (engine.ts → public/stockfish/) │      │
│   └──────────────────────────────────┘      │
└─────────────────┬───────────────────────────┘
                  │ HTTP/JSON  (credentials: "include")
                  ▼
┌─────────────────────────────────────────────┐
│            FastAPI Backend                   │
│  (Python, FastAPI-Users, SQLAlchemy)         │
│            localhost:8000                    │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Chess.com   │  │      Lichess          │  │     External APIs
│  │   API       │  │       API             │  │
│  └─────────────┘  └──────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │       Claude API (Anthropic)          │   │     AI coaching
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │       Resend (transactional email)    │   │     Email delivery
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │       PostgreSQL Database             │   │     Persistence
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Authentication

### FastAPI-Users with Cookie JWT

Authentication is handled by [FastAPI-Users](https://fastapi-users.github.io/fastapi-users/).

- **Transport**: `CookieTransport` — JWT is set in an httpOnly cookie (`fastapiusersauth`). The browser sends it automatically with `credentials: "include"`.
- **Strategy**: `JWTStrategy` — stateless token signed with `SECRET_KEY`. Default lifetime: 3600 s (configurable via `access_token_lifetime`).
- **Email verification**: On registration, the server calls `request_verify()` which sends a signed token via Resend (or logs it to stdout if `RESEND_API_KEY` is unset). All data endpoints require a verified account (`current_verified_user` dependency returns HTTP 403 if not verified).
- **Password reset**: Standard FastAPI-Users reset flow; token delivered by email.

### Session model

Two SQLAlchemy sessions exist side-by-side:

| Session | When used |
|---------|-----------|
| `AsyncSession` (via `get_async_db`) | FastAPI-Users user DB lookups (async routers) |
| `Session` (via `get_db`) | All other data endpoints (sync routers that call `run_in_executor` for heavy work) |

Both target the same Postgres database.

### User model

```
users  (from FastAPI-Users SQLAlchemyBaseUserTableUUID)
├── id (UUID, PK)
├── email
├── hashed_password
├── is_active
├── is_verified
├── is_superuser
├── lichess_username    (nullable — set in /settings)
├── chesscom_username   (nullable — set in /settings)
└── created_at
```

## Multi-Tenancy

Every application table carries a `user_id` FK that references `users.id`. The `current_verified_user` FastAPI dependency is injected into every data router; queries always filter by `user.id` before touching the database.

**Fail-closed**: a missing or invalid cookie returns HTTP 401 before any DB query runs. An unverified account returns HTTP 403. There is no path that returns data without a verified session.

Tenant isolation points:

| Table | Isolation column |
|-------|-----------------|
| `games` | `user_id` |
| `analysis_jobs` | `user_id` |
| `sync_state` | `user_id` (composite PK with `platform`) |
| `reports` | `user_id` |
| `puzzle_progress` | `user_id` |

`move_analyses` is scoped indirectly through `game_id`, which is owned by a user's game row.

## Data Flow

### 1. Registration & Verification

```
POST /api/auth/register {email, password}
  → UserManager creates User row (is_verified=False)
  → on_after_register → request_verify → send_verification_email
      if RESEND_API_KEY set: Resend API call
      else: token printed to server stdout
  → User clicks link → GET /api/auth/verify?token=...
  → is_verified set to True
  → User can now access all data endpoints
```

### 2. Login / Logout

```
POST /api/auth/login (form: username=email, password=...)
  → FastAPI-Users validates credentials
  → Sets httpOnly cookie on 200 response
  → Frontend AuthProvider stores user object in React context

POST /api/auth/logout
  → Clears the auth cookie
```

### 3. Setting Linked Usernames

```
PATCH /api/users/me {lichess_username, chesscom_username}
  → Updates User row with stored usernames
  → /settings page calls this once; sync uses stored values from that point on
```

### 4. Game Syncing

```
User clicks "Sync Games" (no username input — uses stored usernames)
  → POST /api/sync
  → Reads user.lichess_username + user.chesscom_username from DB
  → Background asyncio task:
      ChessComClient.fetch_games() → archives → monthly → parse PGN
      LichessClient.fetch_games()  → NDJSON streaming → parse
      SyncService normalizes both → inserts Game rows with user_id
      Deduplicates by (user_id, platform, platform_id) unique constraint
  → Status polled via GET /api/sync/status (per-user in-memory dict)
```

### 5. Client-Side Analysis

```
Browser opens the Analysis page
  → GET /api/analyze/pending
      returns games owned by the user that have no completed AnalysisJob
  → For each pending game:
      engine.ts spawns Stockfish WASM Web Worker
      Worker evaluates each position (UCI protocol inside the browser)
      For each move: eval_before, eval_after, best_move_uci computed
  → POST /api/analyze/results {game_id, moves: [...]}
      Server classifies each move (CPL → good/inaccuracy/mistake/blunder/brilliant)
      Detects tactical motifs on blunders
      Writes MoveAnalysis rows + marks AnalysisJob completed
  → GET /api/analyze/status returns counts for the status bar
```

The server never runs a Stockfish process. `STOCKFISH_PATH` / `STOCKFISH_DEPTH` are still read for the `/api/health` response but are not used at request time.

### 6. Pattern Detection

```
GET /api/patterns
  → PatternEngine queries MoveAnalysis rows for the current user's games
  → Aggregates across ALL games:
      Opening stats (win rate + CPL per ECO)
      Phase accuracy (avg CPL in opening/middlegame/endgame)
      Tactical blind spots (which motifs missed most)
      Time trouble correlation (blunder rate < 60 s vs normal)
      Color performance (white vs black)
      Endgame conversion rate
      Blunder distribution by move number bucket
      Worst blunders (example positions)
  → Returns PatternReport JSON
```

### 7. AI Coaching Report

```
POST /api/report/generate
  → Background async task
  → PatternEngine generates report data for the current user
  → ReportGenerator builds detailed prompt with stats
  → AsyncAnthropic → Claude claude-sonnet-4-20250514
  → Stores Report row (user_id, report_text, report_json)
  → Frontend polls GET /api/report/status then fetches GET /api/report/latest
```

## Database Schema

```
users
├── id (UUID, PK)
├── email
├── hashed_password
├── is_active / is_verified / is_superuser
├── lichess_username
├── chesscom_username
└── created_at

games
├── id (PK)                     "chesscom_{uuid}" or "lichess_{id}"
├── user_id (FK → users.id)     tenant column
├── platform                    "chesscom" | "lichess"
├── platform_id
├── pgn
├── white_username / black_username
├── player_color                "white" | "black"
├── time_class                  "rapid" | "blitz" | "bullet" | "classical" | "daily"
├── time_control
├── result                      "win" | "loss" | "draw"
├── result_detail               "checkmate" | "timeout" | "resignation" etc.
├── player_rating / opponent_rating
├── opening_eco / opening_name
├── num_moves
├── played_at
├── platform_accuracy
└── created_at

UNIQUE (user_id, platform, platform_id)
INDEX  (user_id, played_at)

move_analyses
├── id (PK, autoincrement)
├── game_id (FK → games.id)     indirect tenant scoping
├── move_number                  ply index (0-based)
├── is_player_move
├── fen_before
├── move_uci / move_san
├── eval_before / eval_after     centipawns from player perspective
├── best_move_uci / best_move_san
├── centipawn_loss
├── classification               "good" | "inaccuracy" | "mistake" | "blunder" | "brilliant"
├── game_phase                   "opening" | "middlegame" | "endgame"
├── time_remaining
└── tactical_motifs              JSON array: ["fork", "pin", ...]
UNIQUE (game_id, move_number)

analysis_jobs
├── id (PK)
├── user_id (FK → users.id)
├── game_id (UNIQUE)
├── status                      "pending" | "running" | "completed" | "failed"
├── engine_depth
├── started_at / completed_at
└── error

sync_state
├── user_id (FK → users.id, PK)
├── platform (PK)
├── last_synced_at
├── last_game_time
└── cached_archives             JSON list

reports
├── id (PK)
├── user_id (FK → users.id)
├── generated_at
├── games_count
├── report_json
└── report_text

puzzle_progress
├── id (PK)
├── user_id (FK → users.id)
├── move_analysis_id (UNIQUE)
├── attempts / successes
├── last_seen / next_review
├── ease_factor / interval_days  SM-2 spaced repetition
└── created_at
```

## Key Design Decisions

### Client-side Stockfish
Stockfish runs as a WebAssembly Web Worker in the browser. This removes server CPU contention, eliminates the need to bundle a native binary, and scales to many concurrent users without a thread pool. The server only classifies centipawn loss and stores results.

### Fail-closed tenancy
Every router uses `current_verified_user` as a FastAPI dependency. A request with no cookie, an expired cookie, or an unverified account never reaches a DB query — the dependency raises HTTP 401/403 first. All queries additionally filter by `user.id`, so a bug in one layer cannot expose another user's data.

### Dual SQLAlchemy sessions
FastAPI-Users requires an `AsyncSession` for user-DB operations (registration, login, user reads). The rest of the application uses a synchronous `Session` because most services run in `run_in_executor` thread pools (Stockfish, pattern engine). Both sessions target the same Postgres pool.

### Alembic migrations
`create_all()` is not called at startup. Schema changes go through versioned Alembic migrations (`alembic upgrade head`). This makes schema evolution safe across deployed instances.

### Per-user in-memory sync status
`sync.py` stores status in a process-local dict keyed by `str(user_id)`. Under a single-worker deployment this is fine. For multi-worker deployments (gunicorn `--workers > 1`), move status to a shared store (Postgres or Redis).

### Incremental sync
Chess.com archives for past months are immutable — only the current month is re-fetched. Deduplication uses the `(user_id, platform, platform_id)` unique constraint.

### CPL-based move classification
- **Good**: 0-25 centipawn loss
- **Inaccuracy**: 25-50 CPL
- **Mistake**: 50-150 CPL
- **Blunder**: 150+ CPL
- **Brilliant**: Large negative CPL (turned a losing position into winning)

### Game phase detection
Based on total material count (excluding kings and pawns):
- **Opening**: >= 24 material points
- **Middlegame**: 10-23 material points
- **Endgame**: < 10 material points
