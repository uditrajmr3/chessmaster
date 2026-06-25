/**
 * Stockfish WASM engine wrapper.
 *
 * Spawns a Web Worker that loads Stockfish (served from /stockfish/stockfish.js)
 * and communicates via the UCI protocol.
 *
 * POV CONVENTION — all evals stored/returned are WHITE POV centipawns:
 *   - UCI `score cp N` is relative to the SIDE TO MOVE.
 *     If it is black's turn we negate N to get white POV.
 *   - UCI `score mate K` maps to ±10000. The sign of K in UCI means
 *     positive = the side-to-move wins. After converting to white POV:
 *       white-to-move  mate +K → +10000,  mate -K → -10000
 *       black-to-move  mate +K → -10000,  mate -K → +10000
 *   This matches the server's convention (centipawn-loss is computed
 *   from consecutive white-POV evals, and mate is capped at ±10000).
 */

export interface EvalResult {
  scoreCp: number | null;
  bestMoveUci: string | null;
}

/** Minimal subset of the Worker API we depend on, for easy mocking in tests. */
export interface WorkerLike {
  postMessage(msg: string): void;
  onmessage: ((ev: { data: string }) => void) | null;
  terminate(): void;
}

/** Factory type — return something that behaves like a Worker. */
export type WorkerFactory = () => WorkerLike;

/**
 * Default factory: constructs the real Stockfish Web Worker.
 * The binary must be present at /stockfish/stockfish.js at runtime.
 * The build does NOT verify this path — drop the file in
 * frontend/public/stockfish/ as described in that directory's README.
 */
function defaultWorkerFactory(): WorkerLike {
  return new Worker("/stockfish/stockfish.js") as unknown as WorkerLike;
}

/**
 * Parse the side-to-move character from a FEN string.
 * FEN field 2 is 'w' or 'b'.
 */
function sideToMove(fen: string): "w" | "b" {
  const parts = fen.trim().split(/\s+/);
  const side = parts[1];
  if (side === "b") return "b";
  return "w"; // default to white (handles startpos-like shorthand)
}

/** Convert a UCI score line token pair into a white-POV centipawn value. */
function parseScore(
  type: "cp" | "mate",
  value: number,
  stm: "w" | "b"
): number {
  let whitePov: number;
  if (type === "cp") {
    // UCI cp is side-to-move relative; negate for black.
    whitePov = stm === "b" ? -value : value;
  } else {
    // mate K: positive K means the side-to-move mates.
    const mateCp = value > 0 ? 10000 : -10000;
    whitePov = stm === "b" ? -mateCp : mateCp;
  }
  return whitePov;
}

export class Engine {
  private worker: WorkerLike | null = null;
  private readonly workerFactory: WorkerFactory;

  constructor(workerFactory: WorkerFactory = defaultWorkerFactory) {
    this.workerFactory = workerFactory;
  }

  /**
   * Initialise the engine: send `uci` and wait for `uciok`,
   * then send `isready` and wait for `readyok`.
   */
  init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const worker = this.workerFactory();
      this.worker = worker;

      let stage: "uci" | "ready" = "uci";
      let settled = false;

      // Reject after 10 s if the engine never responds (e.g. binary missing).
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("Engine init timed out — is /stockfish/stockfish.js present?"));
        }
      }, 10_000);

      worker.onmessage = (ev: { data: string }) => {
        const line = ev.data.trim();
        if (stage === "uci" && line === "uciok") {
          stage = "ready";
          worker.postMessage("isready");
        } else if (stage === "ready" && line === "readyok") {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            worker.onmessage = null;
            resolve();
          }
        }
      };

      worker.postMessage("uci");
    });
  }

  /**
   * Evaluate a position.
   *
   * Sends:
   *   position fen <fen>
   *   go depth <depth>
   *
   * Collects `info ... score ...` lines and the final `bestmove` line,
   * then resolves with the LAST score seen (white-POV cp) + the best move.
   */
  analyse(fen: string, depth: number): Promise<EvalResult> {
    if (!this.worker) {
      return Promise.reject(new Error("Engine not initialised — call init() first"));
    }

    return new Promise<EvalResult>((resolve, reject) => {
      const worker = this.worker!;
      const stm = sideToMove(fen);
      let lastScore: number | null = null;
      let settled = false;

      // Safety timeout per analysis (30 s at high depth).
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          worker.onmessage = null;
          reject(new Error(`analyse() timed out for fen=${fen} depth=${depth}`));
        }
      }, 30_000);

      worker.onmessage = (ev: { data: string }) => {
        const line = ev.data.trim();

        // Parse info lines for score.
        if (line.startsWith("info ")) {
          const cpMatch = line.match(/\bscore cp (-?\d+)/);
          const mateMatch = line.match(/\bscore mate (-?\d+)/);
          if (cpMatch) {
            lastScore = parseScore("cp", parseInt(cpMatch[1], 10), stm);
          } else if (mateMatch) {
            lastScore = parseScore("mate", parseInt(mateMatch[1], 10), stm);
          }
        }

        // bestmove signals end of search.
        if (line.startsWith("bestmove ") && !settled) {
          settled = true;
          clearTimeout(timeout);
          worker.onmessage = null;
          const parts = line.split(/\s+/);
          const bestMoveUci = parts[1] === "(none)" || !parts[1] ? null : parts[1];
          resolve({ scoreCp: lastScore, bestMoveUci });
        }
      };

      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depth}`);
    });
  }

  /** Terminate the underlying worker. */
  quit(): void {
    if (this.worker) {
      this.worker.postMessage("quit");
      this.worker.terminate();
      this.worker = null;
    }
  }
}
