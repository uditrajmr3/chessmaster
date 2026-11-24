"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/page-kit";
import { ProgressBar } from "@/components/ui/ProgressBar";
import NextStep, { type NextStepProps } from "./NextStep";

/** Default sample-size thresholds (spec §2.7). */
export const LOW_DATA = { patterns: 10, perRow: 5, trendMonths: 3 } as const;

export type LowDataUnit = "games" | "analyzedGames" | "gamesWithClock" | "endgames";

export interface LowDataProps {
  have: number;
  need: number;
  unit: LowDataUnit;
  action?: NextStepProps;
  /** Plain-language description of what unlocks once there is enough data. */
  unlocks?: string;
  /** Rendered once have >= need. */
  children?: ReactNode;
}

export default function LowData({ have, need, unit, action, unlocks, children }: LowDataProps) {
  const t = useTranslations("lowData");

  if (have >= need) return <>{children}</>;

  const haveText = t(`units.${unit}`, { count: have });
  const needText = t(`units.${unit}`, { count: need });

  if (have <= 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t("none")}
        description={t("needHint", { need: needText })}
        action={action ? <NextStep {...action} /> : undefined}
      />
    );
  }

  return (
    <section data-testid="low-data-partial" className="surface-card rounded-2xl p-5 sm:p-6">
      <p className="text-base font-semibold text-white">
        {t("partial", { have: haveText, need: needText })}
      </p>
      <div className="mt-4">
        <ProgressBar value={have} max={need} label={t("progress")} />
      </div>
      {unlocks && <p className="mt-4 text-sm text-white/65">{t("unlocks", { what: unlocks })}</p>}
      {action && (
        <div className="mt-4">
          <NextStep {...action} />
        </div>
      )}
    </section>
  );
}
