import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

const URL = "https://chessmaster.cyou/awards/badges";
const SUPPORT_URL =
  "https://support.chess.com/en/articles/8614005-what-are-badges-and-cheers-how-do-i-give-them";

export const metadata: Metadata = {
  title: "Chess.com Badges — why we can't track them, and how to earn them",
  description:
    "Chess.com badges are sent by an opponent from inside a finished game. They aren't exposed by any public API or on public profile pages, so this tracker can't detect them — here's what they are and how to earn them anyway.",
  alternates: { canonical: "/awards/badges" },
  openGraph: {
    title: "Chess.com Badges",
    description: "Why badges can't be tracked automatically, and how to earn them.",
    url: URL,
    type: "website",
  },
};

/**
 * Explainer stub (plan Task 12). Badges are real, but Chess.com exposes no
 * public source for them — not the API, not the profile HTML. Rather than
 * fake a scan, this page says so plainly and links to the official source.
 */
export default async function BadgesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("awards");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Awards", item: "https://chessmaster.cyou/awards" },
      { "@type": "ListItem", position: 2, name: "Badges", item: URL },
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
        {t("badgesTitle")}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        Badges are game-related awards — things like &quot;Good Game&quot; or &quot;Pawn
        Magician&quot; — that an opponent sends you from inside a finished game. Chess.com is
        reported to offer around 84 of them, but those two are the only names documented
        anywhere public.
      </p>

      <div className="surface-card mt-10 p-6">
        <h2 className="font-display text-xl font-semibold text-white">
          {t("badgesWhyHeading")}
        </h2>
        <p className="mt-3 leading-relaxed text-gray-400">
          Badges aren&apos;t returned by Chess.com&apos;s public player API, and they don&apos;t
          appear anywhere on a public profile page. There is no data source this tracker — or
          anyone outside Chess.com — can read to see which badges an account holds. We won&apos;t
          fake a progress bar for something we genuinely cannot see, so this explainer stands in
          place of one.
        </p>
      </div>

      <div className="surface-card mt-6 p-6">
        <h2 className="font-display text-xl font-semibold text-white">
          {t("howToEarnHeading")}
        </h2>
        <p className="mt-3 leading-relaxed text-gray-400">
          Play games. A badge is sent by your opponent after a game ends, from the game&apos;s
          &quot;Info&quot; panel — you can&apos;t send yourself one, and there&apos;s no way to
          request one. The only lever you have is playing games people remember, for good reasons
          or bad ones.
        </p>
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-sm text-accent-300 underline underline-offset-4 hover:text-accent-200"
        >
          Official Chess.com help: What are badges and cheers?
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
