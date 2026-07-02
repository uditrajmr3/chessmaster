import type { Metadata } from "next";
import Link from "next/link";
import Term from "@/components/Term";

const URL = "https://chessmaster.cyou/learn/improve-middlegame";

export const metadata: Metadata = {
  title: "How to Improve Your Middlegame in Chess",
  description:
    "A practical plan to improve your chess middlegame: make a plan from the pawn structure, activate your worst piece, blunder-check every move, and train the tactical patterns you keep missing.",
  alternates: { canonical: "/learn/improve-middlegame" },
  keywords: [
    "how to improve middlegame chess",
    "chess middlegame strategy",
    "chess middlegame plan",
    "get better at chess middlegame",
  ],
  openGraph: { title: "How to Improve Your Middlegame in Chess", url: URL, type: "article" },
};

const FAQ = [
  {
    q: "Why is the middlegame so hard?",
    a: "The opening has known theory and the endgame has known techniques, but the middlegame has the most possibilities and the fewest rules to lean on. That is exactly why a clear thinking routine — plan, candidate moves, blunder-check — helps so much.",
  },
  {
    q: "How do I stop blundering in the middlegame?",
    a: "Before every move, do a quick safety check: 'If I play this, what does my opponent attack?' Look for their checks, captures, and threats first. Most middlegame points are lost to one-move oversights, not deep strategy.",
  },
  {
    q: "What should I study to improve my middlegame?",
    a: "Daily tactics (pattern recognition), a little on common pawn structures, and — most useful of all — reviewing your own middlegames to find the mistakes you repeat.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const H2 = "font-display mt-12 text-2xl font-semibold text-white";
const P = "mt-4 leading-relaxed text-gray-400";

export default function ImproveMiddlegame() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Improve · Middlegame
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        How to improve your middlegame
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        The <Term id="middlegame">middlegame</Term> is where most games are
        decided — and where most rating is lost. The good news: you don&rsquo;t
        need to memorise anything. You need a <strong className="text-white">repeatable
        way of thinking</strong> and a habit of fixing the same leaks. Here is a
        plan you can actually follow.
      </p>

      <h2 className={H2}>1. Always have a plan (read the pawns)</h2>
      <p className={P}>
        Aimless moves are the most common middlegame mistake. Before you look for
        a move, ask <em>what the position wants</em>. The pawn structure usually
        tells you: open files belong to your rooks, a hole in your
        opponent&rsquo;s camp wants a knight, a pawn majority on one side wants to
        advance. A modest plan followed consistently beats brilliant moves chosen
        at random.
      </p>

      <h2 className={H2}>2. Improve your worst-placed piece</h2>
      <p className={P}>
        When you don&rsquo;t know what to do, find your least active piece and
        make it better. A bishop staring at its own pawns, a rook doing nothing
        on its starting square — fix that. Strong players are relentless about
        getting every piece working.
      </p>

      <h2 className={H2}>3. Blunder-check every single move</h2>
      <p className={P}>
        This one habit is worth more rating than any opening line. Before you
        commit, ask: <strong className="text-white">&ldquo;If I play this, what
        can my opponent do to me?&rdquo;</strong> Scan their checks, captures, and
        threats. A <Term id="blunder">blunder</Term> — hanging a piece, missing a
        fork — undoes thirty good moves in one. Slowing down for a five-second
        safety check is the highest-return change most players can make.
      </p>

      <h2 className={H2}>4. Train the patterns you keep missing</h2>
      <p className={P}>
        Middlegame tactics — forks, pins, skewers, discovered attacks — are
        pattern recognition. You get them by seeing them over and over. A few
        tactics puzzles a day, every day, beats a long session once a week. The
        most efficient puzzles are the ones drawn from positions{" "}
        <em>you actually got wrong</em>, because those target your real gaps.
      </p>

      <h2 className={H2}>5. Use your own games as the syllabus</h2>
      <p className={P}>
        Generic advice only goes so far. Your games tell you exactly which of the
        above to prioritise. In ChessInt, open a game&rsquo;s review and look at
        the <Term id="middlegame">middlegame</Term> grade and the moves marked as
        mistakes — then check your <Link href="/weaknesses" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">recurring weaknesses</Link>{" "}
        to see the pattern across many games. If &ldquo;missed fork&rdquo; keeps
        appearing, you know what to drill this week.
      </p>

      <div className="surface-card mt-8 p-5">
        <p className="text-sm leading-relaxed text-gray-300">
          <strong className="text-white">A simple weekly routine:</strong> 10
          minutes of tactics daily · review every game you lose, focusing on the
          first move ChessInt marks as a mistake · pick one recurring weakness and
          make beating it your goal for the week.
        </p>
      </div>

      <h2 className={H2}>Frequently asked questions</h2>
      <div className="mt-4 space-y-4">
        {FAQ.map((f) => (
          <div key={f.q} className="surface-card p-5">
            <h3 className="font-display font-semibold text-white">{f.q}</h3>
            <p className="mt-2 leading-relaxed text-gray-400">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          Next, the most trainable phase of all:{" "}
          <Link href="/learn/improve-endgame" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            how to improve your endgame →
          </Link>
        </p>
      </div>
    </main>
  );
}
