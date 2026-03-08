# ChessMaster

**Your Personal Chess Coach** — Fetches all your Chess.com and Lichess games, runs Stockfish analysis, detects recurring weakness patterns across hundreds of games, and generates a personalized AI coaching report.

Chess.com premium tells you what blunder you made in a single game. ChessMaster tells you what patterns keep repeating across ALL your games and gives you a personalized fix.

![Stack](https://img.shields.io/badge/Next.js-black?logo=next.js) ![Stack](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white) ![Stack](https://img.shields.io/badge/Stockfish-yellow) ![Stack](https://img.shields.io/badge/Claude_API-orange)

## Features

- **Multi-platform sync** — Fetch games from both Chess.com and Lichess with a single click
- **Stockfish analysis** — Position-by-position evaluation of every game (depth 14, ~20s per game)
- **Pattern detection** — Aggregates data across all games to find systemic weaknesses:
  - Opening performance (win rate + accuracy per ECO code)
  - Phase accuracy (opening vs middlegame vs endgame CPL)
  - Tactical blind spots (which motifs you consistently miss)
  - Time trouble correlation (blunder rate under time pressure)
  - Color performance (white vs black stats)
  - Endgame conversion rate
  - Blunder distribution by move number
- **AI coaching report** — Claude API generates a personalized report with specific training advice
- **FIDE rating estimate** — Approximate FIDE conversion for each platform and time control
- **Interactive game viewer** — Browse any game with color-coded moves and evaluation details
- **Responsive UI** — Works on desktop and mobile

## Screenshots

| Dashboard | Weakness Analysis | AI Coach Report |
|:---------:|:-----------------:|:---------------:|
| Rating charts, stats, FIDE estimates | Phase accuracy, tactical blind spots | Personalized training plan |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Stockfish](https://stockfishchess.org/download/) binary
- [Anthropic API key](https://console.anthropic.com/) (for AI coaching reports)

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

Create `backend/.env`:

```env
DATABASE_URL=sqlite:///data/chessmaster.db
STOCKFISH_PATH=stockfish/stockfish/stockfish-windows-x86-64-avx2.exe
ANTHROPIC_API_KEY=sk-ant-...
STOCKFISH_DEPTH=14
```

Place the Stockfish binary at the path specified above, or set `STOCKFISH_PATH` to its location.

```bash
mkdir -p data
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`. Check health: `http://localhost:8000/api/health`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### Usage

1. Open `http://localhost:3000`
2. Click **Sync Games** in the sidebar and enter your Chess.com/Lichess username
3. Wait for sync to complete (progress shown in the status bar)
4. Click **Analyze Games** to run Stockfish analysis (this takes a while for many games)
5. Browse **Weaknesses** to see your recurring patterns
6. Click **AI Coach** to generate a personalized coaching report

## Project Structure

```
chessmaster/
├── backend/                    # Python FastAPI
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, lifespan
│   │   ├── config.py          # Settings (env vars, Stockfish path)
│   │   ├── database.py        # SQLAlchemy engine + session
│   │   ├── models.py          # ORM: Game, MoveAnalysis, AnalysisJob, SyncState, Report
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── routers/           # API endpoints
│   │   │   ├── sync.py        # POST /api/sync, GET /api/sync/status
│   │   │   ├── games.py       # GET /api/games, GET /api/games/{id}
│   │   │   ├── analysis.py    # POST /api/analyze, GET /api/analyze/status
│   │   │   ├── patterns.py    # GET /api/patterns
│   │   │   ├── openings.py    # GET /api/openings/tree
│   │   │   ├── stats.py       # GET /api/stats/overview
│   │   │   └── report.py      # POST /api/report/generate, GET /api/report/latest
│   │   ├── services/          # Business logic
│   │   │   ├── chesscom_client.py     # Chess.com API client
│   │   │   ├── lichess_client.py      # Lichess API client
│   │   │   ├── sync_service.py        # Orchestrates game syncing
│   │   │   ├── stockfish_analyzer.py  # Stockfish analysis engine
│   │   │   ├── move_classifier.py     # CPL-based move classification
│   │   │   ├── tactical_detector.py   # Fork/pin/skewer detection
│   │   │   ├── pattern_engine.py      # Cross-game pattern aggregation
│   │   │   ├── opening_service.py     # Opening tree builder
│   │   │   └── report_generator.py    # Claude API coaching report
│   │   └── utils/
│   │       ├── pgn_parser.py          # PGN parsing + clock extraction
│   │       └── fen_utils.py           # Game phase + material detection
│   └── tests/                  # 109 backend tests
├── frontend/                   # Next.js + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/               # Pages (dashboard, games, openings, weaknesses, report)
│   │   ├── components/        # Sidebar, StatusBar, RatingChart
│   │   └── lib/               # API client, TypeScript types
│   └── src/__tests__/         # 19 frontend tests
└── docs/                       # Documentation
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync` | Start syncing games (body: `{"username": "..."}`) |
| GET | `/api/sync/status` | Sync progress |
| GET | `/api/games` | List games (query: `platform`, `result`, `limit`, `offset`) |
| GET | `/api/games/{id}` | Game detail with move analysis |
| POST | `/api/analyze` | Start Stockfish analysis |
| GET | `/api/analyze/status` | Analysis progress |
| GET | `/api/patterns` | Aggregated weakness patterns |
| GET | `/api/openings/tree` | Personal opening repertoire |
| GET | `/api/stats/overview` | Dashboard stats + FIDE estimates |
| POST | `/api/report/generate` | Generate AI coaching report |
| GET | `/api/report/latest` | Get latest report |
| GET | `/api/health` | Health check + Stockfish status |

## Running Tests

```bash
# Backend
cd backend
pip install -e ".[dev]"
pytest

# Frontend
cd frontend
npm test
```

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts
- **Backend**: FastAPI, SQLAlchemy, SQLite, python-chess
- **Analysis**: Stockfish (depth 14), centipawn loss classification, tactical motif detection
- **AI**: Claude API (claude-sonnet) for personalized coaching reports
- **APIs**: Chess.com Public API, Lichess API (NDJSON streaming)

## License

MIT
