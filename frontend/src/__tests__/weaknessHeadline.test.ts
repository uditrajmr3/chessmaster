import { weaknessHeadline, clockMultiple } from "@/lib/weaknessHeadline";
import type { PatternReport } from "@/lib/types";

function report(over: Partial<PatternReport> = {}): PatternReport {
  return {
    opening_stats: [],
    worst_openings: [],
    phase_accuracy: { opening: 40, middlegame: 50, endgame: 45 },
    phase_blunder_rate: {},
    missed_tactics: {},
    blunder_rate_normal: 4,
    blunder_rate_time_trouble: 5,
    white_stats: { win_rate: 50, avg_cpl: 50, games: 20 },
    black_stats: { win_rate: 48, avg_cpl: 50, games: 20 },
    endgame_conversion_rate: 85,
    blunder_by_move_bucket: {},
    example_positions: [],
    motif_examples: {},
    games_analyzed: 30,
    ...over,
  };
}

describe("weaknessHeadline", () => {
  it("returns none for missing or empty data", () => {
    expect(weaknessHeadline(null).kind).toBe("none");
    expect(weaknessHeadline(undefined).kind).toBe("none");
    expect(
      weaknessHeadline(
        report({
          phase_accuracy: {},
          blunder_rate_normal: 0,
          blunder_rate_time_trouble: 0,
          white_stats: { win_rate: 0, avg_cpl: 0, games: 0 },
          black_stats: { win_rate: 0, avg_cpl: 0, games: 0 },
          endgame_conversion_rate: 0,
        }),
      ).kind,
    ).toBe("none");
  });

  it("returns none when nothing is a leak", () => {
    expect(weaknessHeadline(report())).toEqual({ kind: "none", tone: "good" });
  });

  it("picks the worst phase", () => {
    const h = weaknessHeadline(report({ phase_accuracy: { opening: 40, middlegame: 180, endgame: 60 } }));
    expect(h).toMatchObject({ kind: "phase", phase: "middlegame", avgLoss: 180, tone: "warn" });
  });

  it("ignores a phase that is high but not worse than the others", () => {
    const h = weaknessHeadline(report({ phase_accuracy: { opening: 110, middlegame: 115, endgame: 112 } }));
    expect(h.kind).toBe("none");
  });

  it("phase tone is bad at double the threshold", () => {
    const h = weaknessHeadline(report({ phase_accuracy: { opening: 30, middlegame: 30, endgame: 250 } }));
    expect(h).toMatchObject({ kind: "phase", phase: "endgame", tone: "bad" });
  });

  it("picks the most-missed motif", () => {
    const h = weaknessHeadline(report({ missed_tactics: { fork: 14, pin: 5 } }));
    expect(h).toMatchObject({ kind: "motif", motif: "fork", count: 14, tone: "bad" });
  });

  it("ignores motifs below the minimum count", () => {
    expect(weaknessHeadline(report({ missed_tactics: { fork: 2 } })).kind).toBe("none");
  });

  it("breaks motif count ties alphabetically", () => {
    const h = weaknessHeadline(report({ missed_tactics: { pin: 4, fork: 4 } }));
    expect(h).toMatchObject({ motif: "fork" });
  });

  it("picks the clock leak", () => {
    const h = weaknessHeadline(report({ blunder_rate_normal: 4, blunder_rate_time_trouble: 10 }));
    expect(h).toMatchObject({ kind: "clock", times: 2.5, tone: "warn" });
  });

  it("ignores a clock gap with a tiny trouble rate", () => {
    const h = weaknessHeadline(report({ blunder_rate_normal: 1, blunder_rate_time_trouble: 3 }));
    expect(h.kind).toBe("none");
  });

  it("handles zero normal-time blunders", () => {
    const p = report({ blunder_rate_normal: 0, blunder_rate_time_trouble: 8 });
    expect(clockMultiple(p)).toBeGreaterThan(1.5);
    expect(weaknessHeadline(p).kind).toBe("clock");
    expect(clockMultiple(report({ blunder_rate_time_trouble: 0 }))).toBeNull();
  });

  it("picks the colour gap and names the weaker colour", () => {
    const h = weaknessHeadline(
      report({
        white_stats: { win_rate: 60, avg_cpl: 50, games: 20 },
        black_stats: { win_rate: 35, avg_cpl: 50, games: 20 },
      }),
    );
    expect(h).toMatchObject({ kind: "color", worse: "black", gap: 25 });
    const h2 = weaknessHeadline(
      report({
        white_stats: { win_rate: 30, avg_cpl: 50, games: 20 },
        black_stats: { win_rate: 55, avg_cpl: 50, games: 20 },
      }),
    );
    expect(h2).toMatchObject({ kind: "color", worse: "white" });
  });

  it("ignores a colour gap when a side has too few games", () => {
    const h = weaknessHeadline(
      report({
        white_stats: { win_rate: 90, avg_cpl: 50, games: 20 },
        black_stats: { win_rate: 10, avg_cpl: 50, games: 3 },
      }),
    );
    expect(h.kind).toBe("none");
  });

  it("picks low endgame conversion but treats 0 as no data", () => {
    expect(weaknessHeadline(report({ endgame_conversion_rate: 40 }))).toMatchObject({
      kind: "endgame",
      rate: 40,
      tone: "warn",
    });
    expect(weaknessHeadline(report({ endgame_conversion_rate: 20 }))).toMatchObject({ tone: "bad" });
    expect(weaknessHeadline(report({ endgame_conversion_rate: 0 })).kind).toBe("none");
    expect(weaknessHeadline(report({ endgame_conversion_rate: 61 })).kind).toBe("none");
  });

  it("chooses the biggest severity across kinds", () => {
    const h = weaknessHeadline(
      report({
        phase_accuracy: { opening: 40, middlegame: 130, endgame: 50 }, // ratio 1.3
        missed_tactics: { fork: 12 }, // ratio 3 (capped)
      }),
    );
    expect(h.kind).toBe("motif");
  });

  it("breaks severity ties by priority (phase before motif)", () => {
    const h = weaknessHeadline(
      report({
        phase_accuracy: { opening: 40, middlegame: 300, endgame: 50 }, // capped 3
        missed_tactics: { fork: 20 }, // capped 3
      }),
    );
    expect(h.kind).toBe("phase");
  });
});
