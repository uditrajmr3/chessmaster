import { Engine, WorkerLike } from "@/lib/engine";
import { botMove, weightedIndex, BOT_LEVELS, getBotLevel } from "@/lib/bot";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface FakeWorker extends WorkerLike {
  sent: string[];
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
    terminate() {},
    replyWith(line: string) {
      this.onmessage?.({ data: line });
    },
  };
  return worker;
}

async function initEngine(fake: FakeWorker): Promise<Engine> {
  const engine = new Engine(() => fake);
  const p = engine.init();
  fake.replyWith("uciok");
  fake.replyWith("readyok");
  await p;
  return engine;
}

describe("Engine.configure", () => {
  it("sends UCI strength options and waits for readyok", async () => {
    const fake = makeFakeWorker();
    const engine = await initEngine(fake);
    fake.sent.length = 0;

    const p = engine.configure({ limitStrength: true, elo: 1500 });
    fake.replyWith("readyok");
    await p;

    expect(fake.sent).toContain("setoption name UCI_LimitStrength value true");
    expect(fake.sent).toContain("setoption name UCI_Elo value 1500");
    expect(fake.sent).toContain("isready");
  });

  it("sends Skill Level for weak bots", async () => {
    const fake = makeFakeWorker();
    const engine = await initEngine(fake);
    fake.sent.length = 0;

    const p = engine.configure({ limitStrength: false, skill: 0 });
    fake.replyWith("readyok");
    await p;

    expect(fake.sent).toContain("setoption name Skill Level value 0");
    expect(fake.sent).toContain("setoption name UCI_LimitStrength value false");
  });
});

describe("Engine.bestMove / topMoves", () => {
  it("searches with a movetime budget and returns the move", async () => {
    const fake = makeFakeWorker();
    const engine = await initEngine(fake);
    fake.sent.length = 0;

    const p = engine.bestMove("fen w - - 0 1", { movetime: 250 });
    fake.replyWith("info depth 6 score cp 20");
    fake.replyWith("bestmove e2e4");
    const res = await p;

    expect(fake.sent).toContain("go movetime 250");
    expect(res.bestMoveUci).toBe("e2e4");
  });

  it("parses MultiPV candidates, best first", async () => {
    const fake = makeFakeWorker();
    const engine = await initEngine(fake);
    fake.sent.length = 0;

    const p = engine.topMoves("fen w - - 0 1", { movetime: 100, multipv: 3 });
    fake.replyWith("info depth 8 multipv 1 score cp 30 pv e2e4 e7e5");
    fake.replyWith("info depth 8 multipv 2 score cp 18 pv d2d4 d7d5");
    fake.replyWith("info depth 8 multipv 3 score cp 5 pv g1f3 b8c6");
    fake.replyWith("bestmove e2e4");
    const arr = await p;

    expect(fake.sent).toContain("setoption name MultiPV value 3");
    expect(arr.map((m) => m.uci)).toEqual(["e2e4", "d2d4", "g1f3"]);
    expect(arr[0].score).toBe(30);
  });
});

describe("weightedIndex", () => {
  it("always picks the best move when bias is 0", () => {
    for (const r of [0, 0.3, 0.99]) {
      expect(weightedIndex(5, 0, () => r)).toBe(0);
    }
  });
  it("can pick a weaker candidate when bias is high and rng is high", () => {
    expect(weightedIndex(5, 0.9, () => 0.999)).toBeGreaterThan(0);
  });
});

describe("botMove", () => {
  it("weak bots pick from the top-N engine candidates (never random)", async () => {
    const engine = {
      configure: async () => {},
      topMoves: async () => [
        { uci: "e2e4", score: 30 },
        { uci: "g1f3", score: 22 },
        { uci: "d2d4", score: 18 },
      ],
      bestMove: async () => {
        throw new Error("weak bot must not fall back to bestMove here");
      },
    } as unknown as Engine;

    const mv = await botMove(engine, START, getBotLevel(1000), () => 0);
    expect(mv).toBe("e2e4"); // rng 0 → best of the pool
  });

  it("strong bots use the engine's limited-Elo move", async () => {
    const engine = {
      configure: async () => {},
      bestMove: async () => ({ scoreCp: 20, bestMoveUci: "d2d4" }),
      topMoves: async () => {
        throw new Error("strong bot should not use topMoves");
      },
    } as unknown as Engine;

    const mv = await botMove(engine, START, BOT_LEVELS.find((l) => l.elo === 1500)!);
    expect(mv).toBe("d2d4");
  });
});
