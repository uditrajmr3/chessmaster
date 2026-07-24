"use client";

import { useState, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import type { GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";
import { PageHeader, EmptyState, Stat } from "@/components/ui/page-kit";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function ExportPage() {
  const [filters, setFilters] = useState<GameFilters>({});
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(() => {
    setLoading(true);
    api.getExportSummary(filters)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.time_class) params.set("time_class", filters.time_class);
    return params.toString() ? `?${params.toString()}` : "";
  };

  const downloadCsv = (type: "games" | "analysis") => {
    window.open(`${API_BASE}/export/${type}/csv${buildQuery()}`, "_blank");
  };

  const downloadJson = () => {
    window.open(`${API_BASE}/export/games/json${buildQuery()}`, "_blank");
  };

  const s = summary as Record<string, number | string | string[] | Record<string, string>> | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Export Data"
        subtitle="Download your games and analysis in CSV or JSON formats."
        action={<GameFilterBar filters={filters} onChange={setFilters} />}
      />

      {/* Summary */}
      {s && (s.total_games as number) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
          <Stat label="Total Games" value={s.total_games as number} />
          <Stat
            label="Win Rate"
            value={`${s.win_rate}%`}
            valueClassName={
              (s.win_rate as number) >= 50 ? "text-green-400" : "text-red-400"
            }
          />
          <Stat label="Current Rating" value={s.current_rating as number} />
          <Stat label="Games Analyzed" value={s.games_analyzed as number} />
        </div>
      )}

      {/* Export options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        <ExportCard
          title="Games CSV"
          description="All game metadata: results, ratings, openings, dates"
          format="CSV"
          onClick={() => downloadCsv("games")}
        />
        <ExportCard
          title="Analysis CSV"
          description="Move-by-move analysis: CPL, classifications, evaluations"
          format="CSV"
          onClick={() => downloadCsv("analysis")}
        />
        <ExportCard
          title="Games JSON"
          description="Full game data including PGN for programmatic use"
          format="JSON"
          onClick={() => downloadJson()}
        />
      </div>

      {/* Data preview */}
      {s && (s.total_games as number) > 0 && (
        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">Export Preview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-ink-800 border border-white/5 rounded-lg p-4">
              <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium mb-2">Record</p>
              <p className="text-sm font-mono">
                <span className="text-green-400">{s.wins as number}W</span>
                {" / "}
                <span className="text-red-400">{s.losses as number}L</span>
                {" / "}
                <span className="text-white/55">{s.draws as number}D</span>
              </p>
            </div>
            <div className="bg-ink-800 border border-white/5 rounded-lg p-4">
              <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium mb-2">Peak Rating</p>
              <p className="text-sm font-mono text-yellow-400">{s.peak_rating as number}</p>
            </div>
            <div className="bg-ink-800 border border-white/5 rounded-lg p-4">
              <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium mb-2">Avg CPL</p>
              <p className="text-sm font-mono text-gray-300">{s.avg_cpl as number}</p>
            </div>
            <div className="bg-ink-800 border border-white/5 rounded-lg p-4">
              <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium mb-2">Total Blunders</p>
              <p className="text-sm font-mono text-red-400">{s.total_blunders as number}</p>
            </div>
          </div>
          {s.date_range && (
            <p className="text-xs text-white/45 mt-4">
              Date range: {(s.date_range as Record<string, string>).from?.slice(0, 10)} to{" "}
              {(s.date_range as Record<string, string>).to?.slice(0, 10)}
            </p>
          )}
        </div>
      )}

      {!loading && s && (s.total_games as number) === 0 && (
        <EmptyState
          icon={Download}
          title="Nothing to export yet"
          description="Sync your Chess.com or Lichess games from the sidebar, then return here to download them as CSV or JSON."
        />
      )}
    </div>
  );
}

function ExportCard({
  title,
  description,
  format,
  onClick,
}: {
  title: string;
  description: string;
  format: string;
  onClick: () => void;
}) {
  return (
    <div className="surface-card p-5 card-hover animate-fade-in-up flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-white font-medium">{title}</p>
          <p className="text-xs text-white/45 mt-1">{description}</p>
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-accent-500/15 text-accent-300 font-mono">
          {format}
        </span>
      </div>
      <button
        onClick={onClick}
        className="w-full mt-auto px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-lg btn-press flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        Download
      </button>
    </div>
  );
}
