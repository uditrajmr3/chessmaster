import { evaluate } from "../evaluate";
import type { AwardEntry } from "../types";

const award = (over: Partial<AwardEntry>): AwardEntry => ({
  id: "x", slug: "x", name: "X", category: "achievements",
  description: "", howTo: "", provenance: "community", hidden: false, ...over,
});

describe("evaluate", () => {
  it("marks an award earned when the threshold is met", () => {
    const c = [award({ rule: { measurement: "games.total", op: ">=", target: 100 } })];
    expect(evaluate(c, { games: { total: 150 } }, {})[0].earned).toBe(true);
  });

  it("reports partial progress toward a threshold", () => {
    const c = [award({ rule: { measurement: "games.total", op: ">=", target: 1000 } })];
    const s = evaluate(c, { games: { total: 847 } }, {})[0];
    expect(s.earned).toBe(false);
    expect(s.progress).toEqual({ current: 847, target: 1000 });
  });

  it("handles set_size against countries_played", () => {
    const c = [award({ rule: { measurement: "countries_played", op: "set_size", target: 10 } })];
    const s = evaluate(c, { countries_played: ["US", "IN", "DE"] }, {})[0];
    expect(s.progress).toEqual({ current: 3, target: 10 });
  });

  it("treats a lower min_clock as better for <= rules", () => {
    const c = [award({ rule: { measurement: "min_clock_win_ms", op: "<=", target: 1000 } })];
    expect(evaluate(c, { min_clock_win_ms: 800 }, {})[0].earned).toBe(true);
    expect(evaluate(c, { min_clock_win_ms: 5000 }, {})[0].earned).toBe(false);
  });

  it("does not treat a null measurement as satisfying a <= rule", () => {
    const c = [award({ rule: { measurement: "min_clock_win_ms", op: "<=", target: 1000 } })];
    expect(evaluate(c, { min_clock_win_ms: null }, {})[0].earned).toBe(false);
  });

  it("falls back to the manual checkbox when there is no rule", () => {
    const c = [award({ id: "social", rule: undefined })];
    const s = evaluate(c, {}, { social: true })[0];
    expect(s.manual).toBe(true);
    expect(s.earned).toBe(true);
  });

  it("returns unearned with no progress when no scan has run", () => {
    const c = [award({ rule: { measurement: "games.total", op: ">=", target: 10 } })];
    const s = evaluate(c, null, {})[0];
    expect(s.earned).toBe(false);
    expect(s.progress).toBeNull();
  });

  it("earns a contains rule when the measurement array includes the target", () => {
    const c = [award({ rule: { measurement: "countries_played", op: "contains", target: "IN" } })];
    const s = evaluate(c, { countries_played: ["US", "IN", "DE"] }, {})[0];
    expect(s.earned).toBe(true);
  });

  it("does not earn a contains rule when the target is absent from the array", () => {
    const c = [award({ rule: { measurement: "countries_played", op: "contains", target: "FR" } })];
    const s = evaluate(c, { countries_played: ["US", "IN", "DE"] }, {})[0];
    expect(s.earned).toBe(false);
  });

  it("does not earn a contains rule when the measurement is null or absent", () => {
    const withNull = [award({ rule: { measurement: "countries_played", op: "contains", target: "IN" } })];
    expect(evaluate(withNull, { countries_played: null }, {})[0].earned).toBe(false);

    const withMissing = [award({ rule: { measurement: "countries_played", op: "contains", target: "IN" } })];
    expect(evaluate(withMissing, {}, {})[0].earned).toBe(false);
  });

  it("always reports null progress for a contains rule", () => {
    const c = [award({ rule: { measurement: "countries_played", op: "contains", target: "IN" } })];
    const hit = evaluate(c, { countries_played: ["IN"] }, {})[0];
    const miss = evaluate(c, { countries_played: [] }, {})[0];
    expect(hit.progress).toBeNull();
    expect(miss.progress).toBeNull();
  });
});
