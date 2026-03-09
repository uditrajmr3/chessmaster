"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";
import type { DigestReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";

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

  if (loading) return <DigestSkeleton />;
  if (!report || report.summary.total_games === 0) return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Weekly Digest</h2>
          <p className="text-gray-400 text-sm">Your recent chess performance at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector days={days} onChange={setDays} />
          <GameFilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
        <Mail className="w-10 h-10 text-gray-500" />
        <p className="text-gray-400 text-center">No games in the last {days} days. Try a longer period.</p>
      </div>
    </div>
  );

  const s = report.summary;
  const a = report.accuracy;
  const imp = report.improvement;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Weekly Digest</h2>
          <p className="text-gray-400 text-sm">
            {report.period_start} to {report.period_end}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector days={days} onChange={setDays} />
          <GameFilterBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 stagger-children">
        <StatCard label="Games Played" value={s.total_games} />
        <StatCard
          label="Win Rate"
          value={`${s.win_rate}%`}
          color={s.win_rate >= 50 ? "text-green-400" : "text-red-400"}
        />
        <StatCard
          label="Rating Change"
          value={`${s.rating_change >= 0 ? "+" : ""}${s.rating_change}`}
          color={s.rating_change >= 0 ? "text-green-400" : "text-red-400"}
        />
        <StatCard
          label="Avg CPL"
          value={a.avg_cpl}
          color={a.avg_cpl > 40 ? "text-red-400" : "text-green-400"}
        />
        <StatCard label="Blunders" value={a.blunders} color={a.blunders > 0 ? "text-red-400" : "text-green-400"} />
        <StatCard label="Missed Tactics" value={a.missed_tactics} color={a.missed_tactics > 0 ? "text-yellow-400" : "text-green-400"} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Results breakdown */}
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">Results</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-700">
                {s.total_games > 0 && (
                  <>
                    <div
                      className="bg-green-500"
                      style={{ width: `${(s.wins / s.total_games) * 100}%` }}
                    />
                    <div
                      className="bg-gray-400"
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
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-400">{s.wins}</p>
              <p className="text-xs text-gray-500">Wins</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{s.draws}</p>
              <p className="text-xs text-gray-500">Draws</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{s.losses}</p>
              <p className="text-xs text-gray-500">Losses</p>
            </div>
          </div>
          {s.rating_change !== 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700 text-center">
              <p className="text-gray-500 text-xs">Rating</p>
              <p className="text-lg font-mono text-gray-300">
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
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-4">vs. Previous {days} Days</h3>
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
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up flex items-center justify-center">
            <p className="text-gray-500 text-sm">No previous period data for comparison</p>
          </div>
        )}

        {/* Top openings */}
        {report.openings.length > 0 && (
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-4">Top Openings</h3>
            <div className="space-y-2">
              {report.openings.map((o) => (
                <div
                  key={o.eco}
                  className="flex items-center justify-between bg-[#1a1d27] rounded-lg px-4 py-3 card-hover"
                >
                  <div>
                    <p className="text-sm text-gray-200 font-medium">{o.name}</p>
                    <p className="text-xs text-gray-500">{o.eco} · {o.games} games</p>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 text-sm font-mono">{o.wins}W</span>
                    <span className="text-gray-600 mx-1">/</span>
                    <span className="text-red-400 text-sm font-mono">{o.losses}L</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {report.highlights.length > 0 && (
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-4">Highlights</h3>
            <div className="space-y-2">
              {report.highlights.map((h, i) => (
                <div
                  key={i}
                  className="bg-[#1a1d27] rounded-lg px-4 py-3 card-hover"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      h.type === "best_win" ? "bg-green-500/20 text-green-400" :
                      h.type === "upset" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {h.type === "best_win" ? "Best Win" :
                       h.type === "upset" ? "Upset" :
                       h.type === "longest_game" ? "Marathon" : h.type}
                    </span>
                    <p className="text-sm text-gray-300">{h.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full text digest */}
      <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
        <h3 className="text-xl font-semibold mb-4">Full Digest</h3>
        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-[#1a1d27] rounded-lg p-4">
          {report.digest_text}
        </pre>
      </div>
    </div>
  );
}

function PeriodSelector({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <select
      value={days}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-[#222639] border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
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
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-lg font-mono text-gray-200">{current}</p>
      </div>
      <div className={`text-right px-3 py-1 rounded-lg ${
        isGood ? "bg-green-500/10" : change === 0 ? "bg-gray-700/30" : "bg-red-500/10"
      }`}>
        <p className={`text-sm font-mono font-medium ${
          isGood ? "text-green-400" : change === 0 ? "text-gray-400" : "text-red-400"
        }`}>
          {sign}{change}{suffix}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-[#222639] rounded-xl p-4 card-hover">
      <p className="text-gray-400 text-xs font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function DigestSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton" style={{ height: 32, width: 180, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 300, borderRadius: 4 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-4">
            <div className="skeleton" style={{ height: 12, width: 80, borderRadius: 4 }} />
            <div className="skeleton mt-2" style={{ height: 32, width: 48, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-5">
            <div className="skeleton" style={{ height: 20, width: 120, borderRadius: 4 }} />
            <div className="skeleton mt-4" style={{ height: 150, width: "100%", borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
