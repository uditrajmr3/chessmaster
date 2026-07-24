import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

const H2 = "font-display mt-12 text-2xl font-semibold text-white";
const P = "mt-4 leading-relaxed text-gray-400";
const B = { b: (chunks: React.ReactNode) => <strong className="text-white">{chunks}</strong> };

export default async function ChessNotation({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("chessNotation");

  const faq = [1, 2, 3].map((n) => ({ q: t(`faq${n}Q`), a: t(`faq${n}A`) }));

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
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

      <h2 className={H2}>{t("squareNameHeading")}</h2>
      <p className={P}>{t.rich("squareNameBody", B)}</p>
      <BoardDiagram
        fen="8/8/8/8/4P3/8/8/8"
        from="e4"
        caption={t("squareNameDiagramCaption")}
      />

      <h2 className={H2}>{t("pieceLettersHeading")}</h2>
      <ul className="mt-4 grid grid-cols-2 gap-2 leading-relaxed text-gray-400 sm:grid-cols-3">
        <li><strong className="text-white">K</strong> — {t("pieceK")}</li>
        <li><strong className="text-white">Q</strong> — {t("pieceQ")}</li>
        <li><strong className="text-white">R</strong> — {t("pieceR")}</li>
        <li><strong className="text-white">B</strong> — {t("pieceB")}</li>
        <li><strong className="text-white">N</strong> — {t("pieceN")}</li>
        <li><em>{t("pieceNoneLabel")}</em> — {t("piecePawn")}</li>
      </ul>
      <p className={P}>{t.rich("pieceLettersBody", B)}</p>

      <h2 className={H2}>{t("puttingTogetherHeading")}</h2>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li><strong className="text-white">e4</strong> — {t("ptE4")}</li>
        <li><strong className="text-white">Nf3</strong> — {t("ptNf3")}</li>
        <li><strong className="text-white">Bxe5</strong> — {t("ptBxe5")}</li>
        <li><strong className="text-white">exd5</strong> — {t("ptExd5")}</li>
        <li>
          <strong className="text-white">O-O</strong> — {t("ptCastleKingside")}{" "}
          <strong className="text-white">O-O-O</strong> — {t("ptCastleQueenside")}
        </li>
        <li><strong className="text-white">Qh5+</strong> — {t("ptQh5")}</li>
        <li><strong className="text-white">Qxf7#</strong> — {t("ptQxf7")}</li>
      </ul>
      <p className={P}>{t.rich("ptClosing", B)}</p>

      <h2 className={H2}>{t("faqHeading")}</h2>
      <div className="mt-4 space-y-4">
        {faq.map((f) => (
          <div key={f.q} className="surface-card p-5">
            <h3 className="font-display font-semibold text-white">{f.q}</h3>
            <p className="mt-2 leading-relaxed text-gray-400">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          {t.rich("closingBody", {
            link1: (chunks) => (
              <Link href="/learn/how-to-play-chess" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
                {chunks}
              </Link>
            ),
            link2: (chunks) => (
              <Link href="/learn/glossary" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
