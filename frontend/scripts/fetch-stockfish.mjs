// Copies the single-threaded Stockfish WASM build out of the `stockfish` npm
// package into public/stockfish/ so the browser Web Worker can load it at
// /stockfish/stockfish-18-lite-single.js (see src/lib/engine.ts).
//
// We use the *single-threaded* build deliberately: the multi-threaded builds
// need SharedArrayBuffer, which requires cross-origin-isolation (COOP/COEP)
// response headers. Single-threaded "just works" behind any host.
//
// Run automatically in CI/Render build (`npm run fetch-stockfish`) and once
// locally for dev. The copied files are gitignored.

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "node_modules", "stockfish", "bin");
const dest = join(root, "public", "stockfish");

const FILES = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

mkdirSync(dest, { recursive: true });

let copied = 0;
for (const f of FILES) {
  const from = join(src, f);
  if (!existsSync(from)) {
    console.error(
      `[fetch-stockfish] Missing ${from}. Is the 'stockfish' package installed? ` +
        `Run 'npm install' first. (Package layout may differ across major versions.)`,
    );
    process.exit(1);
  }
  copyFileSync(from, join(dest, f));
  copied++;
  console.log(`[fetch-stockfish] ${f} -> public/stockfish/`);
}
console.log(`[fetch-stockfish] done (${copied} files).`);
