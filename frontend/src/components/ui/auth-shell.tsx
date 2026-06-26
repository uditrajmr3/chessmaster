"use client";

import React from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

/* Shared field + button styles so every auth screen matches the login card. */
export const authInputClass =
  "w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20";

export const authLabelClass =
  "block text-xs font-medium text-white/60 mb-1.5 tracking-wide";

export function AuthButton({
  children,
  className = "",
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      className={
        "w-full h-11 px-4 bg-accent-500 hover:bg-accent-400 text-[#1a120c] font-semibold rounded-lg btn-press transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

/** Success / info callout in the warm accent. */
export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-accent-500/10 border border-accent-500/25 rounded-lg p-4 text-accent-200 text-sm">
      {children}
    </div>
  );
}

/** Error callout. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="bg-red-500/10 border border-red-500/25 rounded-lg p-4 text-red-300 text-sm"
    >
      {children}
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Moonwalker field */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,#1c2f40_0%,#152331_34%,#0a1219_66%,#000000_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100vh] h-[50vh] rounded-b-full bg-accent-500/10 blur-[90px]" />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="relative bg-[#0c1722]/70 backdrop-blur-xl rounded-2xl p-8 border border-white/[0.06] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)]">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-7">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent-500/12 border border-accent-500/25">
              <Logo className="w-5 h-5 text-accent-300" />
            </span>
            <span className="font-display text-lg font-semibold text-white/90">
              ChessInt
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1.5">{title}</h1>
          {subtitle && <p className="text-white/55 text-sm mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}

          {children}

          {footer && (
            <p className="mt-6 text-center text-sm text-white/55">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** A footer link styled with the warm accent underline. */
export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-white font-medium hover:text-accent-300 transition-colors underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}
