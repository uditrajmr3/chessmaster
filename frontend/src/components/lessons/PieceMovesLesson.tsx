"use client";

import { useState } from "react";
import TeachingBoard from "@/components/TeachingBoard";
import { pieceMoves, singlePieceFen, type PieceType } from "@/lib/teaching";

type PieceDef = {
  t: PieceType;
  char: string;
  label: string;
  home: string;
  caption: string;
};

const PIECES: PieceDef[] = [
  { t: "k", char: "K", label: "King", home: "d4", caption: "The king moves one square in any direction. He’s the most important piece — protect him." },
  { t: "q", char: "Q", label: "Queen", home: "d4", caption: "The queen is the most powerful piece: she moves any number of squares in a straight line or diagonally." },
  { t: "r", char: "R", label: "Rook", home: "d4", caption: "The rook moves in straight lines — any number of squares up, down, or across." },
  { t: "b", char: "B", label: "Bishop", home: "d4", caption: "The bishop moves diagonally, any distance. Each bishop stays on one colour the whole game." },
  { t: "n", char: "N", label: "Knight", home: "d4", caption: "The knight jumps in an L: two squares one way, then one at a right angle. It’s the only piece that leaps over others." },
  { t: "p", char: "P", label: "Pawn", home: "d2", caption: "Pawns move straight forward — two squares on their first move — but capture diagonally onto the ringed squares. They never move backward." },
];

export default function PieceMovesLesson() {
  const [idx, setIdx] = useState(2); // rook — simplest to read first
  const [square, setSquare] = useState(PIECES[2].home);

  const piece = PIECES[idx];
  const fen = singlePieceFen(piece.char, square);
  const { dots, rings } = pieceMoves(piece.t, square, "w");

  function select(i: number) {
    setIdx(i);
    setSquare(PIECES[i].home);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap justify-center gap-2">
        {PIECES.map((p, i) => (
          <button
            key={p.t}
            type="button"
            onClick={() => select(i)}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium btn-press transition-colors ${
              i === idx
                ? "border-accent-500/40 bg-accent-500/15 text-accent-300"
                : "border-white/10 bg-ink-800 text-gray-300 hover:border-white/20 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <TeachingBoard
        position={fen}
        dots={dots}
        rings={rings}
        allowDragging
        onPieceDrop={(_from, to) => {
          setSquare(to);
          return true;
        }}
        controls={["flip", "coords"]}
        caption={
          <>
            {piece.caption}
            <span className="mt-1 block text-gray-500">
              Drag the {piece.label.toLowerCase()} to a new square to see where it can go from there.
            </span>
          </>
        }
      />
    </div>
  );
}
