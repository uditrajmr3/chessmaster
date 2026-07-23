import achievements from "@/data/awards/achievements.json";
import books from "@/data/awards/books.json";
import passports from "@/data/awards/passports.json";
import type { AwardEntry } from "./types";

const BY_CATEGORY: Record<string, AwardEntry[]> = {
  achievements: achievements as AwardEntry[],
  books: books as AwardEntry[],
  passports: passports as AwardEntry[],
};

export type AwardCategory = keyof typeof BY_CATEGORY;

export function getCatalog(category: string): AwardEntry[] {
  return BY_CATEGORY[category] ?? [];
}

export function getAllAwards(): AwardEntry[] {
  return Object.values(BY_CATEGORY).flat();
}

export function getAward(category: string, slug: string): AwardEntry | undefined {
  return getCatalog(category).find((a) => a.slug === slug);
}
