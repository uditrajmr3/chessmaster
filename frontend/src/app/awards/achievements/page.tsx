import type { Metadata } from "next";
import { AwardGrid } from "@/components/awards/AwardGrid";
import { getCatalog } from "@/lib/awards/catalog";

const URL = "https://chessmaster.cyou/awards/achievements";

export const metadata: Metadata = {
  title: "Chess.com Achievements List — every achievement and how to earn it",
  description:
    "Every Chess.com achievement we could verify across community sources, with provenance on each one and a guide to earning it.",
  alternates: { canonical: "/awards/achievements" },
  openGraph: {
    title: "Chess.com Achievements List",
    description: "Every verifiable Chess.com achievement, with a guide to earning each one.",
    url: URL,
    type: "website",
  },
};

export default function AchievementsPage() {
  const catalog = getCatalog("achievements");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Awards", item: "https://chessmaster.cyou/awards" },
          { "@type": "ListItem", position: 2, name: "Achievements", item: URL },
        ],
      },
      {
        "@type": "ItemList",
        name: "Chess.com achievements",
        numberOfItems: catalog.length,
        itemListElement: catalog.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: a.name,
          url: `${URL}/${a.slug}`,
        })),
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
        Awards / Achievements
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Chess.com Achievements
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        {catalog.length} achievements, cross-referenced across independent community guides.
        Every card is tagged with where it came from — nothing here is invented.
      </p>

      <div className="mt-10">
        <AwardGrid catalog={catalog} basePath="/awards/achievements" />
      </div>
    </main>
  );
}
