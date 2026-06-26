"use client";

import { useState, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import type { GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";

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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Export Data</h2>
          <p className="text-gray-400 text-sm">
            Download your games and analysis in various formats
          </p>
        </div>
        <GameFilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Summary */}
      {s && (s.total_games as number) > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
          <StatCard label="Total Games" value={s.total_games as number} />
          <StatCard
            label="Win Rate"
            value={`${s.win_rate}%`}
            color={(s.win_rate as number) >= 50 ? "text-green-400" : "text-red-400"}
          />
          <StatCard label="Current Rating" value={s.current_rating as number} />
          <StatCard label="Games Analyzed" value={s.games_analyzed as number} />
        </div>
      )}

      {/* Export options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        <ExportCard
          title="Games CSV"
          description="All game metadata — results, ratings, openings, dates"
          format="CSV"
          onClick={() => downloadCsv("games")}
        />
        <ExportCard
          title="Analysis CSV"
          description="Move-by-move analysis — CPL, classifications, evaluations"
          format="CSV"
          onClick={() => downloadCsv("analysis")}
        />
        <ExportCard
          title="Games JSON"
          description="Full game data including PGN — for programmatic use"
          format="JSON"
          onClick={() => downloadJson()}
        />
      </div>

      {/* Data preview */}
      {s && (s.total_games as number) > 0 && (
        <div className="surface-card p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-4">Export Preview</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#101c27] rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Record</p>
              <p className="text-sm font-mono">
                <span className="text-green-400">{s.wins as number}W</span>
                {" / "}
                <span className="text-red-400">{s.losses as number}L</span>
                {" / "}
                <span className="text-gray-400">{s.draws as number}D</span>
              </p>
            </div>
            <div className="bg-[#101c27] rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Peak Rating</p>
              <p className="text-sm font-mono text-yellow-400">{s.peak_rating as number}</p>
            </div>
            <div className="bg-[#101c27] rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Avg CPL</p>
              <p className="text-sm font-mono text-gray-300">{s.avg_cpl as number}</p>
            </div>
            <div className="bg-[#101c27] rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Total Blunders</p>
              <p className="text-sm font-mono text-red-400">{s.total_blunders as number}</p>
            </div>
          </div>
          {s.date_range && (
            <p className="text-xs text-gray-600 mt-3">
              Date range: {(s.date_range as Record<string, string>).from?.slice(0, 10)} to{" "}
              {(s.date_range as Record<string, string>).to?.slice(0, 10)}
            </p>
          )}
        </div>
      )}

      {!loading && s && (s.total_games as number) === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
          <Download className="w-10 h-10 text-gray-500" />
          <p className="text-gray-400 text-center">No games to export. Sync your games first.</p>
        </div>
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
    <div className="surface-card p-5 card-hover animate-fade-in-up">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-gray-200 font-medium">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-accent-500/20 text-accent-400 font-mono">
          {format}
        </span>
      </div>
      <button
        onClick={onClick}
        className="w-full mt-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-lg btn-press flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        Download
      </button>
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
    <div className="surface-card p-4 card-hover">
      <p className="text-gray-400 text-xs font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
