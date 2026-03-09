"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ScoutReport, OpponentOpening, CrossReferenceEntry } from "@/lib/types";

export default function ScoutingPage() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("chesscom");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ScoutReport | null>(null);

  const handleScout = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const data = await api.scoutOpponent({
        opponent_username: username.trim(),
        platform,
      });
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scout opponent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Opponent Scout</h2>
        <p className="text-gray-400 text-sm">
          Analyze your opponent&apos;s opening repertoire and find your edge
        </p>
      </div>

      {/* Search form */}
      <div className="bg-[#222639] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScout()}
            placeholder="Opponent username"
            className="flex-1 bg-[#1a1d27] text-gray-200 text-sm rounded-lg px-4 py-2.5 border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-500"
          />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="bg-[#1a1d27] text-gray-300 text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="chesscom">Chess.com</option>
            <option value="lichess">Lichess</option>
          </select>
          <button
            onClick={handleScout}
            disabled={loading || !username.trim()}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "Scouting..." : "Scout"}
          </button>
        </div>
        {loading && (
          <p className="text-gray-500 text-xs mt-3">
            Fetching games from {platform === "chesscom" ? "Chess.com" : "Lichess"}...
          </p>
        )}
        {error && (
          <p className="text-red-400 text-sm mt-3">{error}</p>
        )}
      </div>

      {/* Results */}
      {report && <ScoutResults report={report} />}
    </div>
  );
}

function ScoutResults({ report }: { report: ScoutReport }) {
  const { opponent } = report;

  if (opponent.games_analyzed === 0) {
    return (
      <div className="text-gray-400 text-center py-10">
        No games found for this opponent.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="space-y-2">
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

      {/* Opponent summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Rating" value={opponent.rating} />
        <StatCard
          label="Games Analyzed"
          value={opponent.games_analyzed}
        />
        <StatCard
          label="White Win Rate"
          value={`${opponent.white_win_rate}%`}
          color="text-green-400"
        />
        <StatCard
          label="Black Win Rate"
          value={`${opponent.black_win_rate}%`}
          color="text-green-400"
        />
      </div>

      {/* Opening tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OpeningTable
          title="As White"
          openings={report.opponent_white_openings}
          crossRef={report.cross_reference.your_record_vs_their_white_openings}
        />
        <OpeningTable
          title="As Black"
          openings={report.opponent_black_openings}
          crossRef={report.cross_reference.your_record_vs_their_black_openings}
        />
      </div>
    </div>
  );
}

function OpeningTable({
  title,
  openings,
  crossRef,
}: {
  title: string;
  openings: OpponentOpening[];
  crossRef: CrossReferenceEntry[];
}) {
  if (openings.length === 0) {
    return (
      <div className="bg-[#222639] rounded-xl p-5">
        <h3 className="text-xl font-semibold mb-3">{title}</h3>
        <p className="text-gray-500 text-sm">No opening data</p>
      </div>
    );
  }

  const xrefMap = new Map(crossRef.map((x) => [x.eco, x]));

  return (
    <div className="bg-[#222639] rounded-xl p-5">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs">
              <th className="text-left pb-2">Opening</th>
              <th className="text-center pb-2">Freq</th>
              <th className="text-center pb-2">W/L/D</th>
              <th className="text-center pb-2">Your Record</th>
            </tr>
          </thead>
          <tbody>
            {openings.map((o) => {
              const xref = xrefMap.get(o.eco);
              const winRate = xref?.your_win_rate;
              const wrColor =
                winRate === null || winRate === undefined
                  ? "text-gray-500"
                  : winRate >= 55
                  ? "text-green-400"
                  : winRate >= 40
                  ? "text-yellow-400"
                  : "text-red-400";

              return (
                <tr key={o.eco} className="border-b border-gray-800">
                  <td className="py-2.5">
                    <p className="text-gray-200 font-medium">{o.name}</p>
                    <p className="text-gray-500 text-xs">{o.eco}</p>
                  </td>
                  <td className="text-center">
                    <span className="text-gray-300">{o.frequency_pct}%</span>
                    <p className="text-gray-500 text-xs">{o.games}g</p>
                  </td>
                  <td className="text-center text-xs text-gray-400 font-mono">
                    {o.wins}/{o.losses}/{o.draws}
                  </td>
                  <td className="text-center">
                    {xref ? (
                      xref.your_games > 0 ? (
                        <span className={`font-bold ${wrColor}`}>
                          {winRate}%
                          <span className="text-gray-500 text-xs font-normal ml-1">
                            ({xref.your_games}g)
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">No data</span>
                      )
                    ) : (
                      <span className="text-gray-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
    <div className="bg-[#222639] rounded-xl p-4">
      <p className="text-gray-400 text-xs font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
