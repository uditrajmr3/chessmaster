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
 * The single-threaded build must be present at
 * /stockfish/stockfish-18-lite-single.js at runtime (it loads its sibling
 * .wasm by name). Populate it with `npm run fetch-stockfish` — see
 * frontend/public/stockfish/README.md.
 */
const STOCKFISH_WORKER_URL = "/stockfish/stockfish-18-lite-single.js";

function defaultWorkerFactory(): WorkerLike {
  return new Worker(STOCKFISH_WORKER_URL) as unknown as WorkerLike;
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
   * Core search: send a position + a `go ...` command, collect the last score
   * (white-POV cp) and the final bestmove.
   */
  private search(fen: string, goCmd: string): Promise<EvalResult> {
    if (!this.worker) {
      return Promise.reject(new Error("Engine not initialised — call init() first"));
    }

    return new Promise<EvalResult>((resolve, reject) => {
      const worker = this.worker!;
      const stm = sideToMove(fen);
      let lastScore: number | null = null;
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          worker.onmessage = null;
          reject(new Error(`search() timed out for fen=${fen} (${goCmd})`));
        }
      }, 30_000);

      worker.onmessage = (ev: { data: string }) => {
        const line = ev.data.trim();

        if (line.startsWith("info ")) {
          const cpMatch = line.match(/\bscore cp (-?\d+)/);
          const mateMatch = line.match(/\bscore mate (-?\d+)/);
          if (cpMatch) {
            lastScore = parseScore("cp", parseInt(cpMatch[1], 10), stm);
          } else if (mateMatch) {
            lastScore = parseScore("mate", parseInt(mateMatch[1], 10), stm);
          }
        }

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
      worker.postMessage(goCmd);
    });
  }

  /**
   * Evaluate a position to a fixed depth. Resolves with the last white-POV
   * score seen and the best move. (Used by full-game analysis.)
   */
  analyse(fen: string, depth: number): Promise<EvalResult> {
    return this.search(fen, `go depth ${depth}`);
  }

  /**
   * Pick a move for interactive play. Prefer a time budget (`movetime`, ms) so
   * weakened bots feel responsive; falls back to a depth.
   */
  bestMove(fen: string, opts: { depth?: number; movetime?: number } = {}): Promise<EvalResult> {
    const goCmd = opts.movetime ? `go movetime ${opts.movetime}` : `go depth ${opts.depth ?? 12}`;
    return this.search(fen, goCmd);
  }

  /**
   * Set engine strength for beginner-appropriate bots. `elo` uses Stockfish's
   * built-in UCI_LimitStrength (valid roughly ≥1320); for weaker play pass a
   * low `skill` (0–20) with limitStrength false. Resolves once applied
   * (waits for readyok) so the next search uses the new settings.
   */
  configure(options: {
    limitStrength?: boolean;
    elo?: number;
    skill?: number;
  }): Promise<void> {
    if (!this.worker) {
      return Promise.reject(new Error("Engine not initialised — call init() first"));
    }
    return new Promise<void>((resolve, reject) => {
      const worker = this.worker!;
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          worker.onmessage = null;
          reject(new Error("configure() timed out"));
        }
      }, 10_000);

      worker.onmessage = (ev: { data: string }) => {
        if (ev.data.trim() === "readyok" && !settled) {
          settled = true;
          clearTimeout(timeout);
          worker.onmessage = null;
          resolve();
        }
      };

      if (options.limitStrength !== undefined) {
        worker.postMessage(`setoption name UCI_LimitStrength value ${options.limitStrength}`);
      }
      if (options.elo !== undefined) {
        worker.postMessage(`setoption name UCI_Elo value ${options.elo}`);
      }
      if (options.skill !== undefined) {
        worker.postMessage(`setoption name Skill Level value ${options.skill}`);
      }
      worker.postMessage("isready");
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
