import type { Metadata } from "next";
import Link from "next/link";

const URL = "https://chessmaster.cyou/chess-analysis";

export const metadata: Metadata = {
  title: "Free Chess Analysis for Your Own Games",
  description:
    "Free chess analysis that goes past single games: ChessInt runs Stockfish on your full Chess.com and Lichess history, finds the weaknesses you repeat, grades your openings, and writes you an AI coaching report. Analyze your chess in the browser, free.",
  alternates: { canonical: "/chess-analysis" },
  keywords: [
    "chess analysis",
    "free chess analysis",
    "analyze chess games",
    "chess.com analysis",
    "lichess analysis",
    "chess game analyzer",
    "stockfish analysis",
  ],
  openGraph: {
    title: "Free Chess Analysis for your own games",
    description:
      "Stockfish on your whole history, the weaknesses you repeat, opening win-rates, and an AI coach — free, in the browser.",
    url: URL,
    type: "article",
  },
};

const FAQ = [
  {
    q: "Is ChessInt's chess analysis free?",
    a: "Yes. ChessInt analyzes your games with Stockfish for free, with no game cap. The engine runs locally in your browser, so there is no server queue and nothing to install.",
  },
  {
    q: "How is this different from the analysis board on Chess.com or Lichess?",
    a: "Those analyze one game at a time. ChessInt analyzes your entire history at once and looks across games — it surfaces the mistakes you repeat, the openings that quietly lose for you, how you play under time pressure, and your endgame conversion, then turns that into a coaching plan.",
  },
  {
    q: "Does it work with both Chess.com and Lichess?",
    a: "Yes. Connect a Chess.com username, a Lichess username, or both, and ChessInt imports and analyzes your games from either platform.",
  },
  {
    q: "What does the analysis actually tell me?",
    a: "Per-move engine evaluation and accuracy, your recurring weaknesses by phase and tactical motif, opening win-rates from your own games, a tilt and time-management read, rating prediction, and a written AI coach report with drills — plus tactics puzzles generated from positions you got wrong.",
  },
  {
    q: "Do I have to upload PGN files?",
    a: "No. ChessInt pulls your games automatically from your public Chess.com or Lichess profile. You can also import PGN if you want to analyze games from elsewhere.",
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

const CARDS = [
  {
    title: "Full-history engine analysis",
    body: "Stockfish evaluates every move of every game you have played — not one board at a time, but your whole record at once.",
  },
  {
    title: "The weaknesses you repeat",
    body: "ChessInt separates one-off blunders from the mistakes you make again and again, broken down by phase, motif, and opening.",
  },
  {
    title: "Opening intelligence",
    body: "Real win-rates from your own games show which lines actually score for you and which quietly cost you points.",
  },
  {
    title: "A personal AI coach",
    body: "A written report that reads like a coach who studied hundreds of your games, with concrete drills for each gap.",
  },
];

export default function ChessAnalysisPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Free chess analysis
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Chess analysis for your own games — free
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        Most chess analysis stops at one game. <strong className="text-white">ChessInt</strong>{" "}
        runs <strong className="text-white">Stockfish</strong> across your entire{" "}
        <strong className="text-white">Chess.com</strong> and{" "}
        <strong className="text-white">Lichess</strong> history and finds the
        patterns a single-game engine line never shows you: the weaknesses you
        repeat, the openings that lose for you, and the habits that cost you
        rating. Then it writes you a coaching plan. All free, all in the browser.
      </p>

      <div className="mt-8">
        <Link
          href="/register"
          className="inline-block rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
        >
          Analyze my games free
        </Link>
      </div>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        Analysis that looks across games, not just at one
      </h2>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <div key={c.title} className="surface-card p-6">
            <h3 className="font-display text-lg font-semibold text-white">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">{c.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 leading-relaxed text-gray-400">
        Want a move-by-move breakdown of a single game instead?{" "}
        <Link href="/game-review" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
          See the free game review →
        </Link>
      </p>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        How ChessInt analyzes your chess
      </h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 leading-relaxed text-gray-400 marker:text-accent-400">
        <li>Create a free account and add your Chess.com or Lichess username.</li>
        <li>ChessInt syncs your games and runs the engine over your history.</li>
        <li>
          You get per-game reviews, your recurring weaknesses, opening stats, an
          AI coach report, and puzzles built from your own mistakes.
        </li>
      </ol>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        Chess analysis — frequently asked questions
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
          Find out what&apos;s really costing you rating.
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
