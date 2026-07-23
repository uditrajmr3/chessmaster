import { readFileSync } from "node:fs";

describe("awards is wired up as a public section", () => {
  it("is allowed by AuthGuard", () => {
    expect(readFileSync("src/components/AuthGuard.tsx", "utf8")).toContain('"/awards"');
  });

  it("is allowed by robots", () => {
    expect(readFileSync("src/app/robots.ts", "utf8")).toContain("/awards");
  });

  it("generates award detail URLs from the catalog rather than hand-listing slugs", () => {
    const src = readFileSync("src/app/sitemap.ts", "utf8");
    expect(src).toContain('getCatalog("achievements")');
    expect(src).toContain('getCatalog("books")');
  });
});
