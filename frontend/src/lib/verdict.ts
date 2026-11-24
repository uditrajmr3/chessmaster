// Plain-language verdict engine. Pure (no React, no network). Returns message
// keys plus params, never finished strings; the UI translates them.
// Rule ladder: docs/superpowers/specs/2026-11-23-ux-overhaul.md section 2.2.

import { Chess, type Move } from "chess.js";
import { winPct } from "@/lib/accuracy";
import { cplCost, turnedGame } from "@/lib/plain";

export type Tone = "bad" | "good" | "threat" | "neutral";
export type VerdictCost = "small" | "pawn" | "piece" | "rook" | "game";

export interface MistakeInput {
  fen_before: string;
  move_uci?: string | null;
  move_san?: string | null;
  best_move_uci?: string | null;
  best_move_san?: string | null;
  refutation_uci?: string | null;
  eval_before?: number | null;
  eval_after?: number | null;
  centipawn_loss: number;
  tactical_motifs?: string[] | null;
  classification?: string | null;
  player_color: "white" | "black";
}

export interface Verdict {
  primaryKey: string;
  primaryParams: Record<string, string | number>;
  secondaryKey?: string;
  secondaryParams?: Record<string, string | number>;
  cost: VerdictCost;
  isSlip: boolean;
  arrows: { from: string; to: string; tone: Tone }[];
  highlights: { square: string; tone: Tone }[];
}

/** Evals at or beyond this magnitude encode a forced mate. */
export const MATE_EVAL = 9000;
/** Minimum win% drop for a move to count as a slip. */
export const SLIP_DROP_MIN = 5;
const SLIP_CLASSES = new Set(["inaccuracy", "miss", "mistake", "blunder"]);

const PIECE_NAME: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
const PIECE_VALUE: Record<string, number> = { p: 100, n: 300, b: 300, r: 500, q: 900 };
const MINOR_VALUE = 300;

// Backend motif string -> message id (motif.<id>.name / .explain).
const MOTIF_ID: Record<string, string> = {
  fork: "fork",
  pin: "pin",
  skewer: "skewer",
  back_rank: "backRank",
  discovered_attack: "discoveredAttack",
};

type Params = Record<string, string | number>;
interface Match {
  key: string;
  params: Params;
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/;

/** Resolve a UCI or SAN move on `fen`; null when illegal or unparseable. */
function resolveMove(fen: string, uci?: string | null, san?: string | null): Move | null {
  const attempts: (() => Move)[] = [];
  if (uci && UCI_RE.test(uci)) {
    attempts.push(() =>
      new Chess(fen).move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4].toLowerCase() : undefined,
      }),
    );
  } else if (uci) {
    attempts.push(() => new Chess(fen).move(uci));
  }
  if (san) attempts.push(() => new Chess(fen).move(san));
  for (const a of attempts) {
    try {
      return a();
    } catch {
      /* try next */
    }
  }
  return null;
}

function costOf(m: MistakeInput): VerdictCost {
  const { eval_before: b, eval_after: a } = m;
  if (typeof b === "number" && typeof a === "number" && turnedGame(winPct(b), winPct(a))) {
    return "game";
  }
  return cplCost(m.centipawn_loss);
}

function isSlip(m: MistakeInput): boolean {
  if (!m.classification || !SLIP_CLASSES.has(m.classification)) return false;
  const { eval_before: b, eval_after: a } = m;
  if (typeof b === "number" && typeof a === "number") {
    return winPct(b) - winPct(a) >= SLIP_DROP_MIN;
  }
  return true;
}

/** Loss is at least two thirds of the piece's value (so even trades don't trigger). */
function consistent(cpl: number, value: number): boolean {
  return cpl >= (2 / 3) * value;
}

const FALLBACK_KEY: Record<VerdictCost, string> = {
  small: "verdict.smallSlip",
  pawn: "verdict.costPawn",
  piece: "verdict.costPiece",
  rook: "verdict.costRook",
  game: "verdict.turnedGame",
};

