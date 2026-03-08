# Architecture

## System Overview

ChessMaster follows a client-server architecture with a Next.js frontend communicating with a FastAPI backend via REST APIs. The backend handles game fetching, Stockfish analysis, pattern detection, and AI report generation.

```
┌─────────────────────────────────┐
│         Next.js Frontend        │
│  (React, TypeScript, Tailwind)  │
│         localhost:3000           │
└──────────────┬──────────────────┘
               │ HTTP/JSON
               ▼
┌─────────────────────────────────┐
│         FastAPI Backend         │
│  (Python, SQLAlchemy, SQLite)   │
│         localhost:8000           │
├─────────────────────────────────┤
│                                 │
│  ┌──────────┐  ┌─────────────┐  │
│  │ Chess.com │  │   Lichess   │  │     External APIs
│  │   API     │  │    API      │  │
│  └──────────┘  └─────────────┘  │
│                                 │
│  ┌──────────┐  ┌─────────────┐  │
│  │ Stockfish│  │  Claude API  │  │     Analysis + AI
│  │ (local)  │  │  (Anthropic) │  │
│  └──────────┘  └─────────────┘  │
│                                 │
│  ┌──────────────────────────┐   │
│  │     SQLite Database      │   │     Persistence
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

## Data Flow

### 1. Game Syncing

```
User clicks "Sync Games"
  → POST /api/sync {username}
  → Background task starts
  → ChessComClient.fetch_games() — archives → monthly games → parse PGN
  → LichessClient.fetch_games() — NDJSON streaming → parse
  → SyncService normalizes both into Game model
  → Deduplicates by (platform, platform_id)
  → Inserts into SQLite
  → StatusBar polls GET /api/sync/status every 2s
```

### 2. Stockfish Analysis

```
User clicks "Analyze Games"
  → POST /api/analyze
  → Background task in thread pool (run_in_executor)
  → StockfishAnalyzer opens Stockfish UCI engine
  → For each unanalyzed game:
    → Parse PGN, replay moves with python-chess
    → Evaluate each position once (carry forward optimization)
    → Calculate centipawn loss per move
    → Classify: good/inaccuracy/mistake/blunder/brilliant
    → Detect tactical motifs on blunders (fork, pin, skewer, back-rank)
    → Store MoveAnalysis rows
    → Mark AnalysisJob as completed
  → StatusBar shows progress bar
```

### 3. Pattern Detection

```
GET /api/patterns
  → PatternEngine queries all MoveAnalysis rows
  → Aggregates across ALL games:
    → Opening stats (win rate + CPL per ECO)
    → Phase accuracy (avg CPL in opening/middlegame/endgame)
    → Tactical blind spots (which motifs missed most)
    → Time trouble correlation (blunder rate < 60s vs normal)
    → Color performance (white vs black)
    → Endgame conversion rate
    → Blunder distribution by move number bucket
    → Worst blunders (example positions)
  → Returns PatternReport JSON
```

### 4. AI Coaching Report

```
User clicks "Generate Report" on AI Coach page
  → POST /api/report/generate
  → Background async task
  → PatternEngine generates report data
  → ReportGenerator builds detailed prompt with stats
  → AsyncAnthropic sends to Claude claude-sonnet-4-20250514
  → Claude returns personalized coaching text
  → Stored in Report table
  → Frontend polls GET /api/report/status, then fetches GET /api/report/latest
```

## Database Schema

```
games
├── id (PK)              "chesscom_{uuid}" or "lichess_{id}"
├── platform             "chesscom" | "lichess"
├── platform_id          Original platform game ID
├── pgn                  Full PGN text
├── white_username
├── black_username
├── player_color         "white" | "black"
├── time_class           "rapid" | "blitz" | "bullet" | "classical" | "daily"
├── time_control         "600" | "600+5" etc.
├── result               "win" | "loss" | "draw"
├── result_detail        "checkmate" | "timeout" | "resignation" etc.
├── player_rating
├── opponent_rating
├── opening_eco          "B20" etc.
├── opening_name
├── num_moves
├── played_at
├── platform_accuracy    Chess.com accuracy score (if available)
└── created_at

move_analyses
├── id (PK, autoincrement)
├── game_id (FK → games.id)
├── move_number          Ply index (0-based)
├── is_player_move       1 or 0
├── fen_before
├── move_uci
├── move_san
├── eval_before          Centipawns from player perspective
├── eval_after
├── best_move_uci
├── best_move_san
├── centipawn_loss
├── classification       "good" | "inaccuracy" | "mistake" | "blunder" | "brilliant"
├── game_phase           "opening" | "middlegame" | "endgame"
├── time_remaining       Clock time in seconds
└── tactical_motifs      JSON array: ["fork", "pin", ...]
    UNIQUE(game_id, move_number)

analysis_jobs
├── id (PK)
├── game_id (UNIQUE)
├── status               "pending" | "running" | "completed" | "failed"
├── engine_depth
├── started_at
├── completed_at
└── error

sync_state
├── platform (PK)
├── last_synced_at
├── last_game_time
└── cached_archives      JSON list

reports
├── id (PK)
├── generated_at
├── games_count
├── report_json          PatternReport data as JSON
└── report_text          Claude-generated coaching text
```

## Key Design Decisions

### Single eval per position
The original implementation called Stockfish twice per move (before and after). Since eval_after(move N) = eval_before(move N+1), we now evaluate each position once and carry the result forward. This halves the number of Stockfish calls.

### Thread pool for Stockfish
Stockfish uses python-chess's `SimpleEngine` which is synchronous. Running it directly in an async endpoint blocks the event loop. We use `run_in_executor` to run analysis in a thread pool, keeping the API responsive.

### Background tasks for long operations
Sync, analysis, and report generation all run as background tasks. The API returns immediately, and the frontend polls status endpoints.

### Incremental sync
Chess.com archives for past months are immutable — we only re-fetch the current month. Games are deduplicated by `(platform, platform_id)` unique constraint.

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

## Performance Considerations

- **Stockfish depth 14** balances accuracy and speed (~0.2-0.5s per position)
- ~40 moves per game × 1 eval each = ~20s per game
- 1600 games ≈ 8-10 hours of analysis
- SQLite is sufficient for single-user use; for multi-user, migrate to PostgreSQL
- Frontend polls status every 2s (sync/analysis) and 5s (dashboard data)
