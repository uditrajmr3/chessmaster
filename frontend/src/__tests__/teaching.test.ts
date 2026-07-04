import { freeMove, setSquare, singlePieceFen, pieceMoves } from "@/lib/teaching";

describe("freeMove", () => {
  it("relocates a piece and clears the source square", () => {
    const fen = "8/8/8/8/8/8/8/R7 w - - 0 1"; // white rook on a1
    const result = freeMove(fen, "a1", "a4");
    expect(result).toBe("8/8/8/8/R7/8/8/8 w - - 0 1");
  });

  it("is a no-op when the source square is empty", () => {
    const fen = "8/8/8/8/8/8/8/8 w - - 0 1";
    expect(freeMove(fen, "a1", "a4")).toBe(fen);
  });

  it("preserves side-to-move and other FEN fields", () => {
    const fen = "8/8/8/8/8/8/8/R7 b KQkq e3 0 5";
    const result = freeMove(fen, "a1", "h8");
    expect(result.endsWith("b KQkq e3 0 5")).toBe(true);
  });
});

describe("setSquare", () => {
  it("places a piece on an empty square", () => {
    const fen = "8/8/8/8/8/8/8/8 w - - 0 1";
    const result = setSquare(fen, "d1", "R");
    expect(result).toBe("8/8/8/8/8/8/8/3R4 w - - 0 1");
  });

  it("replaces an existing piece — the queen/rook misread correction case", () => {
    // AI misread a white rook on d1 as a white queen; user corrects it.
    const fen = "6k1/8/8/8/8/8/8/3Q4 w - - 0 1"; // wrong: queen on d1
    const fixed = setSquare(fen, "d1", "R");
    expect(fixed).toBe("6k1/8/8/8/8/8/8/3R4 w - - 0 1");
  });

  it("clears a square when piece is null", () => {
    const fen = "8/8/8/8/8/8/8/3R4 w - - 0 1";
    const result = setSquare(fen, "d1", null);
    expect(result).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
  });

  it("preserves side-to-move and other FEN fields", () => {
    const fen = "8/8/8/8/8/8/8/8 b KQkq - 3 10";
    const result = setSquare(fen, "e4", "n");
    expect(result.endsWith("b KQkq - 3 10")).toBe(true);
  });
});

describe("singlePieceFen / pieceMoves smoke test (unchanged by the refactor)", () => {
  it("still builds a lone-piece FEN and computes moves", () => {
    const fen = singlePieceFen("N", "d4");
    expect(fen).toBe("8/8/8/8/3N4/8/8/8 w - - 0 1");
    const { dots } = pieceMoves("n", "d4");
    expect(dots.sort()).toEqual(
      ["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"].sort()
    );
  });
});
