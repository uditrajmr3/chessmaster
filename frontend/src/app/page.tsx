"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OverviewStats } from "@/lib/types";
import RatingChart from "@/components/RatingChart";

export default function Dashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // Re-fetch stats periodically in case sync/analysis finishes
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const data = await api.getOverview();
      setStats(data);
    } catch {
      // Backend might not be running
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!stats || stats.total_games === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="text-6xl">♚</div>
        <h2 className="text-2xl font-bold">Welcome to ChessMaster</h2>
        <p className="text-gray-400 text-center max-w-md">
          Click &quot;Sync Games&quot; in the sidebar to fetch your Chess.com and Lichess
          games, then analyze them to discover your recurring patterns.
        </p>
      </div>
    );
  }

  const winRate = ((stats.wins / stats.total_games) * 100).toFixed(1);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1">Dashboard</h2>
        <p className="text-gray-400 text-sm">Your chess performance overview</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Games" value={stats.total_games} />
        <StatCard label="Win Rate" value={`${winRate}%`} color="text-green-400" />
        <StatCard
          label="W / L / D"
          value={`${stats.wins} / ${stats.losses} / ${stats.draws}`}
        />
        <StatCard
          label="Avg Accuracy"
          value={stats.avg_accuracy ? `${stats.avg_accuracy.toFixed(1)}%` : "N/A"}
        />
      </div>

      {/* FIDE Rating Estimates */}
      {stats.rating_estimates.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-1">Estimated FIDE Rating</h3>
          <p className="text-gray-500 text-xs mb-4">Approximate conversion based on community data</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats.rating_estimates.map((est) => (
              <div key={`${est.platform}-${est.time_class}`} className="bg-[#1a1d27] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400 text-xs">{est.platform === "chesscom" ? "Chess.com" : "Lichess"}</span>
                  <span className="text-gray-600 text-xs capitalize">{est.time_class}</span>
                </div>
                <div className="text-white font-mono text-sm">{est.current_rating}</div>
                <div className="text-yellow-400 font-bold text-lg">~{est.fide_estimate} FIDE</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Platforms</h3>
          <div className="space-y-3">
            {Object.entries(stats.platforms).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="text-gray-300 capitalize">{platform}</span>
                <span className="text-white font-mono">{count} games</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Results</h3>
          <div className="flex gap-4">
            <ResultBar label="Win" value={stats.wins} total={stats.total_games} color="bg-green-500" />
            <ResultBar label="Loss" value={stats.losses} total={stats.total_games} color="bg-red-500" />
            <ResultBar label="Draw" value={stats.draws} total={stats.total_games} color="bg-yellow-500" />
          </div>
        </div>
      </div>

      {/* Rating chart */}
      {stats.rating_history.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Rating Over Time</h3>
          <RatingChart data={stats.rating_history} />
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
    <div className="bg-[#222639] rounded-xl p-5">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function ResultBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex-1">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
