import { getAllAwards, getCatalog } from "../catalog";
import { isValidMeasurementKey } from "../measurements";

const all = getAllAwards();

describe("award catalog", () => {
  it("has unique ids", () => {
    const ids = all.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique slugs within each category", () => {
    for (const cat of ["achievements", "books", "passports"] as const) {
      const slugs = getCatalog(cat).map((a) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("uses url-safe slugs", () => {
    for (const a of all) expect(a.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("tags every entry with provenance", () => {
    for (const a of all) expect(["verified", "community", "inferred"]).toContain(a.provenance);
  });

  it("only references measurements the backend actually emits", () => {
    for (const a of all) {
      if (!a.rule) continue;
      // Jest's expect() takes a single argument (unlike Chai/Vitest), so the
      // identifying context goes in the assertion failure via a thrown message.
      if (!isValidMeasurementKey(a.rule.measurement)) {
        throw new Error(`${a.id} -> invalid measurement key "${a.rule.measurement}"`);
      }
    }
  });

  it("gives every entry non-empty guidance", () => {
    for (const a of all) {
      if (a.name.length <= 0) throw new Error(`${a.id} has an empty name`);
      if (a.howTo.length <= 20) throw new Error(`${a.id} has too-short howTo guidance`);
    }
  });

  it("has exactly 33 books", () => {
    expect(getCatalog("books")).toHaveLength(33);
  });
});
