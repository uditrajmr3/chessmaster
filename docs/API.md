# API Reference

Base URL: `http://localhost:8000/api`

All endpoints except `/auth/*` and `/health` require a valid, **verified** session cookie. Requests without a valid cookie return HTTP 401; unverified accounts return HTTP 403.

---

## Authentication

Authentication is handled by FastAPI-Users. The JWT is stored in an httpOnly cookie (`fastapiusersauth`). Send `credentials: "include"` (or `withCredentials: true`) from the browser so the cookie is forwarded automatically.

### POST /auth/register
Create a new account. Sends a verification email (or logs the link to stdout in dev).

**Request body:**
```json
{"email": "you@example.com", "password": "your-password"}
```

**Response:** `UserRead`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "you@example.com",
  "is_active": true,
  "is_verified": false,
  "is_superuser": false,
  "lichess_username": null,
  "chesscom_username": null
}
```

### POST /auth/login
Log in and receive the session cookie.

**Request body:** `application/x-www-form-urlencoded`
```
username=you@example.com&password=your-password
```

**Response:** Sets `fastapiusersauth` httpOnly cookie.

### POST /auth/logout
Clear the session cookie.

**Response:** `200 OK`

### POST /auth/request-verify-token
Re-send the verification email.

**Request body:**
```json
{"email": "you@example.com"}
```

### POST /auth/verify
Verify email using the token from the verification email.

**Request body:**
```json
{"token": "<token-from-email>"}
```

### POST /auth/forgot-password
Send a password-reset email.

**Request body:**
```json
{"email": "you@example.com"}
```

### POST /auth/reset-password
Set a new password using the reset token.

**Request body:**
```json
{"token": "<token-from-email>", "password": "new-password"}
```

---

## Users

### GET /users/me
Get the current authenticated user.

**Response:** `UserRead` (same shape as register response, but `is_verified: true` after email confirmation)

### PATCH /users/me
Update profile fields, including linked chess platform usernames.

**Request body:** (all fields optional)
```json
{
  "lichess_username": "mylichessname",
  "chesscom_username": "mychesscomname"
}
```

**Response:** Updated `UserRead`

---

## Sync

### POST /sync
Start syncing games using the usernames linked in the user's profile. No request body needed.

Returns HTTP 400 if neither `lichess_username` nor `chesscom_username` is set (link them first via `PATCH /users/me`).

**Response:**
```json
{"message": "Sync started"}
```

### GET /sync/status
Get sync progress for the current user.

**Response:**
```json
{
  "status": "syncing",      // "idle" | "syncing" | "done" | "error"
  "games_fetched": 142,
  "message": "Fetching Lichess games... (142 so far)"
}
```

---

## Games

### GET /games
List the current user's games with optional filters.

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
Get game detail with move-by-move analysis. Only returns the game if it belongs to the current user.

**Response:** `GameDetail` with `moves` array of `MoveAnalysis`

---

## Analysis

Analysis runs **in the browser** via Stockfish WASM. The server provides the list of pending games and stores the results.

### GET /analyze/pending
Return the current user's games that do not yet have a completed `AnalysisJob`.

**Response:**
```json
[
  {"game_id": "chesscom_abc123", "pgn": "1. e4 e5 ...", "player_color": "white"},
  ...
]
```

### POST /analyze/results
Ingest browser-computed Stockfish evaluations for a game.

**Request body:**
```json
{
  "game_id": "chesscom_abc123",
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
      "game_phase": "opening",
      "time_remaining": 590.0
    }
  ]
}
```

The server classifies each move, detects tactical motifs on blunders, writes `MoveAnalysis` rows, and marks the `AnalysisJob` as completed.

**Response:**
```json
{"status": "ok"}
```

### GET /analyze/status
Get analysis counts for the current user.

**Response:**
```json
{
  "status": "done",     // "idle" | "done"
  "total": 1658,
  "completed": 1658,
  "current_game": null
}
```

---

## Patterns

### GET /patterns
Get aggregated weakness patterns across all of the current user's analyzed games.

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

---

## Openings

### GET /openings/tree
Get the current user's personal opening repertoire stats.

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

---

## Stats

### GET /stats/overview
Get dashboard overview statistics for the current user.

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

---

## Report

### POST /report/generate
Start AI coaching report generation (runs in background).

**Response:**
```json
{"message": "Report generation started"}
```

### GET /report/status
Get report generation status for the current user.

**Response:**
```json
{"status": "generating", "error": null}
```

### GET /report/latest
Get the most recent coaching report for the current user.

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

---

## PGN Import

### POST /import/pgn-text
Import games from raw PGN text. Games are scoped to the current user.

**Request body:**
```json
{"pgn": "1. e4 e5 ... [multiple games concatenated]"}
```

**Response:**
```json
{"imported": 5, "skipped": 1, "errors": []}
```

---

## Scouting

### POST /scouting/scout
Fetch and analyze an opponent's recent public games.

**Request body:**
```json
{
  "opponent_username": "magnuscarlsen",
  "platform": "lichess",
  "max_games": 20
}
```

---

## Puzzles

### GET /puzzles/next
Get the next puzzle from the current user's blunder positions (spaced repetition).

### POST /puzzles/{id}/submit
Submit a move attempt for a puzzle.

### GET /puzzles/stats
Get the current user's puzzle progress statistics.

---

## Health

### GET /health
Check backend health. Does **not** require authentication.

**Response:**
```json
{
  "status": "ok",
  "stockfish_available": false,
  "stockfish_path": null
}
```

`stockfish_available` reports whether a local Stockfish binary was found. Since analysis now runs in the browser, `false` here does not affect functionality.
