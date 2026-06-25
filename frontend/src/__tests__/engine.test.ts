/**
 * Tests for the Stockfish engine wrapper (engine.ts).
 *
 * All tests use a fake WorkerLike — no real WASM binary is needed.
 * The fake worker captures postMessage calls and lets the test drive
 * the UCI dialogue by calling replyWith().
 */

import { Engine, WorkerLike } from "@/lib/engine";

// ─────────────────────────────────────────────────────────────────────────────
// Fake Worker helpers
// ─────────────────────────────────────────────────────────────────────────────

interface FakeWorker extends WorkerLike {
  /** Lines posted by the engine to the worker. */
  sent: string[];
  /** Drive the fake engine: deliver a UCI line as if Stockfish sent it. */
  replyWith(line: string): void;
}

function makeFakeWorker(): FakeWorker {
  const sent: string[] = [];
  const worker: FakeWorker = {
    sent,
    onmessage: null,
    postMessage(msg: string) {
      sent.push(msg);
    },
    terminate() {
      // no-op
    },
    replyWith(line: string) {
      if (worker.onmessage) {
        worker.onmessage({ data: line });
      }
    },
  };
  return worker;
}

/** Builds an Engine using the given fake worker, returns both. */
function makeEngine() {
  const worker = makeFakeWorker();
  const engine = new Engine(() => worker);
  return { engine, worker };
}

// ─────────────────────────────────────────────────────────────────────────────
// init() tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Engine.init()", () => {
  it("sends uci then isready and resolves after uciok / readyok handshake", async () => {
    const { engine, worker } = makeEngine();

    const initPromise = engine.init();

    // Engine should have sent "uci"
    expect(worker.sent).toContain("uci");

    // Simulate Stockfish responding with uciok
    worker.replyWith("id name Stockfish 16");
    worker.replyWith("uciok");

    // Engine should now have sent "isready"
    expect(worker.sent).toContain("isready");

    // Simulate Stockfish responding with readyok
    worker.replyWith("readyok");

    await expect(initPromise).resolves.toBeUndefined();
  });

  it("ignores non-uciok lines before uciok", async () => {
    const { engine, worker } = makeEngine();
    const initPromise = engine.init();

    worker.replyWith("Stockfish 16 by T. Romstad et al.");
    worker.replyWith("id name Stockfish");
    worker.replyWith("option name Hash type spin default 16 min 1 max 33554432");
    worker.replyWith("uciok");
    worker.replyWith("readyok");

    await expect(initPromise).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// analyse() tests
// ─────────────────────────────────────────────────────────────────────────────

// Starting position FEN (white to move)
const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Example black-to-move FEN (after 1. e4)
const BLACK_FEN =
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

/** Helper: initialise engine, run init handshake, return ready state. */
async function initEngine(engine: Engine, worker: FakeWorker) {
  const p = engine.init();
  worker.replyWith("uciok");
  worker.replyWith("readyok");
  await p;
}

describe("Engine.analyse() — white to move", () => {
  it("resolves with the last cp score and bestmove (white POV)", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(START_FEN, 10);

    // Verify position + go commands were sent
    expect(worker.sent.some((m) => m.startsWith("position fen"))).toBe(true);
    expect(worker.sent.some((m) => m.startsWith("go depth"))).toBe(true);

    // Simulate engine output
    worker.replyWith("info depth 1 seldepth 1 score cp 12 pv e2e4");
    worker.replyWith("info depth 5 score cp 20 pv e2e4 e7e5");
    worker.replyWith("info depth 10 score cp 34 pv e2e4");
    worker.replyWith("bestmove e2e4 ponder e7e5");

    const result = await analysePromise;
    expect(result.scoreCp).toBe(34); // white to move, no negation needed
    expect(result.bestMoveUci).toBe("e2e4");
  });
});

describe("Engine.analyse() — black to move (POV conversion)", () => {
  it("negates cp score to produce white POV when black is to move", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(BLACK_FEN, 10);

    // UCI returns cp=34 from black's POV (black is winning by 34cp).
    // White POV = −34.
    worker.replyWith("info depth 10 score cp 34 pv e7e5");
    worker.replyWith("bestmove e7e5");

    const result = await analysePromise;
    expect(result.scoreCp).toBe(-34); // negated for white POV
    expect(result.bestMoveUci).toBe("e7e5");
  });
});

describe("Engine.analyse() — mate scores", () => {
  it("score mate 3 (white to move) → scoreCp: 10000", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(START_FEN, 20);

    worker.replyWith("info depth 20 score mate 3 pv d1h5");
    worker.replyWith("bestmove d1h5");

    const result = await analysePromise;
    expect(result.scoreCp).toBe(10000);
    expect(result.bestMoveUci).toBe("d1h5");
  });

  it("score mate -2 (white to move, opponent mates) → scoreCp: -10000", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(START_FEN, 20);

    worker.replyWith("info depth 20 score mate -2 pv e7e5");
    worker.replyWith("bestmove e2e4");

    const result = await analysePromise;
    expect(result.scoreCp).toBe(-10000);
  });

  it("score mate 2 (black to move, black mates) → scoreCp: -10000 (white POV)", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(BLACK_FEN, 20);

    // Black is to move and mates in 2 → bad for white
    worker.replyWith("info depth 20 score mate 2 pv e7e5");
    worker.replyWith("bestmove e7e5");

    const result = await analysePromise;
    expect(result.scoreCp).toBe(-10000);
  });

  it("score mate -3 (black to move, white mates) → scoreCp: 10000 (white POV)", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(BLACK_FEN, 20);

    // Black to move, negative mate = white (side NOT to move) mates
    worker.replyWith("info depth 20 score mate -3 pv e7e5");
    worker.replyWith("bestmove e7e5");

    const result = await analysePromise;
    expect(result.scoreCp).toBe(10000);
  });
});

describe("Engine.analyse() — edge cases", () => {
  it("returns the LAST info score before bestmove", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(START_FEN, 5);

    worker.replyWith("info depth 1 score cp 5 pv e2e4");
    worker.replyWith("info depth 2 score cp 10 pv e2e4");
    worker.replyWith("info depth 5 score cp 99 pv d2d4"); // last one wins
    worker.replyWith("bestmove d2d4");

    const result = await analysePromise;
    expect(result.scoreCp).toBe(99);
    expect(result.bestMoveUci).toBe("d2d4");
  });

  it("handles bestmove (none) as null bestMoveUci", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(START_FEN, 1);

    worker.replyWith("info depth 1 score cp 0");
    worker.replyWith("bestmove (none)");

    const result = await analysePromise;
    expect(result.bestMoveUci).toBeNull();
  });

  it("scoreCp is null if no info line with score was received", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    const analysePromise = engine.analyse(START_FEN, 1);

    worker.replyWith("bestmove e2e4"); // no info line at all

    const result = await analysePromise;
    expect(result.scoreCp).toBeNull();
    expect(result.bestMoveUci).toBe("e2e4");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// quit() tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Engine.quit()", () => {
  it("sends quit command and terminates the worker", async () => {
    const { engine, worker } = makeEngine();
    await initEngine(engine, worker);

    let terminated = false;
    worker.terminate = () => {
      terminated = true;
    };

    engine.quit();

    expect(worker.sent).toContain("quit");
    expect(terminated).toBe(true);
  });
});
