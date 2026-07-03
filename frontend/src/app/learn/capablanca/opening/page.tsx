import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CapablancaChapter from "@/components/CapablancaChapter";
import { OPENING_RULES } from "@/lib/capablanca";

export const metadata: Metadata = {
  title: "Capablanca's Opening Rules — Interactive",
  description:
    "The five opening principles of the Capablanca system, each with a live board you can step through: develop before attacking, handle pins, make threats, castle early, and never waste a tempo.",
  alternates: { canonical: "/learn/capablanca/opening" },
  keywords: ["chess opening principles", "how to play the opening in chess", "capablanca opening rules"],
};

export default async function OpeningChapter() {
  const t = await getTranslations("capablanca");
  const rules = OPENING_RULES.map((r) => ({
    id: r.id,
    title: t(`rules.${r.id}.title`),
    short: t(`rules.${r.id}.short`),
    body: t(`rules.${r.id}.body`),
  }));

  return (
    <CapablancaChapter
      eyebrow={t("opEyebrow")}
      title={t("opChTitle")}
      intro={t("opChIntro")}
      rules={rules}
      checklist={{
        title: t("openingChecklistTitle"),
        items: t.raw("openingChecklist") as string[],
      }}
      prev={{ href: "/learn/capablanca", label: t("toOverview") }}
      next={{ href: "/learn/capablanca/middlegame", label: t("toMiddlegame") }}
    />
  );
}
