"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { GameDetail, MoveAnalysis } from "@/lib/types";

const CLASSIFICATION_COLORS: Record<string, string> = {
  brilliant: "text-cyan-400",
  great: "text-blue-400",
  good: "text-green-400",
  book: "text-gray-400",
  inaccuracy: "text-yellow-400",
  mistake: "text-orange-400",
  blunder: "text-red-400",
};

const CLASSIFICATION_SYMBOLS: Record<string, string> = {
  brilliant: "!!",
  great: "!",
  good: "",
  book: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export default function GameDetailPage() {
  const params = useParams();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGame();
  }, [params.id]);

  async function loadGame() {
    try {
      const data = await api.getGame(params.id as string);
      setGame(data);
    } catch {
      // error
    }
    setLoading(false);
  }

  if (loading) return <div className="text-gray-400">Loading game...</div>;
  if (!game) return <div className="text-gray-400">Game not found</div>;

  const selected = selectedMove !== null ? game.moves[selectedMove] : null;

  // Group moves into pairs (white/black)
  const movePairs: Array<{
    number: number;
    white: MoveAnalysis | null;
    black: MoveAnalysis | null;
  }> = [];
  for (let i = 0; i < game.moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: game.moves[i] || null,
      black: game.moves[i + 1] || null,
    });
  }

  return (
    <div className="space-y-6">
      {/* Game header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            vs {game.opponent_name}
          </h2>
          <p className="text-gray-400 text-sm">
            {new Date(game.played_at).toLocaleDateString()} · {game.opening_name || game.opening_eco || "Unknown opening"} · {game.time_class}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-gray-400 text-sm">
            {game.player_color}
          </span>
          <span
            className={`px-3 py-1 rounded font-medium text-sm ${
              game.result === "win"
                ? "bg-green-900/40 text-green-400"
                : game.result === "loss"
                ? "bg-red-900/40 text-red-400"
                : "bg-yellow-900/40 text-yellow-400"
            }`}
          >
            {game.result.toUpperCase()}
          </span>
          <span className="text-gray-300 font-mono text-sm">
            {game.player_rating} vs {game.opponent_rating}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Move list */}
        <div className="lg:col-span-2 bg-[#222639] rounded-xl p-4 max-h-[600px] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-3">Moves</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="p-2 w-12">#</th>
                <th className="p-2 text-left">White</th>
                <th className="p-2 text-left">Black</th>
              </tr>
            </thead>
            <tbody>
              {movePairs.map((pair) => (
                <tr key={pair.number} className="border-b border-gray-800/50">
                  <td className="p-2 text-gray-500 text-center">{pair.number}</td>
                  <td className="p-2">
                    {pair.white && (
                      <MoveCell
                        move={pair.white}
                        index={pair.white.move_number}
                        isSelected={selectedMove === pair.white.move_number}
                        onClick={() => setSelectedMove(pair.white!.move_number)}
                      />
                    )}
                  </td>
                  <td className="p-2">
                    {pair.black && (
                      <MoveCell
                        move={pair.black}
                        index={pair.black.move_number}
                        isSelected={selectedMove === pair.black.move_number}
                        onClick={() => setSelectedMove(pair.black!.move_number)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Move detail panel */}
        <div className="bg-[#222639] rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-3">Move Details</h3>
          {selected ? (
            <div className="space-y-4">
              <div>
                <span className="text-gray-400 text-sm">Move</span>
                <p className={`text-xl font-bold ${CLASSIFICATION_COLORS[selected.classification]}`}>
                  {selected.move_san}
                  {CLASSIFICATION_SYMBOLS[selected.classification]}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Classification</span>
                <p className={`font-medium capitalize ${CLASSIFICATION_COLORS[selected.classification]}`}>
                  {selected.classification}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Centipawn Loss</span>
                <p className="font-mono">{selected.centipawn_loss.toFixed(0)}</p>
              </div>
              {selected.best_move_san && selected.best_move_san !== selected.move_san && (
                <div>
                  <span className="text-gray-400 text-sm">Best Move</span>
                  <p className="text-green-400 font-bold">{selected.best_move_san}</p>
                </div>
              )}
              <div>
                <span className="text-gray-400 text-sm">Evaluation</span>
                <p className="font-mono">
                  {selected.eval_before !== null ? (selected.eval_before / 100).toFixed(2) : "?"} →{" "}
                  {selected.eval_after !== null ? (selected.eval_after / 100).toFixed(2) : "?"}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Phase</span>
                <p className="capitalize">{selected.game_phase}</p>
              </div>
              {selected.tactical_motifs && selected.tactical_motifs.length > 0 && (
                <div>
                  <span className="text-gray-400 text-sm">Missed Tactics</span>
                  <div className="flex gap-2 mt-1">
                    {selected.tactical_motifs.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs capitalize"
                      >
                        {t.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selected.time_remaining !== null && (
                <div>
                  <span className="text-gray-400 text-sm">Time Remaining</span>
                  <p className="font-mono">
                    {Math.floor(selected.time_remaining / 60)}:{String(Math.floor(selected.time_remaining % 60)).padStart(2, "0")}
                  </p>
                </div>
              )}
              <div className="pt-3 border-t border-gray-700">
                <span className="text-gray-400 text-sm">FEN</span>
                <p className="text-xs font-mono text-gray-500 break-all mt-1">
                  {selected.fen_before}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Click a move to see details</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MoveCell({
  move,
  index,
  isSelected,
  onClick,
}: {
  move: MoveAnalysis;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = CLASSIFICATION_COLORS[move.classification] || "text-gray-300";
  const symbol = CLASSIFICATION_SYMBOLS[move.classification] || "";

  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-left w-full transition-colors ${
        isSelected ? "bg-blue-900/40" : "hover:bg-gray-700/50"
      } ${move.is_player_move ? color : "text-gray-400"}`}
    >
      {move.move_san}
      <span className="text-xs">{symbol}</span>
      {move.centipawn_loss > 50 && move.is_player_move && (
        <span className="ml-1 text-xs opacity-60">
          ({move.centipawn_loss.toFixed(0)})
        </span>
      )}
    </button>
  );
}
