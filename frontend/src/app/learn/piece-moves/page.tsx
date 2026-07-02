import type { Metadata } from "next";
import Link from "next/link";
import PieceMovesLesson from "@/components/lessons/PieceMovesLesson";

const URL = "https://chessmaster.cyou/learn/piece-moves";

export const metadata: Metadata = {
  title: "How the Chess Pieces Move (Interactive)",
  description:
    "Learn how every chess piece moves on an interactive board — pick a piece and its legal squares light up. Rook, bishop, knight, queen, king, and pawn, including how pawns capture.",
  alternates: { canonical: "/learn/piece-moves" },
  keywords: [
    "how do chess pieces move",
    "how does the knight move",
    "chess piece movement",
    "how does the pawn move",
  ],
  openGraph: { title: "How the Chess Pieces Move (Interactive)", url: URL, type: "article" },
};

export default function PieceMovesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Interactive lesson
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        How the pieces move
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        Pick a piece below and its moves light up as dots. Then drag it to a new
        square to see how its reach changes from there. The knight is the one most
        beginners find tricky — spend a moment with it.
      </p>

      <div className="mt-8 surface-card p-4 sm:p-6">
        <PieceMovesLesson />
      </div>

      <p className="mt-8 leading-relaxed text-gray-400">
        A piece captures by moving onto an enemy piece’s square (pawns are the
        exception — they capture diagonally, shown as the ringed squares). No
        piece except the knight can jump over others.
      </p>

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          Next:{" "}
          <Link href="/learn/special-moves" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            the special moves →
          </Link>
        </p>
      </div>
    </main>
  );
}
