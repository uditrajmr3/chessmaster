"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import TeachingBoard from "@/components/TeachingBoard";

type Ply = { from: string; to: string; promotion?: "q"; caption: string };
type Demo = { key: string; label: string; start: string; intro: string; plies: Ply[] };

const DEMOS: Demo[] = [
  {
    key: "castling",
    label: "Castling",
    start: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    intro:
      "White can castle kingside (written O-O): the king and the h1-rook have not moved yet, and the squares between them are empty and safe.",
    plies: [
      {
        from: "e1",
        to: "g1",
        caption:
          "The king slides two squares toward the rook, and the rook hops over to its other side. In one move your king is tucked safely into the corner.",
      },
    ],
  },
  {
    key: "enpassant",
    label: "En passant",
    start: "rnbqkbnr/ppppp1pp/8/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
    intro:
      "Black has just pushed the f-pawn two squares (f7–f5), landing right beside White’s pawn on e5. For this one move only, White may capture it ‘in passing’.",
    plies: [
      {
        from: "e5",
        to: "f6",
        caption:
          "White plays exf6 — capturing as if the black pawn had only moved one square. The pawn that ran past is removed. Miss the chance now and it’s gone.",
      },
    ],
  },
  {
    key: "promotion",
    label: "Promotion",
    start: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    intro:
      "This white pawn is one step from the far end of the board. When a pawn reaches the last rank, it must become a new piece — almost always a queen.",
    plies: [
      {
        from: "a7",
        to: "a8",
        promotion: "q",
        caption:
          "a8=Q! The humble pawn transforms into a queen — the most powerful piece. This is why passed pawns are so dangerous in the endgame.",
      },
    ],
  },
];

export default function SpecialMovesLesson() {
  const [demoKey, setDemoKey] = useState(DEMOS[0].key);
  const [step, setStep] = useState(0);

  const demo = DEMOS.find((d) => d.key === demoKey)!;

  const game = new Chess(demo.start);
  let caption = demo.intro;
  let last: { from: string; to: string } | null = null;
  for (let i = 0; i < step; i++) {
    const p = demo.plies[i];
    try {
      game.move({ from: p.from, to: p.to, promotion: p.promotion });
    } catch {
      break;
    }
    if (i === step - 1) {
      caption = p.caption;
      last = { from: p.from, to: p.to };
    }
  }

  const styles: Record<string, React.CSSProperties> = {};
  if (last) {
    styles[last.from] = { backgroundColor: "rgba(255,213,79,0.42)" };
    styles[last.to] = { backgroundColor: "rgba(255,213,79,0.55)" };
  }

  const atEnd = step >= demo.plies.length;

  function choose(key: string) {
    setDemoKey(key);
    setStep(0);
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap justify-center gap-2">
        {DEMOS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => choose(d.key)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium btn-press transition-colors ${
              d.key === demoKey
                ? "border-accent-500/40 bg-accent-500/15 text-accent-300"
                : "border-white/10 bg-ink-800 text-gray-300 hover:border-white/20 hover:text-white"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <TeachingBoard
        position={game.fen()}
        squareStyles={styles}
        controls={["flip", "coords"]}
        caption={caption}
        footer={
          <>
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-gray-300 btn-press transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {atEnd ? (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm font-medium text-gray-300 btn-press transition-colors hover:border-white/20 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" /> Replay
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(demo.plies.length, s + 1))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-[#1a120c] btn-press hover:bg-accent-400"
              >
                Play the move <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </>
        }
      />
    </div>
  );
}
