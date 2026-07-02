import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GLOSSARY_TERMS, GLOSSARY_LONG } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "Chess & Analysis Glossary",
  description:
    "Plain-English definitions of the chess and analysis terms ChessInt uses — accuracy, CPL, centipawn, evaluation, blunder, brilliant move, tilt, and more. No prior knowledge needed.",
  alternates: { canonical: "/learn/glossary" },
  keywords: ["chess glossary", "what is CPL chess", "chess accuracy meaning", "centipawn loss"],
};

export default async function GlossaryPage() {
  const t = await getTranslations("glossary");
  const tl = await getTranslations("learn");

  const definedTermJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "ChessInt Chess & Analysis Glossary",
    url: "https://chessmaster.cyou/learn/glossary",
    hasDefinedTerm: GLOSSARY_TERMS.map((id) => {
      const short = t(`${id}.short`);
      const description = GLOSSARY_LONG.includes(id) ? `${short} ${t(`${id}.long`)}` : short;
      return {
        "@type": "DefinedTerm",
        "@id": `https://chessmaster.cyou/learn/glossary#${id}`,
        name: t(`${id}.term`),
        description,
      };
    }),
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        {tl("glossaryEyebrow")}
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        {tl("glossaryTitle")}
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        {tl("glossaryIntro")}
      </p>

      <dl className="mt-10 space-y-4">
        {GLOSSARY_TERMS.map((id) => (
          <div key={id} id={id} className="surface-card scroll-mt-20 p-5">
            <dt className="font-display font-semibold text-white">{t(`${id}.term`)}</dt>
            <dd className="mt-2 leading-relaxed text-gray-400">
              {t(`${id}.short`)}
              {GLOSSARY_LONG.includes(id) && (
                <span className="mt-2 block text-gray-500">{t(`${id}.long`)}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          {tl.rich("backToAllGuides", {
            link: (chunks) => (
              <Link href="/learn" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
