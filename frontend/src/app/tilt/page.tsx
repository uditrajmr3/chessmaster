"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { api } from "@/lib/api";
import type { TiltReport } from "@/lib/types";

export default function TiltPage() {
  const [report, setReport] = useState<TiltReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTiltReport()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading tilt data...</div>;
  if (!report) return <div className="text-gray-400">Failed to load tilt data.</div>;

  const streakChartData = Object.entries(report.blunder_by_losing_streak).map(
    ([streak, data]) => ({
      name: streak === "5+" ? "5+" : `${streak} losses`,
      blunder_rate: data.blunder_rate,
      games: data.games,
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tilt Detector</h2>
        <p className="text-gray-400 text-sm">
          Track your streaks, tilt patterns, and know when to stop playing
        </p>
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2">
          {report.recommendations.map((rec, i) => (
            <div
              key={i}
              className="bg-yellow-900/20 border border-yellow-800 rounded-lg px-4 py-3"
            >
              <p className="text-yellow-300 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* Streak Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Longest Win Streak"
          value={report.streaks.max_win_streak}
          color="text-green-400"
        />
        <StatCard
          label="Longest Loss Streak"
          value={report.streaks.max_loss_streak}
          color="text-red-400"
        />
        <StatCard
          label="Avg Win Streak"
          value={report.streaks.avg_win_streak}
          color="text-green-400"
        />
        <StatCard
          label="Avg Loss Streak"
          value={report.streaks.avg_loss_streak}
          color="text-red-400"
        />
      </div>

      {/* Blunder Rate by Losing Streak */}
      {streakChartData.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-1">Blunder Rate by Consecutive Losses</h3>
          <p className="text-gray-500 text-xs mb-4">
            Does your play deteriorate after consecutive losses?
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={streakChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#e8eaed",
                }}
                formatter={(value, name) => {
                  if (name === "blunder_rate") return [`${value ?? 0}%`, "Blunder Rate"];
                  return [`${value ?? 0}`, name ?? ""];
                }}
              />
              <Bar
                dataKey="blunder_rate"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name="blunder_rate"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Worst Tilt Sessions (Rating Drops) */}
      {report.rating_drops.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-1">Worst Tilt Sessions</h3>
          <p className="text-gray-500 text-xs mb-4">
            Sessions where you lost the most rating
          </p>
          <div className="space-y-2">
            {report.rating_drops.map((drop, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-[#1a1d27] rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm text-gray-300">
                    {new Date(drop.date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {drop.games_in_session} games, {drop.losses} losses
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-bold text-lg">
                    -{drop.rating_drop}
                  </p>
                  <p className="text-xs text-gray-500">
                    {drop.peak_rating} → {drop.low_rating}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      {report.sessions.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-1">Recent Sessions</h3>
          <p className="text-gray-500 text-xs mb-4">
            Performance within each playing session
          </p>
          <div className="space-y-4">
            {report.sessions.slice().reverse().map((session, i) => (
              <SessionCard key={i} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: TiltReport["sessions"][0] }) {
  const ratingColor = session.rating_change >= 0 ? "text-green-400" : "text-red-400";
  const ratingPrefix = session.rating_change >= 0 ? "+" : "";

  // Chart data: blunder rate per game in session
  const gameChartData = session.games.map((g) => ({
    name: `G${g.game_number}`,
    blunder_rate: g.blunder_rate,
    rating: g.rating,
    result: g.result,
  }));

  return (
    <div className="bg-[#1a1d27] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-gray-300">
            {new Date(session.date).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500">
            {session.game_count} games · {session.wins}W {session.losses}L
          </p>
        </div>
        <p className={`font-bold ${ratingColor}`}>
          {ratingPrefix}{session.rating_change}
        </p>
      </div>

      {/* Game results row */}
      <div className="flex gap-1 mb-3">
        {session.games.map((g) => (
          <div
            key={g.game_number}
            className={`flex-1 h-2 rounded-full ${
              g.result === "win"
                ? "bg-green-500"
                : g.result === "loss"
                ? "bg-red-500"
                : "bg-yellow-500"
            }`}
            title={`Game ${g.game_number}: ${g.result} (${g.blunder_rate}% blunders)`}
          />
        ))}
      </div>

      {/* Mini chart for blunder rate progression */}
      {session.games.length >= 3 && (
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={gameChartData}>
            <XAxis dataKey="name" hide />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "6px",
                color: "#e8eaed",
                fontSize: "12px",
              }}
              formatter={(value, name) => {
                if (name === "blunder_rate") return [`${value ?? 0}%`, "Blunder Rate"];
                return [`${value ?? 0}`, "Rating"];
              }}
            />
            <Line
              type="monotone"
              dataKey="blunder_rate"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ fill: "#ef4444", r: 3 }}
              name="blunder_rate"
            />
          </LineChart>
        </ResponsiveContainer>
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
    <div className="bg-[#222639] rounded-xl p-4">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
