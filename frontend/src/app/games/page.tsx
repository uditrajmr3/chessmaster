"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Check, Minus } from "lucide-react";
import { api } from "@/lib/api";
import type { GameSummary } from "@/lib/types";

export default function GamesPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>("");
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    loadGames();
  }, [platform, result]);

  async function loadGames() {
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
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-1">Games</h2>
        <p className="text-gray-400 text-sm">Browse and review your game history</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#222639] border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
        >
          <option value="">All Platforms</option>
          <option value="chesscom">Chess.com</option>
          <option value="lichess">Lichess</option>
        </select>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="bg-[#222639] border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
        >
          <option value="">All Results</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="draw">Draws</option>
        </select>
      </div>

      {loading ? (
        <GamesTableSkeleton />
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in-up">
          <Swords className="w-10 h-10 text-gray-500" />
          <p className="text-gray-400 text-center">No games found. Sync your games first.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#222639] rounded-xl overflow-hidden animate-fade-in-up">
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
                    className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="p-4">
                      <Link
                        href={`/games/${game.id}`}
                        className="text-accent-400 hover:text-accent-300 transition-colors"
                      >
                        {new Date(game.played_at).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-300 font-medium">{game.opponent_name}</td>
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
                className="block bg-[#222639] rounded-xl p-4 card-hover active:scale-[0.97]"
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
    <div className="bg-[#222639] rounded-xl overflow-hidden animate-fade-in">
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

function ResultBadge({ result }: { result: string }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${
        result === "win"
          ? "bg-green-500/15 text-green-400"
          : result === "loss"
          ? "bg-red-500/15 text-red-400"
          : "bg-yellow-500/15 text-yellow-400"
      }`}
    >
      {result}
    </span>
  );
}
