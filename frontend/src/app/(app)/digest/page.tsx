"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { DigestReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState, Section, Stat } from "@/components/ui/page-kit";

export default function DigestPage() {
  const [report, setReport] = useState<DigestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api.getDigest({ days, ...filters })
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useDataRefresh(loadData);

  if (loading) return <DigestSkeleton />;
  if (!report || report.summary.total_games === 0) return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Digest"
        subtitle="Your recent chess performance at a glance."
        action={
          <div className="flex items-center gap-3">
            <PeriodSelector days={days} onChange={setDays} />
            <GameFilterBar filters={filters} onChange={setFilters} />
          </div>
        }
      />
      <EmptyState
        icon={Mail}
        title="No games in this period"
        description={`We found no games in the last ${days} days. Try a longer period, or sync more games from the sidebar.`}
      />
    </div>
  );

  const s = report.summary;
  const a = report.accuracy;
  const imp = report.improvement;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Digest"
        subtitle={`${report.period_start} to ${report.period_end}`}
        action={
          <div className="flex items-center gap-3">
            <PeriodSelector days={days} onChange={setDays} />
            <GameFilterBar filters={filters} onChange={setFilters} />
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 stagger-children">
        <Stat label="Games Played" value={s.total_games} />
        <Stat
          label="Win Rate"
          value={`${s.win_rate}%`}
          valueClassName={s.win_rate >= 50 ? "text-green-400" : "text-red-400"}
        />
        <Stat
          label="Rating Change"
          value={`${s.rating_change >= 0 ? "+" : ""}${s.rating_change}`}
          valueClassName={s.rating_change >= 0 ? "text-green-400" : "text-red-400"}
        />
        <Stat
          label="Avg CPL"
          value={a.avg_cpl}
          valueClassName={a.avg_cpl > 40 ? "text-red-400" : "text-green-400"}
        />
        <Stat
          label="Blunders"
          value={a.blunders}
          valueClassName={a.blunders > 0 ? "text-red-400" : "text-green-400"}
        />
        <Stat
          label="Missed Tactics"
          value={a.missed_tactics}
          valueClassName={a.missed_tactics > 0 ? "text-yellow-400" : "text-green-400"}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Results breakdown */}
        <div className="surface-card p-5 animate-fade-in-up">
          <h3 className="text-base font-semibold text-white mb-4">Results</h3>
          <div className="mb-4">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-ink-700">
              {s.total_games > 0 && (
                <>
                  <div
                    className="bg-green-500"
                    style={{ width: `${(s.wins / s.total_games) * 100}%` }}
                  />
                  <div
                    className="bg-yellow-500"
                    style={{ width: `${(s.draws / s.total_games) * 100}%` }}
                  />
                  <div
                    className="bg-red-500"
                    style={{ width: `${(s.losses / s.total_games) * 100}%` }}
                  />
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold font-mono text-green-400">{s.wins}</p>
              <p className="text-xs text-white/45 mt-0.5">Wins</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-yellow-400">{s.draws}</p>
              <p className="text-xs text-white/45 mt-0.5">Draws</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-red-400">{s.losses}</p>
              <p className="text-xs text-white/45 mt-0.5">Losses</p>
            </div>
          </div>
          {s.rating_change !== 0 && (
            <div className="mt-4 pt-4 border-t border-white/5 text-center">
              <p className="text-xs text-white/45">Rating</p>
              <p className="mt-1 text-lg font-mono text-white/90">
                {s.rating_start} → {s.rating_end}{" "}
                <span className={s.rating_change >= 0 ? "text-green-400" : "text-red-400"}>
                  ({s.rating_change >= 0 ? "+" : ""}{s.rating_change})
                </span>
              </p>
            </div>
          )}
        </div>

        {/* vs Previous Period */}
        {imp.has_comparison ? (
          <div className="surface-card p-5 animate-fade-in-up">
            <h3 className="text-base font-semibold text-white mb-4">vs. Previous {days} Days</h3>
            <div className="space-y-4">
              <ComparisonRow
                label="Win Rate"
                current={`${s.win_rate}%`}
                change={imp.win_rate_change}
                suffix="%"
                positive="higher"
              />
              <ComparisonRow
                label="Avg CPL"
                current={`${a.avg_cpl}`}
                change={imp.cpl_change}
                suffix=""
                positive="lower"
              />
              <ComparisonRow
                label="Games Played"
                current={`${s.total_games}`}
                change={imp.games_change}
                suffix=""
                positive="higher"
              />
            </div>
          </div>
        ) : (
          <div className="surface-card p-5 animate-fade-in-up flex items-center justify-center">
            <p className="text-sm text-white/45">No previous period data for comparison.</p>
          </div>
        )}

        {/* Top openings */}
        {report.openings.length > 0 && (
          <div className="surface-card overflow-hidden animate-fade-in-up">
            <h3 className="text-base font-semibold text-white px-5 pt-5 pb-3">Top Openings</h3>
            <div className="divide-y divide-white/5">
              {report.openings.map((o) => (
                <div
                  key={o.eco}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">{o.name}</p>
                    <p className="text-xs text-white/45">
                      <span className="font-mono">{o.eco}</span> · {o.games} games
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-green-400 text-sm font-mono">{o.wins}W</span>
                    <span className="text-white/30 mx-1">/</span>
                    <span className="text-red-400 text-sm font-mono">{o.losses}L</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {report.highlights.length > 0 && (
          <div className="surface-card overflow-hidden animate-fade-in-up">
            <h3 className="text-base font-semibold text-white px-5 pt-5 pb-3">Highlights</h3>
            <div className="divide-y divide-white/5">
              {report.highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`shrink-0 text-xs px-2.5 py-1 rounded-md font-semibold uppercase tracking-wide ${
                    h.type === "best_win" ? "bg-green-500/15 text-green-400" :
                    h.type === "upset" ? "bg-yellow-500/15 text-yellow-400" :
                    "bg-accent-500/15 text-accent-300"
                  }`}>
                    {h.type === "best_win" ? "Best Win" :
                     h.type === "upset" ? "Upset" :
                     h.type === "longest_game" ? "Marathon" : h.type}
                  </span>
                  <p className="text-sm text-white/80">{h.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full text digest */}
      <Section title="Full Digest">
        <div className="surface-card p-5 animate-fade-in-up">
          <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono leading-relaxed bg-ink-900 rounded-lg p-4 border border-white/5">
            {report.digest_text}
          </pre>
        </div>
      </Section>
    </div>
  );
}

function PeriodSelector({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <select
      value={days}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Digest time period"
      className="bg-ink-800 border border-white/10 text-white/80 text-sm rounded-lg px-3 py-2 transition-colors hover:border-white/20 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
    >
      <option value={7}>Last 7 days</option>
      <option value={14}>Last 14 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>
  );
}

function ComparisonRow({
  label,
  current,
  change,
  suffix,
  positive,
}: {
  label: string;
  current: string;
  change: number;
  suffix: string;
  positive: "higher" | "lower";
}) {
  const isGood = positive === "higher" ? change > 0 : change < 0;
  const sign = change >= 0 ? "+" : "";

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white/55">{label}</p>
        <p className="mt-0.5 text-lg font-mono text-white/90">{current}</p>
      </div>
      <span className={`rounded-md px-3 py-1 text-sm font-mono font-medium ${
        isGood ? "bg-green-500/10 text-green-400" : change === 0 ? "bg-white/5 text-white/55" : "bg-red-500/10 text-red-400"
      }`}>
        {sign}{change}{suffix}
      </span>
    </div>
  );
}

function DigestSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="skeleton h-8 w-48 rounded-md" />
          <div className="skeleton mt-2 h-4 w-72 rounded" />
        </div>
        <div className="skeleton h-9 w-72 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="surface-card p-5">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton mt-3 h-8 w-12 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="surface-card p-5">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="skeleton mt-4 h-[150px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
