"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import {
  usePathname as useIntlPathname,
  useRouter as useIntlRouter,
} from "@/i18n/navigation";
import { isPublicPath } from "@/i18n/routing";

const LOCALES = ["en", "hi", "gu"] as const;

/**
 * Language picker. Always writes the chosen locale to the `locale` cookie
 * (read by src/i18n/request.ts). On public pages, the locale also lives in
 * the URL segment, so we navigate to the same page under the new locale
 * ("/about" <-> "/hi/about"). On app/auth pages, which are never
 * locale-prefixed, we just refresh so server components re-render with the
 * new cookie.
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const intlRouter = useIntlRouter();
  const intlPathname = useIntlPathname(); // locale-stripped on public routes
  const locale = useLocale();
  const t = useTranslations("language");
  const [, startTransition] = useTransition();

  function change(next: string) {
    // Cookie keeps the authenticated app (and future visits) in sync.
    document.cookie = `locale=${next};path=/;max-age=31536000;samesite=lax`;
    if (isPublicPath(intlPathname)) {
      // Public pages carry the locale in the URL — navigate to the same
      // page under the new locale ("/about" <-> "/hi/about").
      startTransition(() => intlRouter.replace(intlPathname, { locale: next }));
    } else {
      startTransition(() => router.refresh());
    }
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
