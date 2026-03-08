"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import { api } from "@/lib/api";
import type { Puzzle, PuzzleResult, PuzzleStats } from "@/lib/types";

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

  // Chess.js instance for legal move computation
  const chess = useMemo(() => {
    if (!puzzle) return null;
    return new Chess(puzzle.fen);
  }, [puzzle]);

  const boardOrientation = useMemo(() => {
    if (!chess) return "white" as const;
    return chess.turn() === "w" ? ("white" as const) : ("black" as const);
  }, [chess]);

  // Get legal moves for a square
  function getLegalMovesForSquare(square: string): string[] {
    if (!chess) return [];
    const moves = chess.moves({ square: square as Square, verbose: true });
    return moves.map((m) => m.to);
  }

  // Submit a move (shared by drag and click-to-move)
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
    }).catch(() => {
      // ignore
    });
  }

  // Drag-and-drop handler
  function handleMove({ piece, sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null }) {
    if (state !== "solving" || !puzzle || !targetSquare) return false;
    submitMove(sourceSquare, targetSquare, piece.pieceType);
    return true;
  }

  // Click on a piece — select it and show legal moves
  function handlePieceClick({ square, piece }: { square: string | null; piece: { pieceType: string }; isSparePiece: boolean }) {
    if (state !== "solving" || !chess || !square) return;

    // Only allow clicking own pieces
    const isWhitePiece = piece.pieceType === piece.pieceType.toUpperCase();
    const isPlayerTurn = chess.turn() === "w";
    if (isWhitePiece !== isPlayerTurn) return;

    if (selectedSquare === square) {
      // Deselect
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      setSelectedSquare(square);
      setLegalMoves(getLegalMovesForSquare(square));
    }
  }

  // Click on a square (empty or occupied) — complete a move if piece selected
  function handleSquareClick({ square, piece }: { square: string; piece: { pieceType: string } | null }) {
    if (state !== "solving" || !chess) return;

    if (selectedSquare && legalMoves.includes(square)) {
      // Make the move
      const selectedPiece = chess.get(selectedSquare as Square);
      submitMove(selectedSquare, square, selectedPiece?.type || "p");
      return;
    }

    // If clicking a friendly piece, select it instead
    if (piece) {
      const isWhitePiece = piece.pieceType === piece.pieceType.toUpperCase();
      const isPlayerTurn = chess.turn() === "w";
      if (isWhitePiece === isPlayerTurn) {
        setSelectedSquare(square);
        setLegalMoves(getLegalMovesForSquare(square));
        return;
      }
    }

    // Deselect
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  // Build square styles for highlights
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlight selected square
    if (selectedSquare && state === "solving") {
      styles[selectedSquare] = {
        backgroundColor: "rgba(255, 255, 0, 0.4)",
      };
    }

    // Show legal move dots/highlights
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

    // After answer: highlight the best move
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

  // Arrow showing the best move after answering
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Puzzle Trainer</h2>
          <p className="text-gray-400 text-sm">
            Practice positions from your own blunders
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.total_puzzles > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Puzzles" value={stats.total_puzzles} />
          <StatCard label="Attempted" value={stats.attempted} />
          <StatCard label="Mastered" value={stats.mastered} />
          <StatCard
            label="Accuracy"
            value={`${stats.accuracy}%`}
            color={stats.accuracy >= 70 ? "text-green-400" : stats.accuracy >= 40 ? "text-yellow-400" : "text-red-400"}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="bg-[#222639] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Phases</option>
          <option value="opening">Opening</option>
          <option value="middlegame">Middlegame</option>
          <option value="endgame">Endgame</option>
        </select>
        <select
          value={motifFilter}
          onChange={(e) => setMotifFilter(e.target.value)}
          className="bg-[#222639] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          <option value="">All Tactics</option>
          <option value="fork">Fork</option>
          <option value="pin">Pin</option>
          <option value="skewer">Skewer</option>
          <option value="back_rank">Back Rank</option>
          <option value="discovered_attack">Discovered Attack</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chessboard */}
        <div className="lg:col-span-2 flex flex-col items-center gap-4">
          {state === "loading" && (
            <div className="w-full max-w-[560px] aspect-square bg-[#222639] rounded-xl flex items-center justify-center">
              <p className="text-gray-400">Loading puzzle...</p>
            </div>
          )}

          {state === "empty" && (
            <div className="w-full max-w-[560px] aspect-square bg-[#222639] rounded-xl flex items-center justify-center flex-col gap-3 p-8 text-center">
              <p className="text-gray-400 text-lg">No puzzles available</p>
              <p className="text-gray-500 text-sm">
                Sync and analyze your games first. Puzzles are generated from your blunders and mistakes.
              </p>
            </div>
          )}

          {puzzle && state !== "loading" && (
            <>
              {/* Feedback banner */}
              {state === "correct" && (
                <div className="w-full max-w-[560px] bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 text-green-400 font-medium text-center">
                  Correct! You found the best move.
                </div>
              )}
              {state === "wrong" && result && (
                <div className="w-full max-w-[560px] bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-center">
                  <p className="text-red-400 font-medium">
                    Incorrect. The best move was{" "}
                    <span className="font-bold">{result.best_move_san}</span>
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    You played <span className="text-orange-400">{puzzle.player_move_san}</span> in the original game (CPL: {result.centipawn_loss.toFixed(0)})
                  </p>
                </div>
              )}

              <div className="w-full max-w-[560px]">
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
                      borderRadius: "8px",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
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
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Next Puzzle
                </button>
              )}
            </>
          )}
        </div>

        {/* Puzzle info panel */}
        <div className="bg-[#222639] rounded-xl p-5 h-fit">
          <h3 className="text-lg font-semibold mb-4">Puzzle Info</h3>

          {puzzle && state !== "loading" ? (
            <div className="space-y-4">
              <div>
                <span className="text-gray-400 text-sm">Your Turn</span>
                <p className="font-medium capitalize">{boardOrientation}</p>
              </div>

              <div>
                <span className="text-gray-400 text-sm">Find the best move</span>
                <p className="text-sm text-gray-500 mt-1">
                  You blundered in this position during a game.
                  Can you find what you should have played?
                </p>
              </div>

              <div>
                <span className="text-gray-400 text-sm">Game Phase</span>
                <p className="capitalize">{puzzle.game_phase}</p>
              </div>

              {puzzle.tactical_motifs.length > 0 && (
                <div>
                  <span className="text-gray-400 text-sm">Tactical Theme</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {puzzle.tactical_motifs.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded text-xs capitalize"
                      >
                        {t.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-gray-400 text-sm">Opponent</span>
                <p>{puzzle.opponent}</p>
              </div>

              {puzzle.played_at && (
                <div>
                  <span className="text-gray-400 text-sm">Game Date</span>
                  <p className="text-sm">{new Date(puzzle.played_at).toLocaleDateString()}</p>
                </div>
              )}

              <div>
                <span className="text-gray-400 text-sm">Progress</span>
                <p className="text-sm">
                  {puzzle.attempts === 0
                    ? "New puzzle"
                    : `${puzzle.successes}/${puzzle.attempts} correct`}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-700">
                <span className="text-gray-400 text-sm">Centipawn Loss</span>
                <p className="text-red-400 font-mono text-lg">
                  {puzzle.centipawn_loss.toFixed(0)}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  How much this blunder cost you
                </p>
              </div>
            </div>
          ) : state === "empty" ? (
            <p className="text-gray-500 text-sm">
              No puzzles yet. Analyze some games to generate puzzles from your blunders.
            </p>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}

          {/* Stats summary */}
          {stats && stats.total_puzzles > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-semibold text-gray-400 mb-3">Breakdown</h4>

              {Object.keys(stats.by_phase).length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-gray-500">By Phase</span>
                  <div className="space-y-1 mt-1">
                    {Object.entries(stats.by_phase).map(([phase, count]) => (
                      <div key={phase} className="flex justify-between text-sm">
                        <span className="capitalize text-gray-400">{phase}</span>
                        <span>{count}</span>
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
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.due_for_review > 0 && (
                <div className="mt-3 px-3 py-2 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                  <p className="text-yellow-400 text-sm">
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
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
