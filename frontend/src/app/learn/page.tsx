import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Learn Chess — from your first move to fixing your weaknesses",
  description:
    "Free chess lessons for complete beginners and improving players. Learn how to set up the board, how every piece moves, the rules, how to read notation — then how to actually improve your middlegame and endgame with ChessInt.",
  alternates: { canonical: "/learn" },
  keywords: [
    "learn chess",
    "how to play chess",
    "chess for beginners",
    "chess lessons free",
    "improve at chess",
  ],
};

const BASICS = [
  {
    href: "/learn/how-to-play-chess",
    title: "How to play chess (from zero)",
    body: "Never played before? Set up the board the right way, learn how each piece moves, and understand check, checkmate, and the special moves — with diagrams.",
  },
  {
    href: "/learn/chess-notation",
    title: "How to read chess notation",
    body: "What 'Nf3' and 'O-O' mean, so the moves in your game review actually make sense.",
  },
  {
    href: "/learn/glossary",
    title: "Chess & analysis glossary",
    body: "Plain-English definitions of every term ChessInt uses — accuracy, CPL, blunder, eval, and more.",
  },
];

const IMPROVE = [
  {
    href: "/learn/improve-middlegame",
    title: "How to improve your middlegame",
    body: "The stage where most games are decided. A practical plan for better plans, tactics, and decisions in the thick of the game.",
  },
  {
    href: "/learn/improve-endgame",
    title: "How to improve your endgame",
    body: "The most trainable part of chess. Learn the handful of endgames that win the most points — and how to convert a winning position.",
  },
];

function GuideCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="surface-card block p-6 card-hover">
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">{body}</p>
      <span className="mt-3 inline-block text-sm text-accent-300">Read the guide →</span>
    </Link>
  );
}

export default function LearnPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Learn chess
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Your chess coach, from the very first move
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        Whether you have never touched a chessboard or you already play and want
        to climb, start here. These guides are written to be read and used — no
        jargon without an explanation, and every term links to a plain-English
        definition.
      </p>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        Start from scratch
      </h2>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {BASICS.map((g) => (
          <GuideCard key={g.href} {...g} />
        ))}
      </div>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        Improve with ChessInt
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
        ChessInt tells you <em>where</em> you lose rating — your weakest phase,
        your repeated mistakes. These guides tell you <em>what to do about it</em>.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {IMPROVE.map((g) => (
          <GuideCard key={g.href} {...g} />
        ))}
      </div>

      <div className="mt-14 border-t border-ink-600 pt-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-white">
          Ready to see your own games analysed?
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
