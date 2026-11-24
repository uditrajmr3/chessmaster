"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import NextStep, { type NextStepProps } from "./NextStep";
import ShowNumbers from "./ShowNumbers";
import { TONE_STYLE, type InsightTone } from "./tone";

export type { InsightTone };

export interface InsightCardProps {
  tone: InsightTone;
  /** One sentence: the finding. */
  headline: string;
  /** One optional supporting sentence. */
  detail?: string;
  /** A chart, MoveBoard or mini stat. */
  evidence?: ReactNode;
  /** Number of games the finding is based on. */
  basedOn?: number;
  /** At most one action (single prop by design). */
  action?: NextStepProps;
  /** Content of the "Show numbers" disclosure. */
  numbers?: ReactNode;
}

export default function InsightCard({
  tone,
  headline,
  detail,
  evidence,
  basedOn,
  action,
  numbers,
}: InsightCardProps) {
  const t = useTranslations("plain");
  const { icon: Icon, border, text } = TONE_STYLE[tone];

  return (
    <article
      data-tone={tone}
      className={`surface-card rounded-2xl border-l-4 ${border} p-4 sm:p-5`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${text}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-white">
            <span className="sr-only">{t(`tone.${tone}`)}: </span>
            {headline}
          </h3>
          {detail && <p className="mt-1 text-sm text-white/65">{detail}</p>}
        </div>
      </div>
      {evidence && <div className="mt-4">{evidence}</div>}
      {numbers && (
        <div className="mt-2">
          <ShowNumbers>{numbers}</ShowNumbers>
        </div>
      )}
      {(basedOn !== undefined || action) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {action ? <NextStep {...action} /> : <span />}
          {basedOn !== undefined && (
            <p className="text-xs text-white/45">{t("basedOn", { count: basedOn })}</p>
          )}
        </div>
      )}
    </article>
  );
}
