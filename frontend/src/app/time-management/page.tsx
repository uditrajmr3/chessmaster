"use client";

import { useEffect, useState, useCallback } from "react";
import { Timer } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { TimeManagementProfile, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState, Section, Stat } from "@/components/ui/page-kit";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "#101c27",
  border: "1px solid #263a49",
  borderRadius: "8px",
  color: "#eaf0f3",
};

export default function TimeManagementPage() {
  const [data, setData] = useState<TimeManagementProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api
      .getTimeManagement(filters)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useDataRefresh(loadData);

  if (loading) return <TimeSkeleton />;
  if (!data || data.games_with_clock_data === 0)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Time Management Profile"
          subtitle="How you spend your clock across your analyzed games."
        />
        <EmptyState
          icon={Timer}
          title="No clock data yet"
          description="Sync games that include clock information, then run analysis. Bullet, blitz, and rapid games from Chess.com and Lichess all carry per-move clock data."
        />
      </div>
    );

  const phaseTimeData = Object.entries(data.time_per_move_by_phase).map(
    ([phase, time]) => ({
      phase: phase.charAt(0).toUpperCase() + phase.slice(1),
      time,
    })
  );

  const classificationData = Object.entries(data.avg_time_by_classification)
    .filter(([, time]) => time > 0)
    .map(([classif, time]) => ({
      classification: classif.charAt(0).toUpperCase() + classif.slice(1),
      time,
    }));

  const troubleData = Object.entries(data.time_trouble_stats).map(
    ([zone, stats]) => ({
      zone: zone.charAt(0).toUpperCase() + zone.slice(1),
      blunder_rate: stats.blunder_rate,
      avg_cpl: stats.avg_cpl,
      moves: stats.moves,
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Management Profile"
        subtitle={`How you spend your clock across ${data.games_with_clock_data} analyzed games.`}
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />

      {/* KPI strip — phase timing cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        {phaseTimeData.map((p) => (
          <Stat
            key={p.phase}
            label={`${p.phase} avg time/move`}
            value={`${p.time}s`}
          />
        ))}
      </div>

      {/* Primary content — 2-column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white">Time Spent vs Move Number</h2>
          <p className="mt-0.5 mb-4 text-xs text-white/50">
            Average seconds spent per move, with centipawn loss overlay.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.time_vs_move_number}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263a49" />
                <XAxis
                  dataKey="move"
                  stroke="#90a2b1"
                  fontSize={11}
                  label={{ value: "Move #", position: "insideBottom", offset: -2, style: { fill: "#637688", fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="time"
                  stroke="#90a2b1"
                  fontSize={11}
                  label={{ value: "Seconds", angle: -90, position: "insideLeft", style: { fill: "#637688", fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="cpl"
                  orientation="right"
                  stroke="#90a2b1"
                  fontSize={11}
                  label={{ value: "CPL", angle: 90, position: "insideRight", style: { fill: "#637688", fontSize: 11 } }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  yAxisId="cpl"
                  type="monotone"
                  dataKey="avg_cpl"
                  fill="#ef444420"
                  stroke="#ef4444"
                  strokeWidth={1}
                  name="Avg CPL"
                />
                <Line
                  yAxisId="time"
                  type="monotone"
                  dataKey="avg_time"
                  stroke="#a78368"
                  strokeWidth={2}
                  dot={false}
                  name="Avg Time (s)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white">Time by Move Quality</h2>
          <p className="mt-0.5 mb-4 text-xs text-white/50">
            Average seconds spent on moves of each quality.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classificationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263a49" />
                <XAxis dataKey="classification" stroke="#90a2b1" fontSize={11} />
                <YAxis
                  stroke="#90a2b1"
                  fontSize={11}
                  label={{ value: "Seconds", angle: -90, position: "insideLeft", style: { fill: "#637688", fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value}s`, "Avg Time"]}
                />
                <Bar dataKey="time" radius={[4, 4, 0, 0]} fill="#a78368" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Time Pressure Zones */}
      <div className="surface-card p-6 animate-fade-in-up">
        <h2 className="text-base font-semibold text-white">Time Pressure Zones</h2>
        <p className="mt-0.5 mb-4 text-xs text-white/50">
          How your play quality changes based on remaining clock time.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {troubleData.map((zone) => {
            const dotColor =
              zone.zone === "Critical"
                ? "#ef4444"
                : zone.zone === "Low"
                ? "#f97316"
                : zone.zone === "Normal"
                ? "#eab308"
                : "#22c55e";
            return (
              <div key={zone.zone} className="bg-ink-800 rounded-lg p-4 card-hover">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="font-medium text-white">{zone.zone}</span>
                  <span className="text-xs text-white/45">
                    {zone.zone === "Critical"
                      ? "(<30s)"
                      : zone.zone === "Low"
                      ? "(30-60s)"
                      : zone.zone === "Normal"
                      ? "(1-3min)"
                      : "(3min+)"}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-white/55">Blunder rate</span>
                    <span
                      className={`text-sm font-mono font-bold ${
                        zone.blunder_rate > 15
                          ? "text-red-400"
                          : zone.blunder_rate > 8
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {zone.blunder_rate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-white/55">Avg CPL</span>
                    <span className="text-sm font-mono text-white">{zone.avg_cpl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-white/55">Moves</span>
                    <span className="text-sm font-mono text-white/45">
                      {zone.moves.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Control Breakdown */}
      {data.time_class_breakdown.length > 0 && (
        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">By Time Control</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700/50 text-xs uppercase tracking-wider">
                  <th className="text-left py-2 pr-4 font-medium">Time Control</th>
                  <th className="text-right py-2 px-4 font-medium">Games</th>
                  <th className="text-right py-2 px-4 font-medium">Moves</th>
                  <th className="text-right py-2 px-4 font-medium">Avg CPL</th>
                  <th className="text-right py-2 pl-4 font-medium">Time Trouble %</th>
                </tr>
              </thead>
              <tbody>
                {data.time_class_breakdown.map((tc) => (
                  <tr key={tc.time_class} className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 pr-4 capitalize font-medium">{tc.time_class}</td>
                    <td className="text-right py-2 px-4 font-mono text-sm">{tc.games}</td>
                    <td className="text-right py-2 px-4 font-mono text-sm">{tc.moves_analyzed.toLocaleString()}</td>
                    <td className="text-right py-2 px-4 font-mono text-sm">{tc.avg_cpl}</td>
                    <td
                      className={`text-right py-2 pl-4 font-mono text-sm font-bold ${
                        tc.time_trouble_pct > 20
                          ? "text-red-400"
                          : tc.time_trouble_pct > 10
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {tc.time_trouble_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overthinking + Rushing — 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.overthink_moves.length > 0 && (
          <div className="surface-card p-6 animate-fade-in-up">
            <h2 className="text-base font-semibold text-white">Overthinking Book Moves</h2>
            <p className="mt-0.5 mb-4 text-xs text-white/50">
              Opening moves you played correctly but spent too long on.
            </p>
            <div className="space-y-2">
              {data.overthink_moves.slice(0, 8).map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-ink-800 rounded-lg px-3 py-2 card-hover"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white/45 font-mono text-xs w-6">
                      #{m.move_number}
                    </span>
                    <span className="font-medium text-white">{m.move_san}</span>
                    <span className="text-xs text-white/45 capitalize">{m.phase}</span>
                  </div>
                  <span className="text-yellow-400 font-mono text-sm font-bold">
                    {m.time_spent}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.underthink_blunders.length > 0 && (
          <div className="surface-card p-6 animate-fade-in-up">
            <h2 className="text-base font-semibold text-white">Rushed Blunders</h2>
            <p className="mt-0.5 mb-4 text-xs text-white/50">
              Mistakes made in under 5 seconds. Slow down here.
            </p>
            <div className="space-y-2">
              {data.underthink_blunders.slice(0, 8).map((m, i) => (
                <div
                  key={i}
                  className="bg-ink-800 rounded-lg px-3 py-2 card-hover"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-white/45 font-mono text-xs w-6">
                        #{m.move_number}
                      </span>
                      <span className="text-red-400 font-medium">
                        {m.move_san}
                      </span>
                      <span className="text-green-400 text-xs">
                        best: {m.best_move_san}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-red-400 font-mono text-xs">
                        -{m.cpl.toFixed(0)} cp
                      </span>
                      <span className="text-yellow-400 font-mono text-sm font-bold">
                        {m.time_spent}s
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-white/45">vs {m.opponent}</span>
                    <span className="text-xs text-white/45 capitalize">{m.phase}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimeSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton" style={{ height: 32, width: 240, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 320, borderRadius: 4 }} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="surface-card p-5">
            <div className="skeleton" style={{ height: 14, width: 140, borderRadius: 4 }} />
            <div className="skeleton mt-2" style={{ height: 36, width: 60, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="surface-card p-6">
            <div className="skeleton" style={{ height: 20, width: 200, borderRadius: 4 }} />
            <div className="skeleton mt-4" style={{ height: 256, width: "100%", borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
