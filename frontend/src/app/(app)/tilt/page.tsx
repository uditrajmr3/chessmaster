"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { Flame } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { TiltReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState, Stat } from "@/components/ui/page-kit";

const tooltipStyle = {
  backgroundColor: "#101c27",
  border: "1px solid #263a49",
  borderRadius: "8px",
  color: "#eaf0f3",
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
  useDataRefresh(loadData);

  if (loading) return <TiltSkeleton />;
  if (!report) return (
    <div className="space-y-6">
      <PageHeader
        title="Tilt Detector"
        subtitle="Track your streaks, tilt patterns, and know when to stop playing."
      />
      <EmptyState
        icon={Flame}
        title="No tilt data yet"
        description="Sync your recent games and run analysis. Once a handful of sessions are scored, this page surfaces your loss streaks and the moments your play breaks down."
      />
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
      <PageHeader
        title="Tilt Detector"
        subtitle="Track your streaks, tilt patterns, and know when to stop playing."
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2 stagger-children">
          {report.recommendations.map((rec, i) => (
            <div
              key={i}
              className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3"
            >
              <p className="text-yellow-300 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip — 4 cards max */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <Stat
          label="Longest Win Streak"
          value={report.streaks.max_win_streak}
          valueClassName="text-green-400"
        />
        <Stat
          label="Longest Loss Streak"
          value={report.streaks.max_loss_streak}
          valueClassName="text-red-400"
        />
        <Stat
          label="Avg Win Streak"
          value={report.streaks.avg_win_streak}
          valueClassName="text-green-400"
        />
        <Stat
          label="Avg Loss Streak"
          value={report.streaks.avg_loss_streak}
          valueClassName="text-red-400"
        />
      </div>

      {/* Primary viz — blunder rate by streak */}
      {streakChartData.length > 0 && (
        <div className="surface-card p-5 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white">Blunder Rate by Consecutive Losses</h2>
          <p className="mt-0.5 mb-4 text-xs text-white/50">
            Does your play deteriorate after consecutive losses?
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={streakChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263a49" />
              <XAxis dataKey="name" stroke="#90a2b1" fontSize={12} />
              <YAxis stroke="#90a2b1" fontSize={12} unit="%" />
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
          <div className="surface-card p-5 animate-fade-in-up">
            <h2 className="text-base font-semibold text-white">Worst Tilt Sessions</h2>
            <p className="mt-0.5 mb-4 text-xs text-white/50">
              Sessions where you lost the most rating.
            </p>
            <div className="space-y-2">
              {report.rating_drops.map((drop, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-ink-800 rounded-lg px-4 py-3 card-hover"
                >
                  <div>
                    <p className="text-sm text-white font-medium">
                      {new Date(drop.date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-white/45">
                      {drop.games_in_session} games, {drop.losses} losses
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-bold text-lg font-mono">
                      -{drop.rating_drop}
                    </p>
                    <p className="text-xs text-white/45 font-mono">
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
          <div className="surface-card p-5 animate-fade-in-up">
            <h2 className="text-base font-semibold text-white">Recent Sessions</h2>
            <p className="mt-0.5 mb-4 text-xs text-white/50">
              Performance within each playing session.
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
    <div className="bg-ink-800 rounded-lg p-4 card-hover">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-white font-medium">
            {new Date(session.date).toLocaleDateString()}
          </p>
          <p className="text-xs text-white/45">
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
                backgroundColor: "#101c27",
                border: "1px solid #263a49",
                borderRadius: "6px",
                color: "#eaf0f3",
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

function TiltSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton" style={{ height: 32, width: 160, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 320, borderRadius: 4 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="surface-card p-4">
            <div className="skeleton" style={{ height: 12, width: 100, borderRadius: 4 }} />
            <div className="skeleton mt-2" style={{ height: 32, width: 48, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="surface-card p-5">
        <div className="skeleton" style={{ height: 20, width: 260, borderRadius: 4 }} />
        <div className="skeleton mt-4" style={{ height: 300, width: "100%", borderRadius: 8 }} />
      </div>
    </div>
  );
}
