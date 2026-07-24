import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

const H2 = "font-display mt-12 text-2xl font-semibold text-white scroll-mt-20";
const P = "mt-4 leading-relaxed text-gray-400";
const B = { b: (chunks: React.ReactNode) => <strong className="text-white">{chunks}</strong> };
const BE = { ...B, em: (chunks: React.ReactNode) => <em>{chunks}</em> };

export default async function HowToPlayChess({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howToPlay");
  const tc = await getTranslations("common");

  const faq = [1, 2, 3, 4].map((n) => ({ q: t(`faq${n}Q`), a: t(`faq${n}A`) }));

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
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        {t("eyebrow")}
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        {t("title")}
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">{t("intro")}</p>

      <nav className="mt-8 surface-card p-5 text-sm">
        <span className="font-semibold text-white">{t("onThisPage")}</span>
        <ul className="mt-3 grid grid-cols-1 gap-1 text-accent-300 sm:grid-cols-2">
          <li><a href="#setup" className="hover:underline">{t("toc1")}</a></li>
          <li><a href="#pieces" className="hover:underline">{t("toc2")}</a></li>
          <li><a href="#check" className="hover:underline">{t("toc3")}</a></li>
          <li><a href="#special" className="hover:underline">{t("toc4")}</a></li>
          <li><a href="#draw" className="hover:underline">{t("toc5")}</a></li>
          <li><a href="#next" className="hover:underline">{t("toc6")}</a></li>
        </ul>
      </nav>

      <h2 id="setup" className={H2}>{t("setupTitle")}</h2>
      <p className={P}>{t.rich("setupBody", B)}</p>
      <BoardDiagram
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
        caption={t("setupDiagramCaption")}
      />

      <h2 id="pieces" className={H2}>{t("piecesTitle")}</h2>
      <p className={P}>{t("piecesBody")}</p>

      <h3 className="font-display mt-8 text-xl font-semibold text-white">{t("rookTitle")}</h3>
      <p className={P}>{t("rookBody")}</p>
      <BoardDiagram
        fen="8/8/8/8/3R4/8/8/8"
        from="d4"
        dots={["d1", "d2", "d3", "d5", "d6", "d7", "d8", "a4", "b4", "c4", "e4", "f4", "g4", "h4"]}
        caption={t("rookDiagramCaption")}
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">{t("bishopTitle")}</h3>
      <p className={P}>{t("bishopBody")}</p>
      <BoardDiagram
        fen="8/8/8/8/3B4/8/8/8"
        from="d4"
        dots={["a1", "b2", "c3", "e5", "f6", "g7", "h8", "a7", "b6", "c5", "e3", "f2", "g1"]}
        caption={t("bishopDiagramCaption")}
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">{t("queenTitle")}</h3>
      <p className={P}>{t.rich("queenBody", BE)}</p>
      <BoardDiagram
        fen="8/8/8/8/3Q4/8/8/8"
        from="d4"
        dots={[
          "d1","d2","d3","d5","d6","d7","d8","a4","b4","c4","e4","f4","g4","h4",
          "a1","b2","c3","e5","f6","g7","h8","a7","b6","c5","e3","f2","g1",
        ]}
        caption={t("queenDiagramCaption")}
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">{t("knightTitle")}</h3>
      <p className={P}>{t.rich("knightBody", B)}</p>
      <BoardDiagram
        fen="8/8/8/8/3N4/8/8/8"
        from="d4"
        dots={["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"]}
        caption={t("knightDiagramCaption")}
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">{t("kingTitle")}</h3>
      <p className={P}>{t("kingBody")}</p>
      <BoardDiagram
        fen="8/8/8/8/3K4/8/8/8"
        from="d4"
        dots={["c3", "c4", "c5", "d3", "d5", "e3", "e4", "e5"]}
        caption={t("kingDiagramCaption")}
      />

      <h3 className="font-display mt-8 text-xl font-semibold text-white">{t("pawnTitle")}</h3>
      <p className={P}>{t.rich("pawnBody", B)}</p>
      <BoardDiagram
        fen="8/8/8/8/8/8/4P3/8"
        from="e2"
        dots={["e3", "e4"]}
        caption={t("pawnDiagramCaption")}
      />

      <h2 id="check" className={H2}>{t("checkTitle")}</h2>
      <p className={P}>{t.rich("checkBody", BE)}</p>

      <h2 id="special" className={H2}>{t("specialTitle")}</h2>
      <p className={P}>{t("specialIntro")}</p>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li>
          <strong className="text-white">{t("castlingLabel")}</strong>{" "}
          {t.rich("castlingBody", { term: () => <Term id="book">O-O</Term> })}
        </li>
        <li>
          <strong className="text-white">{t("enPassantLabel")}</strong> {t("enPassantBody")}
        </li>
        <li>
          <strong className="text-white">{t("promotionLabel")}</strong> {t("promotionBody")}
        </li>
      </ul>

      <h2 id="draw" className={H2}>{t("drawTitle")}</h2>
      <p className={P}>{t.rich("drawBody", BE)}</p>

      <h2 id="next" className={H2}>{t("nextTitle")}</h2>
      <p className={P}>{t("nextBody")}</p>
      <ul className="mt-4 space-y-2 leading-relaxed text-gray-400">
        <li>
          {t.rich("nextItem1", {
            link: (chunks) => (
              <Link href="/learn/chess-notation" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
                {chunks}
              </Link>
            ),
          })}
        </li>
        <li>
          {t.rich("nextItem2", {
            link: (chunks) => (
              <Link href="/learn/glossary" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
                {chunks}
              </Link>
            ),
          })}
        </li>
      </ul>

      <h2 className={H2}>{t("faqHeading")}</h2>
      <div className="mt-4 space-y-4">
        {faq.map((f) => (
          <div key={f.q} className="surface-card p-5">
            <h3 className="font-display font-semibold text-white">{f.q}</h3>
            <p className="mt-2 leading-relaxed text-gray-400">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 border-t border-ink-600 pt-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-white">
          {t("closingTitle")}
        </h2>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
        >
          {tc("getStartedFree")}
        </Link>
      </div>
    </main>
  );
}
