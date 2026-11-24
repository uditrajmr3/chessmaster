# ChessInt UX overhaul — design spec

Date: 2026-11-23 · Status: draft for owner review · Scope: planning only (no code in this document)
Brief: `docs/superpowers/briefs/2026-11-23-ux-overhaul-brief.md`

## 0. Summary

Today every analysis page answers "what are the numbers?" in engine vocabulary (CPL, cp, ECO, SAN). The target user (600–1500, may not read notation, en/hi/gu) needs "what did I do wrong, show me, what do I do next?".

The overhaul has three parts:

1. **Fix accuracy** so the one number users already understand is real (phase 1).
2. **Build a small shared kit** (board-based MistakeCard, plain-language verdicts, next-step CTA, low-data states, lexicon) once (phase 2).
3. **Re-lay every app page** on that kit, highest-traffic first (phases 3–16), extracting the hardcoded English into next-intl as each page is touched.

Facts this spec relies on (all verified in the repo):

| Fact | Where |
|---|---|
| No analysis page is translated. Only settings and the auth pages call `useTranslations` under `(app)`; the dashboard does too. | grep of `frontend/src/app/(app)` |
| The dashboard is the authenticated branch of `frontend/src/app/(public)/[locale]/page.tsx` (uses the `dashboard` namespace). | `page.tsx:17-36` |
| Message catalogs are `frontend/src/messages/{en,hi,gu}.json`. They are already out of step: en is 807 lines, hi and gu 791. | `wc -l` |
| The Lichess win%-based per-move accuracy formula already exists in the frontend. Game accuracy is a simple mean over one side's moves, skipping moves where either eval is null. (`CPL_CAP` at `:40` clamps CPL for the phase averages only; it is not part of accuracy.) | `games/[id]/page.tsx:100-112, 134-152` |
| Both players' moves are stored as `MoveAnalysis` rows (`is_player_move` flag), and the browser analysis sends `best_move_uci` for every ply, opponent's included. | `backend/app/services/analysis_ingest.py:56-57, 130`, `frontend/src/lib/types.ts:510-519`, `frontend/src/lib/analyze.ts:79-124` |
| The Lichess export request asks for `evals` but no accuracy parameter was found in the request params. | `backend/app/services/lichess_client.py:40-43` |
| `tactical_motifs` describe the **best move the player missed**, not what the played move allowed. Motifs in use: fork, pin, skewer, back_rank, discovered_attack. | `backend/app/services/tactical_detector.py:4-7`, `analysis_ingest.py:96-102` |
| Weaknesses "worst blunders" already carry `fen` (= `fen_before`) plus SAN for played and best move. | `backend/app/services/pattern_engine.py:338-346` |
| Time-management blunder rows have no FEN; endgame failures have a FEN but no move; opening rows have no move list. | `frontend/src/lib/types.ts:93-101, 192-210, 334-344` |
| Schema changes go through Alembic. | `backend/app/main.py:23`, `backend/alembic/versions/` |
| A jargon tooltip (`<Term>`) and an 18-term localized glossary exist. | `frontend/src/components/Term.tsx`, `frontend/src/lib/glossary.ts:8-27` |
| `BoardDiagram.tsx` is a static, server-renderable Unicode board (FEN + dots + origin square, no arrows). `TeachingBoard.tsx` is the interactive react-chessboard wrapper with arrows, dots, rings and drag handlers. | `BoardDiagram.tsx:1-5`, `TeachingBoard.tsx:26-57` |

---

## 1. Design principles

1. **Show it on a board.** Any reference to a specific move or position is drawn (position + arrows + highlighted squares). Notation is secondary text, never the primary carrier.
2. **Plain words first, numbers on request.** Lead with a sentence a 900-rated player would say ("You gave away a knight"). The metric (CPL, cp, %) sits behind a per-card "Show numbers" disclosure, with a `<Term>` tooltip.
3. **One takeaway, one action per card.** Each card states one finding and ends in exactly one button ("Practise 5 of these", "Replay this game"). No card is a dead end.
4. **Top of every page: the answer.** A single headline insight ("Your biggest leak: you rush moves when you have plenty of time") comes before any chart. Charts support the headline; they do not replace it.
5. **Cost in chess terms.** Express loss as material the user can picture ("about a pawn", "a whole piece", "the game") rather than centipawns; express frequency as "1 in 6 games" rather than rates to one decimal.
6. **Be honest about data.** Every aggregate says how many games it is based on. Below a threshold, show a low-data state that says what to do to unlock the insight instead of a noisy number.
7. **Truthful, deterministic explanations.** Verdict text comes from rules over stored data, never from an LLM, and only claims what the data proves ("your opponent can now take your knight", not "you lost because…"). The repo has already had to fix hallucinated coach text (`1b046d8`).
8. **Three languages or it is not done.** No new hardcoded English. A page is finished only when en/hi/gu keys exist and the parity test passes. Copy is written as ICU templates with parameters (piece, square, count), so hi/gu grammar can reorder.

---

## 2. Shared components (build before pages)

All paths are under `frontend/src/`. New components live in `components/insight/`; pure logic in `lib/`.

### 2.1 `MoveBoard` — `components/insight/MoveBoard.tsx`

A small, non-interactive board for showing one position with arrows.

