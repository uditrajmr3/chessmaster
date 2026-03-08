"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OpeningNode } from "@/lib/types";

export default function OpeningsPage() {
  const [openings, setOpenings] = useState<OpeningNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getOpenings()
      .then(setOpenings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading openings...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Opening Repertoire</h2>
        <p className="text-gray-400 text-sm">
          Your personal opening tree with win rates and accuracy
        </p>
      </div>

      {openings.length === 0 ? (
        <p className="text-gray-400">No opening data yet. Sync and analyze your games first.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#222639] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left p-4">ECO</th>
                  <th className="text-left p-4">Opening</th>
                  <th className="text-center p-4">Games</th>
                  <th className="text-center p-4">Win Rate</th>
                  <th className="text-center p-4">W / L / D</th>
                  <th className="text-center p-4">Avg CPL</th>
                  <th className="p-4">Performance</th>
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
                      className="border-b border-gray-800 hover:bg-gray-800/50"
                    >
                      <td className="p-4 font-mono text-blue-400">{o.eco}</td>
                      <td className="p-4 text-gray-300">{o.name}</td>
                      <td className="p-4 text-center text-gray-300">{o.games}</td>
                      <td className="p-4 text-center">
                        <span
                          className={
                            winRate >= 60
                              ? "text-green-400"
                              : winRate >= 45
                              ? "text-yellow-400"
                              : "text-red-400"
                          }
                        >
                          {winRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className="p-4 text-center text-gray-400 font-mono">
                        {o.wins}/{o.losses}/{o.draws}
                      </td>
                      <td className="p-4 text-center text-gray-400 font-mono">
                        {o.avg_cpl !== null ? o.avg_cpl.toFixed(1) : "—"}
                      </td>
                      <td className="p-4">
                        <div className="w-full h-2 bg-gray-700 rounded-full">
                          <div
                            className={`h-full rounded-full ${barColor}`}
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
          <div className="md:hidden space-y-3">
            {openings.map((o) => {
              const winRate = o.games > 0 ? (o.wins / o.games) * 100 : 0;
              const barColor =
                winRate >= 60
                  ? "bg-green-500"
                  : winRate >= 45
                  ? "bg-yellow-500"
                  : "bg-red-500";

              return (
                <div key={o.eco} className="bg-[#222639] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 text-sm">{o.eco}</span>
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
                  <div className="h-2 bg-gray-700 rounded-full">
                    <div
                      className={`h-full rounded-full ${barColor}`}
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
