# i18n URL-Segment Locales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ChessInt's public (signed-out-reachable) routes under a `[locale]` URL segment (`/`, `/hi/...`, `/gu/...`) so they statically generate and `notFound()` returns a real HTTP 404, while authenticated routes keep cookie-based locale and stay dynamic.

**Architecture:** Two root layouts via route groups — `(public)/[locale]/` (static, locale from URL, `setRequestLocale`) and `(app)/` (dynamic, locale from cookie). next-intl middleware rewrites unprefixed default-locale URLs (`/about` → internal `/en/about`) only for public paths. `getRequestConfig` prefers the URL locale and falls back to the cookie, so authenticated routes behave exactly as today.

**Tech Stack:** Next.js 16.1.6 (App Router, `output: "standalone"`), next-intl ^4.13.1, TypeScript, Jest.

## Global Constraints

- Locales: `["en", "hi", "gu"]`, default `en`, `localePrefix: "as-needed"` (English URLs have NO prefix — `/about`, not `/en/about`).
- Public route set (the ONLY routes that move): `/`, `/about`, `/game-review`, `/chess-analysis`, `/learn/**`, `/awards/**`. Everything else (incl. `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`) stays unprefixed, cookie-localed, dynamic.
- The `/api/:path*` rewrite in `next.config.mjs` must never be touched by middleware.
- `git mv` for all moves (preserve history). Do not reformat files you move; only add the locale plumbing lines shown here.
- Do not edit: `scripts/`, `backend/pyproject.toml`, `Caddyfile`, `docker-compose*.yml`, `frontend/Dockerfile`.
- Do not add hreflang/translated-metadata work — explicitly deferred to the translation-coverage workstream.
- After every task: `npx jest --silent` green. Task 2 additionally requires `npm run build` green.
- Working dir for all commands: `frontend/`.

---

### Task 1: i18n plumbing (routing, navigation, request config)

No behavior change yet — after this task the app still works exactly as today (no middleware, cookie fallback everywhere), and the whole suite stays green.

**Files:**
- Create: `frontend/src/i18n/routing.ts`
- Create: `frontend/src/i18n/navigation.ts`
- Modify: `frontend/src/i18n/request.ts` (full rewrite, below)
- Test: `frontend/src/i18n/__tests__/routing.test.ts`

**Interfaces:**
- Produces: `routing` (defineRouting result), `stripLocale(pathname: string): string`, `isPublicPath(pathname: string): boolean`, `PUBLIC_PATHS: string[]`, and `Link/redirect/usePathname/useRouter/getPathname` from `@/i18n/navigation`. Tasks 2–3 import all of these.

- [ ] **Step 1: Write the failing test**

`frontend/src/i18n/__tests__/routing.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx jest src/i18n --silent` — Expected: FAIL (cannot find `../routing`).

- [ ] **Step 3: Create `frontend/src/i18n/routing.ts`**

```ts
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
```

- [ ] **Step 4: Create `frontend/src/i18n/navigation.ts`**

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation for PUBLIC routes: <Link href="/about"> renders
// "/about" for English and "/hi/about" for Hindi automatically. Use these
// ONLY for hrefs inside PUBLIC_PATHS; app/auth routes ("/login",
// "/settings", …) have no locale segment — keep next/link for those.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 5: Rewrite `frontend/src/i18n/request.ts`**

