import type { Metadata } from "next";
import { AwardGrid } from "@/components/awards/AwardGrid";
import { getCatalog } from "@/lib/awards/catalog";
import { setRequestLocale } from "next-intl/server";

const URL = "https://chessmaster.cyou/awards/books";

export const metadata: Metadata = {
  title: "Chess.com Opening Books — all 33 and how to unlock them",
  description:
    "All 33 Chess.com opening books and which opening to play to unlock each one. Chess.com doesn't publish exact unlock counts, so criteria here are our best reading.",
  alternates: { canonical: "/awards/books" },
  openGraph: {
    title: "Chess.com Opening Books",
    description: "All 33 Chess.com opening books and how to unlock each one.",
    url: URL,
    type: "website",
  },
};

export default async function BooksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const catalog = getCatalog("books");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Awards", item: "https://chessmaster.cyou/awards" },
          { "@type": "ListItem", position: 2, name: "Books", item: URL },
        ],
      },
      {
        "@type": "ItemList",
        name: "Chess.com opening books",
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
        Awards / Books
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        Chess.com Opening Books
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        All {catalog.length} opening books. Chess.com&apos;s own docs don&apos;t publish exact
        unlock counts, so every book here is marked as our best reading — play the opening
        enough and it unlocks.
      </p>

      <div className="mt-10">
        <AwardGrid catalog={catalog} basePath="/awards/books" />
      </div>
    </main>
  );
}