export function verdict(m: MistakeInput): Verdict {
  const cost = costOf(m);
  if (!isSlip(m)) {
    const good = m.classification === "brilliant" || m.classification === "best" || m.classification === "excellent";
    return {
      primaryKey: good ? "verdict.good" : "verdict.fine",
      primaryParams: {},
      cost: "small",
      isSlip: false,
      arrows: [],
      highlights: [],
    };
  }

  const matches: Match[] = [];
  const arrows: Verdict["arrows"] = [];
  const highlights: Verdict["highlights"] = [];

  try {
    const played = resolveMove(m.fen_before, m.move_uci, m.move_san);
    const best = resolveMove(m.fen_before, m.best_move_uci, m.best_move_san);
    const bestSan = best?.san ?? m.best_move_san ?? "";
    const differs = !!best && (!played || best.lan !== played.lan);
    const playedSame = !!best && !!played && best.lan === played.lan;
    const turnOk = new Chess(m.fen_before).turn() === (m.player_color === "white" ? "w" : "b");

    if (played) arrows.push({ from: played.from, to: played.to, tone: "bad" });
    if (best && !playedSame) arrows.push({ from: best.from, to: best.to, tone: "good" });

    // 1. Allows forced mate.
    if (typeof m.eval_after === "number" && m.eval_after <= -MATE_EVAL) {
      matches.push({ key: "verdict.allowsMate", params: {} });
    }

    // 2. Missed mate (forced mate available, or best move is checkmate).
    const bestIsMate = bestSan.endsWith("#");
    const mateAvailable = typeof m.eval_before === "number" && m.eval_before >= MATE_EVAL;
    if (!playedSame && (bestIsMate || (mateAvailable && (differs || !best)))) {
      matches.push({ key: "verdict.missedMate", params: {} });
    }

    // 3. Motif.
    const motif = (m.tactical_motifs ?? []).map((x) => MOTIF_ID[x]).find(Boolean);
    if (motif) matches.push({ key: "verdict.missedMotif", params: { motif } });

    if (turnOk && played) {
      // 4. Opponent can take a piece after the played move.
      // NOTE: verdict.hangsPiece is an ICU select on the raw piece id (pawn, knight, ...)
      // so each language can agree grammar (gender/possessive). Callers must pass this id
      // untranslated, not a pieces.<id> name. verdict.missedCapture takes the translated name.
      if (m.refutation_uci) {
        try {
          const g = new Chess(m.fen_before);
          g.move({ from: played.from, to: played.to, promotion: played.promotion });
          const ref = resolveMove(g.fen(), m.refutation_uci, null);
          const val = ref?.captured ? PIECE_VALUE[ref.captured] : 0;
          if (ref && val >= MINOR_VALUE && consistent(m.centipawn_loss, val)) {
            matches.push({
              key: "verdict.hangsPiece",
              params: { piece: PIECE_NAME[ref.captured as string], square: ref.to },
            });
            arrows.push({ from: ref.from, to: ref.to, tone: "threat" });
            highlights.push({ square: ref.to, tone: "bad" });
          }
        } catch {
          /* skip rule 4 */
        }
      }

      // 5. Best move was a capture the player did not make.
      if (best && differs && best.captured) {
        const val = PIECE_VALUE[best.captured] ?? 0;
        if (val >= MINOR_VALUE && consistent(m.centipawn_loss, val)) {
          matches.push({
            key: "verdict.missedCapture",
            params: { piece: PIECE_NAME[best.captured], square: best.to },
          });
          highlights.push({ square: best.to, tone: "good" });
        }
      }
    }
  } catch {
    matches.length = 0;
    arrows.length = 0;
    highlights.length = 0;
  }

  const [first, second] = matches;
  const out: Verdict = {
    primaryKey: first ? first.key : FALLBACK_KEY[cost],
    primaryParams: first ? first.params : {},
    cost,
    isSlip: true,
    arrows,
    highlights,
  };
  if (second) {
    out.secondaryKey = second.key;
    out.secondaryParams = second.params;
  }
  return out;
}
