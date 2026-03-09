"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import type { OpeningNode, GameFilters } from "@/lib/types";
import GameFilterBar from "@/components/GameFilterBar";

export default function OpeningsPage() {
  const [openings, setOpenings] = useState<OpeningNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GameFilters>({});

  const loadData = useCallback(() => {
    setLoading(true);
    api
      .getOpenings(filters)
      .then(setOpenings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <OpeningsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">Opening Repertoire</h2>
          <p className="text-gray-400 text-sm">
            Your personal opening tree with win rates and accuracy
          </p>
        </div>
        <GameFilterBar filters={filters} onChange={setFilters} />
      </div>

      {openings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
          <BookOpen className="w-10 h-10 text-gray-500" />
          <p className="text-gray-400 text-center">No opening data yet. Sync and analyze your games first.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#222639] rounded-xl overflow-hidden animate-fade-in-up">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left p-4 font-medium">ECO</th>
                  <th className="text-left p-4 font-medium">Opening</th>
                  <th className="text-center p-4 font-medium">Games</th>
                  <th className="text-center p-4 font-medium">Win Rate</th>
                  <th className="text-center p-4 font-medium">W / L / D</th>
                  <th className="text-center p-4 font-medium">Avg CPL</th>
                  <th className="p-4 font-medium">Performance</th>
                </tr>
              </thead>
              <tbody>
                {openings.map((o) => {
                  const winRate = o.games > 0 ? (o.wins / o.games) * 100 : 0;
                  const barColor =
                    winRate >= 60
                      ? "bg-green-500"
                      : winRate >= 45
                      ? "bg-yellow-500"
                      : "bg-red-500";

                  return (
                    <tr
                      key={o.eco}
                      className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-4 font-mono text-accent-400 font-medium">{o.eco}</td>
                      <td className="p-4 text-gray-300">{o.name}</td>
                      <td className="p-4 text-center text-gray-300">{o.games}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`font-semibold ${
                            winRate >= 60
                              ? "text-green-400"
                              : winRate >= 45
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {winRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className="p-4 text-center text-gray-400 font-mono text-sm">
                        {o.wins}/{o.losses}/{o.draws}
                      </td>
                      <td className="p-4 text-center text-gray-400 font-mono text-sm">
                        {o.avg_cpl !== null ? o.avg_cpl.toFixed(1) : "—"}
                      </td>
                      <td className="p-4">
                        <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full progress-animated ${barColor}`}
                            style={{ width: `${winRate}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-2">
            {openings.map((o) => {
              const winRate = o.games > 0 ? (o.wins / o.games) * 100 : 0;
              const barColor =
                winRate >= 60
                  ? "bg-green-500"
                  : winRate >= 45
                  ? "bg-yellow-500"
                  : "bg-red-500";

              return (
                <div key={o.eco} className="bg-[#222639] rounded-xl p-4 card-hover">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-accent-400 text-sm font-medium">{o.eco}</span>
                      <span className="text-gray-300 text-sm">{o.name}</span>
                    </div>
                    <span
                      className={`font-bold ${
                        winRate >= 60
                          ? "text-green-400"
                          : winRate >= 45
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {winRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>{o.games} games</span>
                    <span className="font-mono">{o.wins}W / {o.losses}L / {o.draws}D</span>
                    {o.avg_cpl !== null && <span>{o.avg_cpl.toFixed(1)} CPL</span>}
                  </div>
                  <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full progress-animated ${barColor}`}
                      style={{ width: `${winRate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function OpeningsSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="bg-[#222639] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700/50">
          <div className="skeleton h-4 w-full" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-800/30">
            <div className="skeleton h-4 w-10" />
            <div className="skeleton h-4 w-36" />
            <div className="skeleton h-4 w-8 ml-auto" />
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-2 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
