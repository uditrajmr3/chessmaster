import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/awards/catalog";

const BASE = "https://chessmaster.cyou";

// Only the publicly indexable (non-authenticated) routes belong here. The
// dashboard tools live behind AuthGuard and are excluded via robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Award detail URLs are generated from the catalog, not hand-listed, so the
  // sitemap never drifts from what /awards/achievements and /awards/books
  // actually render. Passports deliberately get no detail pages (249 thin
  // pages would be doorway content), so only the section URL is listed.
  const awardRoutes = [
    "/awards",
    "/awards/achievements",
    "/awards/books",
    "/awards/passports",
    "/awards/badges",
    "/awards/cheers",
    "/awards/medals",
    ...getCatalog("achievements").map((a) => `/awards/achievements/${a.slug}`),
    ...getCatalog("books").map((a) => `/awards/books/${a.slug}`),
  ].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: path === "/awards" ? 0.9 : 0.6,
  }));

  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/game-review`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/chess-analysis`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/learn`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/board-setup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/piece-moves`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/special-moves`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/how-to-play-chess`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/chess-notation`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/glossary`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/improve-middlegame`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/improve-endgame`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/capablanca`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/capablanca/opening`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/capablanca/middlegame`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/capablanca/endgame`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/capablanca/game`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/coach`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    ...awardRoutes,
  ];
}
