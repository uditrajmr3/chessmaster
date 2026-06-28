# ChessInt — Chess Intelligence for Lichess & Chess.com

> **Live app: [ChessInt → chessmaster.cyou](https://chessmaster.cyou)**

**ChessInt** is chess intelligence for your own games. It fetches all your Chess.com and Lichess games, runs client-side Stockfish analysis, detects recurring weakness patterns across hundreds of games, and generates a personalized AI coaching report — all in the browser.

Chess.com premium tells you what blunder you made in a single game. **ChessInt** tells you what patterns keep repeating across ALL your games and gives you a personalized fix. Try it at **[chessmaster.cyou](https://chessmaster.cyou)**.

![Stack](https://img.shields.io/badge/Next.js-black?logo=next.js) ![Stack](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white) ![Stack](https://img.shields.io/badge/Stockfish_WASM-yellow) ![Stack](https://img.shields.io/badge/Claude_API-orange)

> _Formerly “ChessMaster.” The repo folder and local service names are still `chessmaster`; the product is **ChessInt**._

## Features

- **Multi-user SaaS** — Account-per-player with email verification; all data is tenant-scoped
- **Multi-platform sync** — Fetch games from both Chess.com and Lichess (usernames stored per account)
- **Browser-side Stockfish analysis** — Stockfish WASM runs in the browser; evals are posted to the server for classification and storage
- **Pattern detection** — Aggregates data across all games to find systemic weaknesses:
  - Opening performance (win rate + accuracy per ECO code)
  - Phase accuracy (opening vs middlegame vs endgame CPL)
  - Tactical blind spots (which motifs you consistently miss)
  - Time trouble correlation (blunder rate under time pressure)
  - Color performance (white vs black stats)
  - Endgame conversion rate
  - Blunder distribution by move number
- **AI coaching report** — Claude API generates a personalized report with specific training advice
- **Puzzle trainer** — Spaced-repetition drills from your own blunders
- **Tilt & streak detection** — Correlates loss streaks with blunder rate
- **Opponent scouting** — Pre-game analysis of any opponent's games
- **FIDE rating estimate** — Approximate FIDE conversion for each platform and time control
- **Interactive game viewer** — Browse any game with color-coded moves and evaluation details

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for local Postgres) or an external Postgres 14+ instance
- [Anthropic API key](https://console.anthropic.com/) (for AI coaching reports)
- Optional: [Resend API key](https://resend.com/) for transactional email (verification / password-reset)

### 1. Start the Database

```bash
docker compose up -d db
```

This starts Postgres 16 on `localhost:5432` with user/password/db all `chessmaster`.

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Create `backend/.env` (copy from `.env.example` and fill in your values):

```env
# Required
DATABASE_URL=postgresql+psycopg://chessmaster:chessmaster@localhost:5432/chessmaster
SECRET_KEY=change-me-to-a-long-random-string

# Required for AI coaching reports
ANTHROPIC_API_KEY=sk-ant-...

# Optional — email delivery (verification links + password reset)
# When unset, tokens are printed to server stdout (fine for local dev)
RESEND_API_KEY=re_...
EMAIL_FROM=ChessMaster <noreply@yourdomain.com>
FRONTEND_URL=http://localhost:3000

# Optional — not used at request time (analysis now runs in the browser)
# STOCKFISH_PATH=...
# STOCKFISH_DEPTH=20
```

Run database migrations:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`. Health check: `http://localhost:8000/api/health`

### 3. Stockfish WASM (required for analysis)

The browser runs Stockfish via WebAssembly. Drop two files into `frontend/public/stockfish/`:

```bash
cd frontend
npm install stockfish
cp node_modules/stockfish/src/stockfish.js   public/stockfish/stockfish.js
cp node_modules/stockfish/src/stockfish.wasm public/stockfish/stockfish.wasm
```

See `frontend/public/stockfish/README.md` for alternatives (CDN / direct download).

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

Create `frontend/.env.local` if the backend is not at the default URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 5. Usage

1. Open `http://localhost:3000/register` and create an account
2. Verify your email (check server stdout if `RESEND_API_KEY` is not set — the link is printed there)
3. Go to **Settings** (`/settings`) and link your Chess.com and/or Lichess username
4. Click **Sync Games** in the sidebar; the backend fetches games using your stored usernames
5. On the **Analysis** page, click **Analyze Games** — Stockfish runs in your browser and posts results to the server
6. Browse **Weaknesses**, **Openings**, **Puzzles**, and other pages
7. Click **AI Coach** to generate a personalized coaching report

## Project Structure

```
chessmaster/
├── docker-compose.yml          # Postgres 16 service
├── backend/                    # Python FastAPI
│   ├── alembic/                # Database migrations
│   ├── alembic.ini
│   ├── .env.example            # Copy to .env and fill in
│   └── app/
│       ├── main.py             # FastAPI app, CORS, auth routers
│       ├── config.py           # Settings (pydantic-settings, reads .env)
│       ├── database.py         # SQLAlchemy sync+async engines + sessions
│       ├── models.py           # ORM: Game, MoveAnalysis, AnalysisJob, SyncState, Report, PuzzleProgress
│       ├── schemas.py          # Pydantic request/response models
│       ├── auth/               # FastAPI-Users wiring
│       │   ├── models.py       # User model (UUID PK + lichess/chesscom username fields)
│       │   ├── schemas.py      # UserRead / UserCreate / UserUpdate
│       │   ├── users.py        # UserManager, CookieTransport, JWTStrategy
│       │   └── deps.py         # current_verified_user dependency
│       ├── routers/            # API endpoints (all auth-gated + user-scoped)
│       │   ├── sync.py         # POST /api/sync, GET /api/sync/status
│       │   ├── games.py        # GET /api/games, GET /api/games/{id}
│       │   ├── analysis.py     # GET /api/analyze/pending, POST /api/analyze/results
│       │   ├── patterns.py     # GET /api/patterns
│       │   ├── openings.py     # GET /api/openings/tree
│       │   ├── stats.py        # GET /api/stats/overview
│       │   ├── report.py       # POST /api/report/generate, GET /api/report/latest
│       │   └── ...             # puzzles, tilt, scouting, endgame, etc.
│       └── services/           # Business logic
│           ├── sync_service.py
│           ├── analysis_ingest.py   # Classifies + stores browser-sent evals
│           ├── move_classifier.py
│           ├── pattern_engine.py
│           ├── report_generator.py
│           ├── email_service.py     # Resend / stdout fallback
│           └── ...
├── frontend/                   # Next.js 16 + TypeScript + Tailwind
│   ├── public/stockfish/       # Drop stockfish.js + stockfish.wasm here
│   └── src/
│       ├── app/                # Pages: /, /login, /register, /verify-email,
│       │   │                   #        /forgot-password, /reset-password,
│       │   │                   #        /settings, /games, /weaknesses, etc.
│       ├── components/         # AuthProvider, AuthGuard, Sidebar, StatusBar
│       └── lib/
│           ├── api.ts          # Cookie-auth fetch wrapper + all API calls
│           ├── engine.ts       # Stockfish WASM worker wrapper
│           └── types.ts
└── docs/                       # Architecture, API, Product, Roadmap
```

## Auth Flow

- **Register** → email verification link sent (via Resend or printed to stdout in dev)
- **Login** → JWT stored in an httpOnly cookie (no localStorage token exposure)
- **All data endpoints** require a valid, verified session; unverified accounts get 403
- **Password reset** → link sent to email; token valid for 1 hour
- **Settings page** — update linked Chess.com / Lichess usernames (used by sync, not re-entered each time)

## Running Tests

```bash
# Backend (use the venv — system python3 may be broken on macOS)
cd backend
.venv/bin/python -m pytest -q   # 378 tests

# Frontend
cd frontend
npx jest                        # 96 tests
npm run build                   # production build check
```

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Recharts
- **Backend**: FastAPI, FastAPI-Users, SQLAlchemy (sync + async), Postgres, Alembic, python-chess
- **Auth**: FastAPI-Users — httpOnly cookie JWT, email verification, password reset via Resend
- **Analysis**: Stockfish WASM in the browser (depth configurable); server classifies CPL + tactical motifs
- **AI**: Claude API (claude-sonnet) for personalized coaching reports
- **Email**: Resend (falls back to stdout logging when `RESEND_API_KEY` is unset)
- **APIs**: Chess.com Public API, Lichess API (NDJSON streaming)

## License

MIT
