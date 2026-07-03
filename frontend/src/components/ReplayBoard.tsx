"use client";

import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { Example } from "@/lib/capablancaExamples";

const DOT = "radial-gradient(circle, rgba(20,30,40,0.5) 22%, transparent 24%)";

/**
 * Steppable annotated board for the Capablanca tutorial examples. Give it an
 * Example (a start position + a list of SAN moves, each with a caption/arrows),
 * and the reader can walk forward and back through the idea. Every Example is
 * legality-checked in capablancaExamples.test.ts, so nothing broken renders.
 */
export default function ReplayBoard({ example, id }: { example: Example; id: string }) {
  const t = useTranslations("exampleCaptions");
  const getCaption = (key: string, fallback?: string) =>
    t.has(`${id}.${key}`) ? t(`${id}.${key}`) : fallback;
  const frames = useMemo(
    () => build(example, getCaption),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [example, id, t]
  );
  const [ply, setPly] = useState(0);
  const frame = frames[Math.min(ply, frames.length - 1)];
  const last = frames.length - 1;

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (frame.lastMove) {
    squareStyles[frame.lastMove.from] = { backgroundColor: "rgba(167,131,104,0.3)" };
    squareStyles[frame.lastMove.to] = { backgroundColor: "rgba(167,131,104,0.42)" };
  }
  for (const sq of frame.dots ?? []) squareStyles[sq] = { backgroundImage: DOT };

  return (
    <figure className="my-6">
      <div className="mx-auto w-full max-w-[380px]">
        <Chessboard
          options={{
            position: frame.fen,
            boardOrientation: example.orientation ?? "white",
            allowDragging: false,
            squareStyles,
            arrows: (frame.arrows ?? []).map((a) => ({
              startSquare: a.from,
              endSquare: a.to,
              color: a.color ?? "rgba(34,197,94,0.7)",
            })),
            showAnimations: true,
            animationDurationInMs: 200,
            boardStyle: { borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" },
            darkSquareStyle: { backgroundColor: "#779952" },
            lightSquareStyle: { backgroundColor: "#edeed1" },
          }}
        />
      </div>

      <div className="mx-auto mt-3 flex max-w-[380px] items-center justify-between gap-2">
        <div className="flex gap-1">
          <NavBtn icon={ChevronsLeft} label="First" onClick={() => setPly(0)} disabled={ply === 0} />
          <NavBtn icon={ChevronLeft} label="Previous" onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0} />
          <NavBtn icon={ChevronRight} label="Next" onClick={() => setPly((p) => Math.min(last, p + 1))} disabled={ply === last} />
          <NavBtn icon={ChevronsRight} label="Last" onClick={() => setPly(last)} disabled={ply === last} />
        </div>
        <span className="font-mono text-xs text-gray-500">
          {ply}/{last}
          {frame.moveLabel ? ` · ${frame.moveLabel}` : ""}
        </span>
      </div>

      {frame.caption && (
        <figcaption className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-gray-400">
          {frame.caption}
        </figcaption>
      )}
    </figure>
  );
}

type Frame = {
  fen: string;
  caption?: string;
  moveLabel?: string;
  lastMove?: { from: string; to: string };
  arrows?: { from: string; to: string; color?: string }[];
  dots?: string[];
};

function build(
  example: Example,
  getCaption: (key: string, fallback?: string) => string | undefined
): Frame[] {
  const game = example.fen ? new Chess(example.fen) : new Chess();
  const frames: Frame[] = [
    {
      fen: game.fen(),
      caption: getCaption("start", example.startCaption),
      arrows: example.startArrows,
      dots: example.startDots,
    },
  ];
  for (const [i, step] of example.steps.entries()) {
    let res;
    try {
      res = game.move(step.san);
    } catch {
      break; // guarded; examples are legality-tested
    }
    if (!res) break;
    frames.push({
      fen: game.fen(),
      caption: getCaption(String(i), step.caption),
      moveLabel: res.san,
      lastMove: { from: res.from, to: res.to },
      arrows: step.arrows,
      dots: step.dots,
    });
  }
  return frames;
}

function NavBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md border border-white/10 bg-ink-800 p-2 text-gray-300 btn-press hover:border-white/20 hover:text-white disabled:opacity-30"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
