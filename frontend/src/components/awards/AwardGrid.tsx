"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AwardCard } from "./AwardCard";
import { EmptyState } from "@/components/ui/page-kit";
import { evaluate } from "@/lib/awards/evaluate";
import { readLastScan } from "@/lib/awards/useScan";
import { readManual, writeManual, type ManualState } from "@/lib/awards/manual";
import type { AwardEntry, AwardStatus, Measurements } from "@/lib/awards/types";

type Filter = "all" | "earned" | "unearned";

export interface AwardGridProps {
  catalog: AwardEntry[];
  /** When set, each card's title links to `${basePath}/${slug}`. Omitted for
   * passports, which deliberately get no detail pages. */
  basePath?: string;
}

/**
 * Client grid over a static catalog: text filter + earned/unearned/all
 * buttons (no tabs abstraction, per design spec §5.6). Reads the last scan
 * and manual checkboxes from localStorage after mount — starting from
 * "nothing scanned" on both the server render and the first client render
 * avoids a hydration mismatch, then one effect enriches it.
 */
export function AwardGrid({ catalog, basePath }: AwardGridProps) {
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [scannedUsername, setScannedUsername] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualState>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const last = readLastScan();
    setMeasurements(last?.scan.measurements ?? null);
    setScannedUsername(last?.username ?? null);
    setManual(readManual());
  }, []);

  const statuses = useMemo(
    () => evaluate(catalog, measurements, manual),
    [catalog, measurements, manual]
  );
  const statusById = useMemo(() => {
    const map = new Map<string, AwardStatus>();
    for (const s of statuses) map.set(s.id, s);
    return map;
  }, [statuses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) {
        return false;
      }
      const earned = statusById.get(a.id)?.earned ?? false;
      if (filter === "earned") return earned;
      if (filter === "unearned") return !earned;
      return true;
    });
  }, [catalog, query, filter, statusById]);

  function toggleManual(id: string, on: boolean) {
    setManual(writeManual(id, on));
  }

  const earnedCount = statuses.filter((s) => s.earned).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Filter by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-ink-600 bg-ink-900 py-2 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "earned", "unearned"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold btn-press ${
                filter === f
                  ? "bg-accent-500 text-[#1a120c]"
                  : "border border-ink-600 text-gray-300 hover:border-ink-500"
              }`}
            >
              {f === "all" ? "All" : f === "earned" ? "Earned" : "Not earned"}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {scannedUsername ? (
          <>
            {earnedCount}/{catalog.length} earned for{" "}
            <span className="text-gray-300">{scannedUsername}</span>.
          </>
        ) : (
          <>
            Showing the full catalog — scan your username on the{" "}
            <Link href="/awards" className="text-accent-300 underline underline-offset-2">
              Awards hub
            </Link>{" "}
            to see what you&apos;ve earned.
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No awards match"
          description="Try a different search term or filter."
          className="mt-8"
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((award) => (
            <AwardCard
              key={award.id}
              award={award}
              status={statusById.get(award.id)!}
              href={basePath ? `${basePath}/${award.slug}` : undefined}
              onToggleManual={toggleManual}
            />
          ))}
        </div>
      )}
    </div>
  );
}
