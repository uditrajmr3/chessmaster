"use client";

import { useState } from "react";
import { Crosshair } from "lucide-react";
import { api } from "@/lib/api";
import type { ScoutReport, OpponentOpening, CrossReferenceEntry } from "@/lib/types";
import { PageHeader, EmptyState, Stat } from "@/components/ui/page-kit";

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
      <PageHeader
        title="Opponent Scout"
        subtitle="Analyze an opponent's opening repertoire and find where you hold the edge."
      />

      {/* Search form */}
      <div className="surface-card p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScout()}
            placeholder="Opponent username"
            aria-label="Opponent username"
            className="flex-1 bg-ink-800 text-white text-sm rounded-lg px-4 py-2.5 border border-white/10 transition-colors placeholder-white/40 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
          />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            aria-label="Platform"
            className="bg-ink-800 text-white/80 text-sm rounded-lg px-3 py-2.5 border border-white/10 transition-colors hover:border-white/20 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
          >
            <option value="chesscom">Chess.com</option>
            <option value="lichess">Lichess</option>
          </select>
          <button
            onClick={handleScout}
            disabled={loading || !username.trim()}
            className="px-6 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-lg btn-press disabled:bg-ink-700 disabled:text-white/40 disabled:cursor-not-allowed"
          >
            {loading ? "Scouting..." : "Scout"}
          </button>
        </div>
        {loading && (
          <p className="text-white/45 text-xs mt-3">
            Fetching games from {platform === "chesscom" ? "Chess.com" : "Lichess"}...
          </p>
        )}
        {error && (
          <p className="text-red-400 text-sm mt-3">{error}</p>
        )}
      </div>

      {/* Results */}
      {!report && !loading && !error && (
        <EmptyState
          icon={Crosshair}
          title="Scout an opponent"
          description="Enter a Chess.com or Lichess username above to break down their openings, win rates, and how your record stacks up."
        />
      )}
      {report && <ScoutResults report={report} />}
    </div>
  );
}

function ScoutResults({ report }: { report: ScoutReport }) {
  const { opponent } = report;

  if (opponent.games_analyzed === 0) {
    return (
      <EmptyState
        icon={Crosshair}
        title="No games found"
        description="We could not find any games for this opponent. Check the username and platform, then try again."
      />
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Opponent summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        <Stat label="Rating" value={opponent.rating} />
        <Stat label="Games Analyzed" value={opponent.games_analyzed} />
        <Stat
          label="White Win Rate"
          value={`${opponent.white_win_rate}%`}
          valueClassName="text-green-400"
        />
        <Stat
          label="Black Win Rate"
          value={`${opponent.black_win_rate}%`}
          valueClassName="text-green-400"
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
      <div className="surface-card p-5 animate-fade-in-up">
        <h3 className="text-base font-semibold text-white mb-3">{title}</h3>
        <p className="text-sm text-white/45">No opening data.</p>
      </div>
    );
  }

  const xrefMap = new Map(crossRef.map((x) => [x.eco, x]));

  return (
    <div className="surface-card overflow-hidden animate-fade-in-up">
      <h3 className="text-base font-semibold text-white px-5 pt-5 pb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-white/45">
              <th className="text-left py-2.5 px-5 font-medium">Opening</th>
              <th className="text-center py-2.5 px-3 font-medium">Freq</th>
              <th className="text-center py-2.5 px-3 font-medium">W/L/D</th>
              <th className="text-center py-2.5 px-5 font-medium">Your Record</th>
            </tr>
          </thead>
          <tbody>
            {openings.map((o) => {
              const xref = xrefMap.get(o.eco);
              const winRate = xref?.your_win_rate;
              const wrColor =
                winRate === null || winRate === undefined
                  ? "text-white/45"
                  : winRate >= 55
                  ? "text-green-400"
                  : winRate >= 40
                  ? "text-yellow-400"
                  : "text-red-400";

              return (
                <tr key={o.eco} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-5">
                    <p className="font-medium text-white/90">{o.name}</p>
                    <p className="text-xs text-white/45 font-mono">{o.eco}</p>
                  </td>
                  <td className="text-center px-3">
                    <span className="text-white/80 font-mono">{o.frequency_pct}%</span>
                    <p className="text-white/45 text-xs font-mono">{o.games}g</p>
                  </td>
                  <td className="text-center px-3 text-xs text-white/55 font-mono">
                    {o.wins}/{o.losses}/{o.draws}
                  </td>
                  <td className="text-center px-5">
                    {xref ? (
                      xref.your_games > 0 ? (
                        <span className={`font-mono font-bold ${wrColor}`}>
                          {winRate}%
                          <span className="text-white/45 text-xs font-normal ml-1">
                            ({xref.your_games}g)
                          </span>
                        </span>
                      ) : (
                        <span className="text-white/45 text-xs">No data</span>
                      )
                    ) : (
                      <span className="text-white/45 text-xs">—</span>
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
