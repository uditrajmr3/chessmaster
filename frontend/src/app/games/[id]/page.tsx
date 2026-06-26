"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { GameDetail, MoveAnalysis } from "@/lib/types";
import { ResultBadge, EmptyState } from "@/components/ui/page-kit";
import { ArrowLeft, Swords } from "lucide-react";

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

  if (loading) return <GameDetailSkeleton />;
  if (!game)
    return (
      <div className="space-y-6">
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back to games
        </Link>
        <EmptyState
          icon={Swords}
          title="Game not found"
          description="This game may have been removed, or the link is incorrect. Head back to your games list to pick another."
          action={
            <Link
              href="/games"
              className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-lg btn-press px-4 py-2 text-sm"
            >
              View all games
            </Link>
          }
        />
      </div>
    );

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
      <Link
        href="/games"
        className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back to games
      </Link>

      {/* Game header */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-white">
            vs {game.opponent_name}
          </h1>
          <p className="mt-1 text-sm text-white/55">
            {new Date(game.played_at).toLocaleDateString()} · {game.opening_name || game.opening_eco || "Unknown opening"} · {game.time_class}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <span className="text-xs uppercase tracking-wider text-white/45 font-medium">
            {game.player_color}
          </span>
          <ResultBadge result={game.result} />
          <span className="text-white/55 font-mono text-sm">
            {game.player_rating} vs {game.opponent_rating}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Move list */}
        <div className="lg:col-span-2 surface-card overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h2 className="text-base font-semibold text-white">Moves</h2>
            <span className="text-xs text-white/45 font-mono">
              {game.moves.length} ply
            </span>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-white/5">
            {movePairs.map((pair) => (
              <div
                key={pair.number}
                className="grid grid-cols-[2.5rem_1fr_1fr] items-stretch hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center justify-center text-xs text-white/40 font-mono">
                  {pair.number}.
                </div>
                <div className="py-0.5 pr-1">
                  {pair.white && (
                    <MoveCell
                      move={pair.white}
                      index={pair.white.move_number}
                      isSelected={selectedMove === pair.white.move_number}
                      onClick={() => setSelectedMove(pair.white!.move_number)}
                    />
                  )}
                </div>
                <div className="py-0.5 pr-1">
                  {pair.black && (
                    <MoveCell
                      move={pair.black}
                      index={pair.black.move_number}
                      isSelected={selectedMove === pair.black.move_number}
                      onClick={() => setSelectedMove(pair.black!.move_number)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Move detail panel */}
        <div className="surface-card p-5 h-fit animate-slide-in-right">
          <h2 className="text-base font-semibold text-white mb-4">Move Details</h2>
          {selected ? (
            <div className="space-y-4">
              <div>
                <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Move</span>
                <p className={`text-xl font-bold font-mono mt-0.5 ${CLASSIFICATION_COLORS[selected.classification]}`}>
                  {selected.move_san}
                  {CLASSIFICATION_SYMBOLS[selected.classification]}
                </p>
              </div>
              <div>
                <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Classification</span>
                <p className={`font-medium capitalize mt-0.5 ${CLASSIFICATION_COLORS[selected.classification]}`}>
                  {selected.classification}
                </p>
              </div>
              <div>
                <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Centipawn Loss</span>
                <p className="font-mono mt-0.5">{selected.centipawn_loss.toFixed(0)}</p>
              </div>
              {selected.best_move_san && selected.best_move_san !== selected.move_san && (
                <div>
                  <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Best Move</span>
                  <p className="text-green-400 font-bold font-mono mt-0.5">{selected.best_move_san}</p>
                </div>
              )}
              <div>
                <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Evaluation</span>
                <p className="font-mono mt-0.5">
                  {selected.eval_before !== null ? (selected.eval_before / 100).toFixed(2) : "?"} →{" "}
                  {selected.eval_after !== null ? (selected.eval_after / 100).toFixed(2) : "?"}
                </p>
              </div>
              <div>
                <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Phase</span>
                <p className="capitalize mt-0.5">{selected.game_phase}</p>
              </div>
              {selected.tactical_motifs && selected.tactical_motifs.length > 0 && (
                <div>
                  <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Missed Tactics</span>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {selected.tactical_motifs.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-1 bg-red-500/15 text-red-400 rounded-md text-xs capitalize font-medium"
                      >
                        {t.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selected.time_remaining !== null && (
                <div>
                  <span className="text-white/45 text-xs uppercase tracking-wider font-medium">Time Remaining</span>
                  <p className="font-mono mt-0.5">
                    {Math.floor(selected.time_remaining / 60)}:{String(Math.floor(selected.time_remaining % 60)).padStart(2, "0")}
                  </p>
                </div>
              )}
              <div className="pt-3 border-t border-white/5">
                <span className="text-white/45 text-xs uppercase tracking-wider font-medium">FEN</span>
                <p className="text-xs font-mono text-white/45 break-all mt-1">
                  {selected.fen_before}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-white/45 text-sm">Select a move from the list to see its evaluation, best move, and missed tactics.</p>
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
      className={`px-2 py-1 rounded-md text-left w-full font-mono text-sm transition-colors btn-press ${
        isSelected
          ? "bg-accent-500/15 ring-1 ring-accent-500/30"
          : "hover:bg-white/5"
      } ${move.is_player_move ? color : "text-white/45"}`}
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

function GameDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="skeleton h-4 w-28" />
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-7 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton h-6 w-16" />
          <div className="skeleton h-6 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface-card p-4 space-y-2">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton h-7 w-full" />
          ))}
        </div>
        <div className="surface-card p-5 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="skeleton h-3 w-20 mb-1.5" />
              <div className="skeleton h-5 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
