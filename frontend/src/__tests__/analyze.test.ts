/**
 * Tests for the browser-driven analysis loop (analyze.ts).
 *
 * Uses a fake Engine (injected via opts.engine) and mocks api.*
 * so no real worker or network is needed.
 */

import { runAnalysis } from "@/lib/analyze";
import { api } from "@/lib/api";
import type { Engine, EvalResult } from "@/lib/engine";
import type { PendingGame, MoveEval } from "@/lib/types";

// ── Mock the api module ──────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  api: {
    getPending: jest.fn(),
    postAnalysisResults: jest.fn(),
  },
}));

const mockGetPending = api.getPending as jest.MockedFunction<typeof api.getPending>;
const mockPostResults = api.postAnalysisResults as jest.MockedFunction<typeof api.postAnalysisResults>;

// ── Fake Engine helper ───────────────────────────────────────────────────────

function makeFakeEngine(evalSequence: EvalResult[]): Engine {
  let callIndex = 0;

  return {
    init: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn(),
    analyse: jest.fn().mockImplementation(async () => {
      const result = evalSequence[callIndex] ?? { scoreCp: 0, bestMoveUci: null };
      callIndex++;
      return result;
    }),
  } as unknown as Engine;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPostResults.mockResolvedValue(undefined as unknown as void);
});

// Short PGN: 1. e4 e5 2. Nf3 (3 half-moves)
const SHORT_PGN = "1. e4 e5 2. Nf3 *";

describe("runAnalysis — empty pending list", () => {
  it("calls onProgress(0, 0) and never calls postAnalysisResults", async () => {
    mockGetPending.mockResolvedValue([]);

    const onProgress = jest.fn();
    const fakeEngine = makeFakeEngine([]);

    await runAnalysis(onProgress, { engine: fakeEngine });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(0, 0);
    expect(mockPostResults).not.toHaveBeenCalled();
  });
});

describe("runAnalysis — one game (3 half-moves)", () => {
  const GAME_ID = "test-game-42";

  // We have 3 half-moves → 4 engine.analyse calls:
  //   call 0: starting position (eval_before of move 1)
  //   call 1: after e4 (eval_after of move 1 = eval_before of move 2)
  //   call 2: after e5 (eval_after of move 2 = eval_before of move 3)
  //   call 3: after Nf3 (eval_after of move 3)
  const evalSequence: EvalResult[] = [
    { scoreCp: 10, bestMoveUci: "e2e4" },   // starting pos
    { scoreCp: -30, bestMoveUci: "e7e5" },  // after e4
    { scoreCp: 20, bestMoveUci: "g1f3" },   // after e5
    { scoreCp: -15, bestMoveUci: "e7e6" },  // after Nf3
  ];

  let pending: PendingGame[];
  let fakeEngine: Engine;
  let onProgress: jest.Mock;
  let capturedMoves: MoveEval[];

  beforeEach(async () => {
    pending = [{ game_id: GAME_ID, pgn: SHORT_PGN, player_color: "white" }];
    mockGetPending.mockResolvedValue(pending);
    mockPostResults.mockImplementation(async (payload) => {
      capturedMoves = payload.moves;
      return undefined as unknown as void;
    });

    fakeEngine = makeFakeEngine([...evalSequence]);
    onProgress = jest.fn();
    await runAnalysis(onProgress, { engine: fakeEngine });
  });

  it("calls postAnalysisResults exactly once", () => {
    expect(mockPostResults).toHaveBeenCalledTimes(1);
  });

  it("posts with the correct game_id", () => {
    const payload = (mockPostResults as jest.Mock).mock.calls[0][0];
    expect(payload.game_id).toBe(GAME_ID);
  });

  it("produces one MoveEval per half-move (3 total)", () => {
    expect(capturedMoves).toHaveLength(3);
  });

  it("carry-forward: eval_after of move N equals eval_before of move N+1", () => {
    // Move 1 eval_after === move 2 eval_before
    expect(capturedMoves[1].eval_before).toBe(capturedMoves[0].eval_after);
    // Move 2 eval_after === move 3 eval_before
    expect(capturedMoves[2].eval_before).toBe(capturedMoves[1].eval_after);
  });

  it("eval_before of move 1 equals the starting-position eval", () => {
    // Starting pos eval = scoreCp from call 0 = 10
    expect(capturedMoves[0].eval_before).toBe(10);
  });

  it("sets is_player_move correctly for white (moves 1 and 3 are white's)", () => {
    // Move 1: white plays e4 → is_player_move true
    expect(capturedMoves[0].is_player_move).toBe(true);
    // Move 2: black plays e5 → is_player_move false
    expect(capturedMoves[1].is_player_move).toBe(false);
    // Move 3: white plays Nf3 → is_player_move true
    expect(capturedMoves[2].is_player_move).toBe(true);
  });

  it("calls onProgress(1, 1) after the game is posted", () => {
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it("populates move_uci in UCI format (long algebraic)", () => {
    // e4 → e2e4, e5 → e7e5, Nf3 → g1f3
    expect(capturedMoves[0].move_uci).toBe("e2e4");
    expect(capturedMoves[1].move_uci).toBe("e7e5");
    expect(capturedMoves[2].move_uci).toBe("g1f3");
  });

  it("populates move_san", () => {
    expect(capturedMoves[0].move_san).toBe("e4");
    expect(capturedMoves[1].move_san).toBe("e5");
    expect(capturedMoves[2].move_san).toBe("Nf3");
  });

  it("engine.quit is called (via finally)", () => {
    expect((fakeEngine.quit as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});

describe("runAnalysis — is_player_move for black", () => {
  it("marks only black's moves as is_player_move when player_color=black", async () => {
    const pending: PendingGame[] = [
      { game_id: "g2", pgn: SHORT_PGN, player_color: "black" },
    ];
    mockGetPending.mockResolvedValue(pending);

    const evalSeq: EvalResult[] = [
      { scoreCp: 0, bestMoveUci: null },
      { scoreCp: 10, bestMoveUci: null },
      { scoreCp: -10, bestMoveUci: null },
      { scoreCp: 5, bestMoveUci: null },
    ];
    const fakeEngine = makeFakeEngine(evalSeq);
    let capturedMoves: MoveEval[] = [];
    mockPostResults.mockImplementation(async (payload) => {
      capturedMoves = payload.moves;
      return undefined as unknown as void;
    });

    await runAnalysis(jest.fn(), { engine: fakeEngine });

    // Move 1: white (e4) → not player
    expect(capturedMoves[0].is_player_move).toBe(false);
    // Move 2: black (e5) → player
    expect(capturedMoves[1].is_player_move).toBe(true);
    // Move 3: white (Nf3) → not player
    expect(capturedMoves[2].is_player_move).toBe(false);
  });
});

describe("runAnalysis — multiple games", () => {
  it("calls onProgress for each game and postAnalysisResults for each", async () => {
    const pending: PendingGame[] = [
      { game_id: "g1", pgn: SHORT_PGN, player_color: "white" },
      { game_id: "g2", pgn: "1. d4 d5 *", player_color: "black" },
    ];
    mockGetPending.mockResolvedValue(pending);

    // We need enough eval results for both games:
    // Game 1 (3 moves): 4 engine calls
    // Game 2 (2 moves): 3 engine calls
    const evalSeq: EvalResult[] = Array(10).fill({ scoreCp: 0, bestMoveUci: null });
    const fakeEngine = makeFakeEngine(evalSeq);
    const onProgress = jest.fn();

    await runAnalysis(onProgress, { engine: fakeEngine });

    expect(mockPostResults).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });
});
