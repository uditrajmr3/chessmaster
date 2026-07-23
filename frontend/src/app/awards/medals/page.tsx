import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

const URL = "https://chessmaster.cyou/awards/medals";
const SUPPORT_URL = "https://support.chess.com/en/articles/8724664-what-are-medals-on-chess-com";

export const metadata: Metadata = {
  title: "Chess.com Medals — why there's no fixed list, and how to earn them",
  description:
    "Chess.com medals go to 1st, 2nd, and 3rd place finishers in a tournament. Chess.com's own docs say medals use custom, tournament-specific artwork rather than a fixed named catalog, so there's nothing stable to track.",
  alternates: { canonical: "/awards/medals" },
  openGraph: {
    title: "Chess.com Medals",
    description: "Why there's no fixed catalog of medals to track, and how to earn them.",
    url: URL,
    type: "website",
  },
};

/**
 * Explainer stub (plan Task 12). Unlike badges/cheers, this isn't a visibility
 * gap — Chess.com's own support docs say medals use per-tournament custom art
 * rather than a fixed catalog, so there is no stable list to ever enumerate.
 */
export default async function MedalsPage() {
  const t = await getTranslations("awards");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Awards", item: "https://chessmaster.cyou/awards" },
      { "@type": "ListItem", position: 2, name: "Medals", item: URL },
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-xs text-gray-500">
        <Link href="/awards" className="hover:text-gray-300">
          Awards
        </Link>
      </nav>

      <p className="font-mono mt-4 text-xs uppercase tracking-[0.25em] text-accent-400">
        {t("eyebrow")}
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        {t("medalsTitle")}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        Medals go to whoever finishes 1st, 2nd, or 3rd place in a tournament. Unlike badges and
        cheers, this isn&apos;t a visibility problem we could fix with more data — Chess.com&apos;s
        own help center says medals use custom artwork specific to each tournament, not a fixed
        set of named medals.
      </p>

      <div className="surface-card mt-10 p-6">
        <h2 className="font-display text-xl font-semibold text-white">
          {t("medalsWhyHeading")}
        </h2>
        <p className="mt-3 leading-relaxed text-gray-400">
          There is no catalog to be missing. Every tournament organizer can design its own medal
          art, so &quot;the list of Chess.com medals&quot; isn&apos;t a fixed, enumerable thing —
          it grows with every tournament that runs, and no two need look alike. Building a
          tracker for that would mean inventing a catalog that doesn&apos;t exist, which is the
          one thing this project won&apos;t do.
        </p>
      </div>

      <div className="surface-card mt-6 p-6">
        <h2 className="font-display text-xl font-semibold text-white">
          {t("howToEarnHeading")}
        </h2>
        <p className="mt-3 leading-relaxed text-gray-400">
          Enter tournaments and place top three. Chess.com groups medals you&apos;ve won into
          stacks by tournament type, viewable from your own Awards page under &quot;Medals.&quot;
        </p>
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm text-accent-300 underline underline-offset-4 hover:text-accent-200"
        >
          Official Chess.com help: What are medals on Chess.com?
        </a>
      </div>

      <div className="mt-10 border-t border-ink-600 pt-8">
        <Link
          href="/awards"
          className="inline-flex items-center gap-1.5 text-sm text-accent-300 underline underline-offset-4 hover:text-accent-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to Awards
        </Link>
      </div>
    </main>
  );
}
