// Per-move / per-game accuracy. MUST stay in lock-step with
// backend/app/services/accuracy.py; both are checked against
// backend/tests/fixtures/accuracy_fixture.json.

// Evals are stored player-POV (positive = good for the logged-in player; the
// ingest negates white-POV evals for black players), so win% uses them directly.
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// Per-move accuracy from the drop in the MOVER's winning chances (Lichess model).
export function moveAccuracy(evalBefore: number, evalAfter: number, isPlayerMove: boolean): number {
  const before = winPct(evalBefore); // player win% before the move
  const after = winPct(evalAfter);
  // Player's own move: penalize a drop in the player's win%. Opponent's move:
  // penalize a rise in the player's win% (the opponent worsened their position).
  const drop = isPlayerMove ? Math.max(0, before - after) : Math.max(0, after - before);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
}

export interface AccuracyMove {
  eval_before: number | null;
  eval_after: number | null;
  is_player_move: number | boolean;
}

// Simple mean over the player's own moves with both evals present; null if none.
export function gameAccuracy(moves: AccuracyMove[]): number | null {
  let sum = 0;
  let n = 0;
  for (const m of moves) {
    if (!m.is_player_move) continue;
    if (m.eval_before === null || m.eval_after === null) continue;
    sum += moveAccuracy(m.eval_before, m.eval_after, true);
    n += 1;
  }
  return n ? sum / n : null;
}

export type AccuracyGrade = "excellent" | "good" | "ok" | "shaky" | "costly";

// Accuracy-% grade bands (separate from the CPL grades). Single source of truth
// for the badge, digest and peer comparison. Rounds to 1 decimal first so the
// grade always agrees with the displayed number (89.96 shows as 90.0 -> excellent).
export function accuracyGrade(value: number): AccuracyGrade {
  const v = Math.round(value * 10) / 10;
  if (v >= 90) return "excellent";
  if (v >= 80) return "good";
  if (v >= 70) return "ok";
  if (v >= 60) return "shaky";
  return "costly";
}
