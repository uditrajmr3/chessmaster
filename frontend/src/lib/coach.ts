// The Capablanca coach: turns a live position into the three-question loop with
// concrete answers, plus a rule tag for a suggested move. Pure functions over a
// chess.js game so they're unit-testable (see coach.test.ts).
//
// The threat check is deliberately conservative — it flags the beginner-killer
// (a piece attacked and not adequately defended) using chess.js `attackers`,
// rather than guessing at deep tactics. The engine, not this file, decides what
// move to actually recommend; this file explains it in Capablanca's language.

import { Chess, SQUARES, type Color, type PieceSymbol, type Square } from "chess.js";
import { RULES_BY_PHASE, type GamePhase, type Rule } from "./capablanca";

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const NAME: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const HOME: Record<Color, Partial<Record<PieceSymbol, Square[]>>> = {
  w: { n: ["b1", "g1"], b: ["c1", "f1"] },
  b: { n: ["b8", "g8"], b: ["c8", "f8"] },
};

function kingSquare(chess: Chess, color: Color): Square | null {
  for (const sq of SQUARES) {
    const p = chess.get(sq);
    if (p && p.type === "k" && p.color === color) return sq;
  }
  return null;
}

export function detectPhase(chess: Chess): GamePhase {
  const pieces = chess.board().flat().filter(Boolean) as { type: PieceSymbol }[];
  const queens = pieces.filter((p) => p.type === "q").length;
  const heavy = pieces.filter((p) => p.type !== "p" && p.type !== "k").length;
  if (queens === 0 || heavy <= 6) return "endgame";
  const fullmove = Number(chess.fen().split(/\s+/)[5] || "1");
  return fullmove <= 10 ? "opening" : "middlegame";
}

export type Threat = { square: Square; text: string };

/** Pieces of the side to move that are attacked and not adequately defended. */
export function findThreats(chess: Chess): Threat[] {
  const me = chess.turn();
  const opp: Color = me === "w" ? "b" : "w";
  const threats: Threat[] = [];

  const ksq = kingSquare(chess, me);
  if (ksq && chess.attackers(ksq, opp).length > 0) {
    threats.push({ square: ksq, text: "Your king is in check — you must deal with it first." });
  }

  for (const sq of SQUARES) {
    const pc = chess.get(sq);
    if (!pc || pc.color !== me || pc.type === "k") continue;
    const attackers = chess.attackers(sq, opp);
    if (attackers.length === 0) continue;
    const defenders = chess.attackers(sq, me);
    const cheapestAttacker = Math.min(...attackers.map((a) => VALUE[chess.get(a)!.type]));
    const undefended = defenders.length === 0;
    // A real threat: the piece is undefended, or a cheaper piece attacks it, or
    // more attackers than defenders.
    if (undefended || cheapestAttacker < VALUE[pc.type] || attackers.length > defenders.length) {
      threats.push({
        square: sq,
        text: `Your ${NAME[pc.type]} on ${sq} is attacked${undefended ? " and undefended" : ""} — deal with it.`,
      });
    }
  }
  return threats;
}

export type Suggestion = { square: Square; text: string } | null;

/** The least-active piece to improve (undeveloped minors first, then lowest mobility). */
export function leastActivePiece(chess: Chess): Suggestion {
  const me = chess.turn();

  // 1. Undeveloped minor pieces still on their home squares.
  for (const type of ["n", "b"] as PieceSymbol[]) {
    for (const sq of HOME[me][type] ?? []) {
      const p = chess.get(sq);
      if (p && p.type === type && p.color === me) {
        return { square: sq, text: `Your ${NAME[type]} on ${sq} hasn't developed yet — bring it into the game.` };
      }
    }
  }

  // 2. Otherwise the piece (not king/pawn) with the fewest available squares.
  let worst: { sq: Square; type: PieceSymbol; mobility: number } | null = null;
  for (const sq of SQUARES) {
    const p = chess.get(sq);
    if (!p || p.color !== me || p.type === "p" || p.type === "k") continue;
    const mobility = chess.moves({ square: sq, verbose: true }).length;
    if (!worst || mobility < worst.mobility) worst = { sq, type: p.type, mobility };
  }
  if (worst && worst.mobility <= 2) {
    return { square: worst.sq, text: `Your ${NAME[worst.type]} on ${worst.sq} has little scope — find it a better square.` };
  }
  return null;
}

