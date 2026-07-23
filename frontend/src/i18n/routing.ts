import { defineRouting } from "next-intl/routing";

// URL-segment locales for PUBLIC routes only. English is unprefixed
// ("/about"); Hindi and Gujarati are prefixed ("/hi/about", "/gu/about").
// Authenticated routes never carry a locale segment — they read the
// `locale` cookie via src/i18n/request.ts and stay dynamic.
export const routing = defineRouting({
  locales: ["en", "hi", "gu"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // No Accept-Language redirects and no auto <link rel=alternate> headers:
  // crawl-stable URLs; hreflang ships with the translation-coverage round.
  localeDetection: false,
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];

// The signed-out-reachable (indexable) route prefixes. Must stay in sync with
// AuthGuard's AUTH-free sets and middleware.ts's matcher.
export const PUBLIC_PATHS = [
  "/",
  "/about",
  "/game-review",
  "/chess-analysis",
  "/learn",
  "/awards",
];

// "/hi/about" -> "/about", "/hi" -> "/", "/about" -> "/about".
export function stripLocale(pathname: string): string {
  for (const l of routing.locales) {
    if (l === routing.defaultLocale) continue;
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

export function isPublicPath(pathname: string): boolean {
  const p = stripLocale(pathname);
  return PUBLIC_PATHS.some((r) => p === r || p.startsWith(r + "/"));
}
