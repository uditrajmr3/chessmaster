# Brief: ChessInt UX overhaul — design spec (planning only, no code)

Shell rule: use absolute paths and `git -C <repo>`. Never lead commands with `cd X && ...`.
Budget: stay under ~150k tokens. Skim pages with Grep and line-range Reads. Don't read whole large files twice. Don't explore outside the listed paths.

## Owner's words (verbatim, 2026-11-23)
"What about people who don't understand CPL? how about showing actual moves on a board instead of Played: Bc4 Best: Nxg6 and so on. You are showing data and that's good. but if it is not understandable enough, specifically for those not gifted with great minds then there's no point. we can improve openings, puzzles, weaknesses and endgame drills pages. same goes with time management and other pages in analysis. we can do much much better in terms of UI/UX. improve the whole site."

## Target user
A club or casual player, maybe rated 600–1500. Doesn't know CPL, ECO codes or engine jargon, and may not read algebraic notation fluently. Uses English, Hindi or Gujarati (next-intl; the en/hi/gu message files are under frontend/messages or similar, so grep). Every insight must be understandable in about 5 seconds and end in a concrete "do this next".

## Facts already measured (don't rediscover)
- Repo: /Users/uditrajmr3/Projects/chessmaster. Frontend: Next 16.1.6, Tailwind 4, react-chessboard ^5.10, chess.js ^1.4, recharts ^3.7. Dark brown/wood theme.
- Existing board components (reuse them): frontend/src/components/TeachingBoard.tsx, ReplayBoard.tsx, lessons/GuidedPlay.tsx. Today only puzzles/page.tsx and games/[id]/page.tsx render a board.
- App pages (frontend/src/app/(app)/…, line counts): openings 188, puzzles 476, weaknesses 308, endgame 311, time-management 397, tilt 294, rating-predictor 348, peer-comparison 257, digest 322, scouting 238, report 413, games/[id] 595. Also games, import, export, settings, position-analyzer, plus the dashboard (find it). The public Learn hub has jargon tooltips and a glossary already, so reuse those patterns.
- Backend data per move (backend/app/models.py `MoveAnalysis`): fen_before, move_uci/san, best_move_uci/san, eval_before/after, centipawn_loss, classification, game_phase, time_remaining, tactical_motifs. Analysis runs as Stockfish in the browser and is posted to /api/analyze/results.
- Accuracy is broken. No code computes accuracy from our own evals. The `games.platform_accuracy` field is only copied from chess.com/lichess: empty unless the user ran a chess.com review, and always empty for lichess because of a bug (lichess_client.py:103 reads the wrong path; the right one is players.<color>.analysis.accuracy). The stats.py:48 average uses only the few games that have it. Planned fix, to fold into your spec:
  - compute per-game accuracy with the Lichess win%-based formula from move_analyses
  - store it in a new `games.accuracy` column and backfill it
  - base the average on it, falling back to platform accuracy
  - show "based on N games"

## Deliverable
Write ONE spec file: /Users/uditrajmr3/Projects/chessmaster/docs/superpowers/specs/2026-11-23-ux-overhaul.md containing:
1. **Design principles** (5–8). Examples: show it on a board, plain words over metrics, one takeaway plus one action per card, progressive disclosure for the numbers.
2. **Shared components** to build first, each with props/behaviour and the pages that use it. Must include a "MistakeCard": a mini board at fen_before with an arrow for the played move (red) and the best move (green), a plain-language verdict like "This dropped your knight" or "You missed a fork", and a "Try it" mode where the user finds the best move. Also consider: a jargon→plain-language mapping (CPL → "how much each move cost you"), a "Your next step" CTA, empty/low-data states, and an accuracy badge.
3. **Per-page redesign** for every app page: the user's question the page answers, what is wrong today (specific, with file:line), the new layout, and the backend data needed (flag any new endpoint or field).
4. **Phased rollout.** Phases sized for one Sonnet subagent each (~1 page or 1 component per task), in priority order: highest user impact first, and the accuracy fix in phase 1. For each phase: files touched, acceptance checks, and the i18n keys needed (en/hi/gu).
5. **Open product questions** for the owner. Keep it to 5 or fewer, and only real decisions.

Don't write implementation code and don't commit. Return a ≤25-line summary: top principles, phase list, open questions.
