"use client";

// Static, non-interactive board: CSS grid + SVG arrow overlay. Uses the same
// piece SVGs as react-chessboard (defaultPieces) so it matches the interactive
// board. No Chessboard instance, no dnd, no engine: cheap to render 8 at once.

import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import { defaultPieces } from "react-chessboard";
import {
  ARROW_TONES,
  BOARD_THEME,
  HIGHLIGHT_TINTS,
  type Tone,
} from "@/lib/boardTheme";

export type MoveBoardArrow = { from: string; to: string; tone: Tone };
export type MoveBoardHighlight = { square: string; tone: Tone };

type Props = {
  fen: string;
  orientation?: "white" | "black";
  arrows?: MoveBoardArrow[];
  highlights?: MoveBoardHighlight[];
  size?: "sm" | "md";
  ariaLabel: string;
  legend?: boolean;
};

const FILES = "abcdefgh";
const SIZE_PX = { sm: 200, md: 320 } as const;
const LEGEND_KEY: Partial<Record<Tone, "played" | "better" | "threat">> = {
  bad: "played",
  good: "better",
  threat: "threat",
};

/** Parses placement into rows[0] = rank 8. Returns null when invalid. */
function parsePlacement(fen: string): (string | null)[][] | null {
  const rows = (fen ?? "").trim().split(/\s+/)[0]?.split("/");
  if (!rows || rows.length !== 8) return null;
  const out: (string | null)[][] = [];
  for (const row of rows) {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) cells.push(null);
      } else if (/[pnbrqkPNBRQK]/.test(ch)) {
        cells.push(ch);
      } else return null;
    }
    if (cells.length !== 8) return null;
    out.push(cells);
  }
  return out;
}

function sideToMove(fen: string): "white" | "black" {
  return (fen ?? "").trim().split(/\s+/)[1] === "b" ? "black" : "white";
}

function squareXY(sq: string, flipped: boolean): [number, number] | null {
  const f = FILES.indexOf(sq?.[0]);
  const r = Number(sq?.[1]);
  if (f < 0 || !(r >= 1 && r <= 8)) return null;
  return flipped ? [7 - f + 0.5, r - 1 + 0.5] : [f + 0.5, 8 - r + 0.5];
}

function pieceKey(p: string): string {
  return (p === p.toUpperCase() ? "w" : "b") + p.toUpperCase();
}

function MoveBoardImpl({
  fen,
  orientation,
  arrows = [],
  highlights = [],
  size = "md",
  ariaLabel,
  legend,
}: Props) {
  const t = useTranslations("mistakeCard");
  const rows = useMemo(() => parsePlacement(fen), [fen]);
  const flipped = (orientation ?? sideToMove(fen)) === "black";

  const squares = useMemo(() => {
    const list: { sq: string; piece: string | null; light: boolean }[] = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const rank = flipped ? i : 7 - i; // 0-based rank
        const file = flipped ? 7 - j : j;
        list.push({
          sq: `${FILES[file]}${rank + 1}`,
          piece: rows ? rows[7 - rank][file] : null,
          light: (file + rank) % 2 === 1,
        });
      }
    }
    return list;
  }, [rows, flipped]);

  const tint = useMemo(() => {
    const m = new Map<string, Tone>();
    for (const h of highlights) m.set(h.square, h.tone);
    return m;
  }, [highlights]);

  const tones = useMemo(() => {
    const s = new Set<Tone>();
    for (const a of arrows) s.add(a.tone);
    return (["bad", "good", "threat"] as const).filter((x) => s.has(x));
  }, [arrows]);

  const showLegend = (legend ?? arrows.length > 0) && tones.length > 0;
  const px = SIZE_PX[size];

  return (
    <div className="inline-block max-w-full" style={{ width: px }}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative grid aspect-square w-full max-w-full grid-cols-8 overflow-hidden rounded-lg"
        style={{ width: px, maxWidth: "100%", aspectRatio: "1" }}
      >
        {squares.map(({ sq, piece, light }) => {
          const tone = tint.get(sq);
          const Piece = piece ? defaultPieces[pieceKey(piece)] : null;
          return (
            <div
              key={sq}
              data-square={sq}
              className="relative"
              style={{
                backgroundColor: light ? BOARD_THEME.light : BOARD_THEME.dark,
              }}
            >
              {tone && (
                <span
                  className="absolute inset-0"
                  style={{ backgroundColor: HIGHLIGHT_TINTS[tone] }}
                />
              )}
              {Piece && (
                <span className="absolute inset-0 block">{Piece()}</span>
              )}
            </div>
          );
        })}
        <svg
          viewBox="0 0 8 8"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {arrows.map((a, i) => {
            const p1 = squareXY(a.from, flipped);
            const p2 = squareXY(a.to, flipped);
            if (!p1 || !p2) return null;
            const [x1, y1] = p1;
            const [x2, y2] = p2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            if (len === 0) return null;
            const ux = dx / len;
            const uy = dy / len;
            const head = 0.45;
            const w = 0.14;
            const bx = x2 - ux * head;
            const by = y2 - uy * head;
            const color = ARROW_TONES[a.tone];
            return (
              <g key={i} data-arrow={a.tone} opacity={0.8} fill={color} stroke={color}>
                <line
                  x1={x1 + ux * 0.2}
                  y1={y1 + uy * 0.2}
                  x2={bx}
                  y2={by}
                  strokeWidth={w * 2}
                  strokeLinecap="round"
                />
                <polygon
                  stroke="none"
                  points={`${x2},${y2} ${bx - uy * 0.28},${by + ux * 0.28} ${bx + uy * 0.28},${by - ux * 0.28}`}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
          {tones.map((tn) => (
            <li key={tn} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ARROW_TONES[tn] }}
              />
              {t(`legend.${LEGEND_KEY[tn]}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MoveBoard = memo(MoveBoardImpl);
export default MoveBoard;
