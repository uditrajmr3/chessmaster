import type { Metadata } from "next";
import Link from "next/link";
import ReplayBoard from "@/components/ReplayBoard";
import { EXAMPLES } from "@/lib/capablancaExamples";

export const metadata: Metadata = {
  title: "A Complete Game in Capablanca's Style — Interactive",
  description:
    "Step through a full model game showing the Capablanca method end to end: develop everything, castle early, reroute a knight to a strong square, and take the centre with patient, purposeful play.",
  alternates: { canonical: "/learn/capablanca/game" },
  keywords: ["capablanca game", "positional chess model game", "how to play a chess game plan"],
};

export default function GameChapter() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        The Capablanca method · A complete game
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        A complete game, move by move
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        Here is the whole method in one short game — an{" "}
        <em>illustrative model game</em> (not a specific historical one), chosen
        so every move is either developing a piece or improving one. Step through
        it and watch a quiet position turn into a strong one, with no tactics
        forced and nothing left on the back rank.
      </p>

      <div className="mt-6 surface-card p-4 sm:p-6">
        <ReplayBoard example={EXAMPLES.game} />
      </div>

      <h2 className="font-display mt-12 text-2xl font-semibold text-white">What to notice</h2>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li><strong className="text-white">Every piece got a job first (O-1)</strong> — knights and bishops out before any plan.</li>
        <li><strong className="text-white">The king was tucked away early (O-4)</strong> — castling before the position opened.</li>
        <li><strong className="text-white">The worst piece was improved (M-1)</strong> — the d2-knight rerouted f1–g3, aiming at f5, instead of sitting passively.</li>
        <li><strong className="text-white">The payoff came last</strong> — only once every piece was active did White strike in the centre with d4. Patience, then the break.</li>
      </ul>

      <div className="mt-14 flex items-center justify-between border-t border-ink-600 pt-8 text-sm">
        <Link href="/learn/capablanca/endgame" className="text-accent-300 hover:text-accent-200">
          ← The endgame
        </Link>
        <Link href="/learn/capablanca" className="text-accent-300 hover:text-accent-200">
          Overview →
        </Link>
      </div>
    </main>
  );
}
