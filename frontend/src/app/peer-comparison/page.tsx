"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import type { PeerComparisonReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";

const tooltipStyle = {
  backgroundColor: "#1a1d27",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#e8eaed",
};

export default function PeerComparisonPage() {
  const [report, setReport] = useState<PeerComparisonReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api.getPeerComparison(filters)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <PeerSkeleton />;
  if (!report || report.games_analyzed === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
      <Users className="w-10 h-10 text-gray-500" />
      <p className="text-gray-400 text-center">Not enough data for peer comparison. Analyze at least 5 games.</p>
    </div>
  );

  const chartData = report.comparisons
    .filter((c) => c.metric !== "Avg Game Length")
    .map((c) => ({
      name: c.metric.replace(" CPL", "\nCPL"),
      yours: c.your_value,
      peers: c.peer_average,
      verdict: c.verdict,
    }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Peer Comparison</h2>
          <p className="text-gray-400 text-sm">
            How you compare to typical {report.rating_band} rated players
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
              className="bg-blue-500/10 border border-blue-800/50 rounded-lg px-4 py-3"
            >
              <p className="text-blue-300 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <StatCard label="Rating Band" value={report.rating_band} />
        <StatCard label="Avg Rating" value={report.avg_rating} />
        <StatCard
          label="Strengths"
          value={report.strengths.length}
          color="text-green-400"
        />
        <StatCard
          label="Weaknesses"
          value={report.weaknesses.length}
          color={report.weaknesses.length > 0 ? "text-red-400" : "text-green-400"}
        />
      </div>

      {/* Comparison chart */}
      <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
        <h3 className="text-xl font-semibold mb-1">You vs. Peers</h3>
        <p className="text-gray-500 text-xs mb-4">
          Your stats compared to the {report.rating_band} average
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} interval={0} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => {
                if (name === "yours") return [`${value ?? 0}`, "You"];
                return [`${value ?? 0}`, "Peer Average"];
              }}
            />
            <Bar dataKey="yours" name="yours" radius={[4, 4, 0, 0]} fill="#6366f1" />
            <Bar dataKey="peers" name="peers" radius={[4, 4, 0, 0]} fill="#4b5563" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">
            <span className="text-green-400">Strengths</span> vs. Peers
          </h3>
          {report.strengths.length > 0 ? (
            <div className="space-y-2">
              {report.comparisons
                .filter((c) => report.strengths.includes(c.metric))
                .map((c) => (
                  <MetricCard key={c.metric} metric={c} />
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No significant strengths detected yet.</p>
          )}
        </div>

        {/* Weaknesses */}
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">
            <span className="text-red-400">Weaknesses</span> vs. Peers
          </h3>
          {report.weaknesses.length > 0 ? (
            <div className="space-y-2">
              {report.comparisons
                .filter((c) => report.weaknesses.includes(c.metric))
                .map((c) => (
                  <MetricCard key={c.metric} metric={c} />
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No significant weaknesses detected. Nice!</p>
          )}
        </div>
      </div>

      {/* All metrics table */}
      <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
        <h3 className="text-xl font-semibold mb-4">Full Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Metric</th>
                <th className="text-center py-2 px-3">You</th>
                <th className="text-center py-2 px-3">Peer Avg</th>
                <th className="text-center py-2 px-3">Difference</th>
                <th className="text-center py-2 px-3">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {report.comparisons.map((c) => (
                <tr key={c.metric} className="border-b border-gray-800 hover:bg-white/[0.02]">
                  <td className="py-2 px-3 text-gray-300 font-medium">{c.metric}</td>
                  <td className="py-2 px-3 text-center font-mono text-gray-300">
                    {c.your_value}{c.suffix}
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-gray-500">
                    {c.peer_average}{c.suffix}
                  </td>
                  <td className={`py-2 px-3 text-center font-mono ${
                    c.verdict === "better" ? "text-green-400" :
                    c.verdict === "worse" ? "text-red-400" : "text-gray-400"
                  }`}>
                    {c.difference_pct > 0 ? "+" : ""}{c.difference_pct}%
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.verdict === "better" ? "bg-green-500/20 text-green-400" :
                      c.verdict === "worse" ? "bg-red-500/20 text-red-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>
                      {c.verdict === "better" ? "Better" :
                       c.verdict === "worse" ? "Worse" : "Average"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: PeerComparisonReport["comparisons"][0] }) {
  const isBetter = metric.verdict === "better";

  return (
    <div className="bg-[#1a1d27] rounded-lg px-4 py-3 card-hover">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-200 font-medium">{metric.metric}</p>
          <p className="text-xs text-gray-500">
            You: {metric.your_value}{metric.suffix} · Peers: {metric.peer_average}{metric.suffix}
          </p>
        </div>
        <div className={`text-right px-3 py-1 rounded-lg ${
          isBetter ? "bg-green-500/10" : "bg-red-500/10"
        }`}>
          <p className={`text-sm font-mono font-bold ${
            isBetter ? "text-green-400" : "text-red-400"
          }`}>
            {metric.difference_pct > 0 ? "+" : ""}{metric.difference_pct}%
          </p>
        </div>
      </div>
    </div>
  );
}

type PeerMetricType = PeerComparisonReport["comparisons"][0];

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

function PeerSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton" style={{ height: 32, width: 200, borderRadius: 6 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: 360, borderRadius: 4 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#222639] rounded-xl p-4">
            <div className="skeleton" style={{ height: 12, width: 100, borderRadius: 4 }} />
            <div className="skeleton mt-2" style={{ height: 32, width: 60, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="bg-[#222639] rounded-xl p-5">
        <div className="skeleton" style={{ height: 20, width: 200, borderRadius: 4 }} />
        <div className="skeleton mt-4" style={{ height: 350, width: "100%", borderRadius: 8 }} />
      </div>
    </div>
  );
}
