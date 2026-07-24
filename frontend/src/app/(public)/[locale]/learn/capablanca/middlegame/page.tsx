import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CapablancaChapter from "@/components/CapablancaChapter";
import { MIDDLEGAME_RULES } from "@/lib/capablanca";

export const metadata: Metadata = {
  title: "Capablanca's Middlegame Rules — Interactive",
  description:
    "The five middlegame principles of the Capablanca system, with live boards: activate every piece, check every threat, keep intruders out, build domination, and choose simple plans.",
  alternates: { canonical: "/learn/capablanca/middlegame" },
  keywords: ["chess middlegame strategy", "positional chess principles", "capablanca middlegame"],
};

export default async function MiddlegameChapter({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("capablanca");
  const rules = MIDDLEGAME_RULES.map((r) => ({
    id: r.id,
    title: t(`rules.${r.id}.title`),
    short: t(`rules.${r.id}.short`),
    body: t(`rules.${r.id}.body`),
  }));

  return (
    <CapablancaChapter
      eyebrow={t("mgEyebrow")}
      title={t("mgChTitle")}
      intro={t("mgChIntro")}
      rules={rules}
      checklist={{
        title: t("middlegameChecklistTitle"),
        items: t.raw("middlegameChecklist") as string[],
      }}
      prev={{ href: "/learn/capablanca/opening", label: t("ch1Title") }}
      next={{ href: "/learn/capablanca/endgame", label: t("toEndgame") }}
    />
  );
}
