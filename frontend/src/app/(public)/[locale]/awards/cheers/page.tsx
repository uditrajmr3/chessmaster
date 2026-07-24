import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

const URL = "https://chessmaster.cyou/awards/cheers";
const SUPPORT_URL =
  "https://support.chess.com/en/articles/8614005-what-are-badges-and-cheers-how-do-i-give-them";
const COMMUNITY_URL = "https://www.chess.com/blog/rythannguyen/chess-com-awards";

export const metadata: Metadata = {
  title: "Chess.com Cheers — why we can't track them, and how to earn them",
  description:
    "Chess.com cheers are sent player-to-player outside of a game. They aren't exposed by any public API or on public profile pages, so this tracker can't detect them — here's what they are and how to earn them anyway.",
  alternates: { canonical: "/awards/cheers" },
  openGraph: {
    title: "Chess.com Cheers",
    description: "Why cheers can't be tracked automatically, and how to earn them.",
    url: URL,
    type: "website",
  },
};

/**
 * Explainer stub (plan Task 12). Cheers are real, but — like badges — Chess.com
 * exposes no public source for them. The two auto-earned cheers are called out
 * because they're corroborated by a community source, not because we can detect
 * whether any given account has them.
 */
export default async function CheersPage({
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
      { "@type": "ListItem", position: 2, name: "Cheers", item: URL },
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
        {t("cheersTitle")}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
        Cheers are sent player-to-player, outside of any game — to say hello, apologize, or
        encourage someone. Chess.com is reported to offer around 110 of them. Two are
        auto-earned rather than sent by another player: &quot;Welcome to Chess.com!&quot; and
        &quot;Successful Referral!&quot; — beyond those, no complete public list of names exists.
      </p>

      <div className="surface-card mt-10 p-6">
        <h2 className="font-display text-xl font-semibold text-white">
          {t("cheersWhyHeading")}
        </h2>
        <p className="mt-3 leading-relaxed text-gray-400">
          Like badges, cheers aren&apos;t returned by Chess.com&apos;s public player API and
          don&apos;t appear on a public profile page. Even the two auto-earned cheers above
          can&apos;t be confirmed for a given account from outside Chess.com — we know they
          exist, not who has them. We&apos;d rather say that plainly than show a progress bar
          that&apos;s guessing.
        </p>
      </div>

      <div className="surface-card mt-6 p-6">
        <h2 className="font-display text-xl font-semibold text-white">
          {t("howToEarnHeading")}
        </h2>
        <p className="mt-3 leading-relaxed text-gray-400">
          &quot;Welcome to Chess.com!&quot; and &quot;Successful Referral!&quot; come from
          creating an account and successfully referring a friend, respectively. The rest are
          sent to you by other players from your profile page — there&apos;s no way to send one
          to yourself or request one.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-4">
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-300 underline underline-offset-4 hover:text-accent-200"
          >
            Official Chess.com help: What are badges and cheers?
          </a>
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent-300 underline underline-offset-4 hover:text-accent-200"
          >
            Community source on the auto-earned cheers
          </a>
        </div>
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
