import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

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

function GuideCard({
  href,
  title,
  body,
  readLabel,
}: {
  href: string;
  title: string;
  body: string;
  readLabel: string;
}) {
  return (
    <Link href={href} className="surface-card block p-6 card-hover">
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">{body}</p>
      <span className="mt-3 inline-block text-sm text-accent-300">{readLabel}</span>
    </Link>
  );
}

export default async function LearnPage() {
  const t = await getTranslations("learn");
  const tc = await getTranslations("common");
  const readLabel = t("readGuide");

  const interactive = [
    { href: "/learn/board-setup", title: t("boardSetupTitle"), body: t("boardSetupBody") },
    { href: "/learn/piece-moves", title: t("pieceMovesTitle"), body: t("pieceMovesBody") },
    { href: "/learn/special-moves", title: t("specialMovesTitle"), body: t("specialMovesBody") },
  ];
  const basics = [
    { href: "/learn/how-to-play-chess", title: t("howToPlayTitle"), body: t("howToPlayBody") },
    { href: "/learn/chess-notation", title: t("notationTitle"), body: t("notationBody") },
    { href: "/learn/glossary", title: t("glossaryCardTitle"), body: t("glossaryCardBody") },
  ];
  const improve = [
    { href: "/learn/improve-middlegame", title: t("middlegameTitle"), body: t("middlegameBody") },
    { href: "/learn/improve-endgame", title: t("endgameTitle"), body: t("endgameBody") },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        {t("eyebrow")}
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        {t("hubTitle")}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        {t("hubIntro")}
      </p>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        {t("interactiveLessons")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
        {t("interactiveIntro")}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {interactive.map((g) => (
          <GuideCard key={g.href} {...g} readLabel={readLabel} />
        ))}
      </div>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        {t("startScratch")}
      </h2>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {basics.map((g) => (
          <GuideCard key={g.href} {...g} readLabel={readLabel} />
        ))}
      </div>

      <h2 className="font-display mt-14 text-2xl font-semibold text-white">
        {t("improveWith")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
        {t("improveIntro")}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {improve.map((g) => (
          <GuideCard key={g.href} {...g} readLabel={readLabel} />
        ))}
      </div>

      <div className="mt-14 border-t border-ink-600 pt-10 text-center">
        <h2 className="font-display text-2xl font-semibold text-white">
          {t("hubCtaTitle")}
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
