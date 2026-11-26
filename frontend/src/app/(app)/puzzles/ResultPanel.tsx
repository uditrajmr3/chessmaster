"use client";

// What you see after a puzzle is answered: a plain verdict on the original
// mistake, a cost bucket (never centipawns), and a two-board replay.

import { useMemo } from "react";
import { Chess } from "chess.js";
import { useTranslations } from "next-intl";
import MoveBoard, { type MoveBoardArrow } from "@/components/insight/MoveBoard";
import ShowNumbers from "@/components/insight/ShowNumbers";
import Term from "@/components/Term";
import { safeVerdict, useVerdictText } from "@/components/insight/MistakeCard";
import type { MistakeInput } from "@/lib/verdict";
import type { Puzzle } from "@/lib/types";

export type PuzzleOutcome = "correct" | "wrong" | "revealed";

function colorOf(p: Puzzle): "white" | "black" {
  if (p.player_color === "white" || p.player_color === "black") return p.player_color;
  try {
    return new Chess(p.fen).turn() === "w" ? "white" : "black";
  } catch {
    return "white";
  }
}

/** UCI of the move played in the game; falls back to resolving the SAN. */
function playedUci(p: Puzzle): string | null {
  if (p.player_move_uci) return p.player_move_uci;
  try {
    const m = new Chess(p.fen).move(p.player_move_san);
    return `${m.from}${m.to}${m.promotion ?? ""}`;
  } catch {
    return null;
  }
}

const UCI = /^[a-h][1-8][a-h][1-8]/;

export function puzzleToMistake(p: Puzzle): MistakeInput {
  return {
    fen_before: p.fen,
    move_uci: playedUci(p),
    move_san: p.player_move_san,
    best_move_uci: p.best_move_uci,
    best_move_san: p.best_move_san,
    refutation_uci: p.refutation_uci,
    eval_before: p.eval_before,
    eval_after: p.eval_after,
    centipawn_loss: p.centipawn_loss,
    tactical_motifs: p.tactical_motifs,
    // Puzzles are only generated from mistakes and blunders.
    classification: "blunder",
    player_color: colorOf(p),
  };
}

function fmtEval(e: number | null | undefined, mate: string): string {
  if (e == null) return "-";
  if (Math.abs(e) >= 9000) return mate;
  return `${e > 0 ? "+" : ""}${(e / 100).toFixed(2)}`;
}

export default function ResultPanel({ puzzle, outcome }: { puzzle: Puzzle; outcome: PuzzleOutcome }) {
  const t = useTranslations("puzzles");
  const tm = useTranslations("mistakeCard");
  const tc = useTranslations("plain");
  const tmo = useTranslations("motif");
  const vText = useVerdictText();

  const input = useMemo(() => puzzleToMistake(puzzle), [puzzle]);
  const v = useMemo(() => safeVerdict(input), [input]);
  const orientation = input.player_color;

  const played = input.move_uci;
  const refutation = puzzle.refutation_uci;
  const best = puzzle.best_move_uci;

  const playedArrows: MoveBoardArrow[] = [];
  if (played && UCI.test(played)) playedArrows.push({ from: played.slice(0, 2), to: played.slice(2, 4), tone: "bad" });
  if (refutation && UCI.test(refutation))
    playedArrows.push({ from: refutation.slice(0, 2), to: refutation.slice(2, 4), tone: "threat" });
  const betterArrows: MoveBoardArrow[] =
    best && UCI.test(best) ? [{ from: best.slice(0, 2), to: best.slice(2, 4), tone: "good" }] : [];

  const primary = v ? vText(v.primaryKey, v.primaryParams) : "";
  const secondary = v?.secondaryKey ? vText(v.secondaryKey, v.secondaryParams) : "";
  const motifId = typeof v?.primaryParams.motif === "string" ? (v.primaryParams.motif as string) : null;
  const motifExplain = motifId && tmo.has(`${motifId}.explain`) ? tmo(`${motifId}.explain`) : "";

  const headline =
    outcome === "correct"
      ? t("result.correct")
      : outcome === "wrong"
        ? t("result.missed", { san: puzzle.best_move_san })
        : t("result.revealed", { san: puzzle.best_move_san });

  return (
    <section
      data-testid="puzzle-result"
      className="w-full max-w-[640px] space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 animate-scale-in"
    >
      <p
        role="status"
        className={`text-lg font-semibold leading-snug ${outcome === "correct" ? "text-green-400" : "text-white"}`}
      >
        {headline}
      </p>

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">{t("result.why")}</h3>
        {primary && <p className="mt-1 text-base font-semibold text-white">{primary}</p>}
        {secondary && <p className="mt-1 text-sm text-white/70">{secondary}</p>}
        {motifExplain && <p className="mt-1 text-xs text-white/55">{motifExplain}</p>}
        {v && (
          <span className="mt-2 inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
            {tc(`cost.${v.cost}`)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <figure className="min-w-0">
          <figcaption className="mb-2 text-sm font-semibold text-white">{t("result.youPlayed")}</figcaption>
          <MoveBoard
            fen={puzzle.fen}
            orientation={orientation}
            arrows={playedArrows}
            size="sm"
            legend
            ariaLabel={t("result.playedAria")}
          />
        </figure>
        <figure className="min-w-0">
          <figcaption className="mb-2 text-sm font-semibold text-white">{t("result.better")}</figcaption>
          <MoveBoard
            fen={puzzle.fen}
            orientation={orientation}
            arrows={betterArrows}
            size="sm"
            legend
            ariaLabel={t("result.betterAria")}
          />
        </figure>
      </div>

      <ShowNumbers>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-white/75">
          <dt className="text-white/50">{tm("played")}</dt>
          <dd>{puzzle.player_move_san}</dd>
          <dt className="text-white/50">{tm("best")}</dt>
          <dd>{puzzle.best_move_san}</dd>
          <dt className="text-white/50">
            <Term id="cpl">{tm("lossLabel")}</Term>
          </dt>
          <dd>{Math.round(puzzle.centipawn_loss)}</dd>
          <dt className="text-white/50">{tm("evalLabel")}</dt>
          <dd>
            {fmtEval(puzzle.eval_before, tm("evalMate"))} {"->"} {fmtEval(puzzle.eval_after, tm("evalMate"))}
          </dd>
        </dl>
      </ShowNumbers>
    </section>
  );
}
