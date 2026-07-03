import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Term from "@/components/Term";

const URL = "https://chessmaster.cyou/learn/improve-middlegame";

export const metadata: Metadata = {
  title: "How to Improve Your Middlegame in Chess",
  description:
    "A practical plan to improve your chess middlegame: make a plan from the pawn structure, activate your worst piece, blunder-check every move, and train the tactical patterns you keep missing.",
  alternates: { canonical: "/learn/improve-middlegame" },
  keywords: [
    "how to improve middlegame chess",
    "chess middlegame strategy",
    "chess middlegame plan",
    "get better at chess middlegame",
  ],
  openGraph: { title: "How to Improve Your Middlegame in Chess", url: URL, type: "article" },
};

const H2 = "font-display mt-12 text-2xl font-semibold text-white";
const P = "mt-4 leading-relaxed text-gray-400";
const B = { b: (chunks: React.ReactNode) => <strong className="text-white">{chunks}</strong> };
const BE = { ...B, em: (chunks: React.ReactNode) => <em>{chunks}</em> };

export default async function ImproveMiddlegame() {
  const t = await getTranslations("improveMiddlegame");
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
        {t.rich("intro", { ...B, term: (chunks) => <Term id="middlegame">{chunks}</Term> })}
      </p>

      <h2 className={H2}>{t("h1")}</h2>
      <p className={P}>{t.rich("body1", BE)}</p>

      <h2 className={H2}>{t("h2")}</h2>
      <p className={P}>{t("body2")}</p>

      <h2 className={H2}>{t("h3")}</h2>
      <p className={P}>
        {t.rich("body3", { ...B, term: (chunks) => <Term id="blunder">{chunks}</Term> })}
      </p>

      <h2 className={H2}>{t("h4")}</h2>
      <p className={P}>{t.rich("body4", BE)}</p>

      <h2 className={H2}>{t("h5")}</h2>
      <p className={P}>
        {t.rich("body5", {
          term: (chunks) => <Term id="middlegame">{chunks}</Term>,
          link: (chunks) => (
            <Link href="/weaknesses" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
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
          {t.rich("nextBody", {
            link: (chunks) => (
              <Link href="/learn/improve-endgame" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
