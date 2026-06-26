"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import { Puzzle as PuzzleIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { Puzzle, PuzzleResult, PuzzleStats } from "@/lib/types";
import { PageHeader, EmptyState, Stat } from "@/components/ui/page-kit";

type Arrow = { startSquare: string; endSquare: string; color: string };

type PuzzleState = "loading" | "solving" | "correct" | "wrong" | "empty";

export default function PuzzlesPage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [result, setResult] = useState<PuzzleResult | null>(null);
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [state, setState] = useState<PuzzleState>("loading");
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const [motifFilter, setMotifFilter] = useState<string>("");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  const loadPuzzle = useCallback(async () => {
    setState("loading");
    setResult(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    try {
      const params: { phase?: string; motif?: string } = {};
      if (phaseFilter) params.phase = phaseFilter;
      if (motifFilter) params.motif = motifFilter;
      const data = await api.getNextPuzzle(params);
      setPuzzle(data);
      setState(data ? "solving" : "empty");
    } catch {
      setState("empty");
    }
  }, [phaseFilter, motifFilter]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getPuzzleStats();
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPuzzle();
    loadStats();
  }, [loadPuzzle, loadStats]);

  const chess = useMemo(() => {
    if (!puzzle) return null;
    return new Chess(puzzle.fen);
  }, [puzzle]);

  const boardOrientation = useMemo(() => {
    if (!chess) return "white" as const;
    return chess.turn() === "w" ? ("white" as const) : ("black" as const);
  }, [chess]);

  function getLegalMovesForSquare(square: string): string[] {
    if (!chess) return [];
    const moves = chess.moves({ square: square as Square, verbose: true });
    return moves.map((m) => m.to);
  }

  function submitMove(from: string, to: string, piece: string) {
    if (state !== "solving" || !puzzle) return;

    const isPromotion = piece.toLowerCase().includes("p") && (to[1] === "8" || to[1] === "1");
    const moveUci = from + to + (isPromotion ? "q" : "");

    setSelectedSquare(null);
    setLegalMoves([]);

    api.submitPuzzle(puzzle.id, moveUci).then((res) => {
      setResult(res);
      setState(res.correct ? "correct" : "wrong");
      loadStats();
    }).catch(() => {});
  }

  function handleMove({ piece, sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null }) {
    if (state !== "solving" || !puzzle || !targetSquare) return false;
    submitMove(sourceSquare, targetSquare, piece.pieceType);
    return true;
  }

  function handlePieceClick({ square, piece }: { square: string | null; piece: { pieceType: string }; isSparePiece: boolean }) {
    if (state !== "solving" || !chess || !square) return;

    const isWhitePiece = piece.pieceType === piece.pieceType.toUpperCase();
    const isPlayerTurn = chess.turn() === "w";
    if (isWhitePiece !== isPlayerTurn) return;

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      setSelectedSquare(square);
      setLegalMoves(getLegalMovesForSquare(square));
    }
  }

  function handleSquareClick({ square, piece }: { square: string; piece: { pieceType: string } | null }) {
    if (state !== "solving" || !chess) return;

    if (selectedSquare && legalMoves.includes(square)) {
      const selectedPiece = chess.get(selectedSquare as Square);
      submitMove(selectedSquare, square, selectedPiece?.type || "p");
      return;
    }

    if (piece) {
      const isWhitePiece = piece.pieceType === piece.pieceType.toUpperCase();
      const isPlayerTurn = chess.turn() === "w";
      if (isWhitePiece === isPlayerTurn) {
        setSelectedSquare(square);
        setLegalMoves(getLegalMovesForSquare(square));
        return;
      }
    }

    setSelectedSquare(null);
    setLegalMoves([]);
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (selectedSquare && state === "solving") {
      styles[selectedSquare] = {
        backgroundColor: "rgba(255, 255, 0, 0.4)",
      };
    }

    if (state === "solving") {
      for (const sq of legalMoves) {
        const hasPiece = chess?.get(sq as Square);
        styles[sq] = hasPiece
          ? {
              background: "radial-gradient(transparent 51%, rgba(0,0,0,0.3) 51%)",
            }
          : {
              background: "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)",
            };
      }
    }

    if (puzzle && (state === "correct" || state === "wrong")) {
      const bestFrom = puzzle.best_move_uci.slice(0, 2);
      const bestTo = puzzle.best_move_uci.slice(2, 4);

      if (state === "correct") {
        styles[bestFrom] = { backgroundColor: "rgba(0, 180, 0, 0.4)" };
        styles[bestTo] = { backgroundColor: "rgba(0, 180, 0, 0.5)" };
      } else {
        styles[bestFrom] = { backgroundColor: "rgba(220, 50, 50, 0.3)" };
        styles[bestTo] = { backgroundColor: "rgba(220, 50, 50, 0.4)" };
      }
    }

    return styles;
  }, [selectedSquare, legalMoves, state, puzzle, chess]);

  const arrows: Arrow[] = useMemo(() => {
    if (!puzzle || state === "solving" || state === "loading") return [];

    const bestFrom = puzzle.best_move_uci.slice(0, 2);
    const bestTo = puzzle.best_move_uci.slice(2, 4);
    const color = state === "correct" ? "rgb(0, 180, 0)" : "rgb(220, 50, 50)";

    return [{ startSquare: bestFrom, endSquare: bestTo, color }];
  }, [puzzle, state]);

  function handleNext() {
    loadPuzzle();
  }

  const selectClass = "bg-ink-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Puzzle Trainer"
        subtitle="Practice positions drawn from your own blunders, then drill the ones you keep missing."
        action={
          <div className="flex flex-wrap gap-2.5">
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className={selectClass}
              aria-label="Filter by game phase"
            >
              <option value="">All phases</option>
              <option value="opening">Opening</option>
              <option value="middlegame">Middlegame</option>
              <option value="endgame">Endgame</option>
            </select>
            <select
              value={motifFilter}
              onChange={(e) => setMotifFilter(e.target.value)}
              className={selectClass}
              aria-label="Filter by tactical motif"
            >
              <option value="">All tactics</option>
              <option value="fork">Fork</option>
              <option value="pin">Pin</option>
              <option value="skewer">Skewer</option>
              <option value="back_rank">Back Rank</option>
              <option value="discovered_attack">Discovered Attack</option>
            </select>
          </div>
        }
      />

      {/* Stats bar */}
      {stats && stats.total_puzzles > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
          <Stat label="Total Puzzles" value={stats.total_puzzles} />
          <Stat label="Attempted" value={stats.attempted} />
          <Stat label="Mastered" value={stats.mastered} />
          <Stat
            label="Accuracy"
            value={`${stats.accuracy}%`}
            valueClassName={stats.accuracy >= 70 ? "text-green-400" : stats.accuracy >= 40 ? "text-yellow-400" : "text-red-400"}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chessboard */}
        <div className="lg:col-span-2 flex flex-col items-center gap-4">
          {state === "loading" && (
            <div className="w-full max-w-[560px] aspect-square skeleton rounded-xl animate-fade-in" />
          )}

          {state === "empty" && (
            <div className="w-full max-w-[560px] surface-card">
              <EmptyState
                icon={PuzzleIcon}
                title={
                  phaseFilter || motifFilter
                    ? "No puzzles match these filters"
                    : "No puzzles yet"
                }
                description={
                  phaseFilter || motifFilter
                    ? "Try clearing the filters above, or analyze more games to widen the pool."
                    : "Sync your games from the sidebar, then run Analyze. Puzzles are generated automatically from the blunders and mistakes in your own games."
                }
              />
            </div>
          )}

          {puzzle && state !== "loading" && (
            <>
              {/* Feedback banner */}
              {state === "correct" && (
                <div className="w-full max-w-[560px] bg-green-500/10 border border-green-700/50 rounded-lg px-4 py-3 text-green-400 font-medium text-center animate-scale-in">
                  Correct! You found the best move.
                </div>
              )}
              {state === "wrong" && result && (
                <div className="w-full max-w-[560px] bg-red-500/10 border border-red-700/50 rounded-lg px-4 py-3 text-center animate-scale-in">
                  <p className="text-red-400 font-medium">
                    Incorrect. The best move was{" "}
                    <span className="font-bold font-mono">{result.best_move_san}</span>
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    You played <span className="text-orange-400 font-mono">{puzzle.player_move_san}</span> in the original game (CPL: <span className="font-mono">{result.centipawn_loss.toFixed(0)}</span>)
                  </p>
                </div>
              )}

              <div className="w-full max-w-[560px] animate-scale-in">
                <Chessboard
                  options={{
                    position: puzzle.fen,
                    onPieceDrop: handleMove,
                    onPieceClick: handlePieceClick,
                    onSquareClick: handleSquareClick,
                    boardOrientation: boardOrientation,
                    allowDragging: state === "solving",
                    squareStyles: squareStyles,
                    arrows: arrows,
                    showAnimations: true,
                    animationDurationInMs: 200,
                    boardStyle: {
                      borderRadius: "12px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    },
                    darkSquareStyle: { backgroundColor: "#779952" },
                    lightSquareStyle: { backgroundColor: "#edeed1" },
                    dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(255,255,0,0.4)" },
                  }}
                />
              </div>

              {state !== "solving" && (
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-lg btn-press"
                >
                  Next Puzzle
                </button>
              )}
            </>
          )}
        </div>

        {/* Puzzle info panel */}
        <div className="surface-card p-5 h-fit animate-slide-in-right">
          <h3 className="text-xl font-semibold mb-4">Puzzle Info</h3>

          {puzzle && state !== "loading" ? (
            <div className="space-y-4">
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Your Turn</span>
                <p className="font-medium capitalize mt-0.5">{boardOrientation}</p>
              </div>

              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Find the best move</span>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  You blundered in this position during a game.
                  Can you find what you should have played?
                </p>
              </div>

              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Game Phase</span>
                <p className="capitalize mt-0.5">{puzzle.game_phase}</p>
              </div>

              {puzzle.tactical_motifs.length > 0 && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Tactical Theme</span>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {puzzle.tactical_motifs.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 bg-accent-500/15 text-accent-400 rounded-md text-xs capitalize font-medium"
                      >
                        {t.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Opponent</span>
                <p className="mt-0.5">{puzzle.opponent}</p>
              </div>

              {puzzle.played_at && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Game Date</span>
                  <p className="text-sm mt-0.5">{new Date(puzzle.played_at).toLocaleDateString()}</p>
                </div>
              )}

              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Progress</span>
                <p className="text-sm mt-0.5">
                  {puzzle.attempts === 0
                    ? "New puzzle"
                    : <><span className="font-mono">{puzzle.successes}/{puzzle.attempts}</span> correct</>}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Centipawn Loss</span>
                <p className="text-red-400 font-mono text-lg font-bold mt-0.5">
                  {puzzle.centipawn_loss.toFixed(0)}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  How much this blunder cost you
                </p>
              </div>
            </div>
          ) : state === "empty" ? (
            <p className="text-white/45 text-sm leading-relaxed">
              No puzzle loaded. Analyze some games to generate puzzles from your blunders.
            </p>
          ) : (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i}>
                  <div className="skeleton h-3 w-20 mb-1.5" />
                  <div className="skeleton h-5 w-32" />
                </div>
              ))}
            </div>
          )}

          {/* Stats summary */}
          {stats && stats.total_puzzles > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Breakdown</h4>

              {Object.keys(stats.by_phase).length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-gray-500">By Phase</span>
                  <div className="space-y-1 mt-1">
                    {Object.entries(stats.by_phase).map(([phase, count]) => (
                      <div key={phase} className="flex justify-between text-sm">
                        <span className="capitalize text-gray-400">{phase}</span>
                        <span className="font-mono text-sm">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(stats.by_motif).length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">By Tactic</span>
                  <div className="space-y-1 mt-1">
                    {Object.entries(stats.by_motif).map(([motif, count]) => (
                      <div key={motif} className="flex justify-between text-sm">
                        <span className="capitalize text-gray-400">
                          {motif.replace("_", " ")}
                        </span>
                        <span className="font-mono text-sm">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.due_for_review > 0 && (
                <div className="mt-3 px-3 py-2 bg-yellow-500/10 border border-yellow-800/50 rounded-lg">
                  <p className="text-yellow-400 text-sm font-medium">
                    {stats.due_for_review} puzzle{stats.due_for_review > 1 ? "s" : ""} due for review
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