```ts
import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Hybrid locale resolution:
//  - Public routes live under app/(public)/[locale] — the segment supplies
//    `requestLocale` (via setRequestLocale), so no cookie read happens and
//    the route can statically generate.
//  - Everything else (authenticated app + auth pages) has no segment, so
//    `requestLocale` resolves undefined and we fall back to the `locale`
//    cookie (set by <LanguageSwitcher>). The cookie read is what keeps those
//    routes dynamic — by design.
export const SUPPORTED_LOCALES = routing.locales;
export type { Locale } from "./routing";
export const DEFAULT_LOCALE = routing.defaultLocale;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: string;
  if (hasLocale(routing.locales, requested)) {
    locale = requested;
  } else {
    const cookieLocale = (await cookies()).get("locale")?.value;
    locale = hasLocale(routing.locales, cookieLocale)
      ? cookieLocale
      : routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx jest --silent` — Expected: all suites pass (169 existing + new routing suite).
Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/i18n
git commit -m "feat(i18n): add URL-segment routing config with cookie fallback"
```

---

### Task 2: Layout split + route moves (single atomic commit)

The structural switch. Intermediate states do NOT build — that is expected; verify only at the end of the task. One commit.

**Files:**
- Create: `frontend/src/app/root-shell.tsx` (fonts, base metadata, jsonLd, shared `<AppBody>`)
- Create: `frontend/src/app/(public)/[locale]/layout.tsx`
- Create: `frontend/src/app/(app)/layout.tsx`
- Create: `frontend/src/middleware.ts`
- Delete: `frontend/src/app/layout.tsx` (contents absorbed into the three files above)
- Move (git mv): public routes → `(public)/[locale]/`, app routes → `(app)/`
- Modify: `frontend/src/components/AuthGuard.tsx` (strip locale before matching)
- Modify: every **server-component** `page.tsx` under `(public)/[locale]/` (add `setRequestLocale`)

**Interfaces:**
- Consumes: `routing`, `stripLocale` from Task 1.
- Produces: route tree that Tasks 3–4 assume: `src/app/(public)/[locale]/{page.tsx,about,game-review,chess-analysis,learn,awards}` and `src/app/(app)/{login,register,…}`.

- [ ] **Step 1: Create `frontend/src/app/root-shell.tsx`**

Copy VERBATIM from the current `src/app/layout.tsx`: the three font declarations, `SITE_URL`, the whole `metadata` object (rename export to `baseMetadata`), `ORG_ID`, `jsonLd`, and the body JSX. Shape:

```tsx
import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import AuthGuard from "@/components/AuthGuard";
import Analytics from "@/components/Analytics";

// … fonts (dmSans, jetbrainsMono, fraunces), SITE_URL, ORG_ID, jsonLd —
// copied verbatim from the old src/app/layout.tsx …

export const FONT_CLASS = `${dmSans.variable} ${jetbrainsMono.variable} ${fraunces.variable}`;

export const baseMetadata: Metadata = { /* verbatim old `metadata` object */ };

// Shared <body> for both root layouts ((public)/[locale] and (app)).
export function AppBody({ children }: { children: React.ReactNode }) {
  return (
    <body className="flex min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NextIntlClientProvider>
        <AuthProvider>
          <AuthGuard>{children}</AuthGuard>
        </AuthProvider>
        {/* footer JSX verbatim from old layout */}
      </NextIntlClientProvider>
      <Analytics />
    </body>
  );
}
```

- [ ] **Step 2: Create `frontend/src/app/(public)/[locale]/layout.tsx`**

```tsx
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AppBody, FONT_CLASS, baseMetadata } from "../../root-shell";

export const metadata = baseMetadata;

// Only en/hi/gu prerender; anything else ("/xyz" swallowed by [locale]) is a
// real HTTP 404. This is the soft-404 fix — do not remove.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PublicRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Pins the locale for static rendering — without this, next-intl falls
  // back to the cookie read in request.ts and the whole tree goes dynamic.
  setRequestLocale(locale);
  return (
    <html lang={locale} className={FONT_CLASS}>
      <AppBody>{children}</AppBody>
    </html>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/(app)/layout.tsx`**

```tsx
import { getLocale } from "next-intl/server";
import { AppBody, FONT_CLASS, baseMetadata } from "../root-shell";

export const metadata = baseMetadata;

// Authenticated + auth-flow routes: locale from the `locale` cookie (via
// request.ts fallback). The cookie read makes every route here dynamic —
// intended; none of these pages are indexable.
export default async function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={FONT_CLASS}>
      <AppBody>{children}</AppBody>
    </html>
  );
}
```

- [ ] **Step 4: Move the route files**

```bash
cd frontend/src/app
mkdir -p "(public)/[locale]" "(app)"
git mv page.tsx "(public)/[locale]/page.tsx"
git mv about game-review chess-analysis learn awards "(public)/[locale]/"
git mv digest endgame export forgot-password games import login openings \
  peer-comparison position-analyzer puzzles rating-predictor register report \
  reset-password scouting settings tilt time-management verify-email \
  weaknesses "(app)/"
