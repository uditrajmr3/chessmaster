// Picks the ONE biggest leak for the "My mistakes" page headline. Pure (no
// React, no network). Each candidate leak gets a severity ratio (1 = "just
// big enough to mention"); the biggest ratio wins, ties go to PRIORITY order.

import type { PatternReport } from "@/lib/types";

export type WeaknessTone = "bad" | "warn" | "good";
export type Phase = "opening" | "middlegame" | "endgame";

export type WeaknessHeadline =
  | { kind: "phase"; tone: WeaknessTone; phase: Phase; avgLoss: number }
  | { kind: "motif"; tone: WeaknessTone; motif: string; count: number }
  | { kind: "clock"; tone: WeaknessTone; troubleRate: number; normalRate: number; times: number }
  | { kind: "color"; tone: WeaknessTone; worse: "white" | "black"; gap: number }
  | { kind: "endgame"; tone: WeaknessTone; rate: number }
  | { kind: "none"; tone: "good" };

// --- thresholds (a ratio of 1 means "exactly at the threshold") ---
/** A phase is a leak when its average loss per move is at least this (centipawns). */
export const PHASE_LOSS_MIN = 100;
/** ...and at least this many times the average of the other two phases. */
export const PHASE_VS_OTHERS_MIN = 1.2;
/** A motif is a leak once it has been missed this many times. */
export const MOTIF_COUNT_MIN = 3;
/** Low-clock blunder rate must be this many times the normal rate. */
export const CLOCK_RATIO_MIN = 1.5;
/** ...and at least this blunder rate (percent) so tiny rates do not count. */
export const CLOCK_TROUBLE_RATE_MIN = 5;
/** Win-rate gap between colours (percentage points). */
export const COLOR_GAP_MIN = 15;
/** Each colour needs at least this many games to be compared. */
export const COLOR_GAMES_MIN = 5;
/** Endgame conversion at or below this percent is a leak (0 = no data). */
export const ENDGAME_CONVERSION_MAX = 60;
/** Severity is capped so one huge number cannot hide every other finding. */
export const RATIO_CAP = 3;
/** Ratio at or above which the tone is "bad" rather than "warn". */
export const BAD_RATIO = 2;

/** Tie-break order (first wins), matching the spec list. */
const PRIORITY = ["phase", "motif", "clock", "color", "endgame"] as const;

const PHASES: Phase[] = ["opening", "middlegame", "endgame"];

type Candidate = { ratio: number; headline: WeaknessHeadline };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const cap = (r: number) => Math.min(RATIO_CAP, r);
const toneFor = (ratio: number): WeaknessTone => (ratio >= BAD_RATIO ? "bad" : "warn");

function phaseCandidate(p: PatternReport): Candidate | null {
  const acc = p.phase_accuracy ?? {};
  const rows = PHASES.map((ph) => ({ ph, v: num(acc[ph]) })).filter((r) => r.v > 0);
  if (rows.length === 0) return null;
  const worst = rows.reduce((a, b) => (b.v > a.v ? b : a));
  const others = rows.filter((r) => r.ph !== worst.ph);
  const othersAvg = others.length ? others.reduce((s, r) => s + r.v, 0) / others.length : 0;
  if (worst.v < PHASE_LOSS_MIN) return null;
  if (others.length && worst.v < othersAvg * PHASE_VS_OTHERS_MIN) return null;
  const ratio = cap(worst.v / PHASE_LOSS_MIN);
  return {
    ratio,
    headline: { kind: "phase", tone: toneFor(ratio), phase: worst.ph, avgLoss: worst.v },
  };
}

function motifCandidate(p: PatternReport): Candidate | null {
  const entries = Object.entries(p.missed_tactics ?? {}).filter(([, c]) => num(c) > 0);
  if (entries.length === 0) return null;
  // Highest count; ties resolved alphabetically so the result is stable.
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [motif, count] = entries[0];
  if (count < MOTIF_COUNT_MIN) return null;
  const ratio = cap(count / MOTIF_COUNT_MIN);
  return { ratio, headline: { kind: "motif", tone: toneFor(ratio), motif, count } };
}

/** Times as often you blunder when low on clock; null when not measurable. */
export function clockMultiple(p: PatternReport): number | null {
  const trouble = num(p.blunder_rate_time_trouble);
  const normal = num(p.blunder_rate_normal);
  if (trouble <= 0) return null;
  if (normal <= 0) return RATIO_CAP * CLOCK_RATIO_MIN; // never blunders at normal time
  return trouble / normal;
}

function clockCandidate(p: PatternReport): Candidate | null {
  const times = clockMultiple(p);
  if (times === null) return null;
  const trouble = num(p.blunder_rate_time_trouble);
  if (trouble < CLOCK_TROUBLE_RATE_MIN || times < CLOCK_RATIO_MIN) return null;
  const ratio = cap(times / CLOCK_RATIO_MIN);
  return {
    ratio,
    headline: {
      kind: "clock",
      tone: toneFor(ratio),
      troubleRate: trouble,
      normalRate: num(p.blunder_rate_normal),
      times: Math.round(times * 10) / 10,
    },
  };
}

function colorCandidate(p: PatternReport): Candidate | null {
  const w = p.white_stats ?? {};
  const b = p.black_stats ?? {};
  if (num(w.games) < COLOR_GAMES_MIN || num(b.games) < COLOR_GAMES_MIN) return null;
  const gap = num(w.win_rate) - num(b.win_rate);
  if (Math.abs(gap) < COLOR_GAP_MIN) return null;
  const ratio = cap(Math.abs(gap) / COLOR_GAP_MIN);
  return {
    ratio,
    headline: {
      kind: "color",
      tone: toneFor(ratio),
      worse: gap > 0 ? "black" : "white",
      gap: Math.round(Math.abs(gap)),
    },
  };
}

function endgameCandidate(p: PatternReport): Candidate | null {
  const rate = num(p.endgame_conversion_rate);
  // The API sends 0 both for "no winning endgames" and a true 0%; treat as no data.
  if (rate <= 0 || rate > ENDGAME_CONVERSION_MAX) return null;
  const ratio = cap(ENDGAME_CONVERSION_MAX / rate);
  return { ratio, headline: { kind: "endgame", tone: toneFor(ratio), rate: Math.round(rate) } };
}

/** The single biggest leak, or `{kind: "none"}` when nothing stands out. */
export function weaknessHeadline(p: PatternReport | null | undefined): WeaknessHeadline {
  if (!p) return { kind: "none", tone: "good" };
  const found: Record<(typeof PRIORITY)[number], Candidate | null> = {
    phase: phaseCandidate(p),
    motif: motifCandidate(p),
    clock: clockCandidate(p),
    color: colorCandidate(p),
    endgame: endgameCandidate(p),
  };
  let best: Candidate | null = null;
  for (const k of PRIORITY) {
    const c = found[k];
    if (c && (!best || c.ratio > best.ratio)) best = c; // strict > keeps priority on ties
  }
  return best ? best.headline : { kind: "none", tone: "good" };
}
