// Chess.com-style fixed-strength bots for Guided Play.
//
// Stockfish's built-in UCI_LimitStrength only reaches down to ~1320 Elo, so the
// weaker bots are faked the way chess.com does it: a low Skill Level, a short
// think time, and an occasional deliberately-random move (beginners hang
// pieces). The `randomness` chance drops as the rating rises.

import type { Engine } from "./engine";
import { Chess } from "chess.js";

export type BotLevel = {
  elo: number;
  label: string;
  limitStrength: boolean;
  eloOption?: number; // UCI_Elo, only when limitStrength is true
  skill?: number; // Skill Level 0–20, for the sub-1320 bots
  movetime: number; // ms
  randomness: number; // chance of a random legal move (0–1)
};

export const BOT_LEVELS: BotLevel[] = [
  { elo: 300, label: "300", limitStrength: false, skill: 0, movetime: 50, randomness: 0.5 },
  { elo: 650, label: "650", limitStrength: false, skill: 1, movetime: 100, randomness: 0.32 },
  { elo: 1000, label: "1000", limitStrength: false, skill: 3, movetime: 150, randomness: 0.16 },
  { elo: 1200, label: "1200", limitStrength: false, skill: 5, movetime: 200, randomness: 0.07 },
  { elo: 1500, label: "1500", limitStrength: true, eloOption: 1500, movetime: 300, randomness: 0 },
  { elo: 1900, label: "1900", limitStrength: true, eloOption: 1900, movetime: 500, randomness: 0 },
];

export function getBotLevel(elo: number): BotLevel {
  return BOT_LEVELS.find((l) => l.elo === elo) ?? BOT_LEVELS[3];
}

function uci(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? "");
}

/**
 * Choose the bot's move from `fen` at the given level. Returns a UCI move, or
 * null if there are no legal moves (game over). `rng` is injectable for tests.
 */
export async function botMove(
  engine: Engine,
  fen: string,
  level: BotLevel,
  rng: () => number = Math.random
): Promise<string | null> {
  const legal = new Chess(fen).moves({ verbose: true });
  if (legal.length === 0) return null;

  // Beginner blunder: sometimes just play a random legal move.
  if (level.randomness > 0 && rng() < level.randomness) {
    return uci(legal[Math.floor(rng() * legal.length)]);
  }

  await engine.configure({
    limitStrength: level.limitStrength,
    elo: level.eloOption,
    skill: level.skill,
  });
  const { bestMoveUci } = await engine.bestMove(fen, { movetime: level.movetime });
  return bestMoveUci ?? uci(legal[0]);
}
