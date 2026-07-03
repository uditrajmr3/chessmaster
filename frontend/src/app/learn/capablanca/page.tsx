import type { Metadata } from "next";
import Link from "next/link";
import {
  THREE_QUESTIONS,
  OPENING_RULES,
  MIDDLEGAME_RULES,
  ENDGAME_RULES,
  type Rule,
} from "@/lib/capablanca";

const URL = "https://chessmaster.cyou/learn/capablanca";

export const metadata: Metadata = {
  title: "Play Like Capablanca — a Positional System for Beginners",
  description:
    "A simple, complete positional chess system based on world champion José Raúl Capablanca: fifteen rules for the opening, middlegame, and endgame, plus the three-question loop that stops you blundering. Built for improving players.",
  alternates: { canonical: "/learn/capablanca" },
  keywords: [
    "capablanca method",
    "positional chess for beginners",
    "chess principles",
    "how to stop blundering in chess",
    "chess strategy rules",
  ],
  openGraph: {
    title: "Play Like Capablanca — a Positional System for Beginners",
    url: URL,
    type: "article",
  },
};

const FAQ = [
  {
    q: "Who was Capablanca?",
    a: "José Raúl Capablanca (1888–1942) was the third World Chess Champion and is widely regarded as the greatest natural talent in the game's history. He was famous for winning 'equal' positions through pure technique — Magnus Carlsen has named him a major inspiration.",
  },
  {
    q: "Do I need to memorise openings to play this way?",
    a: "No. Capablanca deliberately avoided opening theory. He played natural developing moves and trusted a small set of positional rules. This system is about principles you apply every move, not lines you memorise.",
  },
  {
    q: "How does this help me stop blundering?",
    a: "The core habit is asking 'what did my opponent just threaten?' before every move. Most losses aren't failures of calculation — they're moments of inattention where a threat was missed. Making that question automatic prevents the majority of tactical losses.",
  },
  {
    q: "Is this suitable for beginners?",
    a: "Yes — it's arguably the best system for beginners, because it replaces guesswork with a clear procedure: deal with threats, activate your worst piece, keep intruders out, and choose a simple plan.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "Play Like Capablanca — a Positional System for Beginners",
      description:
        "A complete positional chess system based on Capablanca: rules for every phase plus the three-question loop.",
      author: { "@type": "Person", name: "Udit Raj", url: "https://uditraj.site" },
      publisher: { "@type": "Organization", name: "ChessInt", url: "https://chessmaster.cyou" },
      mainEntityOfPage: URL,
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

const H2 = "font-display mt-14 text-2xl font-semibold text-white scroll-mt-20";
const P = "mt-4 leading-relaxed text-gray-400";

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-baseline gap-3">
        <span className="rounded-md bg-accent-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-accent-300">
          {rule.id}
        </span>
        <h3 className="font-display text-lg font-semibold text-white">{rule.title}</h3>
      </div>
      <p className="mt-2 leading-relaxed text-gray-400">{rule.body}</p>
    </div>
  );
}

const GAME = [
  ["1. e4 e5", "An open game — Capablanca was comfortable in any structure."],
  ["2. Nf3 Nc6", "Both sides develop a knight toward the centre first (O-1)."],
  ["3. Bb5 a6", "The Ruy López. Black challenges the bishop straight away."],
  ["4. Ba4 Nf6", "Everyone keeps developing — nobody wastes a move (O-5)."],
  ["5. O-O Be7", "Capablanca castles as early as he can (O-4)."],
  ["6. Re1", "The rook takes the e-file — every piece gets a job (O-1)."],
  ["17. Nd5!", "A knight lands on an outpost it can never be kicked off (M-1)."],
  ["19. Bxb6!", "A break that works only because every white piece was already ideal (M-4)."],
  ["27. Re7", "In the endgame the rook invades the 7th rank (E-2)."],
  ["29. Ke2–d3–c4", "The king marches to the centre to escort the passed pawn (E-1)."],
  ["30. c5–c6–c7", "The passed pawn rolls, rook behind it the whole way (E-3). Black resigns."],
];

