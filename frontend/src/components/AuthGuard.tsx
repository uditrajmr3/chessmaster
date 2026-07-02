"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";
import Loader from "@/components/Loader";

// Auth/transactional pages — always rendered bare (no app chrome), regardless
// of sign-in state.
const AUTH_ROUTES = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

// Public content/marketing pages — indexable and visible to signed-out visitors
// (rendered bare so they're crawlable), but shown *inside* the app chrome when a
// signed-in user navigates to them (e.g. the Learn guides linked from the
// sidebar), so they don't feel like they left the app.
const CONTENT_ROUTES = ["/about", "/game-review", "/chess-analysis", "/learn"];

function matches(routes: string[], pathname: string): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const t = useTranslations("auth");
  const router = useRouter();
  const pathname = usePathname();

  const isAuthRoute = matches(AUTH_ROUTES, pathname);
  const isContentRoute = matches(CONTENT_ROUTES, pathname);
  const isPublic = isAuthRoute || isContentRoute;
  // The home route is open to everyone: a marketing landing for signed-out
  // visitors, the dashboard (with chrome) once signed in. page.tsx picks which.
  const isHome = pathname === "/";

  useEffect(() => {
    if (!loading && !user && !isPublic && !isHome) {
      router.replace("/login");
    }
  }, [loading, user, isPublic, isHome, router]);

  const chrome = (
    <>
      <Sidebar />
      <StatusBar />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-8">{children}</main>
    </>
  );

  // Auth/transactional pages — never any chrome.
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Public content pages — bare for signed-out visitors (and during SSR/auth
  // resolution, so the page is server-rendered and indexable); inside the app
  // chrome once a user is signed in. Guides are public, so we don't gate them
  // behind email verification.
  if (isContentRoute) {
    if (loading || !user) return <>{children}</>;
    return chrome;
  }

  // Home renders for everyone. While auth resolves — including SSR, where
  // `loading` is true — render the public landing (page.tsx shows <Landing/>
  // when there's no user) instead of a spinner, so the marketing homepage is
  // server-rendered and indexable.
  if (isHome && (loading || !user)) {
    return <>{children}</>;
  }

  // Show loading state while auth is resolving (protected routes).
  if (loading) {
    return <Loader fullscreen />;
  }

  // Unauthenticated on a protected route — redirect happening, render nothing
  if (!user) {
    return null;
  }

  // Authenticated but email not verified
  if (!user.is_verified) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center px-4">
        <div className="surface-card max-w-md w-full p-8 text-center">
          <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/12 border border-accent-500/25">
            <Mail className="h-5 w-5 text-accent-300" strokeWidth={1.75} />
          </span>
          <h2 className="mb-2 text-xl font-semibold text-white">
            {t("verifyEmailTitle")}
          </h2>
          <p className="mb-6 text-sm text-white/55">
            {t.rich("verifyGateBody", {
              email: user.email,
              em: (chunks) => <span className="text-white/80">{chunks}</span>,
            })}
          </p>
          <button
            onClick={() => api.requestVerify(user.email)}
            className="rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
          >
            {t("resendVerification")}
          </button>
        </div>
      </div>
    );
  }

  // Authenticated + verified — render full app chrome
  return chrome;
}
