# Task 15 Report — Frontend Stockfish WASM Engine Wrapper

## Status: COMPLETE

## Files Created

| File | Purpose |
|------|---------|
| `frontend/src/lib/engine.ts` | Engine class with UCI wrapper |
| `frontend/src/__tests__/engine.test.ts` | 12 Jest tests (all green) |
| `frontend/public/stockfish/README.md` | Runtime asset instructions |

## Implementation Summary

### `frontend/src/lib/engine.ts`

Exports `EvalResult` interface and `Engine` class with:
- `init()` — sends `uci`/`isready`, waits for `uciok`/`readyok`, 10s timeout
- `analyse(fen, depth)` — sends `position fen` + `go depth`, collects last `info ... score` line, resolves on `bestmove`, 30s timeout
- `quit()` — sends `quit` + terminates worker

**POV conversion** (white-POV centipawns, matching server convention):
- White to move, `score cp N` → scoreCp = N
- Black to move, `score cp N` → scoreCp = -N (negated)
- `score mate K` (K > 0, side-to-move mates) → ±10000 adjusted for STM:
  - White to move, mate +K → +10000; mate -K → -10000
  - Black to move, mate +K → -10000; mate -K → +10000

**Mockability**: Constructor accepts optional `WorkerFactory` parameter (defaults to `new Worker("/stockfish/stockfish.js")`). Tests inject a fake `WorkerLike` implementation.

### `frontend/src/__tests__/engine.test.ts`

12 tests covering:
- `init()` handshake (uciok → isready → readyok)
- White-to-move `score cp 34` → `scoreCp: 34`
- Black-to-move `score cp 34` → `scoreCp: -34` (POV conversion guard)
- `score mate 3` → `scoreCp: 10000`
- `score mate -2` → `scoreCp: -10000`
- Black-to-move `score mate 2` → `scoreCp: -10000`
- Black-to-move `score mate -3` → `scoreCp: 10000`
- Last info score wins over earlier ones
- `bestmove (none)` → `bestMoveUci: null`
- No info lines → `scoreCp: null`
- `quit()` sends quit + terminates worker

## Test Results

```
Tests:   43 passed, 43 total (31 existing + 12 new)
Suites:  3 passed, 3 total
```

## Build Result

`npm run build` → SUCCESS (TypeScript clean, all 18 pages generated)

## WASM Binary

**NOT present** — must be added manually at runtime.

Drop `stockfish.js` + `stockfish.wasm` into `frontend/public/stockfish/`.
Fastest method:
```bash
npm install stockfish
cp node_modules/stockfish/src/stockfish.js  frontend/public/stockfish/
cp node_modules/stockfish/src/stockfish.wasm frontend/public/stockfish/
```

Instructions documented in `frontend/public/stockfish/README.md`.

## Concerns / Notes

- The 10s / 30s timeouts are safety nets; at runtime the real WASM loads synchronously inside the Worker and should be much faster.
- `engine.ts` does NOT import or bundle the WASM — the Worker URL is resolved at runtime by the browser, so there is zero build-time dependency on the binary.
- Task 16 (analysis loop) should call `new Engine()` with no factory arg for production, or pass a factory in tests.
