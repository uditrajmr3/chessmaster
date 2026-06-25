"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";

const PUBLIC_ROUTES = [
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

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.replace("/login");
    }
  }, [loading, user, isPublic, router]);

  // Always render public routes without restriction
  if (isPublic) {
    return <>{children}</>;
  }

  // Show loading state while auth is resolving
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-amber-800">
            Verify your email
          </h2>
          <p className="mb-6 text-amber-700">
            Please check your inbox and verify your email address to access
            ChessMaster.
          </p>
          <button
            onClick={() => api.requestVerify(user.email)}
            className="rounded-md bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
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
