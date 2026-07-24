import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ReplayBoard from "@/components/ReplayBoard";
import { EXAMPLES } from "@/lib/capablancaExamples";

export const metadata: Metadata = {
  title: "A Complete Game in Capablanca's Style — Interactive",
  description:
    "Step through a full model game showing the Capablanca method end to end: develop everything, castle early, reroute a knight to a strong square, and take the centre with patient, purposeful play.",
  alternates: { canonical: "/learn/capablanca/game" },
  keywords: ["capablanca game", "positional chess model game", "how to play a chess game plan"],
};

export default async function GameChapter({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("capablanca");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        {t("gameEyebrow")}
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        {t("gameChTitle")}
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        {t.rich("gameChIntro", { em: (chunks) => <em>{chunks}</em> })}
      </p>

      <div className="mt-6 surface-card p-4 sm:p-6">
        <ReplayBoard example={EXAMPLES.game} id="game" />
      </div>

      <h2 className="font-display mt-12 text-2xl font-semibold text-white">{t("gameChNoticeTitle")}</h2>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        <li>{t.rich("gameChNotice1", { b: (chunks) => <strong className="text-white">{chunks}</strong> })}</li>
        <li>{t.rich("gameChNotice2", { b: (chunks) => <strong className="text-white">{chunks}</strong> })}</li>
        <li>{t.rich("gameChNotice3", { b: (chunks) => <strong className="text-white">{chunks}</strong> })}</li>
        <li>{t.rich("gameChNotice4", { b: (chunks) => <strong className="text-white">{chunks}</strong> })}</li>
      </ul>

      <div className="mt-14 flex items-center justify-between border-t border-ink-600 pt-8 text-sm">
        <Link href="/learn/capablanca/endgame" className="text-accent-300 hover:text-accent-200">
          ← {t("ch3Title")}
        </Link>
        <Link href="/learn/capablanca" className="text-accent-300 hover:text-accent-200">
          {t("toOverview")} →
        </Link>
      </div>
    </main>
  );
}
