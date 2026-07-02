import type { Metadata } from "next";
import Link from "next/link";
import BoardDiagram from "@/components/BoardDiagram";
import Term from "@/components/Term";

const URL = "https://chessmaster.cyou/learn/how-to-play-chess";

export const metadata: Metadata = {
  title: "How to Play Chess — a Complete Beginner's Guide",
  description:
    "Learn chess from absolute zero: how to set up the board, how every piece moves (with diagrams), check and checkmate, castling, en passant, and promotion. No experience needed.",
  alternates: { canonical: "/learn/how-to-play-chess" },
  keywords: [
    "how to play chess",
    "chess rules for beginners",
    "how do chess pieces move",
    "how to set up a chessboard",
    "chess for beginners",
  ],
  openGraph: {
    title: "How to Play Chess — a Complete Beginner's Guide",
    description:
      "Set up the board, learn how every piece moves, and understand check, checkmate, and the special moves — with diagrams.",
    url: URL,
    type: "article",
  },
};

const FAQ = [
  {
    q: "Is chess hard to learn?",
    a: "The rules of chess take about 20 minutes to learn — how the pieces move and how to win. Getting good takes longer, but you can play a full game the same day you learn. This guide covers everything you need to start.",
  },
  {
    q: "Which colour goes first in chess?",
    a: "White always moves first, then players alternate turns. You must move on your turn — you can never skip.",
  },
  {
    q: "How do you win at chess?",
    a: "You win by checkmate: attacking the opponent's king so that it cannot escape capture on the next move. The king is never actually captured — the game ends the moment escape is impossible.",
  },
  {
    q: "What is the easiest piece to learn?",
    a: "The rook moves in straight lines and the bishop moves diagonally — both are simple. The knight, which jumps in an L-shape, is the one most beginners find tricky at first.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: "How to Play Chess — a Complete Beginner's Guide",
      description:
        "Learn chess from zero: board setup, how every piece moves, check, checkmate, and the special moves.",
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

const H2 = "font-display mt-12 text-2xl font-semibold text-white scroll-mt-20";
const P = "mt-4 leading-relaxed text-gray-400";

export default function HowToPlayChess() {
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
        How to play chess
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        If you have never played a single game, you are in the right place. By
        the end of this page you will know how to set up the board, how every
        piece moves, and how to win. It really does only take a few minutes.
      </p>

      <nav className="mt-8 surface-card p-5 text-sm">
        <span className="font-semibold text-white">On this page</span>
        <ul className="mt-3 grid grid-cols-1 gap-1 text-accent-300 sm:grid-cols-2">
          <li><a href="#setup" className="hover:underline">1. Setting up the board</a></li>
          <li><a href="#pieces" className="hover:underline">2. How the pieces move</a></li>
          <li><a href="#check" className="hover:underline">3. Check &amp; checkmate</a></li>
          <li><a href="#special" className="hover:underline">4. Special moves</a></li>
          <li><a href="#draw" className="hover:underline">5. Draws</a></li>
          <li><a href="#next" className="hover:underline">6. What to do next</a></li>
        </ul>
      </nav>

      <h2 id="setup" className={H2}>1. Setting up the board</h2>
      <p className={P}>
        Place the board so that each player has a{" "}
        <strong className="text-white">light square in the bottom-right</strong>{" "}
        corner — &ldquo;white on the right.&rdquo; The pieces line up on the two
        rows nearest each player. Rooks go in the corners, then knights, then
        bishops, then the queen and king in the middle. The easy rule for the
        royals: the <strong className="text-white">queen goes on her own
        colour</strong> (the white queen on a light square, the black queen on a
        dark square), and the king takes the square beside her.
      </p>
      <BoardDiagram
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
        caption="The starting position. White moves first."
      />

      <h2 id="pieces" className={H2}>2. How the pieces move</h2>
      <p className={P}>
        Each type of piece moves in its own way. In every diagram below, the dots
        show where that piece could move from the middle of an empty board. A
        piece (except the knight) cannot jump over others, and it captures by
        landing on an enemy piece&rsquo;s square.
      </p>

      <h3 className="font-display mt-8 text-xl font-semibold text-white">The rook</h3>
      <p className={P}>
        The rook moves in straight lines — any number of squares up, down, left,
        or right.
      </p>
      <BoardDiagram
        fen="8/8/8/8/3R4/8/8/8"
        from="d4"
        dots={["d1", "d2", "d3", "d5", "d6", "d7", "d8", "a4", "b4", "c4", "e4", "f4", "g4", "h4"]}
        caption="A rook on d4 controls its whole row and column."
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">The bishop</h3>
      <p className={P}>
        The bishop moves diagonally, any number of squares. Each bishop stays on
        one colour for the entire game.
      </p>
      <BoardDiagram
        fen="8/8/8/8/3B4/8/8/8"
        from="d4"
        dots={["a1", "b2", "c3", "e5", "f6", "g7", "h8", "a7", "b6", "c5", "e3", "f2", "g1"]}
        caption="A bishop on d4 slides along both diagonals."
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">The queen</h3>
      <p className={P}>
        The queen is the most powerful piece: she combines the rook and bishop,
        moving any number of squares in a straight line <em>or</em> diagonally.
      </p>
      <BoardDiagram
        fen="8/8/8/8/3Q4/8/8/8"
        from="d4"
        dots={[
          "d1","d2","d3","d5","d6","d7","d8","a4","b4","c4","e4","f4","g4","h4",
          "a1","b2","c3","e5","f6","g7","h8","a7","b6","c5","e3","f2","g1",
        ]}
        caption="The queen: straight lines and diagonals together."
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">The knight</h3>
      <p className={P}>
        The knight moves in an <strong className="text-white">L-shape</strong>:
        two squares one way, then one square at a right angle. It is the only
        piece that can <strong className="text-white">jump over</strong> other
        pieces. This is the move beginners find strangest — so take a moment with
        the diagram.
      </p>
      <BoardDiagram
        fen="8/8/8/8/3N4/8/8/8"
        from="d4"
        dots={["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"]}
        caption="A knight on d4 reaches eight squares, all an L away."
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">The king</h3>
      <p className={P}>
        The king moves one square in any direction. He is the most important
        piece — if he is trapped, the game is over — so he moves carefully.
      </p>
      <BoardDiagram
        fen="8/8/8/8/3K4/8/8/8"
        from="d4"
        dots={["c3", "c4", "c5", "d3", "d5", "e3", "e4", "e5"]}
        caption="The king: one step at a time, in any direction."
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">The pawn</h3>
      <p className={P}>
        Pawns are unusual. They move <strong className="text-white">straight
        forward</strong> one square (or two squares on their very first move),
        but they <strong className="text-white">capture diagonally</strong> — one
        square forward-left or forward-right. Pawns never move backward.
      </p>
      <BoardDiagram
        fen="8/8/8/8/8/8/4P3/8"
        from="e2"
        dots={["e3", "e4"]}
        caption="A pawn on e2 can step to e3 or, on its first move, e4."
      />

      <h2 id="check" className={H2}>3. Check &amp; checkmate</h2>
      <p className={P}>
        When a king is under attack, it is in{" "}
        <strong className="text-white">check</strong>. You must respond
        immediately — move the king to safety, block the attack, or capture the
        attacking piece. If there is <em>no</em> legal way to escape the attack,
        it is <strong className="text-white">checkmate</strong> and the game ends.
        That is how you win: not by capturing the king, but by leaving it with
        nowhere to go.
      </p>

      <h2 id="special" className={H2}>4. Special moves</h2>
      <p className={P}>
        Three moves surprise new players:
      </p>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li>
          <strong className="text-white">Castling</strong> — once per game, if
          neither the king nor a rook has moved and the squares between them are
          empty, the king slides two squares toward the rook and the rook hops to
          the king&rsquo;s other side. It tucks your king into safety. You may
          have seen it written as <Term id="book">O-O</Term>.
        </li>
        <li>
          <strong className="text-white">En passant</strong> — a special pawn
          capture: if an enemy pawn dashes two squares forward and lands right
          beside your pawn, you may capture it as if it had only moved one square
          — but only on the very next turn.
        </li>
        <li>
          <strong className="text-white">Promotion</strong> — if one of your
          pawns reaches the far end of the board, it transforms into any piece
          you choose (almost always a queen). A humble pawn can become your most
          powerful piece.
        </li>
      </ul>

      <h2 id="draw" className={H2}>5. Draws — when nobody wins</h2>
      <p className={P}>
        Not every game ends in a win. The most common surprise is{" "}
        <strong className="text-white">stalemate</strong>: if the player to move
        has no legal move but is <em>not</em> in check, the game is a draw — even
        if they have far less material. Games are also drawn by agreement, by
        repeating the same position three times, or when there are too few pieces
        left to checkmate.
      </p>

      <h2 id="next" className={H2}>6. What to do next</h2>
      <p className={P}>
        That is the whole rulebook. The fastest way to improve from here is to
        play, then look back at what happened — which is exactly what ChessInt
        does for you. Two good next steps:
      </p>
      <ul className="mt-4 space-y-2 leading-relaxed text-gray-400">
        <li>
          Learn to read the moves in a game with{" "}
          <Link href="/learn/chess-notation" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            how to read chess notation
          </Link>.
        </li>
        <li>
          When a term confuses you, the{" "}
          <Link href="/learn/glossary" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            glossary
          </Link>{" "}
          explains it in one sentence.
        </li>
      </ul>

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
          Played a few games? See what you can improve.
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
