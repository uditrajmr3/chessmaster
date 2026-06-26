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
import { api, AuthError } from "./api";
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
  const engineOwned = !opts?.engine;
  const engine = opts?.engine ?? new Engine();

  try {
    if (!opts?.engine) {
      // Only init if we created it; caller-provided engines are assumed ready.
      await engine.init();
    }

    for (let gameIdx = 0; gameIdx < pending.length; gameIdx++) {
      const pendingGame = pending[gameIdx];
      const { game_id, pgn, player_color } = pendingGame;

      // Parse the PGN — capture headers and moves BEFORE resetting, so that
      // custom-start FEN ([FEN "..."] / [SetUp "1"]) games are analysed from
      // the correct starting position rather than the standard one.
      const chess = new Chess();
      chess.loadPgn(pgn);

      // Capture moves while PGN is loaded (before any reset)
      const verboseMoves = chess.history({ verbose: true });
      const numMoves = verboseMoves.length;

      // Capture the custom start FEN BEFORE resetting (reset() clears headers)
      const startFen: string | undefined = (chess.header() as Record<string, string>)["FEN"];

      // Build the replay board from the correct starting position
      const replay = startFen ? new Chess(startFen) : new Chess();

      const moves: MoveEval[] = [];

      // Evaluate the starting position once → used as eval_before for move 0
      // and as carry-forward init. For terminal starting positions (unusual but
      // safe to handle), treat isGameOver as 0.
      let carryEvalCp: number | null;
      let carryBestMove: string | null;

      if (replay.isGameOver()) {
        carryEvalCp = replay.isDraw() ? 0 : replay.isCheckmate() ? (replay.turn() === "w" ? -10000 : 10000) : 0;
        carryBestMove = null;
      } else {
        const startResult = await engine.analyse(replay.fen(), depth);
        carryEvalCp = startResult.scoreCp;
        carryBestMove = startResult.bestMoveUci;
      }

      for (let i = 0; i < numMoves; i++) {
        const verboseMove = verboseMoves[i];
        const fenBefore = replay.fen();
        const evalBefore = carryEvalCp;
        const bestMoveUci = carryBestMove;

        // The side that made this move
        const movingColor = verboseMove.color; // 'w' or 'b'
        const isPlayerMove = movingColor === (player_color === "white" ? "w" : "b") ? 1 : 0;

        // Apply the move
        const moveUci = verboseMove.lan; // long algebraic = UCI format
        const moveSan = verboseMove.san;
        replay.move(verboseMove.san);

        // Evaluate the position AFTER the move (carry-forward: this becomes
        // eval_before for the next move)
        let evalAfter: number | null;
        let nextBestMove: string | null;

        if (replay.isCheckmate()) {
          // The side that just moved has mated the opponent.
          // movingColor won → white-POV: white win = +10000, black win = -10000
          evalAfter = movingColor === "w" ? 10000 : -10000;
          nextBestMove = null;
        } else if (replay.isDraw()) {
          evalAfter = 0;
          nextBestMove = null;
        } else {
          const result = await engine.analyse(replay.fen(), depth);
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

      try {
        await api.postAnalysisResults({ game_id, depth, moves });
      } catch (err) {
        if (err instanceof AuthError) {
          // Session ended mid-run (e.g. the user logged out or the cookie
          // expired). Stop quietly — games analysed so far are already saved
          // server-side, so this is not a failure worth alarming the user.
          console.info("Analysis stopped: session ended.");
          return;
        }
        throw err;
      }
      onProgress(gameIdx + 1, total);
    }
  } finally {
    // Only quit the engine if runAnalysis created it; injected engines are
    // owned by the caller and should remain alive after this call.
    if (engineOwned) engine.quit();
  }
}
