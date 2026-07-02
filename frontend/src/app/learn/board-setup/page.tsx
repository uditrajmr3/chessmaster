import type { Metadata } from "next";
import Link from "next/link";
import BoardSetupLesson from "@/components/lessons/BoardSetupLesson";

const URL = "https://chessmaster.cyou/learn/board-setup";

export const metadata: Metadata = {
  title: "How to Set Up a Chessboard (Interactive)",
  description:
    "Set up a chessboard the right way, step by step, on an interactive board you can flip and label. Learn 'white on the right' and 'queen on her colour' — then drag the pieces yourself.",
  alternates: { canonical: "/learn/board-setup" },
  keywords: [
    "how to set up a chessboard",
    "chess board setup",
    "chess starting position",
    "where do chess pieces go",
  ],
  openGraph: { title: "How to Set Up a Chessboard (Interactive)", url: URL, type: "article" },
};

const H2 = "font-display mt-12 text-2xl font-semibold text-white";
const P = "mt-4 leading-relaxed text-gray-400";

export default function BoardSetupPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Interactive lesson
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Set up the board
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        Before the first move, the board has to be set up correctly. Use the
        board below — flip it to either side, and turn the a–h / 1–8 labels on or
        off — while you follow along.
      </p>

      <div className="mt-8 surface-card p-4 sm:p-6">
        <BoardSetupLesson />
      </div>

      <h2 className={H2}>The two rules that never change</h2>
      <p className={P}>
        <strong className="text-white">White on the right.</strong> Turn the
        board so each player has a light-coloured square in their bottom-right
        corner. If the bottom-right square is dark, the board is rotated the wrong
        way.
      </p>
      <p className={P}>
        <strong className="text-white">The queen goes on her own colour.</strong>{" "}
        The white queen starts on a light square, the black queen on a dark
        square — so the two queens face each other. The king takes the square
        beside her. Get the queen right and the king follows.
      </p>

      <h2 className={H2}>Where every piece starts</h2>
      <p className={P}>
        The back row, from the corners inward: <strong className="text-white">rook,
        knight, bishop</strong>, then <strong className="text-white">queen and
        king</strong> in the middle two squares. The entire second row is filled
        with <strong className="text-white">pawns</strong>. Both armies mirror
        each other across the board.
      </p>

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          Next:{" "}
          <Link href="/learn/piece-moves" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            how each piece moves →
          </Link>
        </p>
      </div>
    </main>
  );
}
