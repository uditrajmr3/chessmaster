"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TimeManagementProfile } from "@/lib/types";
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
  backgroundColor: "#1a1d27",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#e8eaed",
};

export default function TimeManagementPage() {
  const [data, setData] = useState<TimeManagementProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getTimeManagement()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading time data...</div>;
  if (!data || data.games_with_clock_data === 0)
    return (
      <div className="text-gray-400">
        No clock data available. Sync and analyze games with clock information first.
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Time Management Profile</h2>
        <p className="text-gray-400 text-sm">
          How you spend your clock across {data.games_with_clock_data} analyzed games
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {phaseTimeData.map((p) => (
          <div key={p.phase} className="bg-[#222639] rounded-xl p-5">
            <p className="text-sm text-gray-400">{p.phase} avg time/move</p>
            <p className="text-3xl font-bold mt-1">{p.time}s</p>
          </div>
        ))}
      </div>

      {/* Time vs Move Number chart + Time by Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Time Spent vs Move Number</h3>
          <p className="text-xs text-gray-500 mb-3">
            Average seconds spent per move (with CPL overlay)
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.time_vs_move_number}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="move"
                  stroke="#9ca3af"
                  fontSize={11}
                  label={{ value: "Move #", position: "insideBottom", offset: -2, style: { fill: "#6b7280", fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="time"
                  stroke="#9ca3af"
                  fontSize={11}
                  label={{ value: "Seconds", angle: -90, position: "insideLeft", style: { fill: "#6b7280", fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="cpl"
                  orientation="right"
                  stroke="#9ca3af"
                  fontSize={11}
                  label={{ value: "CPL", angle: 90, position: "insideRight", style: { fill: "#6b7280", fontSize: 11 } }}
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
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Avg Time (s)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Time by Move Quality</h3>
          <p className="text-xs text-gray-500 mb-3">
            Average seconds spent on moves of each quality
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classificationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="classification" stroke="#9ca3af" fontSize={11} />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  label={{ value: "Seconds", angle: -90, position: "insideLeft", style: { fill: "#6b7280", fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value}s`, "Avg Time"]}
                />
                <Bar
                  dataKey="time"
                  radius={[4, 4, 0, 0]}
                  fill="#8b5cf6"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Time Pressure Zones */}
      <div className="bg-[#222639] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Time Pressure Zones</h3>
        <p className="text-xs text-gray-500 mb-4">
          How your play quality changes based on remaining clock time
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {troubleData.map((zone) => {
            const color =
              zone.zone === "Critical"
                ? "red"
                : zone.zone === "Low"
                ? "orange"
                : zone.zone === "Normal"
                ? "yellow"
                : "green";
            return (
              <div key={zone.zone} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color === "orange" ? "#f97316" : color === "yellow" ? "#eab308" : color }}
                  />
                  <span className="font-medium">{zone.zone}</span>
                  <span className="text-xs text-gray-500">
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
                    <span className="text-sm text-gray-400">Blunder rate</span>
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
                    <span className="text-sm text-gray-400">Avg CPL</span>
                    <span className="text-sm font-mono">{zone.avg_cpl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Moves</span>
                    <span className="text-sm font-mono text-gray-500">
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
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">By Time Control</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 pr-4">Time Control</th>
                  <th className="text-right py-2 px-4">Games</th>
                  <th className="text-right py-2 px-4">Moves</th>
                  <th className="text-right py-2 px-4">Avg CPL</th>
                  <th className="text-right py-2 pl-4">Time Trouble %</th>
                </tr>
              </thead>
              <tbody>
                {data.time_class_breakdown.map((tc) => (
                  <tr key={tc.time_class} className="border-b border-gray-800">
                    <td className="py-2 pr-4 capitalize font-medium">{tc.time_class}</td>
                    <td className="text-right py-2 px-4">{tc.games}</td>
                    <td className="text-right py-2 px-4">{tc.moves_analyzed.toLocaleString()}</td>
                    <td className="text-right py-2 px-4">{tc.avg_cpl}</td>
                    <td
                      className={`text-right py-2 pl-4 font-mono ${
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

      {/* Overthinking + Rushing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overthinking on book moves */}
        {data.overthink_moves.length > 0 && (
          <div className="bg-[#222639] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-1">Overthinking Book Moves</h3>
            <p className="text-xs text-gray-500 mb-4">
              Opening moves you played correctly but spent too long on
            </p>
            <div className="space-y-2">
              {data.overthink_moves.slice(0, 8).map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 font-mono text-xs w-6">
                      #{m.move_number}
                    </span>
                    <span className="font-medium">{m.move_san}</span>
                    <span className="text-xs text-gray-500 capitalize">{m.phase}</span>
                  </div>
                  <span className="text-yellow-400 font-mono text-sm">
                    {m.time_spent}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rushed blunders */}
        {data.underthink_blunders.length > 0 && (
          <div className="bg-[#222639] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-1">Rushed Blunders</h3>
            <p className="text-xs text-gray-500 mb-4">
              Mistakes made in under 5 seconds — slow down here
            </p>
            <div className="space-y-2">
              {data.underthink_blunders.slice(0, 8).map((m, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-mono text-xs w-6">
                        #{m.move_number}
                      </span>
                      <span className="text-red-400">
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
                      <span className="text-yellow-400 font-mono text-sm">
                        {m.time_spent}s
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">vs {m.opponent}</span>
                    <span className="text-xs text-gray-600 capitalize">{m.phase}</span>
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