/** Opponent pieces sitting on the side-to-move's half of the board. */
export function enemiesOnMyHalf(chess: Chess): Suggestion {
  const me = chess.turn();
  const opp: Color = me === "w" ? "b" : "w";
  const intruders: Square[] = [];
  for (const sq of SQUARES) {
    const p = chess.get(sq);
    if (!p || p.color !== opp) continue;
    const rank = Number(sq[1]);
    const onMyHalf = me === "w" ? rank <= 4 : rank >= 5;
    if (onMyHalf) intruders.push(sq);
  }
  if (intruders.length === 0) return null;
  const list = intruders.join(", ");
  return {
    square: intruders[0],
    text: `Enemy ${intruders.length > 1 ? "pieces" : "piece"} on your half (${list}) — trade it off, chase it back, or blockade it.`,
  };
}

export type CoachReport = {
  phase: GamePhase;
  questions: { q: string; answer: string; ok: boolean }[];
  rules: Rule[];
};

/** The full three-question loop, answered for the current position. */
export function coachReport(chess: Chess): CoachReport {
  const phase = detectPhase(chess);
  const threats = findThreats(chess);
  const least = leastActivePiece(chess);
  const intruders = enemiesOnMyHalf(chess);

  return {
    phase,
    rules: RULES_BY_PHASE[phase],
    questions: [
      {
        q: "What did my opponent just threaten?",
        answer: threats.length
          ? threats.map((t) => t.text).join(" ")
          : "Nothing immediate — you're safe to improve your position.",
        ok: threats.length === 0,
      },
      {
        q: "Which of my pieces is the least active?",
        answer: least ? least.text : "Every piece is reasonably active. Look for a plan instead.",
        ok: !least,
      },
      {
        q: "Any enemy pieces on my half of the board?",
        answer: intruders ? intruders.text : "Your half is clear.",
        ok: !intruders,
      },
    ],
  };
}

/** Tag an engine-chosen move (UCI) with the Capablanca rule it best illustrates. */
export function ruleForMove(chess: Chess, uciMove: string): { rule: Rule; why: string } | null {
  if (!uciMove || uciMove.length < 4) return null;
  const from = uciMove.slice(0, 2) as Square;
  const to = uciMove.slice(2, 4) as Square;
  const piece = chess.get(from);
  if (!piece) return null;
  const phase = detectPhase(chess);
  const rules = RULES_BY_PHASE[phase];
  const byId = (id: string) => rules.find((r) => r.id === id) ?? rules[0];
  const isCapture = !!chess.get(to);

  // Castling (king two squares).
  if (piece.type === "k" && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
    return { rule: byId("O-4"), why: "Getting your king to safety." };
  }
  if (phase === "opening") {
    const home = (HOME[piece.color][piece.type] ?? []).includes(from);
    if (home) return { rule: byId("O-1"), why: `Developing your ${NAME[piece.type]} into the game.` };
    if (isCapture) return { rule: byId("O-3"), why: "A move that hits something and forces a reply." };
    return { rule: byId("O-1"), why: "Keep developing before you commit to a plan." };
  }
  if (phase === "endgame") {
    if (piece.type === "k") return { rule: byId("E-1"), why: "Marching your king toward the centre." };
    if (isCapture) return { rule: byId("E-2"), why: "Winning material — a step closer to promoting." };
    return { rule: byId("E-3"), why: "Improving your rook/king around the passed pawns." };
  }
  // middlegame
  if (isCapture) return { rule: byId("M-2"), why: "Answering a threat / winning material." };
  return { rule: byId("M-1"), why: `Improving your ${NAME[piece.type]} before making a plan.` };
}
