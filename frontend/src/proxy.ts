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
    // Deliberately NOT /en. Next 16 re-routes the proxy's own internal
    // rewrite ("/about" -> "/en/about"), so ANY /en normalisation — an /en
    // matcher entry or a next.config redirects() rule — catches that rewrite
    // and 307-loops every unprefixed public URL. Tested both; both loop.
    // Consequence: explicit /en/* URLs serve 200 instead of redirecting.
    // Accepted: nothing generates /en/* links (as-needed prefix), the
    // sitemap only emits unprefixed URLs, and canonicals point unprefixed.
    "/(hi|gu)/:path*",
    "/about/:path*",
    "/game-review/:path*",
    "/chess-analysis/:path*",
    "/learn/:path*",
    "/awards/:path*",
  ],
};
