import { Chess } from "chess.js";
import { verdict, type MistakeInput } from "@/lib/verdict";

const START = new Chess().fen();
// White queen walks into a pawn capture on d5.
const HANG_FEN = new Chess("4k3/8/2p5/8/8/8/8/3QK3 w - - 0 1").fen();
// White queen could take a free knight on d5.
const CAPTURE_FEN = new Chess("4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1").fen();
// Fool's mate: black to move, Qh4# is available.
const MATE_FEN = new Chess("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2").fen();

function input(over: Partial<MistakeInput>): MistakeInput {
  return {
    fen_before: START,
    move_uci: "e2e4",
    best_move_uci: "d2d4",
    centipawn_loss: 150,
    classification: "mistake",
    player_color: "white",
    eval_before: 0,
    eval_after: -150,
    ...over,
  };
}

describe("verdict gate", () => {
  it("returns fine for a non-slip classification", () => {
    const v = verdict(input({ classification: "good", eval_after: -2 }));
    expect(v.isSlip).toBe(false);
    expect(v.primaryKey).toBe("verdict.fine");
    expect(v.cost).toBe("small");
    expect(v.arrows).toEqual([]);
  });

  it("returns good for a best move", () => {
    expect(verdict(input({ classification: "best" })).primaryKey).toBe("verdict.good");
  });

  it("is not a slip when win% drop is under 5", () => {
    const v = verdict(input({ classification: "mistake", eval_before: 0, eval_after: -10 }));
    expect(v.isSlip).toBe(false);
  });

  it("uses classification alone when evals are null", () => {
    const v = verdict(input({ eval_before: null, eval_after: null, classification: "blunder" }));
    expect(v.isSlip).toBe(true);
  });
});

describe("verdict ladder", () => {
  it("rule 1: allows mate", () => {
    const v = verdict(input({ eval_after: -9990, centipawn_loss: 1000, classification: "blunder" }));
    expect(v.primaryKey).toBe("verdict.allowsMate");
  });

  it("rule 2: missed mate by eval", () => {
    const v = verdict(input({ eval_before: 9990, eval_after: 200, centipawn_loss: 900, classification: "miss" }));
    expect(v.primaryKey).toBe("verdict.missedMate");
  });

  it("rule 2: missed mate by best move SAN ending in #, black player", () => {
    const v = verdict({
      fen_before: MATE_FEN,
      move_uci: "a7a6",
      best_move_san: "Qh4#",
      centipawn_loss: 1000,
      classification: "blunder",
      player_color: "black",
    });
    expect(v.primaryKey).toBe("verdict.missedMate");
    expect(v.arrows).toContainEqual({ from: "d8", to: "h4", tone: "good" });
    expect(v.arrows).toContainEqual({ from: "a7", to: "a6", tone: "bad" });
  });

  it("rule 3: motif", () => {
    const v = verdict(input({ tactical_motifs: ["back_rank"] }));
    expect(v.primaryKey).toBe("verdict.missedMotif");
    expect(v.primaryParams).toEqual({ motif: "backRank" });
  });

  it("rule 3: unknown motif is ignored", () => {
    const v = verdict(input({ tactical_motifs: ["zugzwang"] }));
    expect(v.primaryKey).not.toBe("verdict.missedMotif");
  });

  it("rule 4: opponent can take a piece", () => {
    const v = verdict({
      fen_before: HANG_FEN,
      move_uci: "d1d5",
      best_move_uci: "d1d2",
      refutation_uci: "c6d5",
      centipawn_loss: 800,
      classification: "blunder",
      eval_before: 0,
      eval_after: -800,
      player_color: "white",
    });
    expect(v.primaryKey).toBe("verdict.hangsPiece");
    expect(v.primaryParams).toEqual({ piece: "queen", square: "d5" });
    expect(v.highlights).toContainEqual({ square: "d5", tone: "bad" });
    expect(v.arrows).toContainEqual({ from: "c6", to: "d5", tone: "threat" });
  });

  it("rule 4: even trade (loss too small) does not trigger", () => {
    const v = verdict({
      fen_before: HANG_FEN,
      move_uci: "d1d5",
      refutation_uci: "c6d5",
      centipawn_loss: 150,
      classification: "mistake",
      player_color: "white",
    });
    expect(v.primaryKey).not.toBe("verdict.hangsPiece");
  });

  it("rule 5: missed capture", () => {
    const v = verdict({
      fen_before: CAPTURE_FEN,
      move_uci: "e1e2",
      best_move_uci: "d1d5",
      centipawn_loss: 300,
      classification: "mistake",
      eval_before: 300,
      eval_after: 0,
      player_color: "white",
    });
    expect(v.primaryKey).toBe("verdict.missedCapture");
    expect(v.primaryParams).toEqual({ piece: "knight", square: "d5" });
    expect(v.highlights).toContainEqual({ square: "d5", tone: "good" });
  });

  it("rule 5: capture with small loss does not trigger", () => {
    const v = verdict({
      fen_before: CAPTURE_FEN,
      move_uci: "e1e2",
      best_move_uci: "d1d5",
      centipawn_loss: 100,
      classification: "inaccuracy",
      player_color: "white",
    });
    expect(v.primaryKey).not.toBe("verdict.missedCapture");
  });

  it("accepts SAN for played, best and refutation-bearing moves", () => {
    const v = verdict({
      fen_before: CAPTURE_FEN,
      move_san: "Ke2",
      best_move_san: "Qxd5+",
      centipawn_loss: 300,
      classification: "mistake",
      player_color: "white",
    });
    expect(v.primaryKey).toBe("verdict.missedCapture");
    const h = verdict({
      fen_before: HANG_FEN,
      move_san: "Qd5",
      refutation_uci: "c6d5",
      centipawn_loss: 800,
      classification: "blunder",
      player_color: "white",
    });
    expect(h.primaryKey).toBe("verdict.hangsPiece");
  });

  it("fills secondary with the next match", () => {
    const v = verdict({
      fen_before: HANG_FEN,
      move_uci: "d1d5",
      refutation_uci: "c6d5",
      tactical_motifs: ["fork"],
      centipawn_loss: 800,
      classification: "blunder",
      player_color: "white",
    });
    expect(v.primaryKey).toBe("verdict.missedMotif");
    expect(v.secondaryKey).toBe("verdict.hangsPiece");
    expect(v.secondaryParams).toEqual({ piece: "queen", square: "d5" });
  });
});

