import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Rewrites unprefixed default-locale URLs onto the [locale] segment
// ("/about" -> internal "/en/about") and normalises "/en/about" -> "/about".
// Matcher covers ONLY the public route set — auth routes, /api (proxied to
// the backend via next.config rewrites), /_next and static files never run it.
export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(hi|gu)/:path*",
    "/about/:path*",
    "/game-review/:path*",
    "/chess-analysis/:path*",
    "/learn/:path*",
    "/awards/:path*",
  ],
};
