// Single source of truth for board colours. Wood palette chosen to sit with the
// accent (brown) scale in globals.css. Arrow tones stay red/green/amber so they
// never get lost against the wood.

export type Tone = "bad" | "good" | "threat" | "neutral";

export const BOARD_THEME = {
  light: "#e8d3b0", // warm maple
  dark: "#a8794f", // walnut
  coordOnLight: "#8a5f3c",
  coordOnDark: "#f1e0c4",
  whitePiece: "#ffffff",
  blackPiece: "#1d2630",
} as const;

export const ARROW_TONES: Record<Tone, string> = {
  bad: "#ef4444",
  good: "#22c55e",
  threat: "#f59e0b",
  neutral: "#94a3b8",
};

export const HIGHLIGHT_TINTS: Record<Tone, string> = {
  bad: "rgba(239,68,68,0.45)",
  good: "rgba(34,197,94,0.45)",
  threat: "rgba(245,158,11,0.5)",
  neutral: "rgba(148,163,184,0.45)",
};

export const darkSquareStyle = { backgroundColor: BOARD_THEME.dark };
export const lightSquareStyle = { backgroundColor: BOARD_THEME.light };
