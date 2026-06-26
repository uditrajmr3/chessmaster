"use client";

import { useEffect, useState, useCallback } from "react";
import { Target } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { PatternReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState } from "@/components/ui/page-kit";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#101c27",
  border: "1px solid #33495a",
  borderRadius: "8px",
  color: "#eaf0f3",
};

export default function WeaknessesPage() {
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
      <EmptyState
        icon={Target}
        title="No pattern data yet"
        description="Sync and analyze your games to surface recurring mistakes, tactical blind spots, and the phases where you lose the most points."
      />
    );

  const phaseData = Object.entries(patterns.phase_accuracy).map(
    ([phase, cpl]) => ({ phase: phase.charAt(0).toUpperCase() + phase.slice(1), cpl })
  );

  const blunderBuckets = Object.entries(patterns.blunder_by_move_bucket).map(
    ([bucket, rate]) => ({ bucket: `Moves ${bucket}`, rate })
  );

  const tacticsData = Object.entries(patterns.missed_tactics).map(
    ([tactic, count]) => ({
      tactic: tactic.replace("_", " ").charAt(0).toUpperCase() + tactic.replace("_", " ").slice(1),
      count,
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weakness Analysis"
        subtitle="Recurring patterns and blind spots across your games."
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />

      {/* Phase accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">
            Accuracy by Game Phase (Avg CPL)
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
                <XAxis dataKey="phase" stroke="#90a2b1" fontSize={12} />
                <YAxis stroke="#90a2b1" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="cpl" fill="#a78368" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">
            Blunder Rate by Move Number
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={blunderBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
                <XAxis dataKey="bucket" stroke="#90a2b1" fontSize={11} />
                <YAxis
                  stroke="#90a2b1"
                  fontSize={12}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value}%`, "Blunder Rate"]}
                />
                <Bar dataKey="rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tactical blind spots + Time trouble */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">Tactical Blind Spots</h2>
          {tacticsData.length > 0 ? (
            <div className="space-y-3">
              {tacticsData
                .sort((a, b) => b.count - a.count)
                .map((t) => (
                  <div key={t.tactic} className="flex items-center gap-3 group">
                    <span className="text-gray-300 w-32 text-sm font-medium">{t.tactic}</span>
                    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-red-600 to-red-400 rounded-full progress-animated"
                        style={{
                          width: `${
                            (t.count /
                              Math.max(...tacticsData.map((d) => d.count))) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-gray-400 font-mono w-8 text-right text-sm">
                      {t.count}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-white/45 text-sm">No tactical data yet.</p>
          )}
        </div>

        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">Performance Breakdown</h2>
          <div className="space-y-4">
            {/* Time trouble */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2 font-medium">Time Trouble Impact</h3>
              <div className="flex gap-3">
                <div className="flex-1 bg-ink-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold font-mono text-green-400">
                    {patterns.blunder_rate_normal}%
                  </p>
                  <p className="text-xs text-white/45 mt-0.5">Normal time</p>
                </div>
                <div className="flex-1 bg-ink-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold font-mono text-red-400">
                    {patterns.blunder_rate_time_trouble}%
                  </p>
                  <p className="text-xs text-white/45 mt-0.5">Time trouble</p>
                </div>
              </div>
            </div>

            {/* Color performance */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2 font-medium">Color Performance</h3>
              <div className="flex gap-3">
                <div className="flex-1 bg-ink-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-white rounded-sm shadow-sm" />
                    <span className="text-sm font-medium">White</span>
                  </div>
                  <p className="font-bold font-mono">{patterns.white_stats.win_rate}% wins</p>
                  <p className="text-xs text-white/45">
                    <span className="font-mono">{patterns.white_stats.avg_cpl}</span> avg CPL
                  </p>
                </div>
                <div className="flex-1 bg-ink-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-gray-500 rounded-sm" />
                    <span className="text-sm font-medium">Black</span>
                  </div>
                  <p className="font-bold font-mono">{patterns.black_stats.win_rate}% wins</p>
                  <p className="text-xs text-white/45">
                    <span className="font-mono">{patterns.black_stats.avg_cpl}</span> avg CPL
                  </p>
                </div>
              </div>
            </div>

            {/* Endgame conversion */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2 font-medium">Endgame Conversion</h3>
              <div className="bg-ink-800 rounded-lg p-3">
                <p className="text-2xl font-bold font-mono">
                  {patterns.endgame_conversion_rate}%
                </p>
                <p className="text-xs text-white/45 mt-0.5">
                  Won positions converted in endgame
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Worst blunders */}
      {patterns.example_positions.length > 0 && (
        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">
            Worst Recurring Blunders
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {patterns.example_positions.slice(0, 6).map((pos, i) => (
              <div
                key={i}
                className="bg-ink-800 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white/55 text-sm">
                    vs {pos.opponent} · {new Date(pos.date).toLocaleDateString()}
                  </span>
                  <span className="text-red-400 font-mono text-sm font-semibold">
                    -{pos.centipawn_loss.toFixed(0)} cp
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-400 text-sm">
                    Played: <strong>{pos.player_move}</strong>
                  </span>
                  <span className="text-green-400 text-sm">
                    Best: <strong>{pos.best_move}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white/55 capitalize px-1.5 py-0.5 bg-white/5 rounded">
                    {pos.game_phase}
                  </span>
                  {pos.tactical_motifs.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 bg-red-500/15 text-red-400 rounded capitalize"
                    >
                      {t.replace("_", " ")}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-mono text-white/45 truncate">
                  {pos.fen}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WeaknessesSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="skeleton h-7 w-56 mb-2" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="surface-card p-6">
            <div className="skeleton h-5 w-52 mb-4" />
            <div className="skeleton h-48 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="surface-card p-6">
            <div className="skeleton h-5 w-40 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="skeleton h-6 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
