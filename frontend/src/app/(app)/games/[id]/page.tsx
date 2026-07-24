"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import type { GameDetail, MoveAnalysis } from "@/lib/types";
import { ResultBadge, EmptyState } from "@/components/ui/page-kit";
import Term from "@/components/Term";
import {
  ArrowLeft,
  Swords,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

// chess.com-style move classifications. "best" is derived (move == engine best).
const CLASS_META: Record<
  string,
  { label: string; symbol: string; color: string; chip: string }
> = {
  brilliant: { label: "Brilliant", symbol: "!!", color: "text-cyan-300", chip: "bg-cyan-400/15 text-cyan-300" },
  great: { label: "Great", symbol: "!", color: "text-blue-300", chip: "bg-blue-400/15 text-blue-300" },
  best: { label: "Best", symbol: "★", color: "text-green-400", chip: "bg-green-400/15 text-green-400" },
  excellent: { label: "Excellent", symbol: "", color: "text-emerald-300", chip: "bg-emerald-400/12 text-emerald-300" },
  good: { label: "Good", symbol: "", color: "text-gray-300", chip: "bg-white/10 text-gray-300" },
  book: { label: "Book", symbol: "", color: "text-amber-300/80", chip: "bg-amber-400/10 text-amber-300/80" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", color: "text-yellow-400", chip: "bg-yellow-400/15 text-yellow-400" },
  miss: { label: "Miss", symbol: "✗", color: "text-rose-400", chip: "bg-rose-400/15 text-rose-400" },
  mistake: { label: "Mistake", symbol: "?", color: "text-orange-400", chip: "bg-orange-400/15 text-orange-400" },
  blunder: { label: "Blunder", symbol: "??", color: "text-red-400", chip: "bg-red-400/15 text-red-400" },
};
const CLASS_ORDER = ["brilliant", "great", "best", "excellent", "good", "book", "inaccuracy", "miss", "mistake", "blunder"];

const CPL_CAP = 1000; // mate-score swings (±10000) are clamped so they don't skew metrics

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// A "brilliant" is a sound sacrifice: the best move that leaves the mover still
// winning even though it lets the opponent win material (a piece >= a minor
// captured by a strictly cheaper piece). Evals are player-POV, so "winning for
// the mover" flips on the opponent's moves.
function isBrilliantSac(m: MoveAnalysis): boolean {
  const winningForMover =
    m.eval_after !== null && (m.is_player_move ? m.eval_after >= 100 : m.eval_after <= -100);
  if (!winningForMover) return false;
  try {
    const c = new Chess(m.fen_before);
    if (!c.move(m.move_san)) return false;
    for (const om of c.moves({ verbose: true })) {
      if (om.captured && PIECE_VALUE[om.captured] >= 3 && PIECE_VALUE[om.piece] < PIECE_VALUE[om.captured]) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function effectiveClass(m: MoveAnalysis): string {
  const isBest = !!(m.best_move_san && m.move_san === m.best_move_san);
  if (isBest && isBrilliantSac(m)) return "brilliant";
  if (m.classification === "brilliant") return "brilliant";
  if (m.classification === "book") return "book";
  if (isBest) return "best";
  const cpl = Math.max(0, m.centipawn_loss);
  const missedTactic = !!(m.tactical_motifs && m.tactical_motifs.length > 0);
  if (cpl <= 25) return "excellent";
  if (cpl <= 50) return "good";
  // A "miss" is a significant error that let a tactic / winning chance slip.
  if (missedTactic && cpl >= 100) return "miss";
  if (cpl <= 100) return "inaccuracy";
  if (cpl <= 300) return "mistake";
  return "blunder";
}

function involvesMate(m: MoveAnalysis): boolean {
  return (
    (m.eval_before !== null && Math.abs(m.eval_before) >= 9000) ||
    (m.eval_after !== null && Math.abs(m.eval_after) >= 9000)
  );
}

function evalToStr(cp: number | null): string {
  if (cp === null) return "?";
  if (cp >= 9000) return "+M";
  if (cp <= -9000) return "−M";
  const v = cp / 100;
  return (v > 0 ? "+" : "") + v.toFixed(2);
}

// Evals are stored player-POV (positive = good for the logged-in player; the
// ingest negates white-POV evals for black players), so win% uses them directly.
function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// Per-move accuracy from the drop in the MOVER's winning chances (Lichess model).
function moveAccuracy(evalBefore: number, evalAfter: number, isPlayerMove: boolean): number {
  const before = winPct(evalBefore); // player win% before the move
  const after = winPct(evalAfter);
  // Player's own move: penalize a drop in the player's win%. Opponent's move:
  // penalize a rise in the player's win% (the opponent worsened their position).
  const drop = isPlayerMove ? Math.max(0, before - after) : Math.max(0, after - before);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
}

function phaseGrade(cpl: number | null): { label: string; color: string } {
  if (cpl === null) return { label: "—", color: "text-white/40" };
  if (cpl <= 30) return { label: "Excellent", color: "text-green-400" };
  if (cpl <= 70) return { label: "Good", color: "text-green-300" };
  if (cpl <= 130) return { label: "OK", color: "text-yellow-400" };
  return { label: "Shaky", color: "text-red-400" };
}

interface SideSummary {
  n: number;
  accuracy: number;
  counts: Record<string, number>;
  phaseCpl: Record<string, number | null>;
}

function summarize(moves: MoveAnalysis[]): SideSummary {
  const counts: Record<string, number> = {};
  const phases: Record<string, { sum: number; n: number }> = {};
  let accSum = 0;
  let accN = 0;
  for (const m of moves) {
    counts[effectiveClass(m)] = (counts[effectiveClass(m)] || 0) + 1;
    const cpl = Math.min(Math.max(m.centipawn_loss, 0), CPL_CAP);
    const p = m.game_phase || "middlegame";
    phases[p] = phases[p] || { sum: 0, n: 0 };
    phases[p].sum += cpl;
    phases[p].n += 1;
    if (m.eval_before !== null && m.eval_after !== null) {
      accSum += moveAccuracy(m.eval_before, m.eval_after, m.is_player_move);
      accN += 1;
    }
  }
  const phaseCpl: Record<string, number | null> = {};
  for (const p of ["opening", "middlegame", "endgame"]) {
    phaseCpl[p] = phases[p]?.n ? phases[p].sum / phases[p].n : null;
  }
  return {
    n: moves.length,
    accuracy: accN ? accSum / accN : 0,
    counts,
    phaseCpl,
  };
}

export default function GameReviewPage() {
  const params = useParams();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [ply, setPly] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGame();
  }, [params.id]);

  async function loadGame() {
    try {
      const data = await api.getGame(params.id as string);
      setGame(data);
    } catch {
      // handled by !game state
    }
    setLoading(false);
  }

  // Replay the PGN into a per-ply list of positions (works for analyzed AND
  // unanalyzed games), so the board can step through the whole game.
  const plies = useMemo(() => {
    const out: { fen: string; uci: string; san: string }[] = [];
    try {
      const loaded = new Chess();
      loaded.loadPgn(game!.pgn);
      const startFen = (loaded.header() as Record<string, string>)["FEN"];
      const replay = startFen ? new Chess(startFen) : new Chess();
      out.push({ fen: replay.fen(), uci: "", san: "" });
      for (const mv of loaded.history({ verbose: true })) {
        replay.move(mv.san);
        out.push({ fen: replay.fen(), uci: mv.lan, san: mv.san });
      }
    } catch {
      out.push({ fen: new Chess().fen(), uci: "", san: "" });
    }
    return out;
  }, [game]);

  const totalPlies = plies.length - 1;
  const isAnalyzed = !!game && game.moves.length > 0;

  const summary = useMemo(() => {
    if (!game || !isAnalyzed) return null;
    const you: MoveAnalysis[] = [];
    const opp: MoveAnalysis[] = [];
    for (const m of game.moves) (m.is_player_move ? you : opp).push(m);
    return { you: summarize(you), opp: summarize(opp) };
  }, [game, isAnalyzed]);

  const go = useCallback(
    (p: number) => setPly(Math.max(0, Math.min(totalPlies, p))),
    [totalPlies]
  );

  // Keyboard navigation through the game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); setPly((p) => Math.max(0, p - 1)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setPly((p) => Math.min(totalPlies, p + 1)); }
      else if (e.key === "Home") setPly(0);
      else if (e.key === "End") setPly(totalPlies);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [totalPlies]);

  if (loading) return <GameReviewSkeleton />;
  if (!game)
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={Swords}
          title="Game not found"
          description="This game may have been removed, or the link is incorrect."
          action={
            <Link href="/games" className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-500 text-white font-medium rounded-lg btn-press px-4 py-2 text-sm">
              View all games
            </Link>
          }
        />
      </div>
    );

  const current = plies[ply];
  const currentMove: MoveAnalysis | null = isAnalyzed && ply > 0 ? game.moves[ply - 1] ?? null : null;
  const orientation = game.player_color === "black" ? "black" : "white";

  const lastMoveStyles: Record<string, React.CSSProperties> = {};
  if (current.uci && current.uci.length >= 4) {
    lastMoveStyles[current.uci.slice(0, 2)] = { background: "rgba(167,131,104,0.32)" };
    lastMoveStyles[current.uci.slice(2, 4)] = { background: "rgba(167,131,104,0.42)" };
  }

  // Best move FROM the current position (the move analyzed at this ply). Shown
  // as a green arrow when the move actually played here wasn't the best.
  const nextMove: MoveAnalysis | null =
    isAnalyzed && ply < game.moves.length ? game.moves[ply] ?? null : null;
  const bestArrows =
    nextMove &&
    nextMove.best_move_uci &&
    nextMove.best_move_uci.length >= 4 &&
    nextMove.move_uci !== nextMove.best_move_uci
      ? [
          {
            startSquare: nextMove.best_move_uci.slice(0, 2),
            endSquare: nextMove.best_move_uci.slice(2, 4),
            color: "rgba(34,197,94,0.55)",
          },
        ]
      : [];

  // Build the move-pair rows (analyzed → with classification; else plain SAN).
  const rows: Array<{ n: number; white: number | null; black: number | null }> = [];
  for (let i = 1; i <= totalPlies; i += 2) {
    rows.push({ n: Math.floor((i - 1) / 2) + 1, white: i, black: i + 1 <= totalPlies ? i + 1 : null });
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-white">vs {game.opponent_name}</h1>
          <p className="mt-1 text-sm text-white/55">
            {new Date(game.played_at).toLocaleDateString()} · {game.opening_name || game.opening_eco || "Unknown opening"} · {game.time_class}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <span className="text-xs uppercase tracking-wider text-white/45 font-medium">{game.player_color}</span>
          <ResultBadge result={game.result} />
          <span className="text-white/55 font-mono text-sm">{game.player_rating} vs {game.opponent_rating}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Board + controls */}
        <div className="lg:col-span-3 space-y-3">
          <div className="surface-card p-3 sm:p-4">
            <div className="mx-auto w-full max-w-[560px]">
              <Chessboard
                options={{
                  position: current.fen,
                  allowDragging: false,
                  boardOrientation: orientation,
                  squareStyles: lastMoveStyles,
                  arrows: bestArrows,
                  showAnimations: true,
                  animationDurationInMs: 150,
                  boardStyle: { borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" },
                  darkSquareStyle: { backgroundColor: "#6f8a6b" },
                  lightSquareStyle: { backgroundColor: "#e9ecd6" },
                }}
              />
            </div>
            {/* Nav controls */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <NavBtn onClick={() => go(0)} disabled={ply === 0} label="Start"><ChevronsLeft className="h-4 w-4" /></NavBtn>
              <NavBtn onClick={() => go(ply - 1)} disabled={ply === 0} label="Previous"><ChevronLeft className="h-4 w-4" /></NavBtn>
              <span className="px-3 text-sm font-mono text-white/60 tabular-nums">{ply} / {totalPlies}</span>
              <NavBtn onClick={() => go(ply + 1)} disabled={ply === totalPlies} label="Next"><ChevronRight className="h-4 w-4" /></NavBtn>
              <NavBtn onClick={() => go(totalPlies)} disabled={ply === totalPlies} label="End"><ChevronsRight className="h-4 w-4" /></NavBtn>
            </div>
            <p className="mt-2 text-center text-[0.7rem] text-white/35">Use ← → arrow keys to step through the game</p>
          </div>

          {/* Evaluation graph — scrub the game, click to jump */}
          {isAnalyzed && <EvalGraph moves={game.moves} ply={ply} onSeek={go} />}

          {/* Current move detail */}
          {currentMove && <MoveDetail move={currentMove} />}
        </div>

        {/* Right column: review summary + move list */}
        <div className="lg:col-span-2 space-y-6">
          {isAnalyzed && summary ? (
            <ReviewSummary you={summary.you} opp={summary.opp} opponent={game.opponent_name} />
          ) : (
            <div className="surface-card p-5">
              <h2 className="text-base font-semibold text-white mb-1">Game Review</h2>
              <p className="text-sm text-white/55">
                This game isn&apos;t analyzed yet. Run <span className="text-accent-300">Analyze Games</span> to get
                accuracy, move classifications, and phase grades. You can still replay the moves on the board.
              </p>
            </div>
          )}

          {/* Move list */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <h2 className="text-base font-semibold text-white">Moves</h2>
              <span className="text-xs text-white/45 font-mono">{totalPlies} ply</span>
            </div>
            <div className="max-h-[460px] overflow-y-auto divide-y divide-white/5">
              {rows.map((row) => (
                <div key={row.n} className="grid grid-cols-[2.5rem_1fr_1fr] items-stretch">
                  <div className="flex items-center justify-center text-xs text-white/40 font-mono">{row.n}.</div>
                  <PlyCell plyIdx={row.white} plies={plies} game={game} isAnalyzed={isAnalyzed} selected={ply} onSelect={go} />
                  <PlyCell plyIdx={row.black} plies={plies} game={game} isAnalyzed={isAnalyzed} selected={ply} onSelect={go} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlyCell({
  plyIdx, plies, game, isAnalyzed, selected, onSelect,
}: {
  plyIdx: number | null;
  plies: { san: string }[];
  game: GameDetail;
  isAnalyzed: boolean;
  selected: number;
  onSelect: (p: number) => void;
}) {
  if (plyIdx === null) return <div className="py-0.5 pr-1" />;
  const san = plies[plyIdx]?.san ?? "";
  const move = isAnalyzed ? game.moves[plyIdx - 1] : null;
  const cls = move ? effectiveClass(move) : null;
  const meta = cls ? CLASS_META[cls] : null;
  const isSel = selected === plyIdx;
  return (
    <div className="py-0.5 pr-1">
      <button
        onClick={() => onSelect(plyIdx)}
        className={`px-2 py-1 rounded-md text-left w-full font-mono text-sm transition-colors btn-press flex items-center gap-1 ${
          isSel ? "bg-accent-500/15 ring-1 ring-accent-500/30" : "hover:bg-white/5"
        } ${meta && move?.is_player_move ? meta.color : "text-white/70"}`}
      >
        <span>{san}</span>
        {meta?.symbol && <span className="text-xs">{meta.symbol}</span>}
      </button>
    </div>
  );
}

function ReviewSummary({ you, opp, opponent }: { you: SideSummary; opp: SideSummary; opponent: string }) {
  return (
    <div className="surface-card p-5 animate-fade-in-up">
      <h2 className="text-base font-semibold text-white mb-4">Game Review</h2>

      {/* Accuracy */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <AccuracyCard label="You" accuracy={you.accuracy} highlight />
        <AccuracyCard label={opponent || "Opponent"} accuracy={opp.accuracy} />
      </div>

      {/* Classification counts */}
      <div className="space-y-1.5 mb-5">
        {CLASS_ORDER.map((c) => {
          const meta = CLASS_META[c];
          return (
            <div key={c} className="grid grid-cols-[1.5rem_1fr_1.5rem] items-center text-sm">
              <span className={`text-right font-mono ${meta.color}`}>{you.counts[c] || 0}</span>
              <span className={`text-center text-xs uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
              <span className="text-left font-mono text-white/60">{opp.counts[c] || 0}</span>
            </div>
          );
        })}
      </div>

      {/* Phase grades */}
      <div className="border-t border-white/5 pt-4">
        <h3 className="text-xs uppercase tracking-wider text-white/45 font-medium mb-2">Your phase grades</h3>
        <div className="grid grid-cols-3 gap-2">
          {["opening", "middlegame", "endgame"].map((p) => {
            const g = phaseGrade(you.phaseCpl[p]);
            return (
              <div key={p} className="rounded-lg bg-white/[0.03] px-3 py-2.5 text-center">
                <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{p}</p>
                <p className={`text-sm font-semibold mt-0.5 ${g.color}`}>{g.label}</p>
                <p className="text-[0.65rem] text-white/35 font-mono mt-0.5">
                  {you.phaseCpl[p] !== null ? `${you.phaseCpl[p]!.toFixed(0)} cpl` : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccuracyCard({ label, accuracy, highlight }: { label: string; accuracy: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${highlight ? "bg-accent-500/12 border border-accent-500/25" : "bg-white/[0.03] border border-white/5"}`}>
      <p className="text-xs text-white/50 truncate">{label}</p>
      <p className="text-2xl font-bold font-mono mt-1 text-white">{accuracy.toFixed(1)}<span className="text-sm text-white/50">%</span></p>
      <p className="text-[0.7rem] text-white/40 mt-0.5"><Term id="accuracy">accuracy</Term></p>
    </div>
  );
}

function EvalGraph({
  moves,
  ply,
  onSeek,
}: {
  moves: MoveAnalysis[];
  ply: number;
  onSeek: (p: number) => void;
}) {
  const data = moves.map((m, i) => ({
    ply: i + 1,
    advantage: Math.max(-1000, Math.min(1000, m.eval_after ?? 0)) / 100,
  }));
  if (data.length === 0) return null;
  return (
    <div className="surface-card p-3">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-xs font-semibold text-white/70">Your advantage</span>
        <span className="text-[0.65rem] text-white/35">click to jump</span>
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 6, bottom: 0, left: 6 }}
          onClick={(state) => {
            if (state && typeof state.activeTooltipIndex === "number") {
              onSeek(state.activeTooltipIndex + 1);
            }
          }}
        >
          <defs>
            <linearGradient id="evalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c2ad95" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#c2ad95" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <XAxis dataKey="ply" type="number" domain={[1, data.length]} hide />
          <YAxis domain={[-8, 8]} hide />
          <ReferenceLine y={0} stroke="#33495a" strokeWidth={1} />
          {ply > 0 && <ReferenceLine x={ply} stroke="#a78368" strokeWidth={1.5} />}
          <Area
            type="monotone"
            dataKey="advantage"
            stroke="#c2ad95"
            strokeWidth={1.5}
            fill="url(#evalFill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MoveDetail({ move }: { move: MoveAnalysis }) {
  const cls = effectiveClass(move);
  const meta = CLASS_META[cls];
  const mate = involvesMate(move);
  return (
    <div className="surface-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xl font-bold font-mono ${meta.color}`}>{move.move_san}{meta.symbol}</span>
          <span className={`text-xs px-2 py-0.5 rounded-md ${meta.chip}`}>{meta.label}</span>
        </div>
        <span className="text-sm font-mono text-white/55">
          {evalToStr(move.eval_before)} → {evalToStr(move.eval_after)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {move.best_move_san && move.best_move_san !== move.move_san && (
          <Field label="Best move"><span className="text-green-400 font-mono font-semibold">{move.best_move_san}</span></Field>
        )}
        <Field label={<Term id="cpl">Centipawn loss</Term>}>
          <span className="font-mono">{mate ? "mate swing" : move.centipawn_loss.toFixed(0)}</span>
        </Field>
        <Field label="Phase"><span className="capitalize">{move.game_phase}</span></Field>
        {move.tactical_motifs && move.tactical_motifs.length > 0 && (
          <Field label="Missed tactics">
            <div className="flex gap-1.5 flex-wrap">
              {move.tactical_motifs.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-red-500/15 text-red-400 rounded-md text-xs capitalize">{t.replace("_", " ")}</span>
              ))}
            </div>
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-white/45 text-xs uppercase tracking-wider font-medium">{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function NavBtn({ onClick, disabled, label, children }: { onClick: () => void; disabled: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed btn-press"
    >
      {children}
    </button>
  );
}

function BackLink() {
  return (
    <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
      Back to games
    </Link>
  );
}

function GameReviewSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="skeleton h-4 w-28" />
      <div className="flex justify-between gap-3">
        <div className="space-y-2"><div className="skeleton h-7 w-48" /><div className="skeleton h-4 w-64" /></div>
        <div className="skeleton h-6 w-24" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 surface-card p-4"><div className="skeleton aspect-square w-full max-w-[560px] mx-auto rounded-xl" /></div>
        <div className="lg:col-span-2 surface-card p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
      </div>
    </div>
  );
}
