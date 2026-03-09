"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { Flame } from "lucide-react";
import { api } from "@/lib/api";
import type { TiltReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";

const tooltipStyle = {
  backgroundColor: "#1a1d27",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#e8eaed",
};

export default function TiltPage() {
  const [report, setReport] = useState<TiltReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api.getTiltReport(filters)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <TiltSkeleton />;
  if (!report) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
      <Flame className="w-10 h-10 text-gray-500" />
      <p className="text-gray-400 text-center">No tilt data available. Sync and analyze your games first.</p>
    </div>
  );

  const streakChartData = Object.entries(report.blunder_by_losing_streak).map(
    ([streak, data]) => ({
      name: streak === "5+" ? "5+" : `${streak} losses`,
      blunder_rate: data.blunder_rate,
      games: data.games,
    })
  );

  return (
    <div className="space-y-6">
      {/* Page header — no animation on titles */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Tilt Detector</h2>
          <p className="text-gray-400 text-sm">
            Track your streaks, tilt patterns, and know when to stop playing
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
              className="bg-yellow-500/10 border border-yellow-800/50 rounded-lg px-4 py-3"
            >
              <p className="text-yellow-300 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip — 4 cards max */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
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

      {/* Primary viz — blunder rate by streak */}
      {streakChartData.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-1">Blunder Rate by Consecutive Losses</h3>
          <p className="text-gray-500 text-xs mb-4">
            Does your play deteriorate after consecutive losses?
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={streakChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={tooltipStyle}
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

      {/* Secondary zone — 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worst Tilt Sessions */}
        {report.rating_drops.length > 0 && (
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-1">Worst Tilt Sessions</h3>
            <p className="text-gray-500 text-xs mb-4">
              Sessions where you lost the most rating
            </p>
            <div className="space-y-2">
              {report.rating_drops.map((drop, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-[#1a1d27] rounded-lg px-4 py-3 card-hover"
                >
                  <div>
                    <p className="text-sm text-gray-300 font-medium">
                      {new Date(drop.date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {drop.games_in_session} games, {drop.losses} losses
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-bold text-lg font-mono">
                      -{drop.rating_drop}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
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
          <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-1">Recent Sessions</h3>
            <p className="text-gray-500 text-xs mb-4">
              Performance within each playing session
            </p>
            <div className="space-y-3">
              {report.sessions.slice().reverse().slice(0, 5).map((session, i) => (
                <SessionCard key={i} session={session} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: TiltReport["sessions"][0] }) {
  const ratingColor = session.rating_change >= 0 ? "text-green-400" : "text-red-400";
  const ratingPrefix = session.rating_change >= 0 ? "+" : "";

  const gameChartData = session.games.map((g) => ({
    name: `G${g.game_number}`,
    blunder_rate: g.blunder_rate,
    rating: g.rating,
    result: g.result,
  }));

  return (
    <div className="bg-[#1a1d27] rounded-lg p-4 card-hover">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-gray-300 font-medium">
            {new Date(session.date).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500">
            {session.game_count} games · {session.wins}W {session.losses}L
          </p>
        </div>
        <p className={`font-bold font-mono ${ratingColor}`}>
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

      {/* Mini chart for blunder rate */}
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
    <div className="bg-[#222639] rounded-xl p-4 card-hover">
      <p className="text-gray-400 text-xs font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function TiltSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton" style={{ height: 32, width: 160, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 320, borderRadius: 4 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-4">
            <div className="skeleton" style={{ height: 12, width: 100, borderRadius: 4 }} />
            <div className="skeleton mt-2" style={{ height: 32, width: 48, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="bg-[#222639] rounded-xl p-5">
        <div className="skeleton" style={{ height: 20, width: 260, borderRadius: 4 }} />
        <div className="skeleton mt-4" style={{ height: 300, width: "100%", borderRadius: 8 }} />
      </div>
    </div>
  );
}
