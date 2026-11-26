"use client";

// Plain horizontal bars: how many of your puzzles fall in each bucket, each with
// a "Practise" link that deep-links back into /puzzles filtered to that bucket.

import Link from "next/link";
import { useTranslations } from "next-intl";

export type BarRow = { id: string; label: string; count: number; href: string };

export default function ProgressBars({ title, rows }: { title: string; rows: BarRow[] }) {
  const t = useTranslations("puzzles");
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h4>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-white/85">{r.label}</span>
              <span className="shrink-0 text-xs text-white/55">{t("progress.count", { count: r.count })}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div
                className="h-full rounded-full bg-accent-500"
                style={{ width: `${Math.max(6, Math.round((r.count / max) * 100))}%` }}
              />
            </div>
            <Link
              href={r.href}
              className="inline-flex min-h-11 items-center text-sm font-medium text-accent-300 underline-offset-4 hover:text-accent-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300"
            >
              {t("progress.practise")}
              <span className="sr-only"> {r.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
