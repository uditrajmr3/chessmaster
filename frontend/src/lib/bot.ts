// Chess.com-style fixed-strength bots for Guided Play.
//
// Weakness model: we NEVER play a random legal move (that hangs queens — a 1000
// would never do that). Instead:
//   - Strong bots (>=1500): Stockfish's built-in UCI_LimitStrength + UCI_Elo,
//     always the engine's move.
//   - Weaker bots: search a few candidate moves (MultiPV) at a short think time,
//     then pick from the top-N — biased toward the best move, but the lower the
//     rating the more often it settles for the 2nd/3rd best. Every candidate is
//     engine-vetted, so the bot plays imperfectly but sanely.

import type { Engine } from "./engine";
import { Chess } from "chess.js";

export type BotLevel = {
  elo: number;
  label: string;
  limitStrength: boolean;
  eloOption?: number; // UCI_Elo when limitStrength is true
  skill?: number; // Skill Level 0–20 for the weaker bots
  movetime: number; // ms
  multipv: number; // how many candidates to look at
  pickTopN: number; // choose among this many of them
  bias: number; // 0 = always best; →1 = flatter (weaker)
};

export const BOT_LEVELS: BotLevel[] = [
  { elo: 300, label: "300", limitStrength: false, skill: 0, movetime: 60, multipv: 5, pickTopN: 5, bias: 0.9 },
  { elo: 650, label: "650", limitStrength: false, skill: 2, movetime: 100, multipv: 4, pickTopN: 4, bias: 0.7 },
  { elo: 1000, label: "1000", limitStrength: false, skill: 6, movetime: 150, multipv: 3, pickTopN: 2, bias: 0.4 },
  { elo: 1200, label: "1200", limitStrength: false, skill: 10, movetime: 200, multipv: 2, pickTopN: 2, bias: 0.28 },
  { elo: 1500, label: "1500", limitStrength: true, eloOption: 1500, movetime: 300, multipv: 1, pickTopN: 1, bias: 0 },
  { elo: 1900, label: "1900", limitStrength: true, eloOption: 1900, movetime: 400, multipv: 1, pickTopN: 1, bias: 0 },
];

export function getBotLevel(elo: number): BotLevel {
  return BOT_LEVELS.find((l) => l.elo === elo) ?? BOT_LEVELS[2];
}

function uci(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? "");
}

/** Weighted pick among indices [0..n): probability of index i ∝ bias^i. */
export function weightedIndex(n: number, bias: number, rng: () => number): number {
  if (n <= 1) return 0;
  const w = Math.min(Math.max(bias, 0), 0.999);
  const weights = Array.from({ length: n }, (_, i) => Math.pow(w, i));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < n; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return n - 1;
}

/**
 * Choose the bot's move from `fen` at the given level. Returns a UCI move, or
 * null if there are no legal moves. `rng` is injectable for tests.
 */
export async function botMove(
  engine: Engine,
  fen: string,
  level: BotLevel,
  rng: () => number = Math.random
): Promise<string | null> {
  const legal = new Chess(fen).moves({ verbose: true });
  if (legal.length === 0) return null;

  await engine.configure({
    limitStrength: level.limitStrength,
    elo: level.eloOption,
    skill: level.skill,
  });

  // Strong bots: always the engine's move at a limited Elo.
  if (level.limitStrength) {
    const { bestMoveUci } = await engine.bestMove(fen, { movetime: level.movetime });
    return bestMoveUci ?? uci(legal[0]);
  }

  // Weaker bots: pick from the top-N engine candidates (all sane moves).
  const candidates = await engine.topMoves(fen, { movetime: level.movetime, multipv: level.multipv });
  if (candidates.length === 0) {
    const { bestMoveUci } = await engine.bestMove(fen, { movetime: level.movetime });
    return bestMoveUci ?? uci(legal[0]);
  }
  const pool = candidates.slice(0, Math.min(level.pickTopN, candidates.length));
  return pool[weightedIndex(pool.length, level.bias, rng)].uci;
}
