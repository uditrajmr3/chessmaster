"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Swords, Check, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { useDataRefresh } from "@/lib/useDataRefresh";
import type { GameSummary } from "@/lib/types";
import { PageHeader, EmptyState, ResultBadge } from "@/components/ui/page-kit";

const selectClass =
  "bg-ink-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30";

export default function GamesPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>("");
  const [result, setResult] = useState<string>("");

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (platform) params.platform = platform;
      if (result) params.result = result;
      const data = await api.getGames(params);
      setGames(data);
    } catch {
      // Backend not running
    }
    setLoading(false);
  }, [platform, result]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);
  useDataRefresh(loadGames);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Games"
        subtitle="Browse and review your game history."
        action={
          <div className="flex flex-wrap gap-2.5">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={selectClass}
              aria-label="Filter by platform"
            >
              <option value="">All platforms</option>
              <option value="chesscom">Chess.com</option>
              <option value="lichess">Lichess</option>
            </select>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className={selectClass}
              aria-label="Filter by result"
            >
              <option value="">All results</option>
              <option value="win">Wins</option>
              <option value="loss">Losses</option>
              <option value="draw">Draws</option>
            </select>
          </div>
        }
      />

      {loading ? (
        <GamesTableSkeleton />
      ) : games.length === 0 ? (
        <EmptyState
          icon={Swords}
          title={platform || result ? "No games match these filters" : "No games yet"}
          description={
            platform || result
              ? "Try clearing the filters, or sync more games to widen the pool."
              : "Link a Chess.com or Lichess account in Settings, then Sync Games from the sidebar to pull in your history."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block surface-card overflow-hidden animate-fade-in-up">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left p-4 font-medium">Date</th>
                  <th className="text-left p-4 font-medium">Opponent</th>
                  <th className="text-left p-4 font-medium">Opening</th>
                  <th className="text-center p-4 font-medium">Result</th>
                  <th className="text-center p-4 font-medium">Rating</th>
                  <th className="text-center p-4 font-medium">Accuracy</th>
                  <th className="text-center p-4 font-medium">Platform</th>
                  <th className="text-center p-4 font-medium">Analyzed</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr
                    key={game.id}
                    onClick={() => router.push(`/games/${game.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/games/${game.id}`);
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open review of game vs ${game.opponent_name}`}
                    className="border-b border-gray-800/50 hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none transition-colors cursor-pointer group"
                  >
                    <td className="p-4 text-gray-300">
                      {new Date(game.played_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-gray-200 font-medium group-hover:text-white transition-colors">
                      {game.opponent_name}
                    </td>
                    <td className="p-4 text-gray-400 text-xs max-w-[200px] truncate">
                      {game.opening_name || game.opening_eco || "—"}
                    </td>
                    <td className="p-4 text-center">
                      <ResultBadge result={game.result} />
                    </td>
                    <td className="p-4 text-center text-gray-300 font-mono text-sm">
                      {game.player_rating}
                    </td>
                    <td className="p-4 text-center text-gray-400">
                      {game.platform_accuracy
                        ? `${game.platform_accuracy.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs text-gray-500 capitalize px-2 py-0.5 bg-gray-800/50 rounded">
                        {game.platform}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {game.is_analyzed ? (
                        <Check className="w-4 h-4 text-green-400 inline" />
                      ) : (
                        <Minus className="w-4 h-4 text-gray-600 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-2">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="block surface-card p-4 card-hover active:scale-[0.97]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-200 font-medium">{game.opponent_name}</span>
                  <ResultBadge result={game.result} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{new Date(game.played_at).toLocaleDateString()}</span>
                  <span className="font-mono">{game.player_rating}</span>
                  <span className="capitalize px-1.5 py-0.5 bg-gray-800/50 rounded">{game.platform}</span>
                </div>
                {game.opening_name && (
                  <p className="text-xs text-gray-500 mt-1.5 truncate">{game.opening_name}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GamesTableSkeleton() {
  return (
    <div className="surface-card overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-gray-700/50">
        <div className="skeleton h-4 w-full" />
      </div>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-800/30">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-4 w-32 hidden md:block" />
          <div className="skeleton h-5 w-12 ml-auto" />
          <div className="skeleton h-4 w-12 hidden md:block" />
        </div>
      ))}
    </div>
  );
}

