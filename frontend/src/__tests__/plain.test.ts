import { cplCost, cplGrade, turnedGame, perGames } from "@/lib/plain";

describe("cplCost", () => {
  it.each([
    [0, "small"], [79, "small"], [80, "pawn"], [199, "pawn"],
    [200, "piece"], [449, "piece"], [450, "rook"], [1000, "rook"],
  ])("%d -> %s", (cpl, want) => expect(cplCost(cpl)).toBe(want));
  it("clamps negatives and huge values", () => {
    expect(cplCost(-50)).toBe("small");
    expect(cplCost(5000)).toBe("rook");
    expect(cplCost(NaN)).toBe("small");
  });
});

describe("cplGrade", () => {
  it.each([
    [0, "excellent"], [30, "excellent"], [31, "good"], [70, "good"], [71, "ok"],
    [130, "ok"], [131, "shaky"], [200, "shaky"], [201, "costly"], [900, "costly"],
  ])("%d -> %s", (cpl, want) => expect(cplGrade(cpl)).toBe(want));
});

describe("turnedGame", () => {
  it("true at exact edges: drop 30, before 50, after below 50", () => {
    expect(turnedGame(79.9, 49.9)).toBe(true);
    expect(turnedGame(50, 20)).toBe(true);
  });
  it("false when drop under 30", () => expect(turnedGame(70, 49)).toBe(false));
  it("false when before under 50", () => expect(turnedGame(49.9, 10)).toBe(false));
  it("false when after is 50 or more", () => {
    expect(turnedGame(90, 50)).toBe(false);
    expect(turnedGame(100, 60)).toBe(false);
  });
  it("false for improvements", () => expect(turnedGame(20, 80)).toBe(false));
});

describe("perGames", () => {
  it("returns N for 1 in N", () => {
    expect(perGames(2, 10)).toBe(5);
    expect(perGames(3, 10)).toBe(3);
    expect(perGames(20, 10)).toBe(1);
  });
  it("null when no events or games", () => {
    expect(perGames(0, 10)).toBeNull();
    expect(perGames(3, 0)).toBeNull();
  });
});
