import { Chess } from "chess.js";
import { EXAMPLES } from "@/lib/capablancaExamples";

describe("Capablanca tutorial examples", () => {
  const entries = Object.entries(EXAMPLES);

  it.each(entries)("%s has a valid start position and legal moves", (_id, ex) => {
    // Constructing from the FEN throws if it's not a legal position.
    const game = ex.fen ? new Chess(ex.fen) : new Chess();
    for (const step of ex.steps) {
      // move() throws on an illegal / wrong-turn SAN — a bad example can't ship.
      const res = game.move(step.san);
      expect(res).toBeTruthy();
    }
  });

  it("highlighted squares reference real squares", () => {
    const re = /^[a-h][1-8]$/;
    for (const ex of Object.values(EXAMPLES)) {
      for (const sq of ex.startDots ?? []) expect(sq).toMatch(re);
      for (const step of ex.steps) for (const sq of step.dots ?? []) expect(sq).toMatch(re);
    }
  });
});
