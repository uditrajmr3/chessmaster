"use client";

import { useEffect, useState, useCallback } from "react";
import { Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { PatternReport, GameFilters, ExamplePosition, MistakeOut } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState } from "@/components/ui/page-kit";
import PageAnswer from "@/components/insight/PageAnswer";
import InsightCard from "@/components/insight/InsightCard";
import MistakeCard, { type MistakeCardMistake } from "@/components/insight/MistakeCard";
import MoveBoard from "@/components/insight/MoveBoard";
import LowData, { LOW_DATA } from "@/components/insight/LowData";
import ShowNumbers from "@/components/insight/ShowNumbers";
import type { NextStepProps } from "@/components/insight/NextStep";
import { puzzlesHref } from "@/lib/nextStep";
import { cplGrade } from "@/lib/plain";
import { MOTIF_ID } from "@/lib/verdict";
import {
  weaknessHeadline,
  clockMultiple,
  CLOCK_RATIO_MIN,
  CLOCK_TROUBLE_RATE_MIN,
  COLOR_GAMES_MIN,
  COLOR_GAP_MIN,
  ENDGAME_CONVERSION_MAX,
  BAD_RATIO,
  type Phase,
} from "@/lib/weaknessHeadline";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#101c27",
  border: "1px solid #33495a",
  borderRadius: "8px",
  color: "#eaf0f3",
};

const PHASES: Phase[] = ["opening", "middlegame", "endgame"];
const COSTLY_COUNT = 6;
const UCI_RE = /^[a-h][1-8][a-h][1-8]/;

const GRADE_TEXT: Record<string, string> = {
  excellent: "text-green-400",
  good: "text-green-400",
  ok: "text-white/80",
  shaky: "text-amber-400",
  costly: "text-red-400",
};

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function toCardMistake(pos: ExamplePosition): MistakeCardMistake {
  const d = pos.date ? new Date(pos.date) : null;
  return {
    game_id: pos.game_id,
    move_number: pos.move_number,
    fen_before: pos.fen_before,
    move_uci: pos.move_uci,
    move_san: pos.move_san,
    best_move_uci: pos.best_move_uci,
    best_move_san: pos.best_move_san,
    refutation_uci: pos.refutation_uci,
    eval_before: pos.eval_before,
    eval_after: pos.eval_after,
    centipawn_loss: pos.centipawn_loss,
    tactical_motifs: pos.tactical_motifs,
    classification: pos.classification,
    player_color: pos.player_color === "black" ? "black" : "white",
    opponent: pos.opponent ?? undefined,
    date: d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : undefined,
  };
}

function motifBoard(m: MistakeOut, ariaLabel: string) {
  const arrows: { from: string; to: string; tone: "bad" | "good" }[] = [];
  if (m.move_uci && UCI_RE.test(m.move_uci))
    arrows.push({ from: m.move_uci.slice(0, 2), to: m.move_uci.slice(2, 4), tone: "bad" });
  if (m.best_move_uci && UCI_RE.test(m.best_move_uci))
    arrows.push({ from: m.best_move_uci.slice(0, 2), to: m.best_move_uci.slice(2, 4), tone: "good" });
  return (
    <div className="max-w-[240px]">
      <MoveBoard
        fen={m.fen_before}
        orientation={m.player_color === "black" ? "black" : "white"}
        arrows={arrows}
        size="sm"
        ariaLabel={ariaLabel}
        legend
      />
    </div>
  );
}

