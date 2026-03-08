"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
        <h2 className="text-2xl font-bold mb-1">Games</h2>
        <p className="text-gray-400 text-sm">Browse and review your game history</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#222639] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Platforms</option>
          <option value="chesscom">Chess.com</option>
          <option value="lichess">Lichess</option>
        </select>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="bg-[#222639] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Results</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="draw">Draws</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading games...</div>
      ) : games.length === 0 ? (
        <div className="text-gray-400">No games found. Sync your games first.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#222639] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Opponent</th>
                  <th className="text-left p-4">Opening</th>
                  <th className="text-center p-4">Result</th>
                  <th className="text-center p-4">Rating</th>
                  <th className="text-center p-4">Accuracy</th>
                  <th className="text-center p-4">Platform</th>
                  <th className="text-center p-4">Analyzed</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr
                    key={game.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="p-4">
                      <Link
                        href={`/games/${game.id}`}
                        className="text-blue-400 hover:underline"
                      >
                        {new Date(game.played_at).toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-300">{game.opponent_name}</td>
                    <td className="p-4 text-gray-400 text-xs">
                      {game.opening_name || game.opening_eco || "—"}
                    </td>
                    <td className="p-4 text-center">
                      <ResultBadge result={game.result} />
                    </td>
                    <td className="p-4 text-center text-gray-300 font-mono">
                      {game.player_rating}
                    </td>
                    <td className="p-4 text-center text-gray-400">
                      {game.platform_accuracy
                        ? `${game.platform_accuracy.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs text-gray-500 capitalize">
                        {game.platform}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {game.is_analyzed ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="block bg-[#222639] rounded-xl p-4 active:bg-gray-800/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 font-medium">{game.opponent_name}</span>
                  <ResultBadge result={game.result} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{new Date(game.played_at).toLocaleDateString()}</span>
                  <span className="font-mono">{game.player_rating}</span>
                  <span className="capitalize">{game.platform}</span>
                </div>
                {game.opening_name && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{game.opening_name}</p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${
        result === "win"
          ? "bg-green-900/40 text-green-400"
          : result === "loss"
          ? "bg-red-900/40 text-red-400"
          : "bg-yellow-900/40 text-yellow-400"
      }`}
    >
      {result}
    </span>
  );
}
