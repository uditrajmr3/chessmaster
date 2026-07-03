import type { Metadata } from "next";
import CapablancaChapter from "@/components/CapablancaChapter";
import { OPENING_RULES } from "@/lib/capablanca";

export const metadata: Metadata = {
  title: "Capablanca's Opening Rules — Interactive",
  description:
    "The five opening principles of the Capablanca system, each with a live board you can step through: develop before attacking, handle pins, make threats, castle early, and never waste a tempo.",
  alternates: { canonical: "/learn/capablanca/opening" },
  keywords: ["chess opening principles", "how to play the opening in chess", "capablanca opening rules"],
};

export default function OpeningChapter() {
  return (
    <CapablancaChapter
      eyebrow="The Capablanca method · Chapter 1"
      title="The opening"
      intro="Capablanca never memorised opening theory. He followed five simple principles — develop everything, keep your king safe, and never waste a move. Step through each on the board below."
      rules={OPENING_RULES}
      checklist={{
        title: "Opening checklist — ask before each move",
        items: [
          "Have I developed a new piece? (Prefer developing over pawn moves.)",
          "Am I moving the same piece a second time? If so — is the reason a concrete threat?",
          "Does my opponent have an immediate threat I need to address?",
          "Am I ready to castle? If yes — castle now.",
          "After castling: which is my least active piece?",
        ],
      }}
      next={{ href: "/learn/capablanca/middlegame", label: "The middlegame" }}
    />
  );
}
