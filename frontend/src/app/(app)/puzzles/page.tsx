"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chess, Square } from "chess.js";
import { Puzzle as PuzzleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { Puzzle, PuzzleStats } from "@/lib/types";
import { MOTIF_ID } from "@/lib/verdict";
import { PageHeader, EmptyState, Stat } from "@/components/ui/page-kit";
import TeachingBoard from "@/components/TeachingBoard";
import ResultPanel, { type PuzzleOutcome } from "./ResultPanel";
import ProgressBars, { type BarRow } from "./ProgressBars";

type PuzzleState = "loading" | "solving" | "correct" | "wrong" | "revealed" | "empty";

const PHASES = ["opening", "middlegame", "endgame"];
const MOTIFS = ["fork", "pin", "skewer", "back_rank", "discovered_attack"];
const HINT_MAX = 3; // 0 none, 1 ring the piece, 2 dot the target, 3 offer the answer

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-300";
const BTN_PRIMARY = `${BTN} bg-accent-500 text-white hover:bg-accent-400 btn-press`;
const BTN_GHOST = `${BTN} border border-white/20 text-white/85 hover:bg-white/10`;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function PuzzlesPage() {
  return (
    <Suspense fallback={null}>
      <PuzzlesPageInner />
    </Suspense>
  );
}

function PuzzlesPageInner() {
  const t = useTranslations("puzzles");
  const tm = useTranslations("mistakeCard");
  const tp = useTranslations("plain");
  const tmo = useTranslations("motif");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [state, setState] = useState<PuzzleState>("loading");
  const [streak, setStreak] = useState(0);
  const [hint, setHint] = useState(0);
  // Filters live in the URL (so links like "Practise forks" work from anywhere).
  const phaseFilter = searchParams.get("phase") ?? "";
  const motifFilter = searchParams.get("motif") ?? "";
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  // The board shows the user's move once made (the puzzle FEN is the start).
  const [displayFen, setDisplayFen] = useState<string | null>(null);

  function updateFilter(key: "phase" | "motif", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const loadPuzzle = useCallback(async () => {
    setState("loading");
    setSelectedSquare(null);
    setDisplayFen(null);
    setHint(0);
    try {
      const params: { phase?: string; motif?: string } = {};
      if (phaseFilter) params.phase = phaseFilter;
      if (motifFilter) params.motif = motifFilter;
      const data = await api.getNextPuzzle(params);
      setPuzzle(data);
      setState(data ? "solving" : "empty");
    } catch {
      setState("empty");
    }
  }, [phaseFilter, motifFilter]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getPuzzleStats();
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPuzzle();
    loadStats();
  }, [loadPuzzle, loadStats]);

  const chess = useMemo(() => (puzzle ? new Chess(puzzle.fen) : null), [puzzle]);

  const orientation: "white" | "black" = useMemo(() => {
    if (puzzle?.player_color === "white" || puzzle?.player_color === "black") return puzzle.player_color;
    return chess && chess.turn() === "b" ? "black" : "white";
  }, [puzzle, chess]);

  const bestFrom = puzzle?.best_move_uci.slice(0, 2) ?? null;
  const bestTo = puzzle?.best_move_uci.slice(2, 4) ?? null;

  function submitMove(from: string, to: string): boolean {
    if (state !== "solving" || !puzzle) return false;

    // Validate the move against the actual position before accepting it, so
    // illegal drops snap back cleanly instead of being submitted as "wrong".
    const game = new Chess(puzzle.fen);
    const isPromotion = game.get(from as Square)?.type === "p" && (to[1] === "8" || to[1] === "1");
    try {
      if (!game.move({ from, to, promotion: isPromotion ? "q" : undefined })) return false;
    } catch {
      return false;
    }

    const moveUci = from + to + (isPromotion ? "q" : "");
    setSelectedSquare(null);
    setDisplayFen(game.fen()); // reflect the move on the board immediately

    api
      .submitPuzzle(puzzle.id, moveUci)
      .then((res) => {
        setState(res.correct ? "correct" : "wrong");
        setStreak((s) => (res.correct ? s + 1 : 0));
        loadStats();
      })
      .catch((err) => {
        // Don't leave the user stuck on a silent failure: roll back and log.
        console.error("Puzzle submit failed:", err);
        setDisplayFen(null);
        setState("solving");
      });
    return true;
  }

  function handleSquareClick(square: string) {
    if (state !== "solving" || !chess) return;
    if (selectedSquare && selectedSquare !== square && submitMove(selectedSquare, square)) return;
    const own = chess.get(square as Square)?.color === chess.turn();
    setSelectedSquare(own && selectedSquare !== square ? square : null);
  }

  function showAnswer() {
    // Revealing is not an attempt: nothing is sent, so the schedule is untouched.
    setState("revealed");
    setStreak(0);
    setSelectedSquare(null);
  }

  const solving = state === "solving";
  const rings: string[] = [];
  if (solving && selectedSquare) rings.push(selectedSquare);
  if (solving && hint >= 1 && bestFrom) rings.push(bestFrom);
  const dots = solving && hint >= 2 && bestTo ? [bestTo] : [];
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (solving && selectedSquare) squareStyles[selectedSquare] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
  if (state === "correct" && bestTo) squareStyles[bestTo] = { backgroundColor: "rgba(34,197,94,0.55)" };

  const selectClass =
    "min-h-11 bg-ink-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30";

  const motifName = (m: string) => {
    const id = MOTIF_ID[m];
    return id && tmo.has(`${id}.name`) ? cap(tmo(`${id}.name`)) : cap(m.replace(/_/g, " "));
  };
  const phaseName = (p: string) => (tp.has(`phase.${p}`) ? tp(`phase.${p}`) : cap(p));

  // A deep-linked filter value must show as selected even if not in the list.
  const phaseOptions = phaseFilter && !PHASES.includes(phaseFilter) ? [...PHASES, phaseFilter] : PHASES;
  const motifOptions = motifFilter && !MOTIFS.includes(motifFilter) ? [...MOTIFS, motifFilter] : MOTIFS;

  const motifRows: BarRow[] = stats
    ? Object.entries(stats.by_motif)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, label: motifName(id), count, href: `/puzzles?motif=${encodeURIComponent(id)}` }))
    : [];
  const phaseRows: BarRow[] = stats
    ? Object.entries(stats.by_phase)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, label: phaseName(id), count, href: `/puzzles?phase=${encodeURIComponent(id)}` }))
    : [];

  const filtered = !!(phaseFilter || motifFilter);
  const caughtUp = !filtered && !!stats && stats.total_puzzles > 0;
  const answered = state === "correct" || state === "wrong" || state === "revealed";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("intro")}
        action={
          <div className="flex flex-wrap gap-2.5">
            <select
              value={phaseFilter}
              onChange={(e) => updateFilter("phase", e.target.value)}
              className={selectClass}
              aria-label={t("filters.phase")}
            >
              <option value="">{t("filters.allPhases")}</option>
              {phaseOptions.map((p) => (
                <option key={p} value={p}>
                  {phaseName(p)}
                </option>
              ))}
            </select>
            <select
              value={motifFilter}
              onChange={(e) => updateFilter("motif", e.target.value)}
              className={selectClass}
              aria-label={t("filters.motif")}
            >
              <option value="">{t("filters.allMotifs")}</option>
              {motifOptions.map((m) => (
                <option key={m} value={m}>
                  {motifName(m)}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Header strip: streak + what is waiting */}
      {((stats && stats.due_for_review > 0) || streak > 0) && (
        <div className="flex flex-wrap gap-2.5" data-testid="puzzle-strip">
          {stats && stats.due_for_review > 0 && (
            <p className="rounded-lg border border-yellow-800/50 bg-yellow-500/10 px-3 py-2 text-sm font-medium text-yellow-400">
              {t("due", { count: stats.due_for_review })}
            </p>
          )}
          {streak > 0 && (
            <p className="rounded-lg border border-green-700/50 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-400">
              {t("streak", { count: streak })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col items-center gap-4 min-w-0">
          {state === "loading" && (
            <div className="w-full max-w-[560px] aspect-square skeleton rounded-xl animate-fade-in" />
          )}

          {state === "empty" && (
            <div className="w-full max-w-[560px] surface-card">
              {caughtUp ? (
                <EmptyState icon={PuzzleIcon} title={t("allDone.title")} description={t("allDone.desc")} />
              ) : (
                <EmptyState
                  icon={PuzzleIcon}
                  title={filtered ? t("empty.filteredTitle") : t("empty.title")}
                  description={filtered ? t("empty.filteredDesc") : t("empty.desc")}
                />
              )}
            </div>
          )}

          {puzzle && state !== "loading" && state !== "empty" && (
            <>
              <p className="w-full max-w-[560px] text-sm leading-relaxed text-white/70" data-testid="puzzle-context">
                {t("context", {
                  opponent: puzzle.opponent,
                  colour: t(`colour.${orientation}`),
                })}
              </p>

              <div
                key={puzzle.id}
                className={`w-full max-w-[560px] animate-scale-in ${state === "correct" ? "rounded-xl ring-2 ring-green-500/80" : ""}`}
              >
                <TeachingBoard
                  position={displayFen ?? puzzle.fen}
                  initialOrientation={orientation}
                  allowDragging={solving}
                  onPieceDrop={(from, to) => submitMove(from, to)}
                  onSquareClick={handleSquareClick}
                  rings={rings}
                  dots={dots}
                  squareStyles={squareStyles}
                  controls={[]}
                  maxWidth={560}
                />
              </div>

              {solving && (
                <div className="w-full max-w-[560px] space-y-2">
                  <p aria-live="polite" data-testid="try-feedback" className="text-base font-semibold text-white">
                    {hint >= 2 ? tm("hintSquare") : hint === 1 ? tm("hintPiece") : tm("yourTurn")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {hint < HINT_MAX && (
                      <button type="button" className={BTN_GHOST} onClick={() => setHint((h) => Math.min(HINT_MAX, h + 1))}>
                        {tm("hint")}
                      </button>
                    )}
                    {hint >= HINT_MAX && (
                      <button type="button" className={BTN_PRIMARY} onClick={showAnswer}>
                        {tm("showAnswer")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {answered && (
                <>
                  <ResultPanel puzzle={puzzle} outcome={state as PuzzleOutcome} />
                  <button type="button" onClick={loadPuzzle} className={`${BTN_PRIMARY} px-8`}>
                    {t("result.next")}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          {/* Puzzle info panel */}
          <div className="surface-card p-5 h-fit animate-slide-in-right">
            <h3 className="text-xl font-semibold mb-4">{t("info.title")}</h3>

            {puzzle && state !== "loading" && state !== "empty" ? (
              <div className="space-y-4">
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">{t("info.phase")}</span>
                  <p className="mt-0.5">{phaseName(puzzle.game_phase)}</p>
                </div>

                {puzzle.tactical_motifs.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">{t("info.theme")}</span>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {puzzle.tactical_motifs.map((m) => (
                        <span key={m} className="px-2.5 py-1 bg-accent-500/15 text-accent-400 rounded-md text-xs font-medium">
                          {motifName(m)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {puzzle.played_at && (
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">{t("info.date")}</span>
                    <p className="text-sm mt-0.5">{new Date(puzzle.played_at).toLocaleDateString()}</p>
                  </div>
                )}

                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">{t("info.progress")}</span>
                  <p className="text-sm mt-0.5">
                    {puzzle.attempts === 0
                      ? t("info.newPuzzle")
                      : t("info.record", { successes: puzzle.successes, attempts: puzzle.attempts })}
                  </p>
                </div>
              </div>
            ) : state === "empty" ? (
              <p className="text-white/45 text-sm leading-relaxed">{t("empty.desc")}</p>
            ) : (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="skeleton h-3 w-20 mb-1.5" />
                    <div className="skeleton h-5 w-32" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats bar */}
          {stats && stats.total_puzzles > 0 && (
            <div className="grid grid-cols-2 gap-3 stagger-children">
              <Stat label={t("total")} value={stats.total_puzzles} />
              <Stat label={t("attempted")} value={stats.attempted} />
              <Stat label={t("mastered")} value={stats.mastered} />
              <Stat
                label={t("rightAnswers")}
                value={`${stats.accuracy}%`}
                valueClassName={stats.accuracy >= 70 ? "text-green-400" : stats.accuracy >= 40 ? "text-yellow-400" : "text-red-400"}
              />
            </div>
          )}

          {stats && stats.total_puzzles > 0 && (motifRows.length > 0 || phaseRows.length > 0) && (
            <div className="surface-card p-5 space-y-5" data-testid="puzzle-progress">
              <ProgressBars title={t("progress.title")} rows={motifRows} />
              <ProgressBars title={t("progress.phaseTitle")} rows={phaseRows} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