export default function WeaknessesPage() {
  const t = useTranslations("weaknesses");
  const tn = useTranslations("nextStep");
  const tp = useTranslations("plain");
  const tm = useTranslations("motif");

  const [patterns, setPatterns] = useState<PatternReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api
      .getPatterns(filters)
      .then(setPatterns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useDataRefresh(loadData);

  if (loading) return <WeaknessesSkeleton />;
  if (!patterns)
    return (
      <EmptyState icon={Target} title={t("empty.title")} description={t("empty.description")} />
    );

  const motifId = (raw: string) => MOTIF_ID[raw];
  const motifName = (raw: string) => {
    const id = motifId(raw);
    return id && tm.has(`${id}.name`) ? tm(`${id}.name`) : raw.replace(/_/g, " ");
  };
  const motifExplain = (raw: string) => {
    const id = motifId(raw);
    return id && tm.has(`${id}.explain`) ? tm(`${id}.explain`) : undefined;
  };
  const phaseWord = (p: string) => tn(`phase.${p}`);
  const colorWord = (c: string) => t(`colors.${c}`);

  // ---- headline ----
  const h = weaknessHeadline(patterns);
  let answer: string;
  let action: NextStepProps | undefined;
  switch (h.kind) {
    case "phase":
      answer = t("answer.phase", { phase: phaseWord(h.phase) });
      action = {
        label: tn("practisePhase", { phase: phaseWord(h.phase) }),
        href: puzzlesHref({ phase: h.phase }),
      };
      break;
    case "motif":
      answer = t("answer.motif", { motif: motifName(h.motif), count: h.count });
      action = {
        label: tn("practiseMotif", { motif: motifName(h.motif) }),
        href: puzzlesHref({ motif: h.motif }),
      };
      break;
    case "clock":
      answer = h.times === null ? t("answer.clockOnly") : t("answer.clock", { times: h.times });
      action = { label: t("action.clock"), href: "/time-management" };
      break;
    case "color": {
      const better = h.worse === "white" ? "black" : "white";
      answer = t("answer.color", { worse: colorWord(h.worse), better: colorWord(better) });
      action = { label: t("action.color"), href: "/openings" };
      break;
    }
    case "endgame":
      answer = t("answer.endgame", { rate: h.rate });
      action = { label: t("action.endgame"), href: "/endgame" };
      break;
    default:
      answer = t("answer.none");
  }

  // ---- costly mistakes ----
  const costly = (patterns.example_positions ?? []).slice(0, COSTLY_COUNT);

  // ---- tactics ----
  const motifs = Object.entries(patterns.missed_tactics ?? {})
    .filter(([, c]) => num(c) > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // ---- phases ----
  const phaseRows = PHASES.map((p) => ({ p, cpl: num(patterns.phase_accuracy?.[p]) }));
  const worstCpl = Math.max(...phaseRows.map((r) => r.cpl));
  const phaseData = phaseRows.map((r) => ({ phase: tp(`phase.${r.p}`), loss: r.cpl }));
  const blunderBuckets = Object.entries(patterns.blunder_by_move_bucket ?? {}).map(
    ([bucket, rate]) => ({ bucket, rate }),
  );

  // ---- other patterns ----
  const trouble = num(patterns.blunder_rate_time_trouble);
  const normal = num(patterns.blunder_rate_normal);
  const times = clockMultiple(patterns);
  const clockLeak = times !== null && times >= CLOCK_RATIO_MIN && trouble >= CLOCK_TROUBLE_RATE_MIN;
  const clockCard = {
    tone: times === null ? ("neutral" as const) : clockLeak ? (times >= CLOCK_RATIO_MIN * BAD_RATIO ? ("bad" as const) : ("warn" as const)) : ("good" as const),
    headline:
      times === null
        ? t("clock.none")
        : clockLeak
          ? normal > 0
            ? t("clock.body", { times: Math.round(times * 10) / 10 })
            : t("clock.bodyOnly")
          : t("clock.fine"),
  };

  const w = patterns.white_stats ?? {};
  const b = patterns.black_stats ?? {};
  const colorOk = num(w.games) >= COLOR_GAMES_MIN && num(b.games) >= COLOR_GAMES_MIN;
  const colorGap = num(w.win_rate) - num(b.win_rate);
  const colorBetter = colorGap >= 0 ? "white" : "black";
  const colorWorse = colorBetter === "white" ? "black" : "white";
  const colorCard = !colorOk
    ? { tone: "neutral" as const, headline: t("color.none") }
    : Math.abs(colorGap) >= COLOR_GAP_MIN
      ? {
          tone: (Math.abs(colorGap) >= COLOR_GAP_MIN * BAD_RATIO ? "bad" : "warn") as "bad" | "warn",
          headline: t("color.body", { better: colorWord(colorBetter), worse: colorWord(colorWorse) }),
        }
      : { tone: "good" as const, headline: t("color.even") };

  const conv = num(patterns.endgame_conversion_rate);
  const endgameCard =
    conv <= 0
      ? { tone: "neutral" as const, headline: t("endgame.none") }
      : {
          tone: (conv > 80 ? "good" : conv > ENDGAME_CONVERSION_MAX ? "neutral" : conv > ENDGAME_CONVERSION_MAX / 2 ? "warn" : "bad") as
            | "good"
            | "neutral"
            | "warn"
            | "bad",
          headline: t("endgame.body", { rate: Math.round(conv) }),
        };

  const numRow = (label: string, value: string) => (
    <>
      <dt className="text-white/50">{label}</dt>
      <dd>{value}</dd>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} action={<GameFilterBar filters={filters} onChange={setFilters} />} />

      <LowData
        have={num(patterns.games_analyzed)}
        need={LOW_DATA.patterns}
        unit="analyzedGames"
        unlocks={t("unlocks")}
        action={{ label: tn("analyzeMore"), href: "/games" }}
      >
        <div className="space-y-8">
          <PageAnswer question={t("question")} answer={answer} tone={h.tone} action={action} />

          {/* Costly mistakes */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{t("costly.title")}</h2>
            {costly.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {costly.map((pos) => (
                  <MistakeCard
                    key={`${pos.game_id}-${pos.move_number}-${pos.move_uci}`}
                    mistake={toCardMistake(pos)}
                    compact
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/55">{t("costly.empty")}</p>
            )}
          </section>

          {/* Tactics */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{t("motifs.title")}</h2>
            {motifs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {motifs.map(([raw, count]) => {
                  const ex = patterns.motif_examples?.[raw];
                  const name = motifName(raw);
                  return (
                    <InsightCard
                      key={raw}
                      tone="warn"
                      headline={t("motifs.count", { count, motif: name })}
                      detail={motifExplain(raw)}
                      evidence={ex ? motifBoard(ex, name) : undefined}
                      action={{
                        label: tn("practiseMotif", { motif: name }),
                        href: puzzlesHref({ motif: raw }),
                        variant: "inline",
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/55">{t("motifs.empty")}</p>
            )}
          </section>

          {/* Phases */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{t("phases.title")}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {phaseRows.map(({ p, cpl }) => {
                const has = cpl > 0;
                const grade = has ? cplGrade(cpl) : null;
                const weakest = has && cpl === worstCpl && phaseRows.filter((r) => r.cpl > 0).length > 1;
                return (
                  <div key={p} className="surface-card rounded-2xl p-4" data-testid={`phase-tile-${p}`}>
                    <p className="text-sm text-white/65">{tp(`phase.${p}`)}</p>
                    <p className={`mt-1 text-xl font-bold ${grade ? GRADE_TEXT[grade] : "text-white/45"}`}>
                      {grade ? tp(`grade.${grade}`) : t("phases.noData")}
                    </p>
                    {weakest && (
                      <span className="mt-2 inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                        {t("phases.weakest")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <ShowNumbers>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-white/70">{t("phases.chartTitle")}</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height={192}>
                      <BarChart data={phaseData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
                        <XAxis dataKey="phase" stroke="#90a2b1" fontSize={11} />
                        <YAxis stroke="#90a2b1" fontSize={12} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="loss" fill="#a78368" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-white/70">{t("phases.bucketTitle")}</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height={192}>
                      <BarChart data={blunderBuckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
                        <XAxis dataKey="bucket" stroke="#90a2b1" fontSize={11} />
                        <YAxis stroke="#90a2b1" fontSize={12} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value) => [`${value}%`, ""]}
                        />
                        <Bar dataKey="rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </ShowNumbers>
          </section>

          {/* Other patterns */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{t("other.title")}</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <InsightCard
                tone={clockCard.tone}
                headline={clockCard.headline}
                action={{ label: t("action.clock"), href: "/time-management", variant: "inline" }}
                numbers={
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-white/75">
                    {numRow(t("numbers.normal"), `${normal}%`)}
                    {numRow(t("numbers.trouble"), `${trouble}%`)}
                  </dl>
                }
              />
              <InsightCard
                tone={colorCard.tone}
                headline={colorCard.headline}
                action={{ label: t("action.color"), href: "/openings", variant: "inline" }}
                numbers={
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-white/75">
                    {numRow(t("numbers.white"), `${num(w.win_rate)}%`)}
                    {numRow(t("numbers.black"), `${num(b.win_rate)}%`)}
                  </dl>
                }
              />
              <InsightCard
                tone={endgameCard.tone}
                headline={endgameCard.headline}
                action={{ label: t("action.endgame"), href: "/endgame", variant: "inline" }}
                numbers={
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-white/75">
                    {numRow(t("numbers.rate"), `${conv}%`)}
                  </dl>
                }
              />
            </div>
          </section>
        </div>
      </LowData>
    </div>
  );
}

function WeaknessesSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="skeleton mb-2 h-7 w-56" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="skeleton h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="surface-card p-6">
            <div className="skeleton h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
