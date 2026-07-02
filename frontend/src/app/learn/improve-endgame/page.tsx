import type { Metadata } from "next";
import Link from "next/link";
import Term from "@/components/Term";

const URL = "https://chessmaster.cyou/learn/improve-endgame";

export const metadata: Metadata = {
  title: "How to Improve Your Endgame in Chess",
  description:
    "The endgame is the most trainable part of chess. Learn the handful of techniques that win the most points: king activity, passed pawns and the rule of the square, the basic checkmates, and king-and-pawn opposition.",
  alternates: { canonical: "/learn/improve-endgame" },
  keywords: [
    "how to improve endgame chess",
    "chess endgame basics",
    "chess endgame technique",
    "king and pawn endgame",
  ],
  openGraph: { title: "How to Improve Your Endgame in Chess", url: URL, type: "article" },
};

const FAQ = [
  {
    q: "Why should I study endgames?",
    a: "The endgame is the most trainable phase: there are only a few positions to learn, they come up again and again, and knowing them turns drawn games into wins and lost games into draws. It is the best return on study time for most players.",
  },
  {
    q: "What endgames should a beginner learn first?",
    a: "In order: how to checkmate with king and queen, then king and rook, then king-and-pawn versus king (the 'opposition'). Those three alone decide a huge share of games.",
  },
  {
    q: "What is the most important endgame principle?",
    a: "Activate your king. In the middlegame the king hides; in the endgame it becomes a fighting piece and should march toward the action. An active king is often worth a pawn.",
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

export default function ImproveEndgame() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Improve · Endgame
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        How to improve your endgame
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        If your <Term id="endgame">endgame</Term> needs work, you are in luck:
        it is the most trainable part of chess. Unlike the middlegame, there are
        only a handful of positions to learn, and they repeat for the rest of
        your chess life. A few hours here can be worth more than months of
        opening study.
      </p>

      <h2 className={H2}>1. Activate your king</h2>
      <p className={P}>
        The single most important endgame idea. With the queens off the board, the
        king is no longer in danger — it is a strong piece. March it toward the
        centre and toward the pawns. In most endgames, the player whose king joins
        the fight first wins.
      </p>

      <h2 className={H2}>2. Learn the basic checkmates cold</h2>
      <p className={P}>
        You should be able to deliver these in your sleep, with no thinking:
      </p>
      <ul className="mt-4 space-y-2 leading-relaxed text-gray-400">
        <li><strong className="text-white">King + Queen vs King</strong> — push the enemy king to the edge with your queen, then bring your king up to deliver mate. (Careful not to stalemate!)</li>
        <li><strong className="text-white">King + Rook vs King</strong> — the &ldquo;staircase&rdquo;: use king and rook together to force the lone king back rank by rank.</li>
      </ul>
      <p className={P}>
        Failing to convert these is one of the most painful ways to drop a point —
        and it is completely avoidable with a little drilling.
      </p>

      <h2 className={H2}>3. Passed pawns and the rule of the square</h2>
      <p className={P}>
        A <strong className="text-white">passed pawn</strong> — one with no enemy
        pawns able to stop it — is gold in the endgame. To check if a lone king can
        catch a runner without help, use the <strong className="text-white">rule of
        the square</strong>: imagine a square whose side is the distance from the
        pawn to its promotion rank. If the defending king can step into that
        square, it catches the pawn; if not, the pawn queens. &ldquo;Passed pawns
        must be pushed.&rdquo;
      </p>

      <h2 className={H2}>4. King and pawn vs king: the opposition</h2>
      <p className={P}>
        The most important pawn endgame. When the two kings face each other with
        one square between them, the player <em>not</em> having to move holds the{" "}
        <strong className="text-white">opposition</strong> and controls the key
        squares. Mastering the opposition decides whether a single extra pawn is a
        win or a draw — and it underlies countless real games.
      </p>

      <h2 className={H2}>5. Drill, then apply it to your games</h2>
      <p className={P}>
        Endgames stick through repetition. Practise the positions above until they
        feel automatic, then let your own games point you to what matters most. In
        ChessInt, your game review gives each game an{" "}
        <Term id="endgame">endgame</Term> grade and your{" "}
        <Link href="/endgame" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">endgame drills</Link>{" "}
        target the exact technique you fumbled. If your endgame grade is low while
        your opening is strong, this is the cheapest rating you will ever buy.
      </p>

      <div className="surface-card mt-8 p-5">
        <p className="text-sm leading-relaxed text-gray-300">
          <strong className="text-white">Start here:</strong> drill K+Q vs K and
          K+R vs K until automatic · learn the opposition in king-and-pawn endings
          · remember &ldquo;active king, push passed pawns.&rdquo; That covers most
          of what beginners lose in the endgame.
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
          See also:{" "}
          <Link href="/learn/improve-middlegame" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            how to improve your middlegame
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
