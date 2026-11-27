// Pure helpers for the game-detail review page (no React, no network).
//
// Eval convention (verified against backend/app/services/analysis_ingest.py:66):
// move_analyses.eval_before / eval_after are stored PLAYER-POV (positive = good
// for the logged-in player; ingest negates white-POV evals for black players).
// lib/verdict and lib/accuracy expect exactly that, so no sign conversion is
// needed here, for either colour. `move_number` is the 1-based PLY index.

import type { MoveAnalysis } from "@/lib/types";
import { winPct } from "@/lib/accuracy";
import { SLIP_DROP_MIN, verdict, type MistakeInput } from "@/lib/verdict";

export const MAX_KEY_MOMENTS = 3;

export type ChipGroup = "good" | "slips" | "big";

export const CHIP_GROUPS: Record<ChipGroup, string[]> = {
  good: ["brilliant", "great", "best", "excellent", "good", "book"],
  slips: ["inaccuracy", "miss"],
  big: ["mistake", "blunder"],
};

/** Sum the ten-way classification counts into the three headline groups. */
export function groupChipCounts(counts: Record<string, number>): Record<ChipGroup, number> {
  const out: Record<ChipGroup, number> = { good: 0, slips: 0, big: 0 };
  for (const g of Object.keys(CHIP_GROUPS) as ChipGroup[]) {
    out[g] = CHIP_GROUPS[g].reduce((s, c) => s + (counts[c] || 0), 0);
  }
  return out;
}

/**
 * `?move=N` is the 1-based PLY index over the whole game (1 = White's first
 * move, 2 = Black's first reply, ...), the same number as MoveAnalysis.move_number.
 * Missing or non-integer values return null (ignored); numbers are clamped to
 * [0, totalPlies].
 */
export function parseMoveParam(raw: string | null | undefined, totalPlies: number): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(Math.max(0, totalPlies), n));
}

/** Ply index (1-based) to the full-move number a player would say aloud. */
export function fullMoveNumber(ply: number): number {
  return Math.ceil(ply / 2);
}

/** Win% the player lost on this move (positive = worse for the player). */
export function winDrop(m: Pick<MoveAnalysis, "eval_before" | "eval_after">): number | null {
  if (typeof m.eval_before !== "number" || typeof m.eval_after !== "number") return null;
  return winPct(m.eval_before) - winPct(m.eval_after);
}

export interface Moment {
  /** 1-based ply index into the game. */
  ply: number;
  drop: number;
  /** Player's win% before the move. */
  winBefore: number;
  winAfter: number;
}

/** The player's move with the largest win% drop, if it dropped at least SLIP_DROP_MIN. */
export function turningPoint(moves: MoveAnalysis[]): Moment | null {
  let best: Moment | null = null;
  moves.forEach((m, i) => {
    if (!m.is_player_move) return;
    const drop = winDrop(m);
    if (drop === null || drop < SLIP_DROP_MIN) return;
    if (!best || drop > best.drop) {
      best = {
        ply: i + 1,
        drop,
        winBefore: winPct(m.eval_before as number),
        winAfter: winPct(m.eval_after as number),
      };
    }
  });
  return best;
}

export interface KeyMoment extends Moment {
  mistake: MistakeInput & { game_id: string };
}

/** Build the verdict-engine input for the player's move at `index` (refutation = next row). */
export function toMistakeInput(
  moves: MoveAnalysis[],
  index: number,
  playerColor: string,
  gameId: string,
): MistakeInput & { game_id: string } {
  const m = moves[index];
  const next = moves[index + 1];
  return {
    game_id: gameId,
    fen_before: m.fen_before,
    move_uci: m.move_uci,
    move_san: m.move_san,
    best_move_uci: m.best_move_uci,
    best_move_san: m.best_move_san,
    refutation_uci: next ? next.move_uci : null,
    eval_before: m.eval_before,
    eval_after: m.eval_after,
    centipawn_loss: m.centipawn_loss,
    tactical_motifs: m.tactical_motifs,
    classification: m.classification,
    player_color: playerColor === "black" ? "black" : "white",
  };
}

/**
 * Up to `limit` player moves with the largest win% drops that the verdict engine
 * agrees are slips. Sorted by drop (largest first); ties keep game order.
 */
export function keyMoments(
  moves: MoveAnalysis[],
  playerColor: string,
  gameId: string,
  limit = MAX_KEY_MOMENTS,
): KeyMoment[] {
  const out: KeyMoment[] = [];
  moves.forEach((m, i) => {
    if (!m.is_player_move) return;
    const drop = winDrop(m);
    if (drop === null || drop < SLIP_DROP_MIN) return;
    const mistake = toMistakeInput(moves, i, playerColor, gameId);
    let slip = false;
    try {
      slip = verdict(mistake).isSlip;
    } catch {
      slip = false;
    }
    if (!slip) return;
    out.push({
      ply: i + 1,
      drop,
      winBefore: winPct(m.eval_before as number),
      winAfter: winPct(m.eval_after as number),
      mistake,
    });
  });
  out.sort((a, b) => b.drop - a.drop || a.ply - b.ply);
  return out.slice(0, limit);
}
