import type { Metadata } from "next";
import Link from "next/link";

const URL = "https://chessmaster.cyou/game-review";

export const metadata: Metadata = {
  title: "Free Chess Game Review for Chess.com & Lichess",
  description:
    "ChessInt's free game review classifies every move — Brilliant, Best, Mistake, Blunder — with accuracy, phase grades, an evaluation graph, and best-move arrows. A free game review for your Chess.com and Lichess games, no membership needed.",
  alternates: { canonical: "/game-review" },
  keywords: [
    "chess game review free",
    "chess.com game review free",
    "free game review",
    "chess game analyzer",
    "lichess game review",
    "move by move chess analysis",
  ],
  openGraph: {
    title: "Free Chess Game Review — every move classified",
    description:
      "Brilliant to Blunder on every move, accuracy per side, phase grades, and best-move arrows — free, for Chess.com and Lichess.",
    url: URL,
    type: "article",
  },
};

const FAQ = [
  {
    q: "Is ChessInt's game review free?",
    a: "Yes. Every move of every game is classified — Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Miss, Mistake, Blunder — with per-side accuracy and phase grades, at no cost and with no game limit. The engine runs in your browser, so there is no analysis queue.",
  },
  {
    q: "Is this the same as Chess.com's game review?",
    a: "It is a free alternative built on the same ideas. ChessInt gives you the move classifications, a game accuracy score for each side, opening/middlegame/endgame grades, an evaluation graph you can scrub, and best-move arrows — without a Chess.com Diamond membership, and for your Lichess games too.",
  },
  {
    q: "Does the game review work for Lichess games?",
    a: "Yes. Connect either a Lichess or a Chess.com username (or both) and ChessInt reviews your full history from either platform with the same move-by-move breakdown.",
  },
  {
    q: "How is move accuracy calculated?",
    a: "ChessInt converts each position's engine evaluation into a win percentage and measures how much each move dropped it, then aggregates that into a 0–100 accuracy score per side — the same win-percentage model used by modern chess accuracy metrics.",
  },
  {
    q: "Do I need a Chess.com or Lichess membership?",
    a: "No. ChessInt only needs your public username to import your games. There is nothing to install and no paid tier required to get a full game review.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const CLASSES = [
  ["Brilliant", "A strong sacrifice the engine confirms — the best move and a material give-up."],
  ["Great", "The only move that holds your position together."],
  ["Best", "You found the engine's top choice."],
  ["Excellent / Good", "Sound moves that keep your evaluation intact."],
  ["Book", "Known opening theory."],
  ["Inaccuracy", "A small slip that hands back a little ground."],
  ["Miss", "A winning tactic was on the board and you missed it."],
  ["Mistake / Blunder", "Moves that swing the evaluation against you — the ones worth studying."],
];

export default function GameReviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Free game review
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        A free chess game review for every game you play
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        <strong className="text-white">ChessInt</strong> reviews your{" "}
        <strong className="text-white">Chess.com</strong> and{" "}
        <strong className="text-white">Lichess</strong> games move by move and
        tells you exactly what each move was — from{" "}
        <span className="text-emerald-300">Brilliant</span> to{" "}
        <span className="text-rose-400">Blunder</span> — with an accuracy score
        for both sides, opening/middlegame/endgame grades, a scrubbable
        evaluation graph, and the best move drawn right on the board. It is free,
        unlimited, and needs no membership.
      </p>

      <div className="mt-8">
        <Link
          href="/register"
          className="inline-block rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
        >
          Review my games free
        </Link>
      </div>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        Every move, classified
      </h2>
      <p className="mt-3 leading-relaxed text-gray-400">
        ChessInt labels each move the way you would expect from a full game
        review, so you can see at a glance where a game turned:
      </p>
      <ul className="mt-5 space-y-3">
        {CLASSES.map(([name, desc]) => (
          <li key={name} className="surface-card p-4">
            <span className="font-display font-semibold text-white">{name}</span>
            <span className="text-gray-400"> — {desc}</span>
          </li>
        ))}
      </ul>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        More than a label on each move
      </h2>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li>
          <strong className="text-white">Accuracy per side</strong> — a single
          0–100 score for you and your opponent, built from a win-percentage
          model rather than raw centipawns.
        </li>
        <li>
          <strong className="text-white">Phase grades</strong> — separate marks
          for how you played the opening, middlegame, and endgame.
        </li>
        <li>
          <strong className="text-white">Evaluation graph</strong> — the swing
          of advantage across the whole game; click any point to jump straight
          to that move.
        </li>
        <li>
          <strong className="text-white">Best-move arrows</strong> — when you
          went wrong, the move you should have played is drawn on the board.
        </li>
        <li>
          <strong className="text-white">Repeating patterns</strong> — because
          ChessInt reviews your whole history, it also shows the mistakes you
          make again and again, not just in one game.{" "}
          <Link href="/chess-analysis" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            See full chess analysis →
          </Link>
        </li>
      </ul>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        How to get a free game review
      </h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-gray-400 marker:text-accent-400">
        <li>Create a free ChessInt account.</li>
        <li>Add your Chess.com or Lichess username in Settings.</li>
        <li>Sync your games and open any one to see its full review.</li>
      </ol>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        Game review — frequently asked questions
      </h2>
      <div className="mt-4 space-y-4">
        {FAQ.map((f) => (
          <div key={f.q} className="surface-card p-5">
            <h3 className="font-display font-semibold text-white">{f.q}</h3>
            <p className="mt-2 leading-relaxed text-gray-400">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 border-t border-ink-600 pt-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-white">
          See what every move really was.
        </h2>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
        >
          Get started free
        </Link>
      </div>
    </main>
  );
}