- **Props:** `fen`, `orientation?: "white" | "black"` (default: side to move in `fen`), `arrows?: { from, to, tone: "bad" | "good" | "threat" | "neutral" }[]`, `highlights?: { square, tone }[]`, `size?: "sm" | "md"` (≈200 / 320 px), `ariaLabel` (required; a sentence describing the position's point).
- **Behaviour:** static render (no drag handlers, no engine). Tones map to fixed colours: bad = red, good = green, threat = amber. Arrow colours are never the only signal: the legend chip under the board repeats them in words ("You played" / "Better").
- **Implementation direction:** extend the approach in `BoardDiagram.tsx` (cheap, server-renderable) with an SVG arrow overlay, rather than mounting react-chessboard per card. Pages show grids of 6–8 cards; 8 react-chessboard instances on a low-end phone is the thing to avoid.
- **Used by:** MistakeCard (collapsed), openings, endgame, digest, scouting, dashboard.

### 2.2 `lib/verdict.ts` — plain-language verdict engine

Pure function, no network, no LLM. Fully unit-tested.

- **Input (`MistakeInput`):** `fen_before`, played move (UCI or SAN), best move (UCI or SAN), `refutation_uci?` (opponent's best reply to the played move), `eval_before?`, `eval_after?`, `centipawn_loss`, `tactical_motifs?`, `classification?`, `player_color`.
- **Output:** `{ primaryKey, primaryParams, secondaryKey?, secondaryParams?, cost: "small" | "pawn" | "piece" | "rook" | "game", highlights[], arrows[] }` — message keys plus parameters, never finished strings.
- **Gate:** the ladder runs only when the move is a real slip (classification is inaccuracy, miss, mistake or blunder, and the win% drop is at least 5 points). For any other move the engine returns a neutral result ("A good move" / "Fine") and no rule below is evaluated. This matters because game detail (5.3) calls it for every move.
- **Rule ladder (first match wins for the primary line; the next match may fill the secondary line):**
  1. Played move allows forced mate (mate score against the player in `eval_after`) → "This let your opponent checkmate you."
  2. Best move was checkmate or a forced mate → "You missed checkmate."
  3. A motif is present → "You missed a {motif}" (fork / pin / skewer / back-rank / discovered attack), each with a one-line explanation of the motif in the tooltip.
  4. `refutation_uci` is a capture of a piece worth a minor piece or more, **and** the measured loss is consistent with losing that piece (centipawn loss at least about two thirds of the piece's value, so an even trade does not trigger it) → "After this, your opponent can take your {piece}" + highlight that square.
  5. Best move was a capture the player did not make, with the same loss-consistency check → "You could have taken the {piece} on {square}."
  6. Fallback by cost: "A small slip" / "This cost you about a pawn" / "…about a piece" / "This turned the game."
- **Cost buckets.** Two separate things, so the card never overstates:
  - *Material size* (used in "cost you about a …"), from `centipawn_loss` capped as at `games/[id]/page.tsx:40`: under 80 small; 80–199 pawn; 200–449 piece; 450+ rook.
  - *"This turned the game"* is keyed to the win% drop (same `winPct` as `games/[id]/page.tsx:100-102`), not to CPL: it applies only when the player's winning chances fell by 30 points or more **and** crossed from at least even to worse. A big CPL in an already won or already lost position is reported by material size only. `puzzle_service.py` caps CPL for the same reason (`MAX_PUZZLE_CPL`).
  - If evals are null, use the material-size bucket alone.
  - These are display buckets only and do not change classification. Thresholds are starting values to tune against real games in phase 2d.
- **Wording rule:** copy uses piece names and highlighted squares, not SAN. SAN appears only inside "Show numbers".
- **Uses** chess.js (already a dependency) to resolve SAN to squares and identify the captured piece.
- **Used by:** MistakeCard, puzzles result panel, game detail move panel, digest highlights.

### 2.3 `MistakeCard` — `components/insight/MistakeCard.tsx`

The core unit of the overhaul. Replaces every "Played: Bc4 / Best: Nxg6 / −312 cp" row.

- **Props:** `mistake: MistakeInput & { game_id, move_number?, opponent?, date?, move_analysis_id? }`, `context?: ReactNode` (page-specific line, e.g. "Played in 2 seconds"), `defaultMode?: "view" | "try"`, `onSolved?(correct: boolean)`, `compact?: boolean`.
- **View mode (default):**
  - `MoveBoard` at `fen_before`, oriented to the player, red arrow = played move, green arrow = best move.
  - Verdict line (from `lib/verdict.ts`) in large text; cost chip ("cost: about a piece").
  - Meta line: "vs {opponent} · {date} · move {n}".
  - Two buttons: **Try it** and **See it in the game** (links to `/games/{id}?move={n}`).
  - "Show numbers" disclosure: played SAN, best SAN, centipawn loss with `<Term id="cpl">`, eval before/after.
- **Try mode:**
  - Arrows are hidden; the interactive `TeachingBoard` mounts only now (lazy), with drag and tap-to-move.
  - Prompt: "Your turn. Find a better move than the one you played."
  - Correct (matches best move): green flash, verdict text, "Next" callback.
  - Wrong: the piece returns, "Not quite" plus a hint ladder — first the piece to move is ringed, then the target square is dotted, then "Show answer". No penalty copy.
  - Validation is client-side against `best_move_uci` in v1 (see open question 1).
- **States:** loading skeleton; missing best move (render view mode without green arrow or Try button); illegal/corrupt FEN (fall back to the text-only row and report through the existing error notifier, never show an error to the user).
- **Accessibility:** board has `aria-label` from the verdict; every action is reachable by keyboard; tap targets ≥ 44 px.
- **Used by:** weaknesses, time-management, endgame, tilt (worst-session games), digest, dashboard ("mistake of the week"), game detail.

### 2.4 `lib/plain.ts` + `plain` namespace — jargon → plain-language lexicon

One source for how each metric is spoken about. Pages never write their own label for these.

| Internal | Plain label (en) | Value presentation |
|---|---|---|
| CPL / avg CPL | "How much each move cost you" / "Typical slip size" | A grade word (Excellent / Good / OK / Shaky / Costly) using the thresholds already at `games/[id]/page.tsx:114-118`; number only under "Show numbers" |
| centipawn loss on one move | "What this move cost" | Cost bucket from 2.2 |
| accuracy | "Accuracy" (kept; users know it from chess.com) | Percent + grade word + "based on N games" |
| blunder rate | "Big mistakes" | "1 in every N moves" or "N per game" |
| ECO code | (hidden) | Opening name only; code under "Show numbers" |
| conversion rate | "Winning positions you actually won" | "7 out of 10" |
| time trouble | "Low on clock" | Seconds/minutes in words |
| eval (+1.8) | "Who is ahead" | "You are ahead by about a piece" / bar |
| game phase | "Opening / Middle of the game / Endgame" | — |
| classification (inaccuracy/mistake/blunder/miss) | Kept, with `<Term>`; always paired with the cost bucket | — |

`lib/plain.ts` exports the threshold→grade and cp→cost helpers so wording is identical on every page. New glossary ids to add alongside the existing 18: `conversion`, `timeTrouble`, `fork`, `pin`, `skewer`, `backRank`, `discoveredAttack`, `eco`.

### 2.5 `InsightCard` — `components/insight/InsightCard.tsx`

- **Props:** `tone: "good" | "warn" | "bad" | "neutral"`, `headline` (one sentence), `detail?` (one sentence), `evidence?: ReactNode` (a chart, a MoveBoard, a mini stat), `basedOn?: number` (renders "based on N games"), `action?: NextStepProps`, `numbers?: ReactNode` (content of the "Show numbers" disclosure).
- **Behaviour:** enforces principle 3 structurally: one headline, one optional action. Tone drives an icon and a left border; colour is never the only signal.
- **Used by:** every analysis page; replaces most ad-hoc `surface-card` blocks and bare `<Stat>` rows.

### 2.6 `NextStep` — `components/insight/NextStep.tsx`

- **Props:** `label`, `href` or `onClick`, `reason?` (one line: "because 4 of your last 10 losses came from this"), `variant: "primary" | "inline"`.
- **Behaviour:** the single action for a card or page. The page-level variant renders as a sticky footer bar on mobile.
- **Standard destinations:** filtered puzzles (`/puzzles?motif=fork`, `/puzzles?phase=endgame`), a specific game at a move, a Learn lesson, "sync more games".
- **Used by:** all pages. Requires `/puzzles` to read `motif` and `phase` from the query string (today they are local state only, `puzzles/page.tsx:20-21`).

### 2.7 `LowData` — `components/insight/LowData.tsx`

- **Props:** `have: number`, `need: number`, `unit: "games" | "analyzedGames" | "gamesWithClock" | "endgames"`, `action?: NextStepProps`.
- **Behaviour:** three tiers — none (existing `EmptyState` from `ui/page-kit.tsx:37`), partial ("You have 4 analyzed games. We need 10 to spot patterns" with a progress bar from `ui/ProgressBar.tsx` and a preview of what unlocks), enough (renders children). Sections can be wrapped individually so a page degrades section by section.
- **Default thresholds:** page-level patterns 10 analyzed games; per-opening and per-endgame-type rows 5 games; trend lines 3 months.
- **Used by:** all analysis pages.

### 2.8 `AccuracyBadge` — `components/insight/AccuracyBadge.tsx`

- **Props:** `value: number | null`, `source: "chessint" | "platform" | null`, `basedOn?: number`, `size?: "sm" | "lg"`.
- **Grade thresholds (accuracy %, separate from the CPL grades):** 90+ Excellent; 80–89 Good; 70–79 OK; 60–69 Shaky; under 60 Costly. Starting values; exported from one helper so the badge, digest and peer comparison agree.
- **Behaviour:** percent + grade word + coloured ring; null renders "Not analyzed yet" with an analyze prompt instead of "—". Tooltip via `<Term id="accuracy">`. When `source` is platform, a small "from Chess.com/Lichess" note.
- **Used by:** dashboard, games list, game detail, digest, peer comparison.

### 2.9 `PageAnswer` — `components/insight/PageAnswer.tsx`

- **Props:** `question` (the user's question, small caps above), `answer` (headline sentence), `tone`, `action?`.
- **Behaviour:** the mandatory first block on every analysis page (principle 4). Each page computes its answer with a small pure selector (e.g. "largest gap between phases") that is unit-tested.

### 2.10 `ShowNumbers` — small disclosure primitive

Remembered per browser (localStorage, with try/catch) so an advanced user who opens it once keeps numbers open everywhere.

---

## 3. Accuracy fix (folded into phase 1)

**Problem.** No code computes accuracy from our own evals for lists or averages. `games.platform_accuracy` is copied from the platform: empty unless the user ran a chess.com review, and always empty for Lichess because `backend/app/services/lichess_client.py:100-104` reads `player_info.get("accuracy")` instead of `players.<color>.analysis.accuracy`. The dashboard average (`backend/app/routers/stats.py:48-49, 59`) therefore covers only a handful of games and does not say so.

**Design.**

1. **One formula, two implementations, one parity test.** Port the existing frontend calculation to a new backend module `backend/app/services/accuracy.py` and mirror it exactly: per-move accuracy as at `games/[id]/page.tsx:100-112` (constants `0.00368208`, `103.1668`, `0.04354`, `3.1669`; evals are from the player's perspective, and the drop is measured as written there); game accuracy = simple mean over the player's own moves, skipping any move where `eval_before` or `eval_after` is null (`:134-152`); null if no move qualifies (the frontend shows 0 in that case; the backend stores null so the UI can say "Not analyzed yet"). No extra clamp is applied; mate scores saturate through the win% curve. A shared fixture (a list of evals with the expected result) is checked by a pytest test and a jest test so the two cannot drift.
2. **Storage.** New nullable `games.accuracy` (Float) via an Alembic migration. Written in `analysis_ingest.py` when results are posted to `/api/analyze/results`.
3. **Backfill.** New script `backend/app/scripts/backfill_accuracy.py`, modelled on `scripts/retag_motifs.py`: idempotent, `--dry-run`, batch commits, prints a count. **Running it against production touches live data and needs the owner's go-ahead.**
4. **Lichess fix.** Correct the path in `lichess_client.py:100-104`; extend `backend/tests/test_lichess_client.py`. Also check the export request (`lichess_client.py:40-43`): it sends `evals` but no accuracy parameter was found, and the Lichess games export is believed to omit accuracy unless it is requested. Confirm against the Lichess API documentation in the task; without this the path fix can pass its fixture and still return nothing in production.
5. **Average.** `stats.py` uses `accuracy`, falling back to `platform_accuracy` per game; `OverviewStats` gains `accuracy_games: int` (games that contributed).
6. **API.** `GameSummary` and `GameDetail` gain `accuracy: number | null` and `accuracy_source: "chessint" | "platform" | null`.
7. **Display.** Dashboard stat (`(public)/[locale]/page.tsx:70-73`) and games list column (`games/page.tsx:97, 131-132`) use `AccuracyBadge` with "based on N games". The game detail page keeps computing live from moves; the parity test guarantees the list and the detail agree.

Note: Lichess's own game accuracy uses a volatility-weighted and harmonic mean, so our number can differ slightly from the one shown on lichess.org. Parity with our own detail page matters more; the tooltip says "calculated by ChessInt".

---

## 4. Shared backend change: one "mistake" payload

Several endpoints return a mistake in different, incomplete shapes. Define one schema (`MistakeOut` in `backend/app/schemas.py`) and use it everywhere a specific move is surfaced:

`move_analysis_id, game_id, move_number, player_color, fen_before, move_uci, move_san, best_move_uci, best_move_san, refutation_uci, eval_before, eval_after, centipawn_loss, classification, game_phase, tactical_motifs, time_spent?, time_remaining?, opponent, played_at`

- **`refutation_uci` (new, derived, not stored):** the `best_move_uci` of the next ply's `MoveAnalysis` row in the same game (the opponent's move, whose `fen_before` is the position after the player's move). Null if that row is missing. This is what makes "your opponent can now take your knight" provable.
- **Endpoints to move onto it:**

| Endpoint | Field | Gap today |
|---|---|---|
| `/patterns` | `example_positions` | no UCI, move number, evals or refutation (`pattern_engine.py:338-346`) |
| `/time-management` | `underthink_blunders`, `overthink_moves` | no FEN at all (`types.ts:192-210`) |
| `/endgame` | failures | FEN only, no move (`types.ts:334-344`); add `key_mistake: MistakeOut \| null` = the player's highest-loss endgame move in that game |
| `/digest` | highlights | to confirm in phase; add `mistake: MistakeOut \| null` for the worst move of the period |
| `/tilt` | worst sessions | add `worst_move: MistakeOut \| null` per session |
| `/puzzles/next` | puzzle | add `refutation_uci`, `eval_before`, `eval_after` |

Old fields stay during rollout (additive change), and are removed in the cleanup phase.

---

## 5. Per-page redesign

Format per page: **Q** (the user's question) · **Wrong today** · **New layout** · **Data**.
All paths are `frontend/src/app/(app)/<page>/page.tsx` unless noted. Every page also gets: `PageAnswer` first, `LowData` wrapping, string extraction to its own namespace, and one page-level `NextStep`.

### 5.1 Weaknesses (308 lines) — rename in nav to "My mistakes" (see open question 3)

- **Q:** "What do I keep getting wrong?"
- **Wrong today:**
  - `:243-251` — the exact pattern the owner called out: "−312 cp", "Played: **Bc4**", "Best: **Nxg6**", with a FEN available in the payload and never drawn.
  - `:87` — chart titled "Accuracy by Game Phase (Avg CPL)": two metrics in one title, and the bars are CPL (lower is better) under the word accuracy.
  - `:194, :204` — "avg CPL" for white/black.
  - `:130` "Tactical Blind Spots" lists motif counts with no example and no way to practise them.
  - No headline; five equal-weight cards (`:86-229`).
- **New layout:**
  1. `PageAnswer`: the single biggest leak, chosen from: worst phase, most-missed motif, low-clock blunders, colour gap, endgame conversion.
  2. "Your most costly mistakes" — grid of `MistakeCard` (6), replacing `:225-262`.
  3. "Tactics you miss most" — one `InsightCard` per motif with a count in words ("You missed 14 forks"), a one-line definition, one example `MoveBoard`, action "Practise forks" → `/puzzles?motif=fork`.
  4. "Where in the game it goes wrong" — three phase tiles with grade words instead of the CPL bar chart; chart available under "Show numbers".
  5. "Other patterns" — low-clock impact, colour, endgame conversion as three `InsightCard`s, each linking to its dedicated page.
- **Data:** `/patterns.example_positions` → `MistakeOut`. Add `motif_examples: Record<motif, MistakeOut>` (one example per motif). Add `games_analyzed: int` for "based on N games".

### 5.2 Puzzles (476 lines)

- **Q:** "Can I fix the mistakes I actually made?"
- **Wrong today:**
  - `:301` — after solving: "You played Bc4 in the original game (CPL: 312)". Notation plus jargon at the moment of learning.
  - `:406` — raw `centipawn_loss` shown as a stat.
  - `:254` — "Accuracy" here means solve rate, which collides with game accuracy elsewhere.
  - Uses a bare `Chessboard` (`:307`) with its own move/arrow handling rather than the shared board; filters are local state only (`:20-21`), so no other page can deep-link "practise forks".
  - No explanation of *why* the best move is best.
- **New layout:**
  1. Header strip: "Puzzles from your own games" + streak + "N waiting for review today" (plain wording of `due_for_review`).
  2. Board with a context line above it: "From your game vs {opponent}. You are {colour}. Find a better move than you played."
  3. Hint ladder (same as MistakeCard try mode).
  4. Result panel: verdict from `lib/verdict.ts`, then a two-board replay — "What you played" (red arrow, then the refutation as an amber arrow) and "The better move" (green arrow). Cost bucket instead of CPL.
  5. Rename the stat to "Solved first try". Progress by motif shown as plain bars with "Practise" links.
- **Data:** `/puzzles/next` + `refutation_uci`, `eval_before`, `eval_after`. Page reads `?motif=` and `?phase=`.

### 5.3 Game detail — `games/[id]/page.tsx` (595 lines)

- **Q:** "What happened in this game, and where did I lose it?"
- **Wrong today:**
  - `:437` — phase rows end in "`42 cpl`".
  - `:532-533` — "Centipawn loss" field (it does use `<Term>`, the right pattern, but still leads with the number).
  - `:33-38` — ten classification chips with symbols ("?!") and no guidance on which matter.
  - No "the moment the game turned" summary was found in the sections read (`:400-455`, `:516-533`); confirm in phase before building one.
- **New layout:**
  1. `PageAnswer`: result + one sentence ("You were winning until move 23, then lost a rook").
  2. "Key moments" — up to 3 `MistakeCard`s (largest win% drops by the player), each jumping the main board to that move.
  3. Main replay board unchanged in function; the per-move panel leads with the verdict line and cost bucket, numbers under "Show numbers".
  4. Phase grades keep the words (already present at `:114-118`), drop the `cpl` suffix.
  5. Classification chips collapsed to three groups: "Good moves", "Slips", "Big mistakes"; full ten-way breakdown on expand.
  6. Support `?move=N` to open at a specific move (target of "See it in the game").
- **Data:** none new (`GameDetail.moves` has everything; refutation is the next row). Add `accuracy` fields from section 3.

### 5.4 Time management (397 lines)

- **Q:** "Am I using my clock well?"
- **Wrong today:**
  - `:113` and `:136-146` — dual-axis chart "time spent vs move number, with centipawn loss overlay"; a second axis labelled "CPL".
  - `:238-239`, `:265-275` — "Avg CPL" per pressure zone and per time control.
  - `:327-351` — "Rushed Blunders" as text rows: "#14 Bc4 best: Nxg6 −312 cp 2s". The page's most actionable content has no board, and the payload has no FEN to draw one.
  - `:299` "Overthinking Book Moves" assumes the user knows what a book move is.
- **New layout:**
  1. `PageAnswer`: one of "You rush" / "You run out of time" / "You burn time early" / "Your clock use is fine", with the number that proves it in words ("9 of your 20 biggest mistakes were played in under 5 seconds").
  2. "Moves you rushed" — `MistakeCard` grid with `context` = "Played in 2 seconds, with 4:10 left".
  3. "When the clock is low" — three zone tiles (plenty / getting low / almost out) with "big mistakes: 1 in N moves" instead of Avg CPL.
  4. "Where your time goes" — single-axis chart (seconds per move by move number), a shaded band for typical pace; the CPL overlay moves under "Show numbers".
  5. "Time you could save" — plain rewrite of overthinking ("You spent over a minute on moves you already know").
  6. Per-time-control table → cards with grade words.
- **Data:** `underthink_blunders` and `overthink_moves` → `MistakeOut` with `time_spent` and `time_remaining` (new: FEN, UCI, refutation, evals). Add `rushed_share: { rushed: int, total: int }` for the headline.

### 5.5 Endgame (311 lines)

- **Q:** "Do I win the games I should win?"
- **Wrong today:**
  - `:95-97` — "Avg Endgame CPL" as a headline stat, coloured by a 40-cp threshold.
  - `:174-176`, `:243-245` — "Avg CPL" per type and per failed game.
  - `:210` "Worst Conversion Failures" lists games as text though each row has a FEN (`types.ts:343`).
  - Page is called "Endgame Drills" (`:69`) but contains no drill.
  - "Conversion" is unexplained.
- **New layout:**
  1. `PageAnswer`: "You won 6 of the 10 endgames where you were clearly ahead."
  2. "Endgames you let slip" — per failed game: `MoveBoard` at the position where the endgame began ("You were ahead by about a rook here") + the `key_mistake` as a `MistakeCard`.
  3. "By type" — cards per endgame type (rook, pawn, minor piece…) with a small icon position, "won X of Y", grade word, and action "Practise rook endgames" → `/puzzles?phase=endgame` (+ type filter if added) or the Learn endgame lesson.
  4. An actual drill entry point: "Play it out" opens the starting position of a slipped endgame in the existing `GuidedPlay` flow against the bot (phase 7b; optional, see data).
- **Data:** failure rows gain `key_mistake: MistakeOut | null` and `player_color`. "Play it out" needs `GuidedPlay` to accept a starting FEN (component change, no backend).

### 5.6 Openings (188 lines)

- **Q:** "Which openings work for me, and which should I stop playing or study?"
- **Wrong today:**
  - `:53`, `:77` — ECO code is the first column, in accent colour, the most prominent cell.
  - `:58`, `:97`, `:147` — "Avg CPL" column.
  - `:36` — subtitle promises an "opening tree"; the page is a flat table with no moves and no board.
  - No verdict per opening; the user has to compare win rates themselves. No small-sample guard (an opening played twice looks like 100%).
- **New layout:**
  1. `PageAnswer`: best and worst opening with ≥5 games ("You score best with the Italian Game; you struggle against the Sicilian").
  2. Two tabs: "As White" / "As Black".
  3. Opening cards: `MoveBoard` of the opening position, name, "played N times", a win/draw/loss bar, a verdict chip (Keep playing / Needs work / Too few games), and one action ("See where you go wrong" → the earliest common mistake as a `MistakeCard`; or "Learn the idea" where a Learn page exists).
  4. ECO and CPL under "Show numbers".
- **Data:** `/openings/tree` rows gain `color`, `sample_moves_san: string[]` (first ~8 plies from one representative game, to draw the position) and `first_mistake: MistakeOut | null` (highest-loss opening-phase player move across that opening's games). `/opening-book` (`backend/app/routers/opening_book.py:26`) exists and is not used by this page; evaluate reusing it for the repertoire view before adding fields.

### 5.7 Dashboard — `frontend/src/app/(public)/[locale]/page.tsx` (authenticated branch)

- **Q:** "How am I doing, and what should I do today?"
- **Wrong today:**
  - `:70-73` — average accuracy is usually "N/A" or based on a few games with no caveat (section 3).
  - `:63-74` — four KPI tiles and a rating chart; nothing tells the user what to do next. FIDE estimates (`:85-100`) take prime space for a casual player.
- **New layout:**
  1. Greeting + "Today's focus": one `InsightCard` chosen from the weaknesses selector, with one action.
  2. "Mistake of the week": one `MistakeCard` in try mode.
  3. KPI strip: games, win rate, `AccuracyBadge` (based on N), rating change this month.
  4. Rating chart (kept).
  5. Three shortcut tiles: Puzzles waiting, Latest game review, Coach report.
  6. FIDE estimates moved below, collapsed.
- **Data:** `OverviewStats.accuracy_games`; a small `GET /stats/focus` returning `{ insight_key, params, mistake: MistakeOut | null, puzzles_due }` (new endpoint) so the dashboard does not have to call four reports.

### 5.8 Tilt (294 lines)

- **Q:** "Do I play worse when I'm on a losing run, and when should I stop?"
- **Wrong today:**
  - "Tilt" is poker slang; `:112` "Blunder Rate by Consecutive Losses" is a chart title, not a finding.
  - `:88-103` — four streak statistics lead the page; none is actionable.
  - `:226-235` — each session game is a thin coloured bar whose detail ("Game 3: loss (12% blunders)") lives in a hover `title`, unreachable on touch screens; result is carried by colour alone.
- **New layout:**
  1. `PageAnswer`: a personal stop rule — "After 2 losses in a row you make twice as many big mistakes. Take a break after 2." (or "Losing streaks don't change your play. Nice.")
  2. Evidence chart: big mistakes per game after 0 / 1 / 2 / 3+ losses, with the stop point marked.
  3. "Your roughest sessions" — session timeline as tappable result dots; expanding shows the session's `worst_move` as a `MistakeCard`.
  4. Streak stats moved to a secondary row.
- **Data:** add `stop_after: int | null` and `multiplier: float | null` to the report; `worst_move: MistakeOut | null` per session.

### 5.9 Weekly digest (322 lines)

- **Q:** "How was my week?"
- **Wrong today:**
  - `:82-84`, `:163-165` — "Avg CPL" as a headline stat and as the improvement metric.
  - `:197` — ECO code in the openings list.
  - `:236` — "Full Digest" dumps the backend's preformatted text (`digest_service.py:213-241`, which contains "Average CPL"), English only.
- **New layout:**
  1. `PageAnswer`: "A better week: you won more and made fewer big mistakes."
  2. Three "this week vs last week" tiles with arrows and words (wins, accuracy, big mistakes per game).
  3. "Best moment" and "Moment to learn from" — a `MoveBoard` and a `MistakeCard`.
  4. Openings this week (names + W/D/L bars).
  5. "This week's goal": one `NextStep`.
  6. Remove the raw text block; keep a "Copy summary" action built from translated strings.
- **Data:** `DigestAccuracy` gains `accuracy` and `accuracy_games`; highlights gain `mistake: MistakeOut | null` and `best: MistakeOut | null`.

### 5.10 Rating predictor (348 lines)

- **Q:** "Am I improving, and when will I reach my next milestone?"
- **Wrong today:**
  - `:228-230` — "Weakness Trends: Average CPL by game phase over time. Lower is better." The need to explain direction is the tell.
  - `:117` — "Rate / Month".
  - `:277` — monthly breakdown table as the closing content; no action.
  - Projections shown without uncertainty.
- **New layout:**
  1. `PageAnswer`: "At your current pace you'll reach 1200 around March" + honest caveat ("based on 4 months of games; treat as a rough guide").
  2. Rating chart with the projection drawn as a shaded cone and milestones as flags.
  3. "What's improving / what's stuck" — three phase tiles with trend words (Improving / Steady / Slipping) replacing the CPL line chart.
  4. `NextStep`: the stuck phase's practice link.
  5. Monthly table under "Show numbers".
- **Data:** none required; optional `projection_low/high` per milestone for the cone.

### 5.11 Peer comparison (257 lines)

- **Q:** "How do I compare with players at my level?"
- **Wrong today:**
  - `:59` — metric names contain "CPL" (line-broken for the chart axis).
  - `:89-90` — "Rating Band", "Avg Rating" as lead stats.
  - `:163` "Full Comparison" table; mixed-direction metrics (higher is better for some, lower for others) on one chart.
- **New layout:**
  1. `PageAnswer`: "Compared with other 1000–1200 players: your openings are stronger, your endgames are weaker."
  2. One row per metric: plain label, a "you vs typical" slider with a marker, and a word (Ahead / About the same / Behind). All rows normalised so right = better.
  3. Two lists: "Your edge" and "Where others are ahead", each item with a `NextStep`.
  4. State where the peer numbers come from in one line.
- **Data:** each `PeerMetric` gains `key` (stable id for translation, replacing the English `metric` string) and `higher_is_better: bool`.

### 5.12 Opponent scout (238 lines)

- **Q:** "What will this opponent play, and how should I prepare?"
- **Wrong today:**
  - `:205` — ECO codes; `:177-205` — a dense cross-reference table the user must interpret.
  - No board, no preparation advice.
- **New layout:**
  1. Search form (kept).
  2. `PageAnswer`: "They usually open with 1.e4 and play the Italian. You score well against it."
  3. "Expect this" — top 3 openings per colour as `MoveBoard` cards with "they play this in N of 10 games" and your own record against it in words.
  4. "Your plan" — one `NextStep` per colour.
- **Data:** opponent openings gain `sample_moves_san`.

### 5.13 AI coach report (413 lines)

- **Q:** "What would a coach tell me?"
- **Wrong today:**
  - `:379-391` — a markdown renderer over a long generated document; no structure the UI can act on, no boards, and length works against the 5-second rule.
  - No locale handling was found in `report_generator.py` (grep for locale/language returned nothing), so the report is presumably English only; confirm in phase.
- **New layout:**
  1. "Three things to work on" — the report's top items as `InsightCard`s, each with an example `MistakeCard` and a `NextStep`.
  2. Full report below, collapsed by section.
  3. Positions cited in the report render as `MoveBoard`s (the generator already receives `example_positions`, `report_generator.py:148`).
- **Data:** report generation returns a structured block alongside the prose: `priorities: [{ title, why, action_key, example_move_analysis_id }]`; pass the user's locale to the generator. Expected to be a prompt and schema change stored with the existing report row; confirm in phase that the `Report` model can hold it without a migration.

### 5.14 Games list — `games/page.tsx` (200 lines)

- **Q:** "Which game should I look at?"
- **Wrong today:** `:97, :131-132` — Accuracy column is mostly empty (section 3). No signal for which games are worth reviewing.
- **New layout:** `AccuracyBadge` per row; a "Worth a look" chip on games with a large swing (lost from a winning position, or won from a losing one); un-analyzed rows show "Analyze" instead of a dash; mobile rows become cards.
- **Data:** `accuracy`, `accuracy_source`; `review_flag: "threw_win" | "comeback" | null`.

### 5.15 Position analyzer (568 lines)

- **Q:** "What should I play in this position?"
- **Wrong today:** `:470` — the answer is given as text, "Best move: {san}", so a user who cannot read notation gets nothing from it. The page already attaches a plain reason (`:471-477`, rule title and "why" from `lib/coach.ts`), which is the right pattern and should be kept. Whether the board already draws the move as an arrow was not checked; confirm in phase.
- **New layout:** the best move drawn as a green arrow on the board, the sentence leading with piece and square names ("Move your knight to f3") and the existing reason beneath; SAN under "Show numbers". Paywall/BYOK flow unchanged.
- **Data:** none expected; confirm during the phase.

### 5.16 Import, Export, Settings

- **Import (152)** — Q: "How do I add games that aren't on my account?" `:44-45` — title "Import PGN" and subtitle "…for OTB games or other platforms" use two unexplained abbreviations. Retitle "Add games from a file", explain PGN in one line, add a three-step explainer and an after-import `NextStep` ("Analyze these N games").
- **Export (171)** — Q: "Can I take my data elsewhere?" `:80` describes the file as "CPL, classifications, evaluations" and `:112-113` shows "Avg CPL". Reword in plain terms; this page is for advanced users, so numbers stay visible.
- **Settings (220)** — already translated; no line-level finding (not read for this spec). Add the global "Always show numbers" preference (backs `ShowNumbers`).

### 5.17 Out of scope

Auth pages (login, register, verify-email, forgot/reset password), the public Learn hub, awards, and landing/marketing pages. The sidebar is touched only for label changes agreed under open question 3.

---

## 6. Phased rollout

Each numbered task is sized for one Sonnet subagent. Every task ends with: `npm test` and `npm run lint` and `npm run build` in `frontend/` (and `pytest` in `backend/` when backend files change), plus a manual check at 390 px width in en, hi and gu.

i18n convention: one namespace per page (camelCase page name) plus the shared namespaces created in phase 2. Keys below are listed for en; **hi and gu must be added in the same task**. Shared ICU parameters: `{piece}`, `{square}`, `{count}`, `{opponent}`, `{n}`.

### Phase 1 — Accuracy fix (highest trust impact)

| Task | Files | Acceptance | i18n keys |
|---|---|---|---|
| **1a** Accuracy module + storage | `backend/app/services/accuracy.py` (new), `backend/app/models.py`, new Alembic revision, `backend/app/services/analysis_ingest.py`, `backend/tests/test_accuracy.py` (new), shared fixture JSON, `frontend/src/__tests__/accuracy-parity.test.ts` (new) | Fixture passes in both pytest and jest; posting analysis results sets `games.accuracy`; migration upgrades and downgrades cleanly | — |
| **1b** Lichess path + average + API | `backend/app/services/lichess_client.py`, `backend/app/routers/stats.py`, `backend/app/routers/games.py`, `backend/app/schemas.py`, `backend/tests/test_lichess_client.py`, `frontend/src/lib/types.ts` | Lichess fixture with `players.white.analysis.accuracy` populates `platform_accuracy`; the export request is confirmed (against Lichess API docs) to ask for accuracy, and one real analysed Lichess game returns a non-null value; `/stats/overview` returns `accuracy_games`; a game with both values reports `accuracy_source = "chessint"` | — |
| **1c** Backfill script | `backend/app/scripts/backfill_accuracy.py` (new), test | `--dry-run` writes nothing and prints a count; second real run changes 0 rows. **Prod run only after owner approval.** | — |
| **1d** AccuracyBadge + wire-up | `components/insight/AccuracyBadge.tsx` (new, includes the accuracy→grade helper), `(public)/[locale]/page.tsx`, `games/page.tsx`, messages | Dashboard shows "based on N games"; games list shows a value for every analyzed game; list value equals detail-page value for the same game (±0.1). This task creates the `plain` namespace with only the keys listed here; 2a/2b extend it. | `plain.accuracy.{label, basedOn, notAnalyzed, fromPlatform, byChessInt}`, `plain.grade.{excellent, good, ok, shaky, costly}` |

### Phase 2 — Shared kit

| Task | Files | Acceptance | i18n keys |
|---|---|---|---|
| **2a** i18n groundwork | `frontend/src/messages/{en,hi,gu}.json`, `frontend/src/__tests__/messages-parity.test.ts` (new) | Parity test fails on any key present in one catalog and missing in another; existing en-only drift (807 vs 791 lines) resolved | Namespaces created: `plain`, `verdict`, `pieces`, `motif`, `nextStep`, `lowData`, `mistakeCard` |
| **2b** Lexicon | `lib/plain.ts` (new) + test, `lib/glossary.ts`, messages | cp→cost and CPL→grade helpers unit-tested at every boundary; 8 new glossary ids render in `/learn/glossary` | `plain.cost.{small, pawn, piece, rook, game}`, `plain.label.{moveCost, slipSize, bigMistakes, conversion, lowClock, ahead, behind, even}`, `plain.phase.{opening, middlegame, endgame}`, `plain.perGames`, `glossary.{conversion, timeTrouble, fork, pin, skewer, backRank, discoveredAttack, eco}.{term, short}` |
| **2c** MoveBoard | `components/insight/MoveBoard.tsx` (new) + test | Renders FEN with red/green/amber arrows and highlights; orientation follows side to move by default; 8 boards on one page stay smooth on a mid-range phone; legend text present; square colours and piece style match the interactive board closely enough that switching a MistakeCard to Try mode does not visibly change the board (if Unicode glyphs cannot achieve this, use the same piece set as react-chessboard as static images) | `mistakeCard.legend.{played, better, threat}` |
| **2d** Verdict engine | `lib/verdict.ts` (new), `src/__tests__/verdict.test.ts` (new) | One fixture per ladder rule plus fallbacks; never throws on bad FEN (returns fallback); output contains keys and params only, no English | `verdict.{allowsMate, missedMate, missedMotif, hangsPiece, missedCapture, smallSlip, costPawn, costPiece, turnedGame}`, `pieces.{pawn, knight, bishop, rook, queen, king}`, `motif.{fork, pin, skewer, backRank, discoveredAttack}.{name, explain}` |
| **2e** MistakeCard | `components/insight/MistakeCard.tsx` (new) + test, `components/insight/ShowNumbers.tsx` (new) | View mode shows both arrows and a verdict; Try mode hides arrows, accepts the best move, runs the 3-step hint ladder; interactive board is not mounted until Try is pressed; works by keyboard; missing best move degrades without error | `mistakeCard.{tryIt, seeInGame, yourTurn, correct, notQuite, hintPiece, hintSquare, showAnswer, next, meta, showNumbers, hideNumbers, played, best, playedIn}` |
| **2f-1** InsightCard + PageAnswer | `components/insight/InsightCard.tsx`, `PageAnswer.tsx` (new) + tests | All four tones render with icon + border (not colour alone); "based on N games" appears when `basedOn` is set; at most one action | `plain.basedOn` |
| **2f-2** NextStep | `components/insight/NextStep.tsx` (new) + test | Primary and inline variants; sticky mobile variant does not cover content; links carry query params for puzzles | `nextStep.{practise, practiseMotif, practisePhase, reviewGame, learn, syncMore, analyzeMore}` |
| **2f-3** LowData | `components/insight/LowData.tsx` (new) + test | Three tiers; partial tier shows progress and what unlocks; can wrap a single section | `lowData.{none, partial, unlocks, units.games, units.analyzedGames, units.gamesWithClock, units.endgames}` |
| **2g** `MistakeOut` schema + refutation helper | `backend/app/schemas.py`, `backend/app/services/mistake_payload.py` (new), tests | Helper returns `refutation_uci` from the next ply and null at game end; user scoping preserved (no cross-user rows) | — |

### Phases 3–16 — Pages (priority order)

Phases 9–11 and 13–16 each run as two tasks, like 3–8: **a** = the backend/API files in the "Files" column (with tests and `types.ts`), **b** = the page and its messages. Phase 16b is four tasks, one page each. Rows are kept merged below only to keep the table readable.

| Phase | Page | Files (besides the page and messages) | Acceptance | Namespace and keys |
|---|---|---|---|---|
| **3a** | Weaknesses — backend | `backend/app/services/pattern_engine.py`, `schemas.py`, `types.ts`, tests | `example_positions` are `MistakeOut`; `motif_examples` has one entry per motif present; old fields still returned | — |
| **3b** | Weaknesses — UI | — | No "CPL", "cp", "Played:", "Best:" visible by default; 6 MistakeCards with boards; each motif card links to `/puzzles?motif=…`; headline changes with data (selector unit-tested) | `weaknesses.{title, question, answer.phase, answer.motif, answer.clock, answer.color, answer.endgame, costly.title, motifs.title, motifs.count, phases.title, other.title, clock.body, color.body, endgame.body}` |
| **4a** | Puzzles — backend + deep links | `backend/app/services/puzzle_service.py`, `schemas.py`, `types.ts` | `/puzzles/next` returns refutation + evals; `/puzzles?motif=fork&phase=endgame` preselects filters | — |
| **4b** | Puzzles — UI | — | Result panel shows verdict + two-board replay, no CPL; stat reads "Solved first try"; hint ladder works; spaced-repetition submit unchanged | `puzzles.{title, intro, context, due, streak, solvedFirstTry, result.youPlayed, result.better, result.why, filters.phase, filters.motif, empty, allDone, progress.title}` |
| **5** | Game detail | — | `?move=N` opens at that move; up to 3 key-moment cards; per-move panel leads with verdict; no "cpl" suffix on phase rows; chips grouped into three | `gameDetail.{answer.won, answer.lost, answer.drew, turningPoint, keyMoments, phases.title, groups.good, groups.slips, groups.big, notAnalyzed, analyze}` |
| **6a** | Time management — backend | `backend/app/services/time_management_service.py`, `schemas.py`, `types.ts`, tests | Rushed/overthink rows are `MistakeOut` with `time_spent`, `time_remaining`; `rushed_share` returned | — |
| **6b** | Time management — UI | — | Headline is one of four states; rushed mistakes are MistakeCards with clock context; no dual-axis chart by default; no "CPL" visible by default | `timeManagement.{title, question, answer.rush, answer.runOut, answer.burnEarly, answer.fine, rushed.title, rushed.context, zones.title, zones.plenty, zones.low, zones.critical, pace.title, save.title, save.body, byControl.title}` |
| **7a** | Endgame — backend | `backend/app/services/endgame_service.py`, `schemas.py`, `types.ts`, tests | Failures include `key_mistake` and `player_color` | — |
| **7b** | Endgame — UI | (optional) `components/lessons/GuidedPlay.tsx` for a starting-FEN prop | "Won X of Y" headline; each slipped endgame shows a board; type cards have a practise link; "Avg CPL" not visible by default | `endgame.{title, question, answer, slipped.title, slipped.ahead, types.title, types.won, type.rook, type.pawn, type.minor, type.queen, type.mixed, playItOut}` |
| **8a** | Openings — backend | `backend/app/services/opening_service.py`, `routers/openings.py`, `types.ts`, tests | Rows include `color`, `sample_moves_san`, `first_mistake` | — |
| **8b** | Openings — UI | — | Board on every card; ECO hidden by default; openings with fewer than 5 games show "Too few games" and are excluded from the headline; White/Black tabs | `openings.{title, question, answer.best, answer.worst, tabs.white, tabs.black, played, verdict.keep, verdict.work, verdict.few, whereWrong, learnIdea}` |
| **9** | Dashboard | `backend/app/routers/stats.py` (`/stats/focus`), `schemas.py`, `lib/api.ts`, `types.ts` | "Today's focus" card with one action; mistake of the week in try mode; FIDE block collapsed; single extra request | `dashboard.{focus.title, focus.none, mistakeOfWeek, shortcuts.puzzles, shortcuts.lastGame, shortcuts.coach, ratingThisMonth, fide.show}` |
| **10** | Tilt | `backend/app/services/tilt_detector.py`, `schemas.py`, `types.ts` | Stop rule headline (or the "no effect" variant); session dots tappable on touch; no information available only via `title` hover | `tilt.{title, question, answer.stopAfter, answer.noEffect, chart.title, chart.after, sessions.title, session.summary, streaks.title}` |
| **11** | Digest | `backend/app/services/digest_service.py`, `schemas.py`, `types.ts` | No raw text block; week-vs-week tiles in words; one MistakeCard; summary copy is translated | `digest.{title, question, answer.better, answer.same, answer.worse, vsLast.wins, vsLast.accuracy, vsLast.bigMistakes, bestMoment, learnMoment, openings.title, goal.title, copySummary, period}` |
| **12** | Rating predictor | (optional) `backend/app/services/rating_predictor.py` for the cone | Headline with date + caveat; trend words replace CPL lines; table under Show numbers | `ratingPredictor.{title, question, answer.onTrack, answer.flat, answer.falling, caveat, milestone, trend.improving, trend.steady, trend.slipping, monthly.title}` |
| **13** | Peer comparison | `backend/app/services/peer_comparison.py`, `schemas.py`, `types.ts` | All rows read right = better; metric labels come from keys, not backend English | `peerComparison.{title, question, answer, ahead, same, behind, edge.title, gap.title, source, metric.<key>}` |
| **14** | Opponent scout | `backend/app/services/scouting_service.py`, `types.ts` | Top openings shown on boards; one plan per colour; ECO hidden by default | `scouting.{title, question, answer, expect.title, frequency, yourRecord, plan.white, plan.black, form.username, form.platform, form.submit, empty, notFound}` |
| **15** | AI coach report | `backend/app/services/report_generator.py`, `routers/report.py`, `types.ts` | Three priority cards above the prose; cited positions render as boards; report language follows locale; old reports without `priorities` still render | `report.{title, priorities.title, fullReport, generate, generating, quota, empty.title, empty.body}` |
| **16a** | Games list | `backend/app/routers/games.py`, `types.ts` | "Worth a look" chips; mobile card layout; Analyze prompt on un-analyzed rows | `games.{title, worthALook.threwWin, worthALook.comeback, analyze, columns.*}` |
| **16b** | Position analyzer, Import, Export, Settings | — | Analyzer result on a MoveBoard; Export copy reworded; "Always show numbers" setting persists | `positionAnalyzer.*` (extraction), `import.*`, `export.*`, `settings.alwaysShowNumbers` |
| **17** | Cleanup | backend schemas, `types.ts`, `Sidebar.tsx` labels (if approved) | Deprecated payload fields removed; a repo-wide grep for hardcoded "CPL" in `(app)` returns only Show-numbers/export contexts; parity test green | `nav.*` updates if renames are approved |

### Rollout notes

- Phases 1 and 2 are prerequisites. Phases 3–16 are independent of each other after that and can be reordered.
- Backend changes are additive until phase 17, so frontend and backend can deploy separately.
- Hindi and Gujarati copy for `verdict`, `pieces` and `motif` should be reviewed by a native reader once (phase 2d), since every page reuses it.
- Suggested measure of success: share of sessions that press a `NextStep` or "Try it" (the existing analytics component can record this); no target set here.

---

## 7. Open product questions

**Decisions (owner, 2026-11-23 18:18 IST):**
1. Try it: accept only the engine's best move (no in-browser engine check per attempt).
2. Boards: switch to a wood palette matching the theme; keep red/green arrows.
3. Nav: rename labels only ("My mistakes", "Losing streaks", "Endgames"); no route changes, no page merges.
4. hi/gu: native piece names (घोड़ा, ऊँट, हाथी); tactic names stay transliterated (फोर्क).
5. Not yet decided. Default for v1: Try it is a throwaway exercise and does not feed the puzzle schedule.

Original questions as posed:

1. **"Try it" strictness.** v1 accepts only the engine's single best move, checked in the browser. Should it also accept other good moves? That needs a short Stockfish check in the browser per attempt, which is slower on phones, but avoids telling a user "Not quite" for a perfectly good move.
2. **Board colours.** The existing boards use green/cream squares (`TeachingBoard.tsx:107-108`, `ReplayBoard.tsx:55-56`) inside a dark brown/wood app. Keep green for familiarity with chess.com, or switch all boards to a wood palette that matches the theme?
3. **Navigation names and count.** The sidebar has 17 items in four groups (`Sidebar.tsx:58-98`). Rename for plain language ("Weaknesses" → "My mistakes", "Tilt" → "Losing streaks", "Endgame Drills" → "Endgames") and/or merge thin pages (rating predictor + peer comparison into one "Progress" page)? Renames affect URLs and SEO only if routes change; labels alone are safe.
4. **Hindi and Gujarati chess vocabulary.** Use transliterated English piece and tactic names (नाइट, फोर्क) as most Indian online players see them, or native terms (घोड़ा, काँटा)? This decides every verdict sentence, so it should be settled before phase 2d.
5. **Should "Try it" count as puzzle practice?** A correct or failed attempt on a MistakeCard anywhere in the app could update the same spaced-repetition schedule the Puzzles page uses (one learning record per mistake), or stay a throwaway exercise with Puzzles as the only place progress is tracked. The first needs every card to resolve to a puzzle id and a submit call.
