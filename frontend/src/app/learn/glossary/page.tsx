import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "Chess & Analysis Glossary",
  description:
    "Plain-English definitions of the chess and analysis terms ChessInt uses — accuracy, CPL, centipawn, evaluation, blunder, brilliant move, tilt, and more. No prior knowledge needed.",
  alternates: { canonical: "/learn/glossary" },
  keywords: ["chess glossary", "what is CPL chess", "chess accuracy meaning", "centipawn loss"],
};

const entries = Object.entries(GLOSSARY).sort((a, b) =>
  a[1].term.localeCompare(b[1].term)
);

const definedTermJsonLd = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "ChessInt Chess & Analysis Glossary",
  url: "https://chessmaster.cyou/learn/glossary",
  hasDefinedTerm: entries.map(([key, e]) => ({
    "@type": "DefinedTerm",
    "@id": `https://chessmaster.cyou/learn/glossary#${key}`,
    name: e.term,
    description: e.long ? `${e.short} ${e.long}` : e.short,
  })),
};

export default function GlossaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermJsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Reference
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Chess &amp; analysis glossary
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-gray-400">
        Every term ChessInt uses, explained in plain English. If a word in your
        report or game review ever stops you, it is defined here.
      </p>

      <dl className="mt-10 space-y-4">
        {entries.map(([key, e]) => (
          <div key={key} id={key} className="surface-card scroll-mt-20 p-5">
            <dt className="font-display font-semibold text-white">{e.term}</dt>
            <dd className="mt-2 leading-relaxed text-gray-400">
              {e.short}
              {e.long && <span className="mt-2 block text-gray-500">{e.long}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-14 border-t border-ink-600 pt-10">
        <p className="text-gray-400">
          Back to{" "}
          <Link href="/learn" className="text-accent-300 underline underline-offset-4 hover:text-accent-200">
            all guides
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
