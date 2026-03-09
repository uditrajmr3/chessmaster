"use client";

import { useEffect, useState } from "react";
import { Crown, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import type { OverviewStats } from "@/lib/types";
import RatingChart from "@/components/RatingChart";

export default function Dashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
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
    return <DashboardSkeleton />;
  }

  if (!stats || stats.total_games === 0) {
    return <EmptyState />;
  }

  const winRate = ((stats.wins / stats.total_games) * 100).toFixed(1);

  return (
    <div className="space-y-8">
      {/* Zone 3 — Page Header (blueprint: title left-aligned, no animation on titles) */}
      <div>
        <h2 className="text-3xl font-bold mb-1">Dashboard</h2>
        <p className="text-gray-400 text-sm">Your chess performance overview</p>
      </div>

      {/* Zone 4 — Metric Strip (blueprint: 3-4 KPI cards max, leftmost = most important) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
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

      {/* Zone 5 — Primary Content: Rating Chart (blueprint: one primary viz) */}
      {stats.rating_history.length > 0 && (
        <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">Rating Over Time</h3>
          <RatingChart data={stats.rating_history} />
        </div>
      )}

      {/* Zone 6 — Secondary Content (blueprint: 2-column grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FIDE Rating Estimates */}
        {stats.rating_estimates.length > 0 && (
          <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
            <h3 className="text-xl font-semibold mb-1">Estimated FIDE Rating</h3>
            <p className="text-gray-500 text-xs mb-4">Approximate conversion based on community data</p>
            <div className="grid grid-cols-2 gap-3">
              {stats.rating_estimates.map((est) => (
                <div
                  key={`${est.platform}-${est.time_class}`}
                  className="bg-[#1a1d27] rounded-lg p-4 card-hover"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-400 text-xs font-medium">
                      {est.platform === "chesscom" ? "Chess.com" : "Lichess"}
                    </span>
                    <span className="text-gray-600 text-xs capitalize">{est.time_class}</span>
                  </div>
                  <div className="text-white font-mono text-sm">{est.current_rating}</div>
                  <div className="text-yellow-400 font-bold text-lg">~{est.fide_estimate} FIDE</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results breakdown */}
        <div className="bg-[#222639] rounded-xl p-6 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">Results</h3>
          <div className="flex gap-4">
            <ResultBar label="Win" value={stats.wins} total={stats.total_games} color="bg-green-500" />
            <ResultBar label="Loss" value={stats.losses} total={stats.total_games} color="bg-red-500" />
            <ResultBar label="Draw" value={stats.draws} total={stats.total_games} color="bg-yellow-500" />
          </div>

          {/* Platform counts */}
          <div className="mt-6 pt-4 border-t border-gray-700/50">
            <h4 className="text-sm text-gray-400 font-medium mb-3">Platforms</h4>
            <div className="space-y-2">
              {Object.entries(stats.platforms).map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <span className="text-gray-300 capitalize font-medium text-sm">{platform}</span>
                  <span className="text-white font-mono text-sm">{count} games</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * Empty State (blueprint 7: 3 elements — illustration, explanation, primary action)
 * Headline: "Your games live here" style, not error language
 * ONE button action
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-6 animate-fade-in-up">
      {/* Element 1: Illustration/Icon — contextual, warm */}
      <Crown className="w-16 h-16 text-yellow-400" />

      {/* Element 2: Explanation — headline + subline, helpful not apologetic */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold">Your games live here</h2>
        <p className="text-gray-400 text-center max-w-md leading-relaxed">
          Sync your Chess.com and Lichess games, then analyze them to
          discover your recurring patterns and get personalized coaching.
        </p>
      </div>

      {/* Element 3: Primary action — flow indicator */}
      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-500 opacity-60" />
          Sync
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-gray-700" />
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-500 opacity-80" />
          Analyze
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-gray-700" />
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-500" />
          Improve
        </span>
      </div>
    </div>
  );
}

/*
 * Skeleton loading (interaction 5)
 * Shapes must match real content exactly.
 * Transition from skeleton to real: fade in 200ms (animate-fade-in).
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Page header skeleton */}
      <div>
        <div className="skeleton" style={{ height: 32, width: 160, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 240, borderRadius: 4 }} />
      </div>

      {/* KPI strip skeleton — 4 cards matching StatCard shape */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-5">
            <div className="skeleton" style={{ height: 14, width: 96, borderRadius: 4 }} />
            <div className="skeleton mt-3" style={{ height: 32, width: 80, borderRadius: 6 }} />
          </div>
        ))}
      </div>

      {/* Primary chart skeleton */}
      <div className="bg-[#222639] rounded-xl p-6">
        <div className="skeleton" style={{ height: 20, width: 140, borderRadius: 4 }} />
        <div className="skeleton mt-4" style={{ height: 256, width: "100%", borderRadius: 8 }} />
      </div>

      {/* Secondary zone skeleton — 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#222639] rounded-xl p-6">
          <div className="skeleton" style={{ height: 20, width: 180, borderRadius: 4 }} />
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />
            ))}
          </div>
        </div>
        <div className="bg-[#222639] rounded-xl p-6">
          <div className="skeleton" style={{ height: 20, width: 100, borderRadius: 4 }} />
          <div className="skeleton mt-4" style={{ height: 64, width: "100%", borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}

/* KPI card (blueprint zone 4: metric name + value) */
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
    <div className="bg-[#222639] rounded-xl p-5 card-hover">
      <p className="text-gray-400 text-sm font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1.5 ${color}`}>{value}</p>
    </div>
  );
}

/* Result bars with animated fill (interaction 8: width 0.4s ease-in-out) */
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
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-400 font-medium">{label}</span>
        <span className="text-white font-mono text-sm">{value}</span>
      </div>
      <div className="h-2.5 bg-gray-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-animated ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
