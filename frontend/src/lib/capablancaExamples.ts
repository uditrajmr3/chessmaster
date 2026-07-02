// Interactive board examples for the Capablanca tutorial, keyed by rule id.
//
// Opening examples replay from the initial position (SAN from move 1 — exact).
// Middle/endgame examples use hand-built positions that DEMONSTRATE the
// principle (not claimed to be a specific historical game); each is legality-
// checked in capablancaExamples.test.ts, and every move sequence alternates
// sides so chess.js accepts it.

export type ExArrow = { from: string; to: string; color?: string };
export type ExStep = { san: string; caption?: string; arrows?: ExArrow[]; dots?: string[] };
export type Example = {
  fen?: string; // omitted = start position
  orientation?: "white" | "black";
  startCaption?: string;
  startArrows?: ExArrow[];
  startDots?: string[];
  steps: ExStep[];
};

export const EXAMPLES: Record<string, Example> = {
  // ── Opening (replayed from move 1) ──
  "O-1": {
    startCaption: "A London System — develop every piece before starting anything.",
    steps: [
      { san: "d4", caption: "Stake a claim in the centre." },
      { san: "d5" },
      { san: "Nf3", caption: "Knight toward the centre first." },
      { san: "Nf6" },
      { san: "e3", caption: "Open a path for the bishop." },
      { san: "e6" },
      { san: "Bd3", caption: "Every minor piece gets a job before any attack." },
      { san: "Bd6" },
      { san: "Nbd2", caption: "Nbd2, not Nc3 — it keeps the c-pawn free and guards f3." },
    ],
  },
  "O-2": {
    startCaption: "Handling a pin calmly — no panic, no wasted time.",
    steps: [
      { san: "d4", caption: "" },
      { san: "d5" },
      { san: "Nf3", caption: "" },
      { san: "Nf6" },
      { san: "e3", caption: "" },
      { san: "Bg4", caption: "Black pins the f3-knight against the queen." },
      { san: "Nbd2", caption: "Bring up the other knight first (O-2)." },
      { san: "e6" },
      { san: "Be2", caption: "…then Be2 breaks the pin. Both moves developed a piece — no tempo lost." },
    ],
  },
  "O-3": {
    startCaption: "A developing move that also makes a threat.",
    steps: [
      { san: "e4" },
      { san: "e5" },
      { san: "Nf3", caption: "" },
      { san: "Nc6" },
      { san: "Bb5", caption: "The Ruy López: Bb5 develops AND pressures the knight defending e5 (O-3).", arrows: [{ from: "b5", to: "c6" }] },
      { san: "a6" },
      { san: "Ba4", caption: "Keep the pressure — every move still develops." },
    ],
  },
  "O-4": {
    startCaption: "Castle as early as you reasonably can.",
    steps: [
      { san: "e4" },
      { san: "e5" },
      { san: "Nf3" },
      { san: "Nc6" },
      { san: "Bc4", caption: "The Italian — pieces flow out naturally." },
      { san: "Bc5" },
      { san: "O-O", caption: "Castle now (O-4): the king is safe and the rook is connected." },
    ],
  },
  "O-5": {
    startCaption: "Don't move the same piece twice — spend every move developing a new one.",
    steps: [
      { san: "e4" },
      { san: "e5" },
      { san: "Nf3" },
      { san: "Nc6" },
      { san: "Bc4" },
      { san: "Nf6" },
      { san: "d3", caption: "Opening the last bishop's diagonal." },
      { san: "Bc5" },
      { san: "O-O", caption: "Castled and nearly fully developed — no move wasted moving a piece twice (O-5)." },
    ],
  },

  // ── Middlegame (demonstration positions) ──
  "M-1": {
    fen: "r1bq1rk1/pp3ppp/2n1pn2/3N4/3P4/4PN2/PP3PPP/R1BQ1RK1 w - - 0 1",
    startCaption: "The knight on d5 is a permanent outpost — no black pawn can ever chase it off. That is a maximally active piece (M-1).",
    startDots: ["c7", "e7", "b6", "f4", "b4"],
    steps: [],
  },
  "M-3": {
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/4P3/3n1N2/PPPP1PPP/R1BQKB1R w KQkq - 0 1",
    startCaption: "Black's knight has crashed into d3, deep in White's camp — it even checks the king. Deal with an intruder at once (M-3).",
    steps: [
      { san: "cxd3", caption: "cxd3 — the intruder is eliminated immediately. Don't let enemy pieces settle on your half." },
    ],
  },
  "M-5": {
    fen: "6k1/p4ppp/8/2P5/1P6/8/P4PPP/6K1 w - - 0 1",
    startCaption: "A protected passed c-pawn (defended by b4), with no black pawn able to stop it — a simple, powerful plan (M-5).",
    steps: [
      { san: "c6", caption: "c6! It rolls forward and Black's pieces must drop everything to watch it." },
      { san: "Kf8" },
      { san: "c7", caption: "c7 — one step from a new queen. The passed pawn has tied Black down completely." },
    ],
  },

  // ── Endgame (demonstration positions) ──
  "E-1": {
    fen: "8/8/8/4k3/8/8/4KP2/8 w - - 0 1",
    startCaption: "Queens are off — the king becomes a fighting piece. March it to the centre (E-1).",
    steps: [
      { san: "Ke3", caption: "Ke3 — heading for the middle." },
      { san: "Kd5" },
      { san: "Kd3", caption: "The king is centralised and active, worth about a minor piece here." },
    ],
  },
  "E-3": {
    fen: "6k1/8/8/8/8/1P6/1R6/6K1 w - - 0 1",
    startCaption: "The rook sits BEHIND its passed pawn (E-3) — it will grow stronger with every push.",
    startArrows: [{ from: "b2", to: "b7" }],
    steps: [
      { san: "b4", caption: "b4 — the pawn advances, the rook still behind it." },
      { san: "Kf7" },
      { san: "b5" },
      { san: "Ke6" },
      { san: "b6", caption: "The rook-and-pawn battery is almost impossible to stop." },
    ],
  },
  "E-5": {
    fen: "6k1/p6p/8/8/8/8/6PP/R5K1 w - - 0 1",
    startCaption: "Black has weak pawns on both wings (a7 and h7). One can be defended — two cannot (E-5).",
    steps: [
      { san: "Ra6", caption: "Attack the a-pawn — Black must rush to defend it." },
      { san: "Kf7" },
      { san: "Rh6", caption: "Switch wings! Now the h-pawn is hanging. The king can't guard both." },
      { san: "Kg7" },
      { san: "Ra6", caption: "Back again — shuttling between two weaknesses until one falls." },
    ],
  },
};
