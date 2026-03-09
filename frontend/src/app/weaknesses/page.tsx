"use client";

import { useEffect, useState, useCallback } from "react";
import { Target } from "lucide-react";
import { api } from "@/lib/api";
import type { PatternReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
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
  backgroundColor: "#1a1d27",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#e8eaed",
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

  if (loading) return <WeaknessesSkeleton />;
  if (!patterns)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
        <Target className="w-10 h-10 text-gray-500" />
        <p className="text-gray-400 text-center">
          No pattern data yet. Sync and analyze your games first.
        </p>
      </div>
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
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">Weakness Analysis</h2>
          <p className="text-gray-400 text-sm">
            Recurring patterns and blind spots across your games
          </p>
        </div>
        <GameFilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Phase accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">
            Accuracy by Game Phase (Avg CPL)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="phase" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="cpl" fill="#0ebeb0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">
            Blunder Rate by Move Number
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={blunderBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="bucket" stroke="#9ca3af" fontSize={11} />
                <YAxis
                  stroke="#9ca3af"
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
        <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">Tactical Blind Spots</h3>
          {tacticsData.length > 0 ? (
            <div className="space-y-3">
              {tacticsData
                .sort((a, b) => b.count - a.count)
                .map((t) => (
                  <div key={t.tactic} className="flex items-center gap-3 group">
                    <span className="text-gray-300 w-32 text-sm font-medium">{t.tactic}</span>
                    <div className="flex-1 h-3 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full progress-animated"
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
            <p className="text-gray-500">No tactical data yet</p>
          )}
        </div>

        <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">Performance Breakdown</h3>
          <div className="space-y-4">
            {/* Time trouble */}
            <div>
              <h4 className="text-sm text-gray-400 mb-2 font-medium">Time Trouble Impact</h4>
              <div className="flex gap-3">
                <div className="flex-1 bg-gray-800/70 rounded-lg p-3 text-center card-hover">
                  <p className="text-2xl font-bold text-green-400">
                    {patterns.blunder_rate_normal}%
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Normal time</p>
                </div>
                <div className="flex-1 bg-gray-800/70 rounded-lg p-3 text-center card-hover">
                  <p className="text-2xl font-bold text-red-400">
                    {patterns.blunder_rate_time_trouble}%
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Time trouble</p>
                </div>
              </div>
            </div>

            {/* Color performance */}
            <div>
              <h4 className="text-sm text-gray-400 mb-2 font-medium">Color Performance</h4>
              <div className="flex gap-3">
                <div className="flex-1 bg-gray-800/70 rounded-lg p-3 card-hover">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-white rounded-sm shadow-sm" />
                    <span className="text-sm font-medium">White</span>
                  </div>
                  <p className="font-bold">{patterns.white_stats.win_rate}% wins</p>
                  <p className="text-xs text-gray-500">
                    {patterns.white_stats.avg_cpl} avg CPL
                  </p>
                </div>
                <div className="flex-1 bg-gray-800/70 rounded-lg p-3 card-hover">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-gray-500 rounded-sm" />
                    <span className="text-sm font-medium">Black</span>
                  </div>
                  <p className="font-bold">{patterns.black_stats.win_rate}% wins</p>
                  <p className="text-xs text-gray-500">
                    {patterns.black_stats.avg_cpl} avg CPL
                  </p>
                </div>
              </div>
            </div>

            {/* Endgame conversion */}
            <div>
              <h4 className="text-sm text-gray-400 mb-2 font-medium">Endgame Conversion</h4>
              <div className="bg-gray-800/70 rounded-lg p-3 card-hover">
                <p className="text-2xl font-bold">
                  {patterns.endgame_conversion_rate}%
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Won positions converted in endgame
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Worst blunders */}
      {patterns.example_positions.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">
            Worst Recurring Blunders
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {patterns.example_positions.slice(0, 6).map((pos, i) => (
              <div
                key={i}
                className="bg-gray-800/70 rounded-lg p-4 space-y-2 card-hover"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">
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
                  <span className="text-xs text-gray-500 capitalize px-1.5 py-0.5 bg-gray-700/50 rounded">
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
                <p className="text-xs font-mono text-gray-600 truncate">
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
    <div className="space-y-8 animate-fade-in">
      <div>
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-6">
            <div className="skeleton h-5 w-52 mb-4" />
            <div className="skeleton h-48 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-6">
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
