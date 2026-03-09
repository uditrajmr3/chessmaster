"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import type { RatingPredictionReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";

const tooltipStyle = {
  backgroundColor: "#1a1d27",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#e8eaed",
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

  if (loading) return <PredictorSkeleton />;
  if (!report || report.trajectory.games_played === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
      <TrendingUp className="w-10 h-10 text-gray-500" />
      <p className="text-gray-400 text-center">Not enough data for predictions. Play at least 5 analyzed games.</p>
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
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Rating Predictor</h2>
          <p className="text-gray-400 text-sm">
            Track your improvement trajectory and projected milestones
          </p>
        </div>
        <GameFilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2 stagger-children">
          {report.recommendations.map((rec, i) => (
            <div
              key={i}
              className="bg-blue-500/10 border border-blue-800/50 rounded-lg px-4 py-3"
            >
              <p className="text-blue-300 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 stagger-children">
        <StatCard label="Current Rating" value={t.current_rating} />
        <StatCard
          label="Total Change"
          value={`${t.total_change >= 0 ? "+" : ""}${t.total_change}`}
          color={t.total_change >= 0 ? "text-green-400" : "text-red-400"}
        />
        <StatCard
          label="Rate / Month"
          value={`${t.rate_per_month >= 0 ? "+" : ""}${t.rate_per_month}`}
          color={t.rate_per_month >= 0 ? "text-green-400" : "text-red-400"}
        />
        <StatCard label="Peak Rating" value={t.peak_rating} color="text-yellow-400" />
        <StatCard
          label="Recent Win Rate"
          value={`${t.recent_win_rate}%`}
          color={t.recent_win_rate >= 50 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Milestones */}
      {report.milestones.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-1">Projected Milestones</h3>
          <p className="text-gray-500 text-xs mb-4">
            Based on your current improvement rate of {t.rate_per_month > 0 ? "+" : ""}{t.rate_per_month} points/month
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {report.milestones.map((m) => (
              <div
                key={m.target_rating}
                className="bg-[#1a1d27] rounded-lg p-4 card-hover text-center"
              >
                <p className="text-2xl font-bold text-accent-400 font-mono">{m.target_rating}</p>
                <p className="text-xs text-gray-500 mt-1">
                  ~{m.months_away} months
                </p>
                <p className="text-xs text-gray-600">
                  {m.projected_date}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating over time chart */}
      {monthlyChartData.length > 1 && (
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-1">Rating Over Time</h3>
          <p className="text-gray-500 text-xs mb-4">
            Monthly average and peak rating
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={12} domain={["auto", "auto"]} />
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
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: "#6366f1", r: 3 }}
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
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-1">Monthly Win Rate</h3>
            <p className="text-gray-500 text-xs mb-4">
              Win percentage by month
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={12} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => {
                    if (name === "win_rate") return [`${value ?? 0}%`, "Win Rate"];
                    return [`${value ?? 0}`, "Games"];
                  }}
                />
                <Bar dataKey="win_rate" fill="#6366f1" radius={[4, 4, 0, 0]} name="win_rate" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* CPL trends */}
        {cplChartData.length > 1 && (
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-1">Weakness Trends</h3>
            <p className="text-gray-500 text-xs mb-4">
              Average CPL by game phase over time (lower is better)
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cplChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={12} />
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
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-1">Monthly Breakdown</h3>
          <p className="text-gray-500 text-xs mb-4">
            Detailed stats for each month
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="text-left py-2 px-3">Month</th>
                  <th className="text-center py-2 px-3">Games</th>
                  <th className="text-center py-2 px-3">W/L/D</th>
                  <th className="text-center py-2 px-3">Win Rate</th>
                  <th className="text-center py-2 px-3">Avg Rating</th>
                  <th className="text-center py-2 px-3">Rating Change</th>
                </tr>
              </thead>
              <tbody>
                {report.monthly_performance.slice().reverse().map((m) => (
                  <tr key={m.month} className="border-b border-gray-800 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-gray-300 font-medium">{m.month}</td>
                    <td className="py-2 px-3 text-center text-gray-400">{m.games}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-green-400">{m.wins}</span>
                      /
                      <span className="text-red-400">{m.losses}</span>
                      /
                      <span className="text-gray-400">{m.draws}</span>
                    </td>
                    <td className={`py-2 px-3 text-center font-mono ${
                      m.win_rate >= 50 ? "text-green-400" : "text-red-400"
                    }`}>
                      {m.win_rate}%
                    </td>
                    <td className="py-2 px-3 text-center text-gray-300 font-mono">{m.avg_rating}</td>
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

function PredictorSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton" style={{ height: 32, width: 200, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 380, borderRadius: 4 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-4">
            <div className="skeleton" style={{ height: 12, width: 80, borderRadius: 4 }} />
            <div className="skeleton mt-2" style={{ height: 32, width: 60, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="bg-[#222639] rounded-xl p-5">
        <div className="skeleton" style={{ height: 20, width: 200, borderRadius: 4 }} />
        <div className="skeleton mt-4" style={{ height: 300, width: "100%", borderRadius: 8 }} />
      </div>
    </div>
  );
}
