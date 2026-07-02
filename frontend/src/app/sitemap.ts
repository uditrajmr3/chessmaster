import type { MetadataRoute } from "next";

const BASE = "https://chessmaster.cyou";

// Only the publicly indexable (non-authenticated) routes belong here. The
// dashboard tools live behind AuthGuard and are excluded via robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/game-review`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/chess-analysis`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/learn`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/how-to-play-chess`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/chess-notation`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/glossary`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/learn/improve-middlegame`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/learn/improve-endgame`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
