// Plain-language lexicon helpers. Pure functions (no React) so wording and
// thresholds are identical on every page. Display strings live in the `plain`
// message namespace; this file only decides WHICH bucket a number falls in.

import type { AccuracyGrade } from "@/lib/accuracy";

export type CplCost = "small" | "pawn" | "piece" | "rook";

// Centipawn-loss cost buckets (lower bounds, inclusive).
export const CPL_CAP = 1000;
export const COST_PAWN_MIN = 80;
export const COST_PIECE_MIN = 200;
export const COST_ROOK_MIN = 450;

/** Bucket one move's centipawn loss into small slip / pawn / piece / rook-or-more. */
export function cplCost(cpl: number): CplCost {
  const c = Math.min(CPL_CAP, Math.max(0, Number.isFinite(cpl) ? cpl : 0));
  if (c >= COST_ROOK_MIN) return "rook";
  if (c >= COST_PIECE_MIN) return "piece";
  if (c >= COST_PAWN_MIN) return "pawn";
  return "small";
}

// "Turned the game" = a big swing from winning/equal to losing.
export const TURNED_DROP_MIN = 30;
export const TURNED_BEFORE_MIN = 50;
export const TURNED_AFTER_MAX = 50;

/**
 * True when the player's win% dropped by at least 30 points, from at least 50%
 * to below 50%. Inputs are player-POV win% (0-100); callers use `winPct`
 * from lib/accuracy.
 */
export function turnedGame(winBefore: number, winAfter: number): boolean {
  return (
    winBefore - winAfter >= TURNED_DROP_MIN &&
    winBefore >= TURNED_BEFORE_MIN &&
    winAfter < TURNED_AFTER_MAX
  );
}

// Average-CPL grade upper bounds (inclusive). These are starting values and may
// be tuned once we see real data; the first three match the original game page.
export const GRADE_EXCELLENT_MAX = 30;
export const GRADE_GOOD_MAX = 70;
export const GRADE_OK_MAX = 130;
export const GRADE_SHAKY_MAX = 200;

/** Grade an average centipawn loss (lower is better). */
export function cplGrade(avgCpl: number): AccuracyGrade {
  if (avgCpl <= GRADE_EXCELLENT_MAX) return "excellent";
  if (avgCpl <= GRADE_GOOD_MAX) return "good";
  if (avgCpl <= GRADE_OK_MAX) return "ok";
  if (avgCpl <= GRADE_SHAKY_MAX) return "shaky";
  return "costly";
}

/**
 * "1 in every N games" helper: given `count` events over `games` games,
 * returns N (rounded, at least 1), or null when there are no events or games.
 */
export function perGames(count: number, games: number): number | null {
  if (!(count > 0) || !(games > 0)) return null;
  return Math.max(1, Math.round(games / count));
}
