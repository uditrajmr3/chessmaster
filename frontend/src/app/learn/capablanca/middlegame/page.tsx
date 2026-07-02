import type { Metadata } from "next";
import CapablancaChapter from "@/components/CapablancaChapter";
import { MIDDLEGAME_RULES } from "@/lib/capablanca";

export const metadata: Metadata = {
  title: "Capablanca's Middlegame Rules — Interactive",
  description:
    "The five middlegame principles of the Capablanca system, with live boards: activate every piece, check every threat, keep intruders out, build domination, and choose simple plans.",
  alternates: { canonical: "/learn/capablanca/middlegame" },
  keywords: ["chess middlegame strategy", "positional chess principles", "capablanca middlegame"],
};

export default function MiddlegameChapter() {
  return (
    <CapablancaChapter
      eyebrow="The Capablanca method · Chapter 2"
      title="The middlegame"
      intro="This is where Capablanca's method shone: keep improving your pieces until the position is overwhelming, and let tactics appear on their own. Work through the ideas below."
      rules={MIDDLEGAME_RULES}
      prev={{ href: "/learn/capablanca/opening", label: "The opening" }}
      next={{ href: "/learn/capablanca/endgame", label: "The endgame" }}
    />
  );
}
