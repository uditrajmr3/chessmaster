import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import AuthGuard from "@/components/AuthGuard";

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

export const metadata: Metadata = {
  title: "ChessMaster - Your Personal Chess Coach",
  description: "Analyze your chess games and discover recurring patterns",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-screen">
        <AuthProvider>
          <AuthGuard>{children}</AuthGuard>
        </AuthProvider>
        <footer className="fixed bottom-0 right-0 z-10 px-3 py-1">
          <p className="text-[9px] font-mono opacity-25 text-foreground">
            <a href="https://uditraj.site" rel="author noopener">Udit Raj</a>
            {' '}·{' '}
            <a href="https://evileye.uditraj.site" rel="noopener">Evil Eye</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
