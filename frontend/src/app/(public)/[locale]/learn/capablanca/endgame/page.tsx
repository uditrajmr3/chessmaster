import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CapablancaChapter from "@/components/CapablancaChapter";
import { ENDGAME_RULES } from "@/lib/capablanca";

export const metadata: Metadata = {
  title: "Capablanca's Endgame Rules — Interactive",
  description:
    "The five endgame principles of the Capablanca system, with live boards: activate your king, attack weak pawns, put your rook behind passed pawns, don't push pawns carelessly, and play on two weaknesses.",
  alternates: { canonical: "/learn/capablanca/endgame" },
  keywords: ["chess endgame principles", "rook endgame rules", "capablanca endgame technique"],
};

export default async function EndgameChapter({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("capablanca");
  const rules = ENDGAME_RULES.map((r) => ({
    id: r.id,
    title: t(`rules.${r.id}.title`),
    short: t(`rules.${r.id}.short`),
    body: t(`rules.${r.id}.body`),
  }));

  return (
    <CapablancaChapter
      eyebrow={t("egEyebrow")}
      title={t("egChTitle")}
      intro={t("egChIntro")}
      rules={rules}
      checklist={{
        title: t("endgameChecklistTitle"),
        items: t.raw("endgameChecklist") as string[],
      }}
      prev={{ href: "/learn/capablanca/middlegame", label: t("ch2Title") }}
      next={{ href: "/learn/capablanca/game", label: t("toGame") }}
    />
  );
}
