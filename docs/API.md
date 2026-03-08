# API Reference

Base URL: `http://localhost:8000/api`

## Sync

### POST /sync
Start syncing games from Chess.com and Lichess.

**Request body:**
```json
{"username": "csense2653"}
```

**Response:**
```json
{"message": "Sync started"}
```

### GET /sync/status
Get current sync progress.

**Response:**
```json
{
  "status": "syncing",      // "idle" | "syncing" | "done" | "error"
  "games_fetched": 142,
  "message": "Fetching Lichess games... (142 so far)"
}
```

## Games

### GET /games
List games with optional filters.

**Query params:**
- `platform` — `chesscom` or `lichess`
- `result` — `win`, `loss`, or `draw`
- `limit` — number of games (default 100)
- `offset` — pagination offset

**Response:** Array of `GameSummary`
```json
[
  {
    "id": "chesscom_abc123",
    "platform": "chesscom",
    "player_color": "white",
    "time_class": "rapid",
    "result": "win",
    "result_detail": "checkmate",
    "player_rating": 1013,
    "opponent_rating": 987,
    "opponent_name": "opponent123",
    "opening_eco": "B20",
    "opening_name": "Sicilian Defense",
    "num_moves": 42,
    "played_at": "2026-03-04T15:30:00",
    "platform_accuracy": 87.5,
    "is_analyzed": true
  }
]
```

### GET /games/{id}
Get game detail with move-by-move analysis.

**Response:** `GameDetail` with `moves` array of `MoveAnalysis`
```json
{
  "id": "chesscom_abc123",
  "pgn": "1. e4 e5 2. Nf3 ...",
  "moves": [
    {
      "move_number": 0,
      "is_player_move": true,
      "fen_before": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "move_uci": "e2e4",
      "move_san": "e4",
      "eval_before": 30.0,
      "eval_after": 25.0,
      "best_move_uci": "e2e4",
      "best_move_san": "e4",
      "centipawn_loss": 5.0,
      "classification": "good",
      "game_phase": "opening",
      "time_remaining": 590.0,
      "tactical_motifs": null
    }
  ]
}
```

## Analysis

### POST /analyze
Start Stockfish analysis on all unanalyzed games.

**Response:**
```json
{"message": "Analysis started"}
```

### GET /analyze/status
Get analysis progress.

**Response:**
```json
{
  "status": "running",     // "idle" | "running" | "done" | "error"
  "total": 1658,
  "completed": 42,
  "current_game": "chesscom_abc123"
}
```

## Patterns

### GET /patterns
Get aggregated weakness patterns across all analyzed games.

**Response:** `PatternReport`
```json
{
  "opening_stats": [...],
  "worst_openings": [...],
  "phase_accuracy": {"opening": 25.3, "middlegame": 45.1, "endgame": 38.7},
  "phase_blunder_rate": {"opening": 2.1, "middlegame": 5.3, "endgame": 4.8},
  "missed_tactics": {"fork": 23, "pin": 15, "back_rank": 8},
  "blunder_rate_normal": 3.2,
  "blunder_rate_time_trouble": 8.7,
  "white_stats": {"win_rate": 52.1, "avg_cpl": 35.4, "games": 820},
  "black_stats": {"win_rate": 47.3, "avg_cpl": 38.1, "games": 838},
  "endgame_conversion_rate": 68.5,
  "blunder_by_move_bucket": {"1-10": 1.2, "11-20": 3.4, "21-30": 5.1, "31-40": 7.2, "41+": 9.8},
  "example_positions": [...]
}
```

## Openings

### GET /openings/tree
Get personal opening repertoire stats.

**Response:** Array of `OpeningNode`
```json
[
  {
    "eco": "B20",
    "name": "Sicilian Defense",
    "games": 45,
    "wins": 22,
    "losses": 18,
    "draws": 5,
    "avg_cpl": 32.5
  }
]
```

## Stats

### GET /stats/overview
Get dashboard overview statistics.

**Response:** `OverviewStats`
```json
{
  "total_games": 1658,
  "wins": 823,
  "losses": 770,
  "draws": 65,
  "platforms": {"chesscom": 1524, "lichess": 134},
  "avg_accuracy": 67.7,
  "rating_history": [...],
  "rating_estimates": [
    {
      "platform": "chesscom",
      "time_class": "rapid",
      "current_rating": 1013,
      "fide_estimate": 863
    }
  ]
}
```

## Report

### POST /report/generate
Start AI coaching report generation (runs in background).

**Response:**
```json
{"message": "Report generation started"}
```

### GET /report/status
Get report generation status.

**Response:**
```json
{"status": "generating", "error": null}
```

### GET /report/latest
Get the most recent coaching report.

**Response:** `ReportOut`
```json
{
  "id": 1,
  "generated_at": "2026-03-08T12:00:00",
  "games_count": 1658,
  "report_text": "## Player Profile Summary\n...",
  "report_json": {...}
}
```

## Health

### GET /health
Check backend health and Stockfish availability.

**Response:**
```json
{
  "status": "ok",
  "stockfish_available": true,
  "stockfish_path": "/path/to/stockfish"
}
```
