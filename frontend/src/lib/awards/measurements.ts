export const PIECES = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;
export const TIME_CLASSES = ["bullet", "blitz", "rapid", "daily"] as const;
export const VARIANTS = [
  "chess960", "crazyhouse", "kingofthehill", "threecheck", "bughouse", "oddschess",
] as const;

export const MEASUREMENT_KEYS = [
  "games.live", "games.daily", "games.total",
  "wins.live", "wins.daily", "wins.total",
  ...TIME_CLASSES.map((c) => `ratings_peak.${c}`),
  "puzzles.rating_best", "puzzles.rush_best",
  ...PIECES.map((p) => `mates_by_piece.${p}`),
  "mates_by_king_discovery",
  "mate_by_castling",
  ...VARIANTS.map((v) => `variants.${v}`),
  "countries_played",
  "eco_played",
  "min_clock_win_ms",
  "flawless_wins",
  "quick_knockouts",
  "marathon_games",
  "promotions.queen", "promotions.underpromotion",
] as const;

const KEY_SET = new Set<string>(MEASUREMENT_KEYS);

/** `eco_played.B01` is valid: the ECO code is data, not a fixed key. */
export function isValidMeasurementKey(key: string): boolean {
  if (KEY_SET.has(key)) return true;
  if (key.startsWith("eco_played.")) return /^eco_played\.[A-E]\d{2}$/.test(key);
  return false;
}

/** Resolve a dotted path against a measurements object. */
export function readMeasurement(m: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined),
    m,
  );
}
