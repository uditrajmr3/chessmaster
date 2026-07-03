import type { Metadata } from "next";
import CapablancaChapter from "@/components/CapablancaChapter";
import { ENDGAME_RULES } from "@/lib/capablanca";

export const metadata: Metadata = {
  title: "Capablanca's Endgame Rules — Interactive",
  description:
    "The five endgame principles of the Capablanca system, with live boards: activate your king, attack weak pawns, put your rook behind passed pawns, don't push pawns carelessly, and play on two weaknesses.",
  alternates: { canonical: "/learn/capablanca/endgame" },
  keywords: ["chess endgame principles", "rook endgame rules", "capablanca endgame technique"],
};

export default function EndgameChapter() {
  return (
    <CapablancaChapter
      eyebrow="The Capablanca method · Chapter 3"
      title="The endgame"
      intro="Endgames are simpler than they look: win a weak pawn and promote one of your own. These five rules do most of the work — step through the key techniques on the board."
      rules={ENDGAME_RULES}
      checklist={{
        title: "Endgame checklist",
        items: [
          "Has my king moved toward the centre yet? (Priority one.)",
          "Which is the weakest pawn on the board? Is my king heading there?",
          "Is my rook behind my passed pawn (or behind the opponent's)?",
          "Have I avoided pawn moves without a clear reason?",
          "Am I pressing two weaknesses — or only one?",
        ],
      }}
      prev={{ href: "/learn/capablanca/middlegame", label: "The middlegame" }}
      next={{ href: "/learn/capablanca/game", label: "A complete game" }}
    />
  );
}
