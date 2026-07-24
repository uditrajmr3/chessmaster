"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { RatingPredictionReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState, Stat } from "@/components/ui/page-kit";

const tooltipStyle = {
  backgroundColor: "#101c27",
  border: "1px solid #263a49",
  borderRadius: "8px",
  color: "#eaf0f3",
};

export default function RatingPredictorPage() {
  const [report, setReport] = useState<RatingPredictionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api.getRatingPrediction(filters)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useDataRefresh(loadData);

  if (loading) return <PredictorSkeleton />;
  if (!report || report.trajectory.games_played === 0) return (
    <div className="space-y-6">
      <PageHeader
        title="Rating Predictor"
        subtitle="Track your improvement trajectory and projected milestones."
      />
      <EmptyState
        icon={TrendingUp}
        title="Not enough data yet"
        description="Play and analyze at least 5 games so we can model your trajectory. The more analyzed games you have, the tighter the rating projection becomes."
      />
    </div>
  );

  const t = report.trajectory;

  const monthlyChartData = report.monthly_performance.map((m) => ({
    month: m.month,
    avg_rating: m.avg_rating,
    peak_rating: m.peak_rating,
    win_rate: m.win_rate,
    games: m.games,
  }));

  // Merge CPL trends into a single chart dataset
  const cplMonths = new Set<string>();
  for (const phase of ["opening_cpl", "middlegame_cpl", "endgame_cpl"] as const) {
    for (const d of report.weakness_trends[phase]) {
      cplMonths.add(d.month);
    }
  }
  const cplMap: Record<string, Record<string, number>> = {};
  for (const phase of ["opening_cpl", "middlegame_cpl", "endgame_cpl"] as const) {
    for (const d of report.weakness_trends[phase]) {
      if (!cplMap[d.month]) cplMap[d.month] = {};
      cplMap[d.month][phase.replace("_cpl", "")] = d.avg_cpl;
    }
  }
  const cplChartData = [...cplMonths].sort().map((month) => ({
    month,
    opening: cplMap[month]?.opening ?? null,
    middlegame: cplMap[month]?.middlegame ?? null,
    endgame: cplMap[month]?.endgame ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rating Predictor"
        subtitle="Track your improvement trajectory and projected milestones."
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2 stagger-children">
          {report.recommendations.map((rec, i) => (
            <div
              key={i}
              className="bg-accent-500/10 border border-accent-500/20 rounded-lg px-4 py-3"
            >
              <p className="text-accent-200 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 stagger-children">
        <Stat label="Current Rating" value={t.current_rating} />
        <Stat
          label="Total Change"
          value={`${t.total_change >= 0 ? "+" : ""}${t.total_change}`}
          valueClassName={t.total_change >= 0 ? "text-green-400" : "text-red-400"}
        />
        <Stat
          label="Rate / Month"
          value={`${t.rate_per_month >= 0 ? "+" : ""}${t.rate_per_month}`}
          valueClassName={t.rate_per_month >= 0 ? "text-green-400" : "text-red-400"}
        />
        <Stat label="Peak Rating" value={t.peak_rating} valueClassName="text-yellow-400" />
        <Stat
          label="Recent Win Rate"
          value={`${t.recent_win_rate}%`}
          valueClassName={t.recent_win_rate >= 50 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Milestones */}
      {report.milestones.length > 0 && (
        <div className="surface-card p-5 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white">Projected Milestones</h2>
          <p className="mt-0.5 mb-4 text-xs text-white/50">
            Based on your current improvement rate of {t.rate_per_month > 0 ? "+" : ""}{t.rate_per_month} points/month.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {report.milestones.map((m) => (
              <div
                key={m.target_rating}
                className="bg-ink-800 rounded-lg p-4 card-hover text-center"
              >
                <p className="text-2xl font-bold text-accent-400 font-mono">{m.target_rating}</p>
                <p className="text-xs text-white/55 mt-1">
                  ~{m.months_away} months
                </p>
                <p className="text-xs text-white/45">
                  {m.projected_date}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating over time chart */}
      {monthlyChartData.length > 1 && (
        <div className="surface-card p-5 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white">Rating Over Time</h2>
          <p className="mt-0.5 mb-4 text-xs text-white/50">
            Monthly average and peak rating.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263a49" />
              <XAxis dataKey="month" stroke="#90a2b1" fontSize={11} />
              <YAxis stroke="#90a2b1" fontSize={12} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  if (name === "avg_rating") return [`${value ?? 0}`, "Avg Rating"];
                  if (name === "peak_rating") return [`${value ?? 0}`, "Peak Rating"];
                  return [`${value ?? 0}`, name ?? ""];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avg_rating"
                stroke="#a78368"
                strokeWidth={2}
                dot={{ fill: "#a78368", r: 3 }}
                name="avg_rating"
              />
              <Line
                type="monotone"
                dataKey="peak_rating"
                stroke="#22c55e"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={{ fill: "#22c55e", r: 2 }}
                name="peak_rating"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly performance */}
        {monthlyChartData.length > 1 && (
          <div className="surface-card p-5 animate-fade-in-up">
            <h2 className="text-base font-semibold text-white">Monthly Win Rate</h2>
            <p className="mt-0.5 mb-4 text-xs text-white/50">
              Win percentage by month.
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263a49" />
                <XAxis dataKey="month" stroke="#90a2b1" fontSize={11} />
                <YAxis stroke="#90a2b1" fontSize={12} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    if (name === "win_rate") return [`${value ?? 0}%`, "Win Rate"];
                    return [`${value ?? 0}`, "Games"];
                  }}
                />
                <Bar dataKey="win_rate" fill="#a78368" radius={[4, 4, 0, 0]} name="win_rate" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* CPL trends */}
        {cplChartData.length > 1 && (
          <div className="surface-card p-5 animate-fade-in-up">
            <h2 className="text-base font-semibold text-white">Weakness Trends</h2>
            <p className="mt-0.5 mb-4 text-xs text-white/50">
              Average CPL by game phase over time. Lower is better.
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cplChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263a49" />
                <XAxis dataKey="month" stroke="#90a2b1" fontSize={11} />
                <YAxis stroke="#90a2b1" fontSize={12} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    return [`${value ?? 0}`, String(name ?? "")];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="opening"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="middlegame"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="endgame"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Monthly breakdown table */}
      {report.monthly_performance.length > 0 && (
        <div className="surface-card p-5 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white">Monthly Breakdown</h2>
          <p className="mt-0.5 mb-4 text-xs text-white/50">
            Detailed stats for each month.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700/50">
                  <th className="text-left py-2 px-3 font-medium">Month</th>
                  <th className="text-center py-2 px-3 font-medium">Games</th>
                  <th className="text-center py-2 px-3 font-medium">W/L/D</th>
                  <th className="text-center py-2 px-3 font-medium">Win Rate</th>
                  <th className="text-center py-2 px-3 font-medium">Avg Rating</th>
                  <th className="text-center py-2 px-3 font-medium">Rating Change</th>
                </tr>
              </thead>
              <tbody>
                {report.monthly_performance.slice().reverse().map((m) => (
                  <tr key={m.month} className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-3 text-white font-medium">{m.month}</td>
                    <td className="py-2 px-3 text-center text-white/55 font-mono">{m.games}</td>
                    <td className="py-2 px-3 text-center font-mono">
                      <span className="text-green-400">{m.wins}</span>
                      <span className="text-white/30">/</span>
                      <span className="text-red-400">{m.losses}</span>
                      <span className="text-white/30">/</span>
                      <span className="text-yellow-400">{m.draws}</span>
                    </td>
                    <td className={`py-2 px-3 text-center font-mono ${
                      m.win_rate >= 50 ? "text-green-400" : "text-red-400"
                    }`}>
                      {m.win_rate}%
                    </td>
                    <td className="py-2 px-3 text-center text-white/80 font-mono">{m.avg_rating}</td>
                    <td className={`py-2 px-3 text-center font-mono ${
                      m.rating_change >= 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {m.rating_change >= 0 ? "+" : ""}{m.rating_change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PredictorSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton" style={{ height: 32, width: 200, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 380, borderRadius: 4 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="surface-card p-4">
            <div className="skeleton" style={{ height: 12, width: 80, borderRadius: 4 }} />
            <div className="skeleton mt-2" style={{ height: 32, width: 60, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="surface-card p-5">
        <div className="skeleton" style={{ height: 20, width: 200, borderRadius: 4 }} />
        <div className="skeleton mt-4" style={{ height: 300, width: "100%", borderRadius: 8 }} />
      </div>
    </div>
  );
}
