"use client";

import { useState, type ElementType } from "react";
import { Chessboard } from "react-chessboard";
import { RotateCw, Hash, RefreshCw } from "lucide-react";

export type TBArrow = { startSquare: string; endSquare: string; color?: string };

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const DOT =
  "radial-gradient(circle, rgba(20,30,40,0.5) 22%, transparent 24%)";
const RING =
  "radial-gradient(circle, transparent 60%, rgba(20,30,40,0.5) 62%, rgba(20,30,40,0.5) 80%, transparent 82%)";

type Orientation = "white" | "black";

/**
 * Interactive teaching board used across the /learn interactive lessons.
 * Presentational + owns flip and coordinate-label toggles; each lesson drives
 * the position, highlighted squares, arrows, and drag/click behaviour.
 */
export default function TeachingBoard({
  position,
  initialOrientation = "white",
  initialCoords = false,
  dots = [],
  rings = [],
  squareStyles = {},
  arrows = [],
  allowDragging = false,
  onPieceDrop,
  onSquareClick,
  onReset,
  controls = ["flip", "coords"],
  caption,
  footer,
  maxWidth = 520,
}: {
  position: string;
  initialOrientation?: Orientation;
  initialCoords?: boolean;
  dots?: string[];
  rings?: string[];
  squareStyles?: Record<string, React.CSSProperties>;
  arrows?: TBArrow[];
  allowDragging?: boolean;
  onPieceDrop?: (from: string, to: string, pieceType: string) => boolean;
  onSquareClick?: (square: string) => void;
  onReset?: () => void;
  controls?: ("flip" | "coords" | "reset")[];
  caption?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}) {
  const [orientation, setOrientation] = useState<Orientation>(initialOrientation);
  const [coords, setCoords] = useState(initialCoords);

  const styles: Record<string, React.CSSProperties> = { ...squareStyles };
  for (const sq of dots) styles[sq] = { ...styles[sq], backgroundImage: DOT };
  for (const sq of rings) styles[sq] = { ...styles[sq], backgroundImage: RING };

  const fileLabels = orientation === "white" ? FILES : [...FILES].reverse();
  const rankLabels =
    orientation === "white"
      ? [8, 7, 6, 5, 4, 3, 2, 1]
      : [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full" style={{ maxWidth }}>
        <div className="flex">
          {coords && (
            <div className="mr-1 flex w-4 flex-col py-[2px] text-[0.7rem] font-semibold text-gray-500">
              {rankLabels.map((r) => (
                <span key={r} className="flex flex-1 items-center justify-center">
                  {r}
                </span>
              ))}
            </div>
          )}
          <div className="relative flex-1">
            <Chessboard
              options={{
                position,
                boardOrientation: orientation,
                allowDragging,
                onPieceDrop: onPieceDrop
                  ? ({ sourceSquare, targetSquare, piece }) =>
                      targetSquare
                        ? onPieceDrop(sourceSquare, targetSquare, piece.pieceType)
                        : false
                  : undefined,
                onSquareClick: onSquareClick
                  ? ({ square }) => square && onSquareClick(square)
                  : undefined,
                squareStyles: styles,
                arrows: arrows.map((a) => ({
                  ...a,
                  color: a.color ?? "rgba(167,131,104,0.8)",
                })),
                showAnimations: true,
                animationDurationInMs: 250,
                boardStyle: {
                  borderRadius: "10px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                },
                darkSquareStyle: { backgroundColor: "#779952" },
                lightSquareStyle: { backgroundColor: "#edeed1" },
              }}
            />
          </div>
        </div>
        {coords && (
          <div className="mt-1 flex text-[0.7rem] font-semibold text-gray-500" style={{ paddingLeft: "1.25rem" }}>
            {fileLabels.map((f) => (
              <span key={f} className="flex-1 text-center">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {caption && (
        <p className="max-w-md text-center text-sm leading-relaxed text-gray-400">
          {caption}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {controls.includes("flip") && (
          <ControlBtn
            icon={RotateCw}
            label="Flip board"
            onClick={() =>
              setOrientation((o) => (o === "white" ? "black" : "white"))
            }
          />
        )}
        {controls.includes("coords") && (
          <ControlBtn
            icon={Hash}
            label={coords ? "Hide labels" : "Show labels"}
            active={coords}
            onClick={() => setCoords((c) => !c)}
          />
        )}
        {controls.includes("reset") && onReset && (
          <ControlBtn icon={RefreshCw} label="Reset" onClick={onReset} />
        )}
        {footer}
      </div>
    </div>
  );
}

function ControlBtn({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium btn-press transition-colors ${
        active
          ? "border-accent-500/40 bg-accent-500/15 text-accent-300"
          : "border-white/10 bg-ink-800 text-gray-300 hover:border-white/20 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
