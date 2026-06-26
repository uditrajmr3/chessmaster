"use client";

import React, { type ElementType } from "react";

/**
 * Shared layout primitives for the authenticated app. Every feature page uses
 * the same header rhythm, empty state, and stat treatment so the internal UI
 * reads as one product rather than 16 separately-built screens.
 */

/** Page title block: title, optional subtitle, optional right-aligned action. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-white/55 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Composed empty state: icon badge, headline, helper copy, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-16 sm:py-20 animate-fade-in-up ${className}`}
    >
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500/10 border border-accent-500/20 accent-glow">
        <Icon className="h-6 w-6 text-accent-300" strokeWidth={1.5} />
      </span>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Section wrapper with an optional label, for grouping content on a page. */
export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-white">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-white/50">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A single KPI: uppercase micro-label over a large tabular value. */
export function Stat({
  label,
  value,
  hint,
  valueClassName = "text-white",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="surface-card p-5 card-hover">
      <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium">
        {label}
      </p>
      <p
        className={`mt-3 text-[1.7rem] leading-none font-bold font-mono ${valueClassName}`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-white/45">{hint}</p>}
    </div>
  );
}

/** Result pill shared by Games, Scouting, etc. */
export function ResultBadge({ result }: { result: string }) {
  const tone =
    result === "win"
      ? "bg-green-500/15 text-green-400"
      : result === "loss"
      ? "bg-red-500/15 text-red-400"
      : "bg-yellow-500/15 text-yellow-400";
  return (
    <span
      className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${tone}`}
    >
      {result}
    </span>
  );
}
