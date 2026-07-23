import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Hybrid locale resolution:
//  - Public routes live under app/(public)/[locale] — the segment supplies
//    `requestLocale` (via setRequestLocale), so no cookie read happens and
//    the route can statically generate.
//  - Everything else (authenticated app + auth pages) has no segment, so
//    `requestLocale` resolves undefined and we fall back to the `locale`
//    cookie (set by <LanguageSwitcher>). The cookie read is what keeps those
//    routes dynamic — by design.
export const SUPPORTED_LOCALES = routing.locales;
export type { Locale } from "./routing";
export const DEFAULT_LOCALE = routing.defaultLocale;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  let locale: string;
  if (hasLocale(routing.locales, requested)) {
    locale = requested;
  } else {
    const cookieLocale = (await cookies()).get("locale")?.value;
    locale = hasLocale(routing.locales, cookieLocale)
      ? cookieLocale
      : routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
