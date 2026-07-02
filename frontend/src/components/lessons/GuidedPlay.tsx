"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Lightbulb, Check, AlertTriangle } from "lucide-react";
import { Engine } from "@/lib/engine";
import { OPENINGS, getOpening } from "@/lib/openings";
import { BOT_LEVELS, botMove } from "@/lib/bot";
import { coachReport, findThreats, ruleForMove } from "@/lib/coach";

type Side = "white" | "black";
type Hint = { san: string; ruleId: string; ruleTitle: string; why: string; from: string; to: string };

export default function GuidedPlay() {
  const [started, setStarted] = useState(false);
  const [side, setSide] = useState<Side>("white");
  const [openingKey, setOpeningKey] = useState(OPENINGS[0].key);
  const [elo, setElo] = useState(1000);

  const [fen, setFen] = useState(() => new Chess().fen());
  const [status, setStatus] = useState("");
  const [thinking, setThinking] = useState(false);
  const [engineOffline, setEngineOffline] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const gameRef = useRef(new Chess());
  const engineRef = useRef<Engine | null>(null);
  const userColor = side === "white" ? "w" : "b";
  const botLevel = useMemo(() => BOT_LEVELS.find((l) => l.elo === elo) ?? BOT_LEVELS[2], [elo]);

  useEffect(() => {
    return () => engineRef.current?.quit();
  }, []);

  const sync = () => setFen(gameRef.current.fen());

  function updateStatus() {
    const g = gameRef.current;
    if (g.isCheckmate()) {
      setStatus(g.turn() === userColor ? "Checkmate — you lost this one." : "Checkmate — you won! 🎉");
    } else if (g.isDraw()) {
      setStatus("Draw.");
    } else if (g.inCheck()) {
      setStatus(g.turn() === userColor ? "You're in check — deal with it." : "Check!");
    } else {
      setStatus("");
    }
  }

  async function maybeBotMove() {
    const g = gameRef.current;
    if (g.isGameOver() || g.turn() === userColor) return;
    setThinking(true);
    try {
      let uci: string | null = null;
      if (engineRef.current) {
        uci = await botMove(engineRef.current, g.fen(), botLevel);
      } else {
        // Engine failed to load — keep the game playable with a random legal move.
        const legal = g.moves({ verbose: true });
        if (legal.length) {
          const m = legal[Math.floor(Math.random() * legal.length)];
          uci = m.from + m.to + (m.promotion ?? "");
        }
      }
      if (uci) {
        g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci.slice(4) || "q") as "q" });
        setLastMove({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
        sync();
        updateStatus();
      }
    } finally {
      setThinking(false);
    }
  }

  async function start() {
    const g = new Chess();
    const opening = getOpening(openingKey);
    if (opening) for (const san of opening.moves) { try { g.move(san); } catch {} }
    gameRef.current = g;
    setHint(null);
    setLastMove(null);
    setStarted(true);
    sync();
    updateStatus();

    if (!engineRef.current) {
      const e = new Engine();
      try {
        await e.init();
        engineRef.current = e;
        setEngineOffline(false);
      } catch {
        setEngineOffline(true);
      }
    }
    void maybeBotMove();
  }

  function onDrop(from: string, to: string, pieceType: string): boolean {
    const g = gameRef.current;
    if (thinking || g.isGameOver() || g.turn() !== userColor) return false;
    const isPromo = pieceType.toLowerCase().endsWith("p") && (to[1] === "8" || to[1] === "1");
    try {
      const move = g.move({ from, to, promotion: isPromo ? "q" : undefined });
      if (!move) return false;
    } catch {
      return false;
    }
    setLastMove({ from, to });
    setHint(null);
    sync();
    updateStatus();
    setTimeout(() => void maybeBotMove(), 300);
    return true;
  }

  async function getHint() {
    const g = gameRef.current;
    if (thinking || g.isGameOver() || g.turn() !== userColor) return;
    if (!engineRef.current) return;
    setThinking(true);
    try {
      const { bestMoveUci } = await engineRef.current.bestMove(g.fen(), { depth: 12 });
      if (bestMoveUci) {
        const from = bestMoveUci.slice(0, 2);
        const to = bestMoveUci.slice(2, 4);
        const tag = ruleForMove(g, bestMoveUci);
        const tmp = new Chess(g.fen());
        const mv = tmp.move({ from, to, promotion: (bestMoveUci.slice(4) || "q") as "q" });
        setHint({
          san: mv?.san ?? bestMoveUci,
          ruleId: tag?.rule.id ?? "",
          ruleTitle: tag?.rule.title ?? "",
          why: tag?.why ?? "",
          from,
          to,
        });
      }
    } finally {
      setThinking(false);
    }
  }

  const isUserTurn = started && gameRef.current.turn() === userColor && !gameRef.current.isGameOver();

  const report = useMemo(() => {
    if (!isUserTurn) return null;
    return coachReport(new Chess(fen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, isUserTurn]);

  const threatSquares = useMemo(() => {
    if (!isUserTurn) return [];
    return findThreats(new Chess(fen)).map((t) => t.square);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, isUserTurn]);

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: "rgba(167,131,104,0.28)" };
    squareStyles[lastMove.to] = { backgroundColor: "rgba(167,131,104,0.4)" };
  }
  for (const sq of threatSquares) {
    squareStyles[sq] = { backgroundColor: "rgba(220,60,60,0.45)" };
  }

  const arrows = hint
    ? [{ startSquare: hint.from, endSquare: hint.to, color: "rgba(34,197,94,0.7)" }]
    : [];

  const opening = getOpening(openingKey);

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-300">Play as</p>
          <div className="flex gap-2">
            {(["white", "black"] as Side[]).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium capitalize btn-press transition-colors ${
                  side === s
                    ? "border-accent-500/40 bg-accent-500/15 text-accent-300"
                    : "border-white/10 bg-ink-800 text-gray-300 hover:border-white/20"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-300">Opening</label>
          <select
            value={openingKey}
            onChange={(e) => setOpeningKey(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-gray-200 hover:border-white/20 focus:border-accent-500 focus:outline-none"
          >
            {OPENINGS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.name} ({o.forSide})
              </option>
            ))}
          </select>
          {opening && <p className="mt-2 text-xs leading-relaxed text-gray-500">{opening.idea}</p>}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-300">Opponent strength (Elo)</p>
          <div className="grid grid-cols-3 gap-2">
            {BOT_LEVELS.map((l) => (
              <button
                key={l.elo}
                onClick={() => setElo(l.elo)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium btn-press transition-colors ${
                  elo === l.elo
                    ? "border-accent-500/40 bg-accent-500/15 text-accent-300"
                    : "border-white/10 bg-ink-800 text-gray-300 hover:border-white/20"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={start}
          className="w-full rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
        >
          Start playing
        </button>
      </div>
    );
  }

  // ── Play screen ───────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="mx-auto w-full max-w-[520px]">
          <Chessboard
            options={{
              position: fen,
              boardOrientation: side,
              allowDragging: isUserTurn && !thinking,
              onPieceDrop: ({ sourceSquare, targetSquare, piece }) =>
                targetSquare ? onDrop(sourceSquare, targetSquare, piece.pieceType) : false,
              squareStyles,
              arrows,
              showAnimations: true,
              animationDurationInMs: 200,
              boardStyle: { borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" },
              darkSquareStyle: { backgroundColor: "#779952" },
              lightSquareStyle: { backgroundColor: "#edeed1" },
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-gray-400">
            {status || (thinking ? "Opponent is thinking…" : isUserTurn ? "Your move." : "…")}
          </span>
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={getHint}
            disabled={!isUserTurn || thinking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-gray-300 btn-press hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            <Lightbulb className="h-4 w-4" /> Hint
          </button>
          <button
            onClick={() => { setStarted(false); setStatus(""); }}
            className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-gray-300 btn-press hover:border-white/20 hover:text-white"
          >
            New game
          </button>
        </div>
      </div>

      {/* Coach panel */}
      <div className="lg:col-span-2">
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-white">Your coach</h3>
            {report && (
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs capitalize text-gray-400">
                {report.phase}
              </span>
            )}
          </div>

          {engineOffline && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              The engine didn&rsquo;t load, so the opponent is playing random moves and hints are off.
            </p>
          )}

          {report ? (
            <>
              <ol className="mt-4 space-y-3">
                {report.questions.map((q, i) => (
                  <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      {q.ok ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      {i + 1}. {q.q}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">{q.answer}</p>
                  </li>
                ))}
              </ol>

              {hint ? (
                <div className="mt-4 rounded-lg border border-green-700/40 bg-green-500/10 p-3">
                  <p className="text-sm font-semibold text-green-300">
                    Try {hint.san}
                    {hint.ruleId && (
                      <span className="ml-1 font-normal text-green-400/80">— {hint.ruleId}: {hint.ruleTitle}</span>
                    )}
                  </p>
                  {hint.why && <p className="mt-1 text-xs text-gray-400">{hint.why}</p>}
                </div>
              ) : (
                <p className="mt-4 text-xs text-gray-500">
                  Work through the three questions, then play your move. Stuck? Press{" "}
                  <span className="text-gray-300">Hint</span> for a sound move and the rule behind it.
                </p>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-gray-400">
              {thinking ? "Opponent is thinking…" : status || "Game over."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
