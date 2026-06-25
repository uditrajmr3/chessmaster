/**
 * Browser-side analysis loop.
 *
 * Fetches unanalyzed games from the server, runs Stockfish WASM locally on
 * each position, and POSTs the evaluations back.
 *
 * CARRY-FORWARD OPTIMIZATION (mirrors the server logic):
 *   We call engine.analyse() ONCE per position (after the move is made).
 *   The result is used as eval_after for the current move AND as eval_before
 *   for the next move — so we never analyse the same position twice.
 *
 * POV CONVENTION (follows engine.ts):
 *   All evals are WHITE-POV centipawns. Checkmate = ±10000.
 */

import { Chess } from "chess.js";
import { api } from "./api";
import { Engine } from "./engine";
import type { MoveEval } from "./types";

const DEFAULT_DEPTH = 14;

export async function runAnalysis(
  onProgress: (done: number, total: number) => void,
  opts?: { depth?: number; engine?: Engine }
): Promise<void> {
  const pending = await api.getPending();
  const total = pending.length;

  if (total === 0) {
    onProgress(0, 0);
    return;
  }

  const depth = opts?.depth ?? DEFAULT_DEPTH;
  const engine = opts?.engine ?? new Engine();

  try {
    if (!opts?.engine) {
      // Only init if we created it; caller-provided engines are assumed ready.
      await engine.init();
    }

    for (let gameIdx = 0; gameIdx < pending.length; gameIdx++) {
      const pendingGame = pending[gameIdx];
      const { game_id, pgn, player_color } = pendingGame;

      // Parse the PGN
      const chess = new Chess();
      chess.loadPgn(pgn);

      // Replay from start: collect verbose move objects
      const verboseMoves = chess.history({ verbose: true });
      const numMoves = verboseMoves.length;

      // Reset to start position to replay move-by-move
      chess.reset();
      // If the PGN has a custom start FEN, load it:
      const headers = chess.header();
      const startFen: string | undefined = (headers as Record<string, string>)["FEN"];
      if (startFen) {
        chess.load(startFen);
      }

      const moves: MoveEval[] = [];

      // Evaluate the starting position once → used as eval_before for move 0
      // and as carry-forward init. For terminal starting positions (unusual but
      // safe to handle), treat isGameOver as 0.
      let carryEvalCp: number | null;
      let carryBestMove: string | null;

      if (chess.isGameOver()) {
        carryEvalCp = chess.isDraw() ? 0 : chess.isCheckmate() ? (chess.turn() === "w" ? -10000 : 10000) : 0;
        carryBestMove = null;
      } else {
        const startResult = await engine.analyse(chess.fen(), depth);
        carryEvalCp = startResult.scoreCp;
        carryBestMove = startResult.bestMoveUci;
      }

      for (let i = 0; i < numMoves; i++) {
        const verboseMove = verboseMoves[i];
        const fenBefore = chess.fen();
        const evalBefore = carryEvalCp;
        const bestMoveUci = carryBestMove;

        // The side that made this move
        const movingColor = verboseMove.color; // 'w' or 'b'
        const isPlayerMove = movingColor === (player_color === "white" ? "w" : "b") ? 1 : 0;

        // Apply the move
        const moveUci = verboseMove.lan; // long algebraic = UCI format
        const moveSan = verboseMove.san;
        chess.move(verboseMove.san);

        // Evaluate the position AFTER the move (carry-forward: this becomes
        // eval_before for the next move)
        let evalAfter: number | null;
        let nextBestMove: string | null;

        if (chess.isCheckmate()) {
          // The side that just moved has mated the opponent.
          // movingColor won → white-POV: white win = +10000, black win = -10000
          evalAfter = movingColor === "w" ? 10000 : -10000;
          nextBestMove = null;
        } else if (chess.isDraw()) {
          evalAfter = 0;
          nextBestMove = null;
        } else {
          const result = await engine.analyse(chess.fen(), depth);
          evalAfter = result.scoreCp;
          nextBestMove = result.bestMoveUci;
        }

        moves.push({
          move_number: i + 1,
          is_player_move: isPlayerMove === 1,
          fen_before: fenBefore,
          move_uci: moveUci,
          move_san: moveSan,
          eval_before: evalBefore,
          eval_after: evalAfter,
          best_move_uci: bestMoveUci,
        });

        // Carry forward
        carryEvalCp = evalAfter;
        carryBestMove = nextBestMove;
      }

      await api.postAnalysisResults({ game_id, depth, moves });
      onProgress(gameIdx + 1, total);
    }
  } finally {
    engine.quit();
  }
}
