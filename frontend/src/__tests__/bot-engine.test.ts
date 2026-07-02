import { Engine, WorkerLike } from "@/lib/engine";
import { botMove, BOT_LEVELS } from "@/lib/bot";

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

describe("Engine.bestMove", () => {
  it("searches with a movetime budget and returns the move", async () => {
    const fake = makeFakeWorker();
    const engine = await initEngine(fake);
    fake.sent.length = 0;

    const p = engine.bestMove("startpos-fen-unused w - - 0 1", { movetime: 250 });
    fake.replyWith("info depth 6 score cp 20");
    fake.replyWith("bestmove e2e4");
    const res = await p;

    expect(fake.sent.some((s) => s === "go movetime 250")).toBe(true);
    expect(res.bestMoveUci).toBe("e2e4");
  });
});

describe("botMove randomness", () => {
  it("plays a legal random move without calling the engine when rng is low", async () => {
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    // A dummy engine that would throw if the code path touched it.
    const engine = {
      configure: () => {
        throw new Error("engine should not be called on the random path");
      },
      bestMove: () => {
        throw new Error("engine should not be called on the random path");
      },
    } as unknown as Engine;

    const level = BOT_LEVELS[0]; // 300, randomness 0.5
    const move = await botMove(engine, START, level, () => 0); // 0 < randomness
    expect(move).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
  });
});
