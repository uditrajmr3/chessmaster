"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Landing() {
  const t = useTranslations("landing");
  const tc = useTranslations("common");

  const features = [1, 2, 3, 4].map((n) => ({
    title: t(`feature${n}Title`),
    body: t(`feature${n}Body`),
  }));
  const steps = [
    { n: "01", title: t("step1Title"), body: t("step1Body") },
    { n: "02", title: t("step2Title"), body: t("step2Body") },
    { n: "03", title: t("step3Title"), body: t("step3Body") },
  ];
  const faq = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`faq${n}Q`),
    a: t(`faq${n}A`),
  }));

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-5xl px-6">
        {/* Top bar: language switcher */}
        <div className="flex justify-end pt-5">
          <LanguageSwitcher />
        </div>

        {/* Hero */}
        <header className="flex flex-col items-center pt-16 pb-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="ChessInt logo" width={56} height={56} />
          <p className="font-mono mt-6 text-xs uppercase tracking-[0.3em] text-accent-400">
            {t("eyebrow")}
          </p>
          <h1 className="font-display mt-4 text-4xl font-semibold sm:text-6xl text-white">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">
            {t("heroBody")}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
            >
              {tc("getStartedFree")}
            </Link>
            <Link
              href="/about"
              className="rounded-lg border border-ink-500 px-6 py-3 text-sm font-semibold text-white hover:bg-ink-700"
            >
              {t("howItWorks")}
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            {t("explore")}{" "}
            <Link href="/game-review" className="text-accent-300 underline-offset-4 hover:underline">
              {t("exploreGameReview")}
            </Link>{" "}
            ·{" "}
            <Link href="/chess-analysis" className="text-accent-300 underline-offset-4 hover:underline">
              {t("exploreAnalysis")}
            </Link>{" "}
            ·{" "}
            <Link href="/learn" className="text-accent-300 underline-offset-4 hover:underline">
              {t("exploreLearn")}
            </Link>
          </p>
        </header>

        {/* Features */}
        <section className="grid grid-cols-1 gap-4 pb-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="surface-card p-6">
              <h2 className="font-display text-lg font-semibold text-white">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.body}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="py-20">
          <h2 className="font-display text-center text-2xl font-semibold text-white">
            {t("stepsTitle")}
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <span className="font-mono text-sm text-accent-400">{s.n}</span>
                <h3 className="font-display mt-2 text-xl font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ — also feeds FAQPage rich results and AI answers */}
        <section className="border-t border-ink-600 py-16">
          <h2 className="font-display text-center text-2xl font-semibold text-white">
            {t("faqTitle")}
          </h2>
          <div className="mx-auto mt-8 max-w-2xl space-y-4">
            {faq.map((f) => (
              <div key={f.q} className="surface-card p-5">
                <h3 className="font-display font-semibold text-white">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-ink-600 pb-28 pt-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-white">
            {t("closingTitle")}
          </h2>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-[#1a120c] hover:bg-accent-400 btn-press"
          >
            {t("closingCta")}
          </Link>
        </section>
      </div>
    </div>
  );
}
