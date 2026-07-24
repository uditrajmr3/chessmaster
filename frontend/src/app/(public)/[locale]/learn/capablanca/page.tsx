import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  THREE_QUESTIONS,
  OPENING_RULES,
  MIDDLEGAME_RULES,
  ENDGAME_RULES,
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

const H2 = "font-display mt-14 text-2xl font-semibold text-white scroll-mt-20";
const P = "mt-4 leading-relaxed text-gray-400";

function RuleCard({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-baseline gap-3">
        <span className="rounded-md bg-accent-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-accent-300">
          {id}
        </span>
        <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-2 leading-relaxed text-gray-400">{body}</p>
    </div>
  );
}

export default async function CapablancaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("capablanca");
  const tc = await getTranslations("common");

  const gameMoves = t.raw("gameMoves") as { mv: string; note: string }[];
  const faq = [1, 2, 3, 4].map((n) => ({
    q: t(`faq${n}Q`),
    a: t(`faq${n}A`),
  }));

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
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        {t.rich("intro", { b: (chunks) => <strong className="text-white">{chunks}</strong> })}
      </p>

      <h2 className="font-display mt-12 text-2xl font-semibold text-white">
        {t("chaptersHeading")}
      </h2>
      <p className="mt-3 leading-relaxed text-gray-400">{t("chaptersIntro")}</p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { href: "/learn/capablanca/opening", n: "Chapter 1", t: t("ch1Title"), d: t("chFiveRules") },
          { href: "/learn/capablanca/middlegame", n: "Chapter 2", t: t("ch2Title"), d: t("chFiveRules") },
          { href: "/learn/capablanca/endgame", n: "Chapter 3", t: t("ch3Title"), d: t("chFiveRules") },
          { href: "/learn/capablanca/game", n: "Chapter 4", t: t("ch4Title"), d: t("ch4Desc") },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="surface-card block p-5 card-hover">
            <span className="font-mono text-xs text-accent-300">{c.n}</span>
            <h3 className="font-display mt-1 text-lg font-semibold text-white">{c.t}</h3>
            <p className="mt-1 text-sm text-gray-400">{c.d}</p>
          </Link>
        ))}
      </div>

      <nav className="mt-10 surface-card p-5 text-sm">
        <span className="font-semibold text-white">{t("quickRefTitle")}</span>
        <ul className="mt-3 grid grid-cols-1 gap-1 text-accent-300 sm:grid-cols-2">
          <li><a href="#loop" className="hover:underline">{t("quickRefLoop")}</a></li>
          <li><a href="#opening" className="hover:underline">{t("quickRefOpening")}</a></li>
          <li><a href="#middlegame" className="hover:underline">{t("quickRefMiddlegame")}</a></li>
          <li><a href="#endgame" className="hover:underline">{t("quickRefEndgame")}</a></li>
          <li><a href="#mindset" className="hover:underline">{t("quickRefMindset")}</a></li>
          <li><a href="#game" className="hover:underline">{t("quickRefGame")}</a></li>
        </ul>
      </nav>

      <h2 id="loop" className={H2}>{t("loopHeading")}</h2>
      <p className={P}>{t.rich("loopIntro", { em: (chunks) => <em>{chunks}</em> })}</p>
      <ol className="mt-4 space-y-3">
        {THREE_QUESTIONS.map((_item, i) => (
          <li key={i} className="surface-card p-5">
            <p className="font-display font-semibold text-white">
              {i + 1}. {t(`q${i + 1}.q`)}
            </p>
            <p className="mt-1.5 leading-relaxed text-gray-400">{t(`q${i + 1}.hint`)}</p>
          </li>
        ))}
      </ol>

      <h2 id="opening" className={H2}>{t("openingHeading")}</h2>
      <p className={P}>{t("openingIntro")}</p>
      <div className="mt-5 space-y-3">
        {OPENING_RULES.map((r) => (
          <RuleCard key={r.id} id={r.id} title={t(`rules.${r.id}.title`)} body={t(`rules.${r.id}.body`)} />
        ))}
      </div>

      <h2 id="middlegame" className={H2}>{t("middlegameHeading")}</h2>
      <p className={P}>{t("middlegameIntro")}</p>
      <div className="mt-5 space-y-3">
        {MIDDLEGAME_RULES.map((r) => (
          <RuleCard key={r.id} id={r.id} title={t(`rules.${r.id}.title`)} body={t(`rules.${r.id}.body`)} />
        ))}
      </div>

      <h2 id="endgame" className={H2}>{t("endgameHeading")}</h2>
      <p className={P}>{t("endgameIntro")}</p>
      <div className="mt-5 space-y-3">
        {ENDGAME_RULES.map((r) => (
          <RuleCard key={r.id} id={r.id} title={t(`rules.${r.id}.title`)} body={t(`rules.${r.id}.body`)} />
        ))}
      </div>

      <h2 id="mindset" className={H2}>{t("mindsetHeading")}</h2>
      <ul className="mt-4 space-y-3 leading-relaxed text-gray-400">
        {[1, 2, 3, 4].map((n) => (
          <li key={n}>
            <strong className="text-white">{t(`mindset${n}Title`)}</strong>{" "}
            {t(`mindset${n}Body`)}
          </li>
        ))}
      </ul>

      <h2 id="game" className={H2}>{t("gameHeading")}</h2>
      <p className={P}>{t("gameIntro")}</p>
      <div className="mt-5 space-y-2">
        {gameMoves.map((g) => (
          <div key={g.mv} className="surface-card flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
            <span className="shrink-0 font-mono text-sm font-semibold text-accent-300 sm:w-36">
              {g.mv}
            </span>
            <span className="text-sm leading-relaxed text-gray-400">{g.note}</span>
          </div>
        ))}
      </div>

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
        <h2 className="font-display text-2xl font-semibold text-white">{t("closingTitle")}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-400">{t("closingBody")}</p>
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
