import type { Metadata } from "next";
import Link from "next/link";
import BoardDiagram from "@/components/BoardDiagram";

const URL = "https://chessmaster.cyou/learn/chess-notation";

export const metadata: Metadata = {
  title: "How to Read Chess Notation",
  description:
    "Chess notation made simple: how squares are named, what the piece letters mean, and how to read moves like Nf3, exd5, O-O, and Qh5#. So the moves in your game review finally make sense.",
  alternates: { canonical: "/learn/chess-notation" },
  keywords: [
    "chess notation",
    "how to read chess moves",
    "what does Nf3 mean",
    "algebraic chess notation",
  ],
  openGraph: { title: "How to Read Chess Notation", url: URL, type: "article" },
};

const FAQ = [
  {
    q: "What does Nf3 mean in chess?",
    a: "N is the knight (K is already the king), and f3 is the destination square. So 'Nf3' means 'knight moves to the f3 square'. Pawns have no letter — 'e4' just means a pawn moves to e4.",
  },
  {
    q: "What does the 'x' mean in chess notation?",
    a: "An 'x' means a capture. 'Bxe5' means a bishop captures the piece on e5. For pawn captures you write the starting file, like 'exd5' (the e-pawn captures on d5).",
  },
  {
    q: "What do O-O and O-O-O mean?",
    a: "O-O is kingside castling (the short one) and O-O-O is queenside castling (the long one). A '+' after a move means check, and '#' means checkmate.",
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

export default function ChessNotation() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Beginner guide
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        How to read chess notation
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        Every move in your game review is written in a short code. Once you know
        the code, you can read any game in the world — and follow exactly what
        ChessInt is showing you.
      </p>

      <h2 className={H2}>Every square has a name</h2>
      <p className={P}>
        The board is a grid. The columns (called <strong className="text-white">files</strong>)
        are lettered <strong className="text-white">a</strong> to{" "}
        <strong className="text-white">h</strong> from left to right. The rows
        (called <strong className="text-white">ranks</strong>) are numbered{" "}
        <strong className="text-white">1</strong> to{" "}
        <strong className="text-white">8</strong> from White&rsquo;s side. Put a
        letter and a number together and you have named a square — like{" "}
        <strong className="text-white">e4</strong>, the famous centre square.
      </p>
      <BoardDiagram
        fen="8/8/8/8/4P3/8/8/8"
        from="e4"
        caption="The pawn is on e4: the e-file, the 4th rank."
      />

      <h2 className={H2}>The piece letters</h2>
      <ul className="mt-4 grid grid-cols-2 gap-2 leading-relaxed text-gray-400 sm:grid-cols-3">
        <li><strong className="text-white">K</strong> — King</li>
        <li><strong className="text-white">Q</strong> — Queen</li>
        <li><strong className="text-white">R</strong> — Rook</li>
        <li><strong className="text-white">B</strong> — Bishop</li>
        <li><strong className="text-white">N</strong> — Knight</li>
        <li><em>(none)</em> — Pawn</li>
      </ul>
      <p className={P}>
        The knight is <strong className="text-white">N</strong> because{" "}
        <strong className="text-white">K</strong> is already taken by the king.
        Pawns get no letter at all — you just write the square.
      </p>

      <h2 className={H2}>Putting it together</h2>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li><strong className="text-white">e4</strong> — a pawn moves to e4.</li>
        <li><strong className="text-white">Nf3</strong> — a knight moves to f3.</li>
        <li><strong className="text-white">Bxe5</strong> — a bishop captures on e5 (x = capture).</li>
        <li><strong className="text-white">exd5</strong> — the e-pawn captures on d5.</li>
        <li><strong className="text-white">O-O</strong> — castle kingside; <strong className="text-white">O-O-O</strong> — castle queenside.</li>
        <li><strong className="text-white">Qh5+</strong> — queen to h5, giving check (+).</li>
        <li><strong className="text-white">Qxf7#</strong> — queen captures on f7, checkmate (#).</li>
      </ul>
      <p className={P}>
        Moves come in pairs, numbered by turn: <strong className="text-white">1. e4 e5
        2. Nf3 Nc6</strong> means White played e4 and Black replied e5, then White
        played Nf3 and Black replied Nc6. That is all a game score is.
      </p>

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
          New to the game itself? Start with{" "}
          <Link href="/learn/how-to-play-chess" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            how to play chess
          </Link>
          . Confused by a term? See the{" "}
          <Link href="/learn/glossary" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            glossary
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
