"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PatternReport } from "@/lib/types";
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

export default function WeaknessesPage() {
  const [patterns, setPatterns] = useState<PatternReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getPatterns()
      .then(setPatterns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading patterns...</div>;
  if (!patterns)
    return (
      <div className="text-gray-400">
        No pattern data yet. Sync and analyze your games first.
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
      <div>
        <h2 className="text-2xl font-bold mb-1">Weakness Analysis</h2>
        <p className="text-gray-400 text-sm">
          Recurring patterns and blind spots across all your games
        </p>
      </div>

      {/* Phase accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            Accuracy by Game Phase (Avg CPL)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="phase" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1d27",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#e8eaed",
                  }}
                />
                <Bar dataKey="cpl" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
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
                  contentStyle={{
                    backgroundColor: "#1a1d27",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#e8eaed",
                  }}
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
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Tactical Blind Spots</h3>
          {tacticsData.length > 0 ? (
            <div className="space-y-3">
              {tacticsData
                .sort((a, b) => b.count - a.count)
                .map((t) => (
                  <div key={t.tactic} className="flex items-center gap-3">
                    <span className="text-gray-300 w-32">{t.tactic}</span>
                    <div className="flex-1 h-3 bg-gray-700 rounded-full">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{
                          width: `${
                            (t.count /
                              Math.max(...tacticsData.map((d) => d.count))) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-gray-400 font-mono w-8 text-right">
                      {t.count}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500">No tactical data yet</p>
          )}
        </div>

        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Breakdown</h3>
          <div className="space-y-4">
            {/* Time trouble */}
            <div>
              <h4 className="text-sm text-gray-400 mb-2">Time Trouble Impact</h4>
              <div className="flex gap-4">
                <div className="flex-1 bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">
                    {patterns.blunder_rate_normal}%
                  </p>
                  <p className="text-xs text-gray-500">Normal time</p>
                </div>
                <div className="flex-1 bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">
                    {patterns.blunder_rate_time_trouble}%
                  </p>
                  <p className="text-xs text-gray-500">Time trouble</p>
                </div>
              </div>
            </div>

            {/* Color performance */}
            <div>
              <h4 className="text-sm text-gray-400 mb-2">Color Performance</h4>
              <div className="flex gap-4">
                <div className="flex-1 bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-white rounded-sm" />
                    <span className="text-sm">White</span>
                  </div>
                  <p className="font-bold">{patterns.white_stats.win_rate}% wins</p>
                  <p className="text-xs text-gray-500">
                    {patterns.white_stats.avg_cpl} avg CPL
                  </p>
                </div>
                <div className="flex-1 bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 bg-gray-600 rounded-sm" />
                    <span className="text-sm">Black</span>
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
              <h4 className="text-sm text-gray-400 mb-2">Endgame Conversion</h4>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-2xl font-bold">
                  {patterns.endgame_conversion_rate}%
                </p>
                <p className="text-xs text-gray-500">
                  Won positions converted in endgame
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Worst blunders */}
      {patterns.example_positions.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            Worst Recurring Blunders
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patterns.example_positions.slice(0, 6).map((pos, i) => (
              <div
                key={i}
                className="bg-gray-800 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">
                    vs {pos.opponent} · {new Date(pos.date).toLocaleDateString()}
                  </span>
                  <span className="text-red-400 font-mono text-sm">
                    -{pos.centipawn_loss.toFixed(0)} cp
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-400">
                    Played: <strong>{pos.player_move}</strong>
                  </span>
                  <span className="text-green-400">
                    Best: <strong>{pos.best_move}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 capitalize">
                    {pos.game_phase}
                  </span>
                  {pos.tactical_motifs.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 bg-red-900/30 text-red-400 rounded capitalize"
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
