"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Globe } from "lucide-react";

const LOCALES = ["en", "hi", "gu"] as const;

/**
 * Language picker. Writes the chosen locale to the `locale` cookie (read by
 * src/i18n/request.ts) and refreshes so all server components re-render in the
 * new language. No i18n routing, so the URL is unchanged.
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("language");
  const [, startTransition] = useTransition();

  function change(next: string) {
    document.cookie = `locale=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label className={`relative flex items-center gap-2 text-sm text-gray-400 ${className}`}>
      <Globe className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={(e) => change(e.target.value)}
        aria-label={t("label")}
        className="w-full cursor-pointer rounded-md border border-white/10 bg-ink-800 px-2 py-1.5 text-sm text-gray-200 hover:border-white/20 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500/30"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="bg-ink-800 text-gray-200">
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
