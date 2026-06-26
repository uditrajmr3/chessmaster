import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About ChessInt — Chess Intelligence, and the maker",
  description:
    "ChessInt is chess intelligence for your own games: engine analysis, recurring weaknesses, and an AI coach for Lichess and Chess.com players. Built by Udit Raj.",
  alternates: { canonical: "/about" },
};

// Self-contained Person/AboutPage structured data so the About page reinforces
// the Udit Raj entity (sameAs → uditraj.site) independent of the root layout.
const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About ChessInt",
  url: "https://chessmaster.cyou/about",
  about: {
    "@type": "Person",
    name: "Udit Raj",
    url: "https://uditraj.site",
    sameAs: ["https://uditraj.site", "https://evileye.uditraj.site"],
  },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />

      <p className="font-mono text-xs tracking-[0.25em] text-accent-400 uppercase">
        Since 2026
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white">
        ChessInt — Chess Intelligence
      </h1>

      <p className="mt-6 text-gray-400 leading-relaxed">
        <strong className="text-white">ChessInt</strong> (short for{" "}
        <em>Chess Intelligence</em>) turns your real games into a clear plan for
        improvement. Connect your <strong className="text-white">Lichess</strong>{" "}
        or <strong className="text-white">Chess.com</strong> account and ChessInt
        runs full engine analysis on every game, then surfaces the patterns that
        actually cost you rating — the openings you drift in, the tactics you
        miss, the endgames you let slip, and how you play under time pressure.
      </p>

      <h2 className="font-display mt-12 text-2xl font-semibold text-white">
        What ChessInt does
      </h2>
      <ul className="mt-4 space-y-3 text-gray-400 leading-relaxed">
        <li>
          <strong className="text-white">Game analysis</strong> — Stockfish runs
          locally in your browser, so your whole history gets evaluated without
          waiting on a server queue.
        </li>
        <li>
          <strong className="text-white">Recurring weaknesses</strong> — instead
          of one-off blunders, ChessInt finds the mistakes you make again and
          again, by phase, motif, and opening.
        </li>
        <li>
          <strong className="text-white">Opening intelligence</strong> — see
          which lines win for you and which quietly lose, with real win-rates
          from your own games.
        </li>
        <li>
          <strong className="text-white">A personal AI coach</strong> — a written
          report that reads like a coach who has studied hundreds of your games,
          with concrete drills to fix each weakness.
        </li>
        <li>
          <strong className="text-white">Tactics from your mistakes</strong> —
          puzzles generated from positions you actually got wrong.
        </li>
      </ul>

      <h2 className="font-display mt-12 text-2xl font-semibold text-white">
        Who built it
      </h2>
      <p className="mt-4 text-gray-400 leading-relaxed">
        ChessInt is designed and built by{" "}
        <a
          href="https://uditraj.site"
          rel="author"
          className="text-accent-300 underline underline-offset-4 hover:text-accent-200"
        >
          Udit Raj
        </a>
        , an independent engineer and product builder. You can see more of his
        work — including{" "}
        <a
          href="https://evileye.uditraj.site"
          rel="noopener"
          className="text-accent-300 underline underline-offset-4 hover:text-accent-200"
        >
          Evil Eye
        </a>{" "}
        — over at{" "}
        <a
          href="https://uditraj.site"
          rel="author"
          className="text-accent-300 underline underline-offset-4 hover:text-accent-200"
        >
          uditraj.site
        </a>
        .
      </p>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
        >
          Get started free
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-ink-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-700"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
