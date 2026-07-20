import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProvenanceBadge } from "@/components/awards/ProvenanceBadge";
import { getAward, getCatalog } from "@/lib/awards/catalog";

const HUB = "https://chessmaster.cyou/awards";

export const dynamicParams = false;

export function generateStaticParams() {
  return getCatalog("achievements").map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getAward("achievements", slug);
  if (!a) return {};
  const url = `${HUB}/achievements/${a.slug}`;
  return {
    title: `How to get the ${a.name} award on Chess.com`,
    description: a.description,
    alternates: { canonical: `/awards/achievements/${a.slug}` },
    openGraph: {
      title: `${a.name} — Chess.com award guide`,
      description: a.description,
      url,
      type: "article",
    },
  };
}

export default async function AchievementDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const award = getAward("achievements", slug);
  if (!award) notFound();

  const url = `${HUB}/achievements/${award.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: `How to get the ${award.name} award on Chess.com`,
        description: award.description,
        step: [{ "@type": "HowToStep", text: award.howTo }],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Awards", item: HUB },
          { "@type": "ListItem", position: 2, name: "Achievements", item: `${HUB}/achievements` },
          { "@type": "ListItem", position: 3, name: award.name, item: url },
        ],
      },
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
        </Link>{" "}
        /{" "}
        <Link href="/awards/achievements" className="hover:text-gray-300">
          Achievements
        </Link>
      </nav>

      <p className="font-mono mt-4 text-xs uppercase tracking-[0.25em] text-accent-400">
        Achievement
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
        {award.name}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-gray-400">{award.description}</p>
      <div className="mt-4">
        <ProvenanceBadge provenance={award.provenance} awardName={award.name} />
      </div>

      <div className="surface-card mt-10 p-6">
        <h2 className="font-display text-xl font-semibold text-white">How to earn it</h2>
        <p className="mt-3 leading-relaxed text-gray-400">{award.howTo}</p>
      </div>

      <div className="mt-10 border-t border-ink-600 pt-8">
        <Link
          href="/awards/achievements"
          className="inline-flex items-center gap-1.5 text-sm text-accent-300 underline underline-offset-4 hover:text-accent-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to all achievements
        </Link>
      </div>
    </main>
  );
}
