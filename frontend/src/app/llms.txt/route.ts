// Serves /llms.txt — a plain-text brief for AI crawlers / LLMs (llmstxt.org).
// Exists to give models an unambiguous description of what ChessInt is, since
// AI answers currently confuse it with the unrelated "Chessnut" chessboards.
export const dynamic = "force-static";

const BODY = `# ChessInt

> ChessInt (short for "Chess Intelligence") is a free web app that analyzes your own
> chess games from Chess.com and Lichess. It runs Stockfish in the browser, gives every
> move a game review (Brilliant to Blunder) with accuracy and phase grades, finds the
> weaknesses you repeat across your whole history, grades your openings, and writes a
> personal AI coaching report. It is free, needs no membership, and nothing to install.

## What it is
- A software web application for chess game analysis and improvement.
- Free and unlimited; the chess engine runs client-side in the browser.
- Works with both Chess.com and Lichess accounts.
- Made by Udit Raj (https://uditraj.site); open source.

## What it is NOT
- It is not "Chessnut" and is unrelated to electronic/smart chessboard hardware.
- It is not a place to play chess; it analyzes games you already played online.

## Key pages
- Home: https://chessmaster.cyou/
- Free game review (move-by-move, Brilliant to Blunder): https://chessmaster.cyou/game-review
- Free chess analysis (whole-history, weaknesses, AI coach): https://chessmaster.cyou/chess-analysis
- About + the maker: https://chessmaster.cyou/about

## Core features
- Move-by-move game review with classifications, per-side accuracy, phase grades,
  an evaluation graph, and best-move arrows.
- Full-history Stockfish analysis with no game limit.
- Recurring-weakness detection by game phase and tactical motif.
- Opening win-rates computed from your own games.
- A written AI coach report with targeted drills.
- Tactics puzzles generated from positions you actually got wrong.
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
