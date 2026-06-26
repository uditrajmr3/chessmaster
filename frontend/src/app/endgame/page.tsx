"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { EndgameReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState, Stat } from "@/components/ui/page-kit";

const tooltipStyle = {
  backgroundColor: "#101c27",
  border: "1px solid #33495a",
  borderRadius: "8px",
  color: "#eaf0f3",
};

export default function EndgamePage() {
  const [report, setReport] = useState<EndgameReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api.getEndgameReport(filters)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useDataRefresh(loadData);

  if (loading) return <EndgameSkeleton />;
  if (!report || report.overall.games_with_endgame === 0) return (
    <EmptyState
      icon={Trophy}
      title="No endgame data yet"
      description="Sync and analyze your games to track how often you convert winning endgames and spot the positions where advantages slip away."
    />
  );

  const conversionData = report.by_type
    .filter((t) => t.had_advantage > 0)
    .map((t) => ({
      name: t.type,
      conversion_rate: t.conversion_rate ?? 0,
      games: t.had_advantage,
    }));

  const blunderData = report.by_type
    .filter((t) => t.total_blunders > 0)
    .map((t) => ({
      name: t.type,
      blunders: t.total_blunders,
      games: t.games,
    }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Endgame Drills"
        subtitle="Track your endgame conversion and find where you squander advantages."
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2 stagger-children">
          {report.recommendations.map((rec, i) => (
            <div
              key={i}
              className="bg-yellow-500/10 border border-yellow-500/25 rounded-lg px-4 py-3"
            >
              <p className="text-yellow-300 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <Stat
          label="Endgame Games"
          value={report.overall.games_with_endgame}
        />
        <Stat
          label="Avg Endgame CPL"
          value={report.overall.avg_endgame_cpl}
          valueClassName={report.overall.avg_endgame_cpl > 40 ? "text-red-400" : "text-green-400"}
        />
        <Stat
          label="Endgame Types"
          value={report.by_type.length}
        />
        <Stat
          label="Conversion Failures"
          value={report.worst_games.length}
          valueClassName={report.worst_games.length > 0 ? "text-red-400" : "text-green-400"}
        />
      </div>

      {/* Conversion rate chart */}
      {conversionData.length > 0 && (
        <div className="surface-card p-5 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-1">Conversion Rate by Endgame Type</h2>
          <p className="text-white/45 text-xs mb-4">
            How often you win from a winning endgame position
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
              <XAxis dataKey="name" stroke="#90a2b1" fontSize={11} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke="#90a2b1" fontSize={12} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  if (name === "conversion_rate") return [`${value ?? 0}%`, "Conversion Rate"];
                  return [`${value ?? 0}`, "Games with Advantage"];
                }}
              />
              <Bar dataKey="conversion_rate" name="conversion_rate" radius={[4, 4, 0, 0]}>
                {conversionData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.conversion_rate >= 60 ? "#22c55e" : entry.conversion_rate >= 40 ? "#eab308" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endgame type breakdown */}
        <div className="surface-card p-5 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-1">Endgame Type Breakdown</h2>
          <p className="text-white/45 text-xs mb-4">
            Performance statistics by endgame type
          </p>
          <div className="space-y-2">
            {report.by_type.map((t) => (
              <div
                key={t.type}
                className="bg-ink-800 rounded-lg px-4 py-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-200 font-medium">{t.type}</p>
                  <p className="text-xs text-white/45"><span className="font-mono">{t.games}</span> games</p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xs text-white/45">Advantage</p>
                    <p className="text-sm font-mono text-gray-300">{t.had_advantage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Converted</p>
                    <p className="text-sm font-mono text-green-400">{t.converted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Failed</p>
                    <p className="text-sm font-mono text-red-400">{t.failed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Avg CPL</p>
                    <p className={`text-sm font-mono ${t.avg_cpl > 40 ? "text-red-400" : "text-gray-300"}`}>
                      {t.avg_cpl}
                    </p>
                  </div>
                </div>
                {t.conversion_rate !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/45">Conversion</span>
                      <span className={`font-mono ${
                        t.conversion_rate >= 60 ? "text-green-400" :
                        t.conversion_rate >= 40 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {t.conversion_rate}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          t.conversion_rate >= 60 ? "bg-green-500" :
                          t.conversion_rate >= 40 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${t.conversion_rate}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Worst endgame games */}
        {report.worst_games.length > 0 && (
          <div className="surface-card p-5 animate-fade-in-up">
            <h2 className="text-base font-semibold text-white mb-1">Worst Conversion Failures</h2>
            <p className="text-white/45 text-xs mb-4">
              Games where you had a winning endgame but failed to convert
            </p>
            <div className="space-y-2">
              {report.worst_games.map((g) => (
                <div
                  key={g.game_id}
                  className="bg-ink-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm text-gray-200 font-medium">{g.endgame_type}</p>
                      <p className="text-xs text-white/45">
                        vs {g.opponent} · {g.played_at ? new Date(g.played_at).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium capitalize ${
                        g.result === "loss" ? "text-red-400" : "text-yellow-400"
                      }`}>
                        {g.result}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mt-2">
                    <div>
                      <p className="text-xs text-white/45">Entering Eval</p>
                      <p className="text-sm font-mono text-green-400">
                        +{(g.entering_eval / 100).toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/45">Avg CPL</p>
                      <p className={`text-sm font-mono ${g.avg_cpl > 40 ? "text-red-400" : "text-gray-300"}`}>
                        {g.avg_cpl}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/45">Blunders</p>
                      <p className={`text-sm font-mono ${g.blunders > 0 ? "text-red-400" : "text-gray-300"}`}>
                        {g.blunders}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Blunders by type chart */}
      {blunderData.length > 0 && (
        <div className="surface-card p-5 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-1">Endgame Blunders by Type</h2>
          <p className="text-white/45 text-xs mb-4">
            Where you make the most mistakes in the endgame
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={blunderData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
              <XAxis dataKey="name" stroke="#90a2b1" fontSize={11} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke="#90a2b1" fontSize={12} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  if (name === "blunders") return [`${value ?? 0}`, "Blunders"];
                  return [`${value ?? 0}`, "Games"];
                }}
              />
              <Bar dataKey="blunders" fill="#ef4444" radius={[4, 4, 0, 0]} name="blunders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EndgameSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="skeleton h-7 w-48 mb-2" />
        <div className="skeleton h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="surface-card p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-7 w-12 mt-3" />
          </div>
        ))}
      </div>
      <div className="surface-card p-5">
        <div className="skeleton h-5 w-72 mb-4" />
        <div className="skeleton h-75 w-full" />
      </div>
    </div>
  );
}
