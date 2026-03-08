import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import StatusBar from "@/components/StatusBar";

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
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <StatusBar />
        <main className="flex-1 lg:ml-64 pt-16 lg:pt-8 px-4 sm:px-6 lg:px-8 pb-8">{children}</main>
      </body>
    </html>
  );
}
