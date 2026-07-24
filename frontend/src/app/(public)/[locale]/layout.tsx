import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AppBody, FONT_CLASS, baseMetadata } from "../../root-shell";

export const metadata = baseMetadata;

// Only en/hi/gu prerender; anything else ("/xyz" swallowed by [locale]) is a
// real HTTP 404. This is the soft-404 fix — do not remove.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PublicRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Pins the locale for static rendering — without this, next-intl falls
  // back to the cookie read in request.ts and the whole tree goes dynamic.
  setRequestLocale(locale);
  return (
    <html lang={locale} className={FONT_CLASS}>
      <AppBody>{children}</AppBody>
    </html>
  );
}
