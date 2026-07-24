import type { Metadata } from "next";
import AwardsHub from "@/components/awards/AwardsHub";
import { getCatalog } from "@/lib/awards/catalog";
import { setRequestLocale } from "next-intl/server";

const URL = "https://chessmaster.cyou/awards";

export const metadata: Metadata = {
  title: "Chess.com Awards Tracker — see which awards you've earned",
  description:
    "Scan your Chess.com username to see which achievements, opening books, and country passports you've earned, which you haven't, and exactly how to earn the rest.",
  alternates: { canonical: "/awards" },
  keywords: [
    "chess.com awards",
    "chess.com achievements list",
    "chess.com achievements tracker",
    "chess.com passport awards",
    "chess.com books unlock",
  ],
  openGraph: {
    title: "Chess.com Awards Tracker",
    description:
      "See which Chess.com achievements, books, and passports you've earned — and exactly how to earn the rest.",
    url: URL,
    type: "website",
  },
};

export default async function AwardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const achievementsCount = getCatalog("achievements").length;
  const booksCount = getCatalog("books").length;
  const passportsCount = getCatalog("passports").length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ChessInt", item: "https://chessmaster.cyou/" },
          { "@type": "ListItem", position: 2, name: "Awards", item: URL },
        ],
      },
      {
        "@type": "ItemList",
        name: "Chess.com award categories",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Achievements", url: `${URL}/achievements` },
          { "@type": "ListItem", position: 2, name: "Books", url: `${URL}/books` },
          { "@type": "ListItem", position: 3, name: "Passports", url: `${URL}/passports` },
          { "@type": "ListItem", position: 4, name: "Badges", url: `${URL}/badges` },
          { "@type": "ListItem", position: 5, name: "Cheers", url: `${URL}/cheers` },
          { "@type": "ListItem", position: 6, name: "Medals", url: `${URL}/medals` },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-400">
        Free · No account needed
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Chess.com Awards Tracker
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        Enter your Chess.com username to see which of the {achievementsCount} achievements,{" "}
        {booksCount} opening books, and {passportsCount} country passports you&apos;ve already
        earned — and exactly how to earn the rest.
      </p>

      <div className="mt-10">
        <AwardsHub />
      </div>
    </main>
  );
}
