"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";

const PUBLIC_ROUTES = [
  "/about",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = isPublicRoute(pathname);
  // The home route is open to everyone: a marketing landing for signed-out
  // visitors, the dashboard (with chrome) once signed in. page.tsx picks which.
  const isHome = pathname === "/";

  useEffect(() => {
    if (!loading && !user && !isPublic && !isHome) {
      router.replace("/login");
    }
  }, [loading, user, isPublic, isHome, router]);

  // Bare public routes (auth pages, about) — no app chrome
  if (isPublic) {
    return <>{children}</>;
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent opacity-60" />
      </div>
    );
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
            Verify your email
          </h2>
          <p className="mb-6 text-sm text-white/55">
            Check your inbox and confirm{" "}
            <span className="text-white/80">{user.email}</span> to unlock
            ChessInt.
          </p>
          <button
            onClick={() => api.requestVerify(user.email)}
            className="rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
          >
            Resend verification email
          </button>
        </div>
      </div>
    );
  }

  // Authenticated + verified — render full app chrome
  return (
    <>
      <Sidebar />
      <StatusBar />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-8">{children}</main>
    </>
  );
}
