import { routing, stripLocale, isPublicPath } from "../routing";

describe("routing config", () => {
  it("declares the three locales with en default and as-needed prefix", () => {
    expect(routing.locales).toEqual(["en", "hi", "gu"]);
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localePrefix).toBe("as-needed");
  });
});

describe("stripLocale", () => {
  it("strips a non-default locale prefix", () => {
    expect(stripLocale("/hi/about")).toBe("/about");
    expect(stripLocale("/gu/awards/books/foo")).toBe("/awards/books/foo");
  });
  it("maps a bare locale to the root", () => {
    expect(stripLocale("/hi")).toBe("/");
    expect(stripLocale("/gu")).toBe("/");
  });
  it("leaves unprefixed and app paths alone", () => {
    expect(stripLocale("/about")).toBe("/about");
    expect(stripLocale("/settings")).toBe("/settings");
    expect(stripLocale("/")).toBe("/");
  });
  it("does not strip look-alike segments", () => {
    expect(stripLocale("/hindi-guide")).toBe("/hindi-guide");
  });
});

describe("isPublicPath", () => {
  it.each(["/", "/about", "/game-review", "/chess-analysis", "/learn", "/learn/coach", "/awards/achievements/x", "/hi/about", "/gu"])
    ("accepts %s", (p) => expect(isPublicPath(p)).toBe(true));
  it.each(["/login", "/settings", "/games/123", "/register", "/aboutus"])
    ("rejects %s", (p) => expect(isPublicPath(p)).toBe(false));
});
