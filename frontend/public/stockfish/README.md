# Stockfish WASM Assets

`engine.ts` loads Stockfish by spawning:

```js
new Worker("/stockfish/stockfish.js")
```

which maps to `frontend/public/stockfish/stockfish.js` at runtime.

## Required files

| File | Description |
|------|-------------|
| `stockfish.js` | The UCI-speaking JS entry point (loads the WASM binary) |
| `stockfish.wasm` | The compiled WebAssembly binary (loaded by stockfish.js) |

## Status

**These files are NOT committed** (large binaries, excluded by .gitignore).
You must obtain and drop them into this directory before running the app.

## How to obtain

### Option A — npm package (recommended)

```bash
npm install stockfish
# Copy from node_modules:
cp node_modules/stockfish/src/stockfish.js   public/stockfish/stockfish.js
cp node_modules/stockfish/src/stockfish.wasm public/stockfish/stockfish.wasm
```

The `stockfish` npm package (https://www.npmjs.com/package/stockfish) ships
Stockfish 16 WASM builds. Tested version: **stockfish@16.x**.

### Option B — CDN / direct download

Download a single-file Stockfish WASM build from:
- https://github.com/nmrugg/stockfish.js/releases  (nmrugg/stockfish.js)
- Or the official Stockfish GitHub releases page.

Rename the JS entry file to `stockfish.js` and place both `stockfish.js` and
`stockfish.wasm` here.

## Notes

- The build and tests do NOT require these files — `engine.ts` accepts a
  `WorkerFactory` parameter so tests inject a fake worker.
- The Worker URL (`/stockfish/stockfish.js`) is the default; pass a custom
  `WorkerFactory` to `new Engine(factory)` to override it.
