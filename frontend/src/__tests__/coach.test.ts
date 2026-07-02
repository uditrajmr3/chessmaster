import { Chess } from "chess.js";
import {
  detectPhase,
  findThreats,
  leastActivePiece,
  enemiesOnMyHalf,
  coachReport,
  ruleForMove,
} from "@/lib/coach";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("detectPhase", () => {
  it("calls the starting position the opening", () => {
    expect(detectPhase(new Chess(START))).toBe("opening");
  });
  it("calls a queenless, sparse position the endgame", () => {
    expect(detectPhase(new Chess("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"))).toBe("endgame");
  });
});

describe("findThreats", () => {
  it("flags a piece that is attacked and undefended", () => {
    // White knight on d4 attacked by the black e5-pawn, undefended.
    const chess = new Chess("4k3/8/8/4p3/3N4/8/8/4K3 w - - 0 1");
    const threats = findThreats(chess);
    expect(threats.map((t) => t.square)).toContain("d4");
  });

  it("reports no threats in the starting position", () => {
    expect(findThreats(new Chess(START))).toHaveLength(0);
  });

  it("flags a king in check", () => {
    // Black rook on e8 checks the white king on e1 down the open e-file.
    const chess = new Chess("4r1k1/8/8/8/8/8/8/4K3 w - - 0 1");
    const threats = findThreats(chess);
    expect(threats.some((t) => /check/i.test(t.text))).toBe(true);
  });
});

describe("leastActivePiece", () => {
  it("suggests developing an undeveloped minor from the start", () => {
    const s = leastActivePiece(new Chess(START));
    expect(s).not.toBeNull();
    expect(["b1", "g1", "c1", "f1"]).toContain(s!.square);
    expect(s!.text).toMatch(/develop/i);
  });
});

describe("enemiesOnMyHalf", () => {
  it("finds an enemy knight sitting on White's half", () => {
    const chess = new Chess("4k3/8/8/8/4n3/8/8/4K3 w - - 0 1");
    const s = enemiesOnMyHalf(chess);
    expect(s).not.toBeNull();
    expect(s!.text).toMatch(/e4/);
  });

  it("returns nothing when the half is clear", () => {
    expect(enemiesOnMyHalf(new Chess(START))).toBeNull();
  });
});

describe("coachReport", () => {
  it("answers all three questions", () => {
    const r = coachReport(new Chess(START));
    expect(r.questions).toHaveLength(3);
    expect(r.phase).toBe("opening");
    expect(r.rules.length).toBeGreaterThan(0);
    // No threats at the start → first question is 'ok'.
    expect(r.questions[0].ok).toBe(true);
  });
});

describe("ruleForMove", () => {
  it("tags a developing knight move as an opening rule", () => {
    const chess = new Chess(START);
    const tag = ruleForMove(chess, "g1f3");
    expect(tag).not.toBeNull();
    expect(tag!.rule.id).toBe("O-1");
  });

  it("tags castling as O-4", () => {
    // White to move, able to castle kingside.
    const chess = new Chess("rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1");
    const tag = ruleForMove(chess, "e1g1");
    expect(tag!.rule.id).toBe("O-4");
  });
});
