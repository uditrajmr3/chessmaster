import { Chess } from "chess.js";
import { OPENINGS, getOpening } from "@/lib/openings";

describe("opening presets", () => {
  it.each(OPENINGS.map((o) => [o.name, o] as const))(
    "%s is a legal sequence of moves",
    (_name, opening) => {
      const chess = new Chess();
      for (const san of opening.moves) {
        // chess.js throws on an illegal SAN move — a typo can't ship.
        expect(() => chess.move(san)).not.toThrow();
      }
      expect(chess.history()).toHaveLength(opening.moves.length);
    }
  );

  it("looks up openings by key", () => {
    expect(getOpening("italian")?.name).toBe("Italian Game");
    expect(getOpening("nope")).toBeUndefined();
  });
});
