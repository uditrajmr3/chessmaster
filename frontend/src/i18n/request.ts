import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// No i18n routing: the locale lives in a cookie (set by <LanguageSwitcher>),
// so every URL stays the same and the whole app — public pages and the
// authenticated dashboard alike — renders in the chosen language. Default is
// English; unknown/absent cookie falls back to it.
export const SUPPORTED_LOCALES = ["en", "hi", "gu"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("locale")?.value;
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
