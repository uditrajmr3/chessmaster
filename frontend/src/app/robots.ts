import type { MetadataRoute } from "next";

const BASE = "https://chessmaster.cyou";

// Marketing/auth pages are crawlable; the authenticated dashboard tools are
// not (they redirect to login when signed out, which would otherwise read as
// thin/duplicate content). Keeps crawl budget on the pages that can rank.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/game-review", "/chess-analysis", "/about", "/login", "/register"],
      disallow: [
        "/games",
        "/openings",
        "/weaknesses",
        "/report",
        "/puzzles",
        "/settings",
        "/digest",
        "/endgame",
        "/export",
        "/import",
        "/peer-comparison",
        "/rating-predictor",
        "/scouting",
        "/tilt",
        "/time-management",
        "/verify-email",
        "/reset-password",
        "/forgot-password",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
