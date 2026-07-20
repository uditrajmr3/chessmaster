"use client";

import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProvenanceBadge } from "./ProvenanceBadge";
import type { AwardEntry, AwardStatus } from "@/lib/awards/types";

export interface AwardCardProps {
  award: AwardEntry;
  status: AwardStatus;
  /** Link to the per-award guide page. Omitted for passports, which
   * deliberately get no detail pages (see plan Task 11). */
  href?: string;
  onToggleManual?: (id: string, on: boolean) => void;
}

/**
 * One award: name, description, earned/locked state, a progress bar when the
 * rule tracks toward a numeric threshold, a provenance badge, and — for
 * awards with no detectable rule — a manual checkbox. The title is the only
 * link (not the whole card) so the checkbox stays a sibling control instead
 * of nesting an <input> inside an <a>.
 */
export function AwardCard({ award, status, href, onToggleManual }: AwardCardProps) {
  return (
    <div
      className={`surface-card card-hover flex h-full flex-col gap-3 p-5 ${
        status.earned ? "ring-1 ring-inset ring-accent-500/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-white">
          {href ? (
            <Link href={href} className="underline-offset-4 hover:underline">
              {award.name}
            </Link>
          ) : (
            award.name
          )}
        </h3>
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            status.earned ? "bg-accent-500/20 text-accent-300" : "bg-white/5 text-gray-500"
          }`}
          title={status.earned ? "Earned" : "Not earned yet"}
        >
          {status.earned ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Lock className="h-3 w-3" aria-hidden />
          )}
        </span>
      </div>

      <p className="flex-1 text-sm leading-relaxed text-gray-400">{award.description}</p>

      {status.progress && (
        <ProgressBar value={status.progress.current} max={status.progress.target} />
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <ProvenanceBadge provenance={award.provenance} awardName={award.name} />
        {status.manual && (
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={status.earned}
              onChange={(e) => onToggleManual?.(award.id, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-500 bg-ink-900 accent-accent-500"
            />
            I&apos;ve earned this
          </label>
        )}
      </div>
    </div>
  );
}
