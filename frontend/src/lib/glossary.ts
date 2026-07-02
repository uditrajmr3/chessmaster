// Plain-English definitions of the chess + analysis jargon ChessInt shows.
// Used by <Term> for inline hover/tap tooltips and rendered in full on
// /learn/glossary. Keep every definition beginner-first: assume the reader has
// never seen the word before. `short` is for the tooltip; `long` (optional)
// adds a sentence of depth on the glossary page.

export type GlossaryEntry = {
  term: string;
  short: string;
  long?: string;
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  accuracy: {
    term: "Accuracy",
    short:
      "How close your moves were to the best moves, scored 0–100%. Higher is better — 90%+ is excellent, under 70% means several moves went wrong.",
    long: "Accuracy rolls every move of a game into one friendly number. It is built from how much each move changed your chance of winning, not from raw engine points, so it is easy to compare between games.",
  },
  cpl: {
    term: "CPL (Centipawn Loss)",
    short:
      "How much a move 'cost' you, measured in 1/100ths of a pawn. 0 is perfect; under ~20 is fine; big numbers mean a big mistake.",
    long: "Centipawn Loss is the gap between the move you played and the best available move. Because a pawn is worth 100 centipawns, a CPL of 50 means you gave up about half a pawn of advantage.",
  },
  acpl: {
    term: "ACPL (Average CPL)",
    short:
      "Your Centipawn Loss averaged over a whole game (or many games) — a single number for how cleanly you played. Lower is better.",
    long: "ACPL is the most common way to compare how well two players, or two of your own games, were played. Strong club players often average under 30.",
  },
  centipawn: {
    term: "Centipawn",
    short:
      "A unit for measuring advantage: 100 centipawns = the value of one pawn. The engine scores every position this way.",
  },
  evaluation: {
    term: "Evaluation (eval)",
    short:
      "The engine's score for a position. Positive = you're better, negative = your opponent is. +1.0 ≈ a pawn ahead, +3.0 ≈ a piece ahead.",
    long: "The evaluation is the engine's overall judgement of who stands better and by how much, considering material, king safety, activity, and more.",
  },
  winpct: {
    term: "Win %",
    short:
      "Your estimated chance of winning from a position, based on the engine's evaluation. Easier to read than centipawns.",
  },
  blunder: {
    term: "Blunder",
    short:
      "A serious mistake that badly hurts your position — usually hanging a piece or missing a major threat. ChessInt marks these so you can learn from them.",
  },
  mistake: {
    term: "Mistake",
    short:
      "A clear error that worsens your position — less severe than a blunder, but it still hands your opponent an edge.",
  },
  inaccuracy: {
    term: "Inaccuracy",
    short:
      "A small slip: not losing, but not the best move. A series of these quietly adds up.",
  },
  brilliant: {
    term: "Brilliant move",
    short:
      "A great, often surprising move — usually a smart sacrifice the engine confirms is best. The hardest classification to earn.",
  },
  best: {
    term: "Best move",
    short: "You played the engine's top choice for that position.",
  },
  book: {
    term: "Book move",
    short:
      "A known opening move from established theory — solid, but it's memorised theory rather than your own calculation.",
  },
  miss: {
    term: "Miss",
    short:
      "You had a strong tactic or winning chance available and didn't play it.",
  },
  opening: {
    term: "Opening",
    short:
      "The first stage of the game (roughly the first 10–15 moves), where you develop your pieces and fight for the centre.",
  },
  middlegame: {
    term: "Middlegame",
    short:
      "The main battle after the pieces are developed — plans, attacks, and tactics. Where most games are won or lost.",
  },
  endgame: {
    term: "Endgame",
    short:
      "The final stage, with few pieces left. Technique matters most here: king activity, passed pawns, and known winning methods.",
  },
  tilt: {
    term: "Tilt",
    short:
      "Playing worse because of emotion — frustration after a loss leading to rushed, weaker moves. ChessInt can spot it in your results.",
  },
  stockfish: {
    term: "Stockfish",
    short:
      "The free, world-class chess engine ChessInt runs in your browser to analyse your games.",
  },
};
