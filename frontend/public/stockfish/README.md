# Stockfish WASM Assets

`engine.ts` runs the chess engine in the browser by spawning a Web Worker:

```js
new Worker("/stockfish/stockfish-18-lite-single.js")
```

which maps to `frontend/public/stockfish/stockfish-18-lite-single.js` at runtime.
That JS loads its sibling `stockfish-18-lite-single.wasm` automatically.

We use the **single-threaded** build on purpose: the multi-threaded builds need
`SharedArrayBuffer`, which requires cross-origin-isolation (`COOP`/`COEP`)
response headers. The single-threaded build works behind any host with no extra
headers.

## How to obtain (automated)

These files are large binaries and are **gitignored** — they are fetched from
the `stockfish` npm package at build time:

```bash
npm install             # installs the pinned `stockfish` package
npm run fetch-stockfish # copies the two files into this directory
```

The Render build runs `npm run fetch-stockfish` automatically (see `render.yaml`).
For local dev, run it once after `npm install`.

## Required files

| File | Description |
|------|-------------|
| `stockfish-18-lite-single.js`   | UCI-speaking JS worker entry point |
| `stockfish-18-lite-single.wasm` | Compiled WebAssembly engine (loaded by the .js) |

## Notes

- The build and tests do NOT require these files — `engine.ts` accepts a
  `WorkerFactory` parameter, so unit tests inject a fake worker.
- To override the worker URL, pass a custom `WorkerFactory` to `new Engine(factory)`.
- If a future `stockfish` major version renames `bin/stockfish-18-lite-single.*`,
  update both `scripts/fetch-stockfish.mjs` and `STOCKFISH_WORKER_URL` in
  `src/lib/engine.ts`.
