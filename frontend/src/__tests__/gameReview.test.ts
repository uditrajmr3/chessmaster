import type { MoveAnalysis } from "@/lib/types";
import {
  groupChipCounts,
  keyMoments,
  parseMoveParam,
  turningPoint,
  fullMoveNumber,
} from "@/lib/gameReview";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// After 1.e4 e5 2.Nf3: black to move.
const BLACK_TO_MOVE = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";

function mv(p: Partial<MoveAnalysis>): MoveAnalysis {
  return {
    move_number: 1,
    is_player_move: true,
    fen_before: START,
    move_uci: "e2e4",
    move_san: "e4",
    eval_before: 20,
    eval_after: 20,
    best_move_uci: "e2e4",
    best_move_san: "e4",
    centipawn_loss: 0,
    classification: "best",
    game_phase: "opening",
    time_remaining: null,
    tactical_motifs: null,
    ...p,
  };
}

describe("parseMoveParam", () => {
  it("parses ply and clamps", () => {
    expect(parseMoveParam("5", 40)).toBe(5);
    expect(parseMoveParam("999", 40)).toBe(40);
    expect(parseMoveParam("-3", 40)).toBe(0);
    expect(parseMoveParam("0", 40)).toBe(0);
  });
  it("ignores missing or malformed values", () => {
    expect(parseMoveParam(null, 40)).toBeNull();
    expect(parseMoveParam("", 40)).toBeNull();
    expect(parseMoveParam("abc", 40)).toBeNull();
    expect(parseMoveParam("3.5", 40)).toBeNull();
  });
});

describe("fullMoveNumber", () => {
  it("maps ply to chess move number", () => {
    expect([1, 2, 3, 4, 45].map(fullMoveNumber)).toEqual([1, 1, 2, 2, 23]);
  });
});

describe("groupChipCounts", () => {
  it("sums ten classes into three groups", () => {
    const g = groupChipCounts({
      brilliant: 1, great: 1, best: 4, excellent: 3, good: 2, book: 5,
      inaccuracy: 2, miss: 1, mistake: 3, blunder: 1,
    });
    expect(g).toEqual({ good: 16, slips: 3, big: 4 });
  });
  it("handles empty counts", () => {
    expect(groupChipCounts({})).toEqual({ good: 0, slips: 0, big: 0 });
  });
});

describe("turningPoint / keyMoments", () => {
  const moves: MoveAnalysis[] = [
    mv({ move_number: 1, eval_before: 20, eval_after: 25 }),
    mv({ move_number: 2, is_player_move: false, eval_before: 25, eval_after: 30 }),
    mv({ move_number: 3, eval_before: 30, eval_after: -50, classification: "mistake", centipawn_loss: 80 }),
    mv({ move_number: 4, is_player_move: false, eval_before: -50, eval_after: -60 }),
    mv({ move_number: 5, eval_before: -60, eval_after: -700, classification: "blunder", centipawn_loss: 640 }),
    mv({ move_number: 6, is_player_move: false, eval_before: -700, eval_after: -700 }),
  ];

  it("picks the largest win% drop by the player", () => {
    expect(turningPoint(moves)?.ply).toBe(5);
  });
  it("returns null when there is no meaningful drop", () => {
    expect(turningPoint([mv({}), mv({ is_player_move: false })])).toBeNull();
  });
  it("ignores opponent moves even with big swings", () => {
    const m = [mv({ is_player_move: false, eval_before: 0, eval_after: 900, classification: "blunder" })];
    expect(turningPoint(m)).toBeNull();
    expect(keyMoments(m, "white", "g1")).toEqual([]);
  });
  it("returns slips sorted by drop, capped at 3, with refutation = next row", () => {
    const many = [
      ...moves,
      mv({ move_number: 7, eval_before: -700, eval_after: -900, classification: "mistake", centipawn_loss: 200 }),
      mv({ move_number: 8, is_player_move: false, move_uci: "d8h4" }),
      mv({ move_number: 9, eval_before: 0, eval_after: -150, classification: "mistake", centipawn_loss: 150 }),
    ];
    const km = keyMoments(many, "white", "g1");
    expect(km.length).toBe(3);
    expect(km[0].ply).toBe(5);
    expect(km[0].drop).toBeGreaterThanOrEqual(km[1].drop);
    expect(km[0].mistake.refutation_uci).toBe(many[5].move_uci);
    expect(km.every((k) => k.mistake.game_id === "g1")).toBe(true);
  });
  it("skips drops the verdict engine does not call slips (good classification)", () => {
    const m = [mv({ eval_before: 100, eval_after: -100, classification: "good" })];
    expect(keyMoments(m, "white", "g1")).toEqual([]);
  });
  it("detects a black-player blunder (evals are stored player-POV)", () => {
    const black = [
      mv({
        move_number: 4,
        fen_before: BLACK_TO_MOVE,
        move_uci: "d8h4",
        move_san: "Qh4",
        eval_before: 15,
        eval_after: -450,
        best_move_uci: "b8c6",
        best_move_san: "Nc6",
        classification: "blunder",
        centipawn_loss: 465,
      }),
    ];
    const km = keyMoments(black, "black", "g2");
    expect(km).toHaveLength(1);
    expect(km[0].mistake.player_color).toBe("black");
    expect(km[0].drop).toBeGreaterThan(30);
    expect(turningPoint(black)?.ply).toBe(1);
  });
});
