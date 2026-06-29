import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import AuthGuard from "@/components/AuthGuard";
import Analytics from "@/components/Analytics";

const SITE_URL = "https://chessmaster.cyou";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// Display serif — wordmark and large auth headings only. Reads warm and
// editorial against the taupe accent; never used for UI chrome or body.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "ChessInt",
  title: {
    default: "ChessInt — Chess Intelligence for Lichess & Chess.com",
    template: "%s · ChessInt",
  },
  description:
    "ChessInt is chess intelligence for your own games. Connect Lichess or Chess.com and get engine analysis, your recurring weaknesses, opening insights, and a personal AI coach — all in the browser.",
  keywords: [
    "ChessInt",
    "chess intelligence",
    "chess analysis",
    "analyze chess games",
    "Lichess analysis",
    "Chess.com analysis",
    "chess weaknesses",
    "chess improvement",
    "AI chess coach",
    "Stockfish analysis",
    "chess game review",
    "Udit Raj",
  ],
  authors: [{ name: "Udit Raj", url: "https://uditraj.site" }],
  creator: "Udit Raj",
  publisher: "Udit Raj",
  verification: { google: "guzi5deunY5X5YZZzh7g5xewA8y2mKTp-S4gdf977q8" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "ChessInt",
    title: "ChessInt — Chess Intelligence for Lichess & Chess.com",
    description:
      "Analyze every game, find your recurring patterns, and fix your weaknesses with a personal AI chess coach.",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChessInt — Chess Intelligence",
    description:
      "Analyze every game, find your recurring patterns, and fix your weaknesses with a personal AI chess coach.",
  },
};

// Structured data: the app, the publishing org, and Udit Raj as creator.
// `alternateName`/`disambiguatingDescription` exist to teach search + AI that
// "ChessInt" means this Chess-Intelligence web app (not the unrelated
// "Chessnut" electronic-chessboard brand it currently gets confused with).
// sameAs ties the entity to uditraj.site and the open-source repo.
const ORG_ID = `${SITE_URL}/#org`;
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "ChessInt",
      alternateName: "Chess Intelligence",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.svg`,
      description:
        "ChessInt (Chess Intelligence) is a free web app that analyzes your own Chess.com and Lichess games — engine analysis, a move-by-move game review, recurring weaknesses, and an AI coach.",
      sameAs: [
        "https://uditraj.site",
        "https://github.com/uditrajmr3/chessmaster",
      ],
      founder: { "@type": "Person", name: "Udit Raj", url: "https://uditraj.site" },
    },
    {
      "@type": "WebApplication",
      name: "ChessInt",
      alternateName: "ChessInt — Chess Intelligence",
      url: SITE_URL,
      applicationCategory: "GameApplication",
      operatingSystem: "Web browser",
      browserRequirements: "Requires a modern web browser. No install.",
      disambiguatingDescription:
        "ChessInt is a software web app for analyzing your own chess games on Chess.com and Lichess. It is not related to electronic chessboard hardware.",
      description:
        "Chess intelligence for your own games: engine analysis, a free game review, recurring weaknesses, opening insights, and a personal AI coach for Lichess and Chess.com players.",
      featureList: [
        "Free move-by-move game review (Brilliant to Blunder)",
        "Full-history Stockfish analysis in the browser",
        "Recurring weakness detection by phase and motif",
        "Opening win-rates from your own games",
        "Personal AI coaching report",
        "Tactics puzzles from your own mistakes",
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": ORG_ID },
      author: {
        "@type": "Person",
        name: "Udit Raj",
        url: "https://uditraj.site",
      },
    },
    {
      "@type": "Person",
      name: "Udit Raj",
      url: "https://uditraj.site",
      sameAs: ["https://uditraj.site", "https://evileye.uditraj.site"],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
    >
      <body className="flex min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AuthProvider>
          <AuthGuard>{children}</AuthGuard>
        </AuthProvider>
        <footer className="fixed bottom-0 right-0 z-10 px-3 py-1">
          <p className="text-[10px] font-mono opacity-40 text-foreground">
            ChessInt — Chess Intelligence by{" "}
            <a href="https://uditraj.site" rel="author" className="underline-offset-2 hover:underline">
              Udit Raj
            </a>
            {" · "}
            <a href="https://evileye.uditraj.site" rel="noopener" className="underline-offset-2 hover:underline">
              Evil Eye
            </a>
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
