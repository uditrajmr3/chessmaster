"use client";

import { useTranslations } from "next-intl";
import Term from "@/components/Term";
import { accuracyGrade, type AccuracyGrade } from "@/lib/accuracy";

export { accuracyGrade };
export type { AccuracyGrade };

const GRADE_STYLE: Record<AccuracyGrade, { text: string; ring: string }> = {
  excellent: { text: "text-green-400", ring: "stroke-green-400" },
  good: { text: "text-green-300", ring: "stroke-green-300" },
  ok: { text: "text-yellow-400", ring: "stroke-yellow-400" },
  shaky: { text: "text-orange-400", ring: "stroke-orange-400" },
  costly: { text: "text-red-400", ring: "stroke-red-400" },
};

export interface AccuracyBadgeProps {
  value: number | null;
  source: "chessint" | "platform" | null;
  /** Number of games the value is averaged over (dashboard). */
  basedOn?: number;
  size?: "sm" | "lg";
  /** Display name for the "from X" note when source is platform. */
  platformName?: string;
}

function Ring({ pct, className, px }: { pct: number; className: string; px: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg width={px} height={px} viewBox="0 0 36 36" aria-hidden="true" className="shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-white/10" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        className={className}
      />
    </svg>
  );
}

export default function AccuracyBadge({
  value,
  source,
  basedOn,
  size = "sm",
  platformName,
}: AccuracyBadgeProps) {
  const t = useTranslations("plain");
  const lg = size === "lg";

  if (value === null) {
    return (
      <span className={`${lg ? "text-sm" : "text-xs"} text-gray-500`}>{t("accuracy.notAnalyzed")}</span>
    );
  }

  const grade = accuracyGrade(value);
  const style = GRADE_STYLE[grade];
  const shown = (Math.round(value * 10) / 10).toFixed(1);

  return (
    <span
      className="inline-flex items-center gap-2 align-middle"
      title={source === "chessint" ? t("accuracy.byChessInt") : undefined}
    >
      <Ring pct={value} className={style.ring} px={lg ? 40 : 22} />
      <span className="inline-flex flex-col items-start leading-tight">
        <span className="inline-flex items-baseline gap-1.5">
          <span className={`font-mono font-bold ${lg ? "text-2xl" : "text-sm"} text-white`}>
            {shown}
            <span className={`${lg ? "text-sm" : "text-xs"} text-white/50`}>%</span>
          </span>
          <span className={`${lg ? "text-sm" : "text-xs"} font-medium ${style.text}`}>
            {t(`grade.${grade}`)}
          </span>
        </span>
        {lg && (
          <span className="text-[0.7rem] text-white/40 mt-0.5">
            <Term id="accuracy">{t("accuracy.label")}</Term>
          </span>
        )}
        {basedOn !== undefined && (
          <span className="text-[0.7rem] text-white/40">{t("accuracy.basedOn", { count: basedOn })}</span>
        )}
        {source === "platform" && (
          <span className="text-[0.65rem] text-white/40">
            {t("accuracy.fromPlatform", { platform: platformName ?? "Chess.com/Lichess" })}
          </span>
        )}
      </span>
    </span>
  );
}