git rm layout.tsx
```

Stays at `src/app/`: `globals.css`, `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`, `llms.txt/`, `root-shell.tsx`, favicon assets. (`sitemap.ts`/`robots.ts` keep working unchanged — English URLs are unprefixed, so every URL they emit is still live.)

- [ ] **Step 5: Create `frontend/src/middleware.ts`**

```ts
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
```

Note: if `npm run build` warns that `middleware.ts` is deprecated in favor of `proxy.ts` (Next 16), rename the file to `frontend/src/proxy.ts` and keep the identical content, renaming the default export accordingly per the warning text. Use whichever form builds without warnings.

- [ ] **Step 6: Add `setRequestLocale` to every server page under `(public)/[locale]/`**

For each `page.tsx` under `(public)/[locale]/` that does NOT start with `"use client"` (all of `about`, `game-review`, `chess-analysis`, `learn/**`, `awards/**` — the home `page.tsx` is a client component, skip it):

1. Add import: `import { setRequestLocale } from "next-intl/server";`
2. Give the default export the params prop and pin the locale as its first statement. Pages with no existing params:

```tsx
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // …existing body unchanged…
```

Pages that already take `params` (`awards/achievements/[slug]`, `awards/books/[slug]`) — widen the type and destructure both:

```tsx
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
```

Leave each page's `generateStaticParams` (slug-only) and `generateMetadata` untouched — Next composes the locale params from the layout, and metadata stays English/en-canonical this round (deferred by design).

If a page's default export is currently non-async, make it async. Do not otherwise reformat.

- [ ] **Step 7: Fix `frontend/src/components/AuthGuard.tsx` for locale-prefixed pathnames**

```tsx
import { stripLocale } from "@/i18n/routing";
```

and change the two pathname lines inside the component:

```tsx
  const rawPathname = usePathname();
  // "/hi/about" must match CONTENT_ROUTES' "/about"; "/hi" is home.
  const pathname = stripLocale(rawPathname);
```

(`usePathname` stays the one from `next/navigation`; the `router.replace("/login")` is correct unprefixed.)

- [ ] **Step 8: Build + test**

Run: `npm run build` — Expected: compiles; route table shows `(public)` routes as prerendered (`●`/`○`, e.g. `/[locale]/awards/achievements/[slug]` with 3×slugs entries) and `(app)` routes as dynamic (`ƒ`). If the build errors mentioning a duplicate root layout, `src/app/layout.tsx` was not deleted. If public routes still show `ƒ`, a cookie/header read is leaking into the static tree — check that `setRequestLocale` runs in the layout before anything else and that home/`page.tsx` was not given a server-side cookie read.
Run: `npx jest --silent` — Expected: green (the awards wiring test reads AuthGuard/robots/sitemap, none of which moved).
Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(i18n): move public routes under [locale] URL segment

Public pages statically generate again and unknown paths return a real
404 — the cookie read that forced app-wide dynamic rendering now only
runs for authenticated routes."
```

---

### Task 3: Locale-aware links + LanguageSwitcher navigation

After Task 2, `/hi/about` works when typed directly, but in-page links drop the prefix (a Hindi visitor clicking "Awards" lands on English `/awards`), and the language picker still only refreshes. Fix both.

**Files:**
- Modify: `frontend/src/components/LanguageSwitcher.tsx`
- Modify: every component/page rendering an `href` whose destination is inside `PUBLIC_PATHS` (find them: `grep -rn 'href="/' frontend/src/app/\(public\) frontend/src/components` plus `grep -rn 'href={' frontend/src/components/Sidebar.tsx frontend/src/components/Landing.tsx frontend/src/components/awards`) — switch those to the `Link` from `@/i18n/navigation`. Known set: the moved public pages' breadcrumbs/back-links (`awards/**`, `learn/**`, `about`, `game-review`, `chess-analysis`), `Landing.tsx`, `Sidebar.tsx` (its Learn/Awards/About entries only), `AwardCard.tsx`, `AwardGrid.tsx`, `AwardsHub.tsx`.
- Test: `frontend/src/components/__tests__/language-switcher-nav.test.tsx` is NOT required — the switcher's branch logic lives in `isPublicPath` (already unit-tested). Do not build a jsdom navigation harness for this.

**Interfaces:**
- Consumes: `Link`, `useRouter`, `usePathname` from `@/i18n/navigation`; `isPublicPath` from `@/i18n/routing`.

- [ ] **Step 1: Swap public-destination links to the locale-aware `Link`**

In each file found above, change the import `import Link from "next/link";` to `import { Link } from "@/i18n/navigation";` **iff** every `<Link>` in that file targets a public path. If a file mixes public and app destinations (e.g. `Sidebar.tsx`, `Landing.tsx` with login/register CTAs), import both:

```tsx
import Link from "next/link";
import { Link as LocaleLink } from "@/i18n/navigation";
```

and use `LocaleLink` only for the public destinations (`/`, `/about`, `/game-review`, `/chess-analysis`, `/learn…`, `/awards…`). Auth/app destinations (`/login`, `/register`, `/settings`, `/games…`, etc.) MUST keep plain `Link` — `/hi/login` does not exist and would 404.

- [ ] **Step 2: Rework `LanguageSwitcher.change()`**

```tsx
import { useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import {
  usePathname as useIntlPathname,
  useRouter as useIntlRouter,
} from "@/i18n/navigation";
import { isPublicPath } from "@/i18n/routing";
```

and inside the component:

```tsx
  const router = useRouter();
  const intlRouter = useIntlRouter();
  const intlPathname = useIntlPathname(); // locale-stripped on public routes
  // …existing useLocale/useTranslations/useTransition lines unchanged…

  function change(next: string) {
    // Cookie keeps the authenticated app (and future visits) in sync.
    document.cookie = `locale=${next};path=/;max-age=31536000;samesite=lax`;
    if (isPublicPath(intlPathname)) {
      // Public pages carry the locale in the URL — navigate to the same
      // page under the new locale ("/about" <-> "/hi/about").
      startTransition(() => intlRouter.replace(intlPathname, { locale: next }));
    } else {
      startTransition(() => router.refresh());
    }
  }
```

Update the component docstring (lines 10–14) to describe the two-path behavior.

- [ ] **Step 3: Test + typecheck**

Run: `npx jest --silent` — Expected: green.
Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(i18n): keep the locale across navigation and the language picker"
```

---

### Task 4: End-to-end verification (run by the orchestrator, not a subagent)

- [ ] **Step 1: Production build + server**

```bash
cd frontend && npm run build && PORT=3100 node .next/standalone/server.js &
```

(Static assets: `cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public` first if the standalone server 404s assets.)

- [ ] **Step 2: Curl matrix** (all against `http://localhost:3100`)

| URL | Expect |
|---|---|
| `/` | 200, `lang="en"` |
| `/hi` | 200, `lang="hi"` |
| `/gu/about` | 200, `lang="gu"` |
| `/en/about` | 3xx → `/about` (as-needed normalisation) |
| `/awards/achievements/<real-slug>` | 200 |
| `/awards/achievements/does-not-exist` | **404** (THE soft-404 fix) |
| `/no-such-page` | **404** |
| `/hi/login` | 404 (auth routes not localized) |
| `/login` | 200 |
| `/settings` | 200 (client-side auth redirect is fine; must not 500) |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/llms.txt`, `/opengraph-image` | 200 |

- [ ] **Step 3: Route-table audit** — from build output, confirm every `(public)` route is `●`/`○` (prerendered) and count ≈ 3 locales × (4 singles + 14 learn + 8 awards hubs) + 3×(achievements+books slugs). Confirm `(app)` routes are `ƒ`.

- [ ] **Step 4: Kill the server** (`kill %1`), verify no orphan node processes.
