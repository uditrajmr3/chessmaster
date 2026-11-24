// The set of chess/analysis terms ChessInt explains. The actual text
// (term + short tooltip + optional long definition) lives in the `glossary`
// namespace of the message catalogs (src/messages/*.json) so it localizes with
// the rest of the app. <Term> reads it for inline tooltips; /learn/glossary
// renders the full list. Order here = display order on the glossary page
// (alphabetical by English term).

export const GLOSSARY_TERMS = [
  "accuracy",
  "acpl",
  "backRank",
  "best",
  "blunder",
  "book",
  "brilliant",
  "centipawn",
  "conversion",
  "cpl",
  "discoveredAttack",
  "eco",
  "endgame",
  "evaluation",
  "fork",
  "inaccuracy",
  "middlegame",
  "miss",
  "mistake",
  "opening",
  "pin",
  "skewer",
  "stockfish",
  "tilt",
  "timeTrouble",
  "winpct",
] as const;

// Terms that have an extra `long` definition shown on the glossary page.
export const GLOSSARY_LONG: readonly string[] = [
  "accuracy",
  "cpl",
  "acpl",
  "evaluation",
];