describe("verdict fallback and cost", () => {
  const base = { eval_before: null, eval_after: null, classification: "inaccuracy" };
  it.each([
    [40, "small", "verdict.smallSlip"],
    [120, "pawn", "verdict.costPawn"],
    [300, "piece", "verdict.costPiece"],
    [600, "rook", "verdict.costRook"],
  ])("cpl %i -> %s", (cpl, cost, key) => {
    const v = verdict(input({ ...base, centipawn_loss: cpl }));
    expect(v.cost).toBe(cost);
    expect(v.primaryKey).toBe(key);
  });

  it("turned the game when winning chances flip", () => {
    const v = verdict(input({ eval_before: 100, eval_after: -400, centipawn_loss: 500 }));
    expect(v.cost).toBe("game");
    expect(v.primaryKey).toBe("verdict.turnedGame");
  });

  it("big loss in an already won position is size only", () => {
    const v = verdict(input({ eval_before: 800, eval_after: 100, centipawn_loss: 700 }));
    expect(v.cost).toBe("rook");
    expect(v.primaryKey).toBe("verdict.costRook");
  });
});

describe("verdict robustness", () => {
  it("does not throw on a bad FEN", () => {
    const v = verdict(input({ fen_before: "not a fen", eval_after: -9990, classification: "blunder" }));
    expect(v.arrows).toEqual([]);
    expect(v.highlights).toEqual([]);
    expect(v.primaryKey.startsWith("verdict.")).toBe(true);
  });

  it("does not throw on an illegal move", () => {
    const v = verdict(input({ move_uci: "e2e5", best_move_uci: "zz", centipawn_loss: 300 }));
    expect(v.arrows).toEqual([]);
    expect(v.primaryKey).toBe("verdict.costPiece");
  });

  it("output contains keys and ids only, no English", () => {
    const v = verdict({
      fen_before: HANG_FEN,
      move_uci: "d1d5",
      refutation_uci: "c6d5",
      tactical_motifs: ["discovered_attack"],
      centipawn_loss: 800,
      classification: "blunder",
      player_color: "white",
    });
    for (const k of [v.primaryKey, v.secondaryKey]) expect(k).toMatch(/^verdict\.[a-zA-Z]+$/);
    for (const p of [v.primaryParams, v.secondaryParams ?? {}]) {
      for (const val of Object.values(p)) expect(String(val)).not.toMatch(/\s/);
    }
    expect(v.primaryParams).toEqual({ motif: "discoveredAttack" });
  });
});