export default function CapablancaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Strategy · The Capablanca method
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Play like Capablanca
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        José Raúl Capablanca won by <strong className="text-white">radical
        simplicity</strong>. He avoided opening theory, disliked long
        calculation, and almost never blundered. His secret was a small set of
        positional rules, applied consistently — build a position where all your
        pieces are active and your opponent&rsquo;s are passive, and the tactics
        appear on their own. Here is that whole system, for improving players.
      </p>

      <h2 className="font-display mt-12 text-2xl font-semibold text-white">
        Work through it, with interactive boards
      </h2>
      <p className="mt-3 leading-relaxed text-gray-400">
        Each phase is a chapter you can step through move by move on a live board.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { href: "/learn/capablanca/opening", n: "Chapter 1", t: "The opening", d: "Five rules, each on a live board." },
          { href: "/learn/capablanca/middlegame", n: "Chapter 2", t: "The middlegame", d: "Five rules, each on a live board." },
          { href: "/learn/capablanca/endgame", n: "Chapter 3", t: "The endgame", d: "Five rules, each on a live board." },
          { href: "/learn/capablanca/game", n: "Chapter 4", t: "A complete game", d: "The whole method in one steppable model game." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="surface-card block p-5 card-hover">
            <span className="font-mono text-xs text-accent-300">{c.n}</span>
            <h3 className="font-display mt-1 text-lg font-semibold text-white">{c.t}</h3>
            <p className="mt-1 text-sm text-gray-400">{c.d}</p>
          </Link>
        ))}
      </div>

      <nav className="mt-10 surface-card p-5 text-sm">
        <span className="font-semibold text-white">Quick reference on this page</span>
        <ul className="mt-3 grid grid-cols-1 gap-1 text-accent-300 sm:grid-cols-2">
          <li><a href="#loop" className="hover:underline">The three-question loop</a></li>
          <li><a href="#opening" className="hover:underline">Opening rules</a></li>
          <li><a href="#middlegame" className="hover:underline">Middlegame rules</a></li>
          <li><a href="#endgame" className="hover:underline">Endgame rules</a></li>
          <li><a href="#mindset" className="hover:underline">The mindset</a></li>
          <li><a href="#game" className="hover:underline">A complete game</a></li>
        </ul>
      </nav>

      <h2 id="loop" className={H2}>The three-question loop</h2>
      <p className={P}>
        This is the habit that drives everything. Before <em>every</em> move, in
        any phase, ask these three questions in order:
      </p>
      <ol className="mt-4 space-y-3">
        {THREE_QUESTIONS.map((item, i) => (
          <li key={i} className="surface-card p-5">
            <p className="font-display font-semibold text-white">
              {i + 1}. {item.q}
            </p>
            <p className="mt-1.5 leading-relaxed text-gray-400">{item.hint}</p>
          </li>
        ))}
      </ol>

      <h2 id="opening" className={H2}>Opening rules</h2>
      <p className={P}>
        Capablanca didn&rsquo;t memorise openings — he followed five principles
        and trusted his understanding for the rest.
      </p>
      <div className="mt-5 space-y-3">
        {OPENING_RULES.map((r) => <RuleCard key={r.id} rule={r} />)}
      </div>

      <h2 id="middlegame" className={H2}>Middlegame rules</h2>
      <p className={P}>
        The middlegame is where his method shone: keep improving your pieces
        until the position becomes overwhelming, and let tactics follow.
      </p>
      <div className="mt-5 space-y-3">
        {MIDDLEGAME_RULES.map((r) => <RuleCard key={r.id} rule={r} />)}
      </div>

      <h2 id="endgame" className={H2}>Endgame rules</h2>
      <p className={P}>
        Endgames are simpler than they look: win a weak pawn and promote one of
        your own. Five rules do most of the work.
      </p>
      <div className="mt-5 space-y-3">
        {ENDGAME_RULES.map((r) => <RuleCard key={r.id} rule={r} />)}
      </div>

      <h2 id="mindset" className={H2}>The mindset</h2>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li>
          <strong className="text-white">Simplicity over complexity.</strong>{" "}
          Consistent good play with no blunders beats occasional brilliance with
          occasional disasters. Choose the clear move over the flashy one.
        </li>
        <li>
          <strong className="text-white">Trade when your pieces are better.</strong>{" "}
          Swapping into an endgame where your pieces are more active is how a
          positional edge becomes a win. Trading while passive is the mistake.
        </li>
        <li>
          <strong className="text-white">Patience is a weapon.</strong> When
          there&rsquo;s nothing better, improve your least-active piece by one
          square and ask again next move. Quiet pressure makes opponents crack.
        </li>
        <li>
          <strong className="text-white">Never stop asking about threats.</strong>{" "}
          The question that prevents the loss is the one you actually ask. Make it
          automatic.
        </li>
      </ul>

      <h2 id="game" className={H2}>A complete game: Capablanca vs. Bernstein, 1914</h2>
      <p className={P}>
        Every rule above appears in this one 36-move masterpiece — develop
        everything, plant a knight on an outpost, break through only when
        dominant, then convert with king and passed pawn.
      </p>
      <div className="mt-5 space-y-2">
        {GAME.map(([mv, note]) => (
          <div key={mv} className="surface-card flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
            <span className="shrink-0 font-mono text-sm font-semibold text-accent-300 sm:w-36">
              {mv}
            </span>
            <span className="text-sm leading-relaxed text-gray-400">{note}</span>
          </div>
        ))}
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

      <div className="mt-14 border-t border-ink-600 pt-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-white">
          See these rules in your own games.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">
          ChessInt reviews every game you play and shows exactly where a threat
          was missed or a piece sat idle — the Capablanca rules, applied to you.
        </p>
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
