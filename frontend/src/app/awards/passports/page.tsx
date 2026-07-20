import type { Metadata } from "next";
import { AwardGrid } from "@/components/awards/AwardGrid";
import { getCatalog } from "@/lib/awards/catalog";

const URL = "https://chessmaster.cyou/awards/passports";

export const metadata: Metadata = {
  title: "Chess.com Passport Awards — every country and how to earn it",
  description:
    "Track Chess.com passport awards for every ISO-3166 country: play one opponent based there to earn it. See which countries you've already played.",
  alternates: { canonical: "/awards/passports" },
  openGraph: {
    title: "Chess.com Passport Awards",
    description: "Every ISO-3166 country passport, tracked against who you've actually played.",
    url: URL,
    type: "website",
  },
};

export default function PassportsPage() {
  const catalog = getCatalog("passports");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Awards", item: "https://chessmaster.cyou/awards" },
          { "@type": "ListItem", position: 2, name: "Passports", item: URL },
        ],
      },
      {
        "@type": "ItemList",
        name: "Chess.com passport countries",
        numberOfItems: catalog.length,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Awards / Passports
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Chess.com Passports
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        Chess.com grants a passport for every country you play an opponent from. There is no
        official published list, so this tracks the {catalog.length}-country ISO-3166-1
        standard as the approximate target set. Chess.com also grants passports for a few
        sub-regions outside that standard — such as the Basque Country and Catalonia — which
        have no ISO country code and are therefore not tracked here.
      </p>

      <div className="mt-10">
        <AwardGrid catalog={catalog} />
      </div>
    </main>
  );
}
