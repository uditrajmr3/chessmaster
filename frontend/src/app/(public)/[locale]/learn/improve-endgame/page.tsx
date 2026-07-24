import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

const H2 = "font-display mt-12 text-2xl font-semibold text-white";
const P = "mt-4 leading-relaxed text-gray-400";
const B = { b: (chunks: React.ReactNode) => <strong className="text-white">{chunks}</strong> };
const BE = { ...B, em: (chunks: React.ReactNode) => <em>{chunks}</em> };

export default async function ImproveEndgame({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("improveEndgame");
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
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        {t.rich("intro", { term: (chunks) => <Term id="endgame">{chunks}</Term> })}
      </p>

      <h2 className={H2}>{t("h1")}</h2>
      <p className={P}>{t("body1")}</p>

      <h2 className={H2}>{t("h2")}</h2>
      <p className={P}>{t("body2Intro")}</p>
      <ul className="mt-4 space-y-2 leading-relaxed text-gray-400">
        <li><strong className="text-white">{t("kqLabel")}</strong> {t("kqBody")}</li>
        <li><strong className="text-white">{t("krLabel")}</strong> {t("krBody")}</li>
      </ul>
      <p className={P}>{t("body2Closing")}</p>

      <h2 className={H2}>{t("h3")}</h2>
      <p className={P}>{t.rich("body3", B)}</p>

      <h2 className={H2}>{t("h4")}</h2>
      <p className={P}>{t.rich("body4", BE)}</p>

      <h2 className={H2}>{t("h5")}</h2>
      <p className={P}>
        {t.rich("body5", {
          term: (chunks) => <Term id="endgame">{chunks}</Term>,
          link: (chunks) => (
            <Link href="/endgame" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <div className="surface-card mt-8 p-5">
        <p className="text-sm leading-relaxed text-gray-300">
          <strong className="text-white">{t("routineTitle")}</strong> {t("routineBody")}
        </p>
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

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          {t.rich("seeAlsoBody", {
            link: (chunks) => (
              <Link href="/learn/improve-middlegame" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
