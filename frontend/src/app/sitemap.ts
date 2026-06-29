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
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
