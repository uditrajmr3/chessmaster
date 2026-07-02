import type { Metadata } from "next";
import Link from "next/link";
import SpecialMovesLesson from "@/components/lessons/SpecialMovesLesson";

const URL = "https://chessmaster.cyou/learn/special-moves";

export const metadata: Metadata = {
  title: "Castling, En Passant & Promotion — Special Chess Moves (Interactive)",
  description:
    "The three special chess moves that surprise beginners — castling, en passant, and pawn promotion — shown step by step on an interactive board. Press play and watch each one happen.",
  alternates: { canonical: "/learn/special-moves" },
  keywords: [
    "castling chess",
    "en passant",
    "pawn promotion",
    "special chess moves",
    "how does castling work",
  ],
  openGraph: {
    title: "Castling, En Passant & Promotion — Special Chess Moves",
    url: URL,
    type: "article",
  },
};

export default function SpecialMovesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Interactive lesson
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Special moves
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        Three moves trip up almost every beginner. Pick one, read the setup, then
        press <span className="text-white">Play the move</span> to watch it
        happen — and flip the board to see it from either side.
      </p>

      <div className="mt-8 surface-card p-4 sm:p-6">
        <SpecialMovesLesson />
      </div>

      <p className="mt-8 leading-relaxed text-gray-400">
        <strong className="text-white">Castling</strong> tucks your king to
        safety once per game. <strong className="text-white">En passant</strong>{" "}
        is a one-time pawn capture available only on the very next move.{" "}
        <strong className="text-white">Promotion</strong> turns a pawn that
        reaches the far side into any piece you choose.
      </p>

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          Back to{" "}
          <Link href="/learn" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            all lessons
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
