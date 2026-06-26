"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { PeerComparisonReport, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState, Section, Stat } from "@/components/ui/page-kit";

const tooltipStyle = {
  backgroundColor: "#101c27",
  border: "1px solid #33495a",
  borderRadius: "8px",
  color: "#eaf0f3",
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
  useDataRefresh(loadData);

  if (loading) return <PeerSkeleton />;
  if (!report || report.games_analyzed === 0) return (
    <div className="space-y-6">
      <PageHeader
        title="Peer Comparison"
        subtitle="See how your play stacks up against players in your rating band."
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />
      <EmptyState
        icon={Users}
        title="Not enough data yet"
        description="Analyze at least 5 games to unlock a peer comparison. Sync more games, then run analysis from the sidebar."
      />
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
      <PageHeader
        title="Peer Comparison"
        subtitle={`How you compare to typical ${report.rating_band} rated players.`}
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2 stagger-children">
          {report.recommendations.map((rec, i) => (
            <div
              key={i}
              className="rounded-lg border border-accent-500/20 bg-accent-500/10 px-4 py-3"
            >
              <p className="text-sm text-accent-200">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <Stat label="Rating Band" value={report.rating_band} />
        <Stat label="Avg Rating" value={report.avg_rating} />
        <Stat
          label="Strengths"
          value={report.strengths.length}
          valueClassName="text-green-400"
        />
        <Stat
          label="Weaknesses"
          value={report.weaknesses.length}
          valueClassName={report.weaknesses.length > 0 ? "text-red-400" : "text-green-400"}
        />
      </div>

      {/* Comparison chart */}
      <Section
        title="You vs. Peers"
        description={`Your stats compared to the ${report.rating_band} average`}
      >
        <div className="surface-card p-5 animate-fade-in-up">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#33495a" />
              <XAxis dataKey="name" stroke="#90a2b1" fontSize={11} interval={0} />
              <YAxis stroke="#90a2b1" fontSize={12} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={tooltipStyle}
                formatter={(value, name) => {
                  if (name === "yours") return [`${value ?? 0}`, "You"];
                  return [`${value ?? 0}`, "Peer Average"];
                }}
              />
              <Bar dataKey="yours" name="yours" radius={[4, 4, 0, 0]} fill="#a78368" />
              <Bar dataKey="peers" name="peers" radius={[4, 4, 0, 0]} fill="#33495a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Metric cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strengths */}
        <Section title={<><span className="text-green-400">Strengths</span> vs. Peers</>}>
          {report.strengths.length > 0 ? (
            <div className="surface-card divide-y divide-white/5 animate-fade-in-up">
              {report.comparisons
                .filter((c) => report.strengths.includes(c.metric))
                .map((c) => (
                  <MetricRow key={c.metric} metric={c} />
                ))}
            </div>
          ) : (
            <p className="text-sm text-white/45">No significant strengths detected yet.</p>
          )}
        </Section>

        {/* Weaknesses */}
        <Section title={<><span className="text-red-400">Weaknesses</span> vs. Peers</>}>
          {report.weaknesses.length > 0 ? (
            <div className="surface-card divide-y divide-white/5 animate-fade-in-up">
              {report.comparisons
                .filter((c) => report.weaknesses.includes(c.metric))
                .map((c) => (
                  <MetricRow key={c.metric} metric={c} />
                ))}
            </div>
          ) : (
            <p className="text-sm text-white/45">No significant weaknesses detected. Nice work.</p>
          )}
        </Section>
      </div>

      {/* All metrics table */}
      <Section title="Full Comparison">
        <div className="surface-card overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-white/45">
                  <th className="text-left py-3 px-4 font-medium">Metric</th>
                  <th className="text-center py-3 px-4 font-medium">You</th>
                  <th className="text-center py-3 px-4 font-medium">Peer Avg</th>
                  <th className="text-center py-3 px-4 font-medium">Difference</th>
                  <th className="text-center py-3 px-4 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {report.comparisons.map((c) => (
                  <tr key={c.metric} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-medium text-white/90">{c.metric}</td>
                    <td className="py-3 px-4 text-center font-mono text-white/90">
                      {c.your_value}{c.suffix}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-white/45">
                      {c.peer_average}{c.suffix}
                    </td>
                    <td className={`py-3 px-4 text-center font-mono ${
                      c.verdict === "better" ? "text-green-400" :
                      c.verdict === "worse" ? "text-red-400" : "text-white/55"
                    }`}>
                      {c.difference_pct > 0 ? "+" : ""}{c.difference_pct}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-md font-semibold uppercase tracking-wide ${
                        c.verdict === "better" ? "bg-green-500/15 text-green-400" :
                        c.verdict === "worse" ? "bg-red-500/15 text-red-400" :
                        "bg-white/10 text-white/55"
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
      </Section>
    </div>
  );
}

function MetricRow({ metric }: { metric: PeerComparisonReport["comparisons"][0] }) {
  const isBetter = metric.verdict === "better";

  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/90">{metric.metric}</p>
        <p className="mt-0.5 text-xs text-white/45">
          You: <span className="font-mono">{metric.your_value}{metric.suffix}</span> · Peers: <span className="font-mono">{metric.peer_average}{metric.suffix}</span>
        </p>
      </div>
      <span className={`shrink-0 rounded-md px-3 py-1 text-sm font-mono font-bold ${
        isBetter ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
      }`}>
        {metric.difference_pct > 0 ? "+" : ""}{metric.difference_pct}%
      </span>
    </div>
  );
}

function PeerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="skeleton h-8 w-56 rounded-md" />
          <div className="skeleton mt-2 h-4 w-80 rounded" />
        </div>
        <div className="skeleton h-9 w-64 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="surface-card p-5">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
      <div className="surface-card p-5">
        <div className="skeleton h-5 w-48 rounded" />
        <div className="skeleton mt-4 h-[350px] w-full rounded-lg" />
      </div>
    </div>
  );
}
