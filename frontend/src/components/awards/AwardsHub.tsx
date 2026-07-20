"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ScanPanel from "./ScanPanel";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Section } from "@/components/ui/page-kit";
import { useScan } from "@/lib/awards/useScan";
import { readManual } from "@/lib/awards/manual";
import { getAllAwards, getCatalog, type AwardCategory } from "@/lib/awards/catalog";
import { evaluate } from "@/lib/awards/evaluate";

const TRACKED_CATEGORIES: { key: AwardCategory; href: string; title: string; blurb: string }[] = [
  {
    key: "achievements",
    href: "/awards/achievements",
    title: "Achievements",
    blurb: "One-off milestones — mate with a knight, win flawlessly, and more.",
  },
  {
    key: "books",
    href: "/awards/books",
    title: "Books",
    blurb: "Unlock every opening book by playing that opening at least once.",
  },
  {
    key: "passports",
    href: "/awards/passports",
    title: "Passports",
    blurb: "Play an opponent from every country on the ISO-3166 list.",
  },
];

const STUB_CATEGORIES: { key: string; href: string; title: string; blurb: string }[] = [
  {
    key: "badges",
    href: "/awards/badges",
    title: "Badges",
    blurb: "Sent by opponents after a game. Not exposed by any public API.",
  },
  {
    key: "cheers",
    href: "/awards/cheers",
    title: "Cheers",
    blurb: "Sent player-to-player, outside of games.",
  },
  {
    key: "medals",
    href: "/awards/medals",
    title: "Medals",
    blurb: "Tournament placement. Chess.com uses custom art, not a fixed catalog.",
  },
];

/**
 * Client shell for the /awards hub: owns the one `useScan()` instance so the
 * scan box, the overall progress bar, and the per-category counts all stay
 * in sync off a single source of truth.
 */
export default function AwardsHub() {
  const { scan, username, status, progress, error, start, clear } = useScan();
  const [manual] = useState(() => readManual());

  const all = useMemo(() => getAllAwards(), []);
  const measurements = scan?.measurements ?? null;
  const overallStatuses = useMemo(
    () => evaluate(all, measurements, manual),
    [all, measurements, manual]
  );
  const overallEarned = overallStatuses.filter((s) => s.earned).length;

  const perCategory = useMemo(() => {
    const out: Record<string, { earned: number; total: number }> = {};
    for (const cat of TRACKED_CATEGORIES) {
      const catalog = getCatalog(cat.key);
      const statuses = evaluate(catalog, measurements, manual);
      out[cat.key] = { earned: statuses.filter((s) => s.earned).length, total: catalog.length };
    }
    return out;
  }, [measurements, manual]);

  return (
    <>
      <ScanPanel
        username={username}
        scan={scan}
        status={status}
        progress={progress}
        error={error}
        onStart={start}
        onClear={clear}
      />

      {scan && (
        <div className="surface-card mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Overall progress for {scan.username}
            </p>
            <span className="font-mono text-sm text-accent-300">
              {overallEarned}/{all.length}
            </span>
          </div>
          <div className="mt-4">
            <ProgressBar value={overallEarned} max={all.length} />
          </div>
        </div>
      )}

      <Section title="Tracked" className="mt-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TRACKED_CATEGORIES.map((c) => {
            const counts = perCategory[c.key];
            return (
              <Link key={c.key} href={c.href} className="surface-card block p-6 card-hover">
                <h3 className="font-display text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{c.blurb}</p>
                {counts && (
                  <div className="mt-4">
                    <ProgressBar
                      value={counts.earned}
                      max={counts.total}
                      label={scan ? `${counts.earned}/${counts.total} earned` : `${counts.total} total`}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        title="Explained, not tracked"
        description="Chess.com does not expose these through any public API or on public profile pages, so we do not pretend to detect them. Each page explains why, and how to earn them anyway."
        className="mt-10"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STUB_CATEGORIES.map((c) => (
            <Link key={c.key} href={c.href} className="surface-card block p-6 card-hover">
              <h3 className="font-display text-lg font-semibold text-white">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
