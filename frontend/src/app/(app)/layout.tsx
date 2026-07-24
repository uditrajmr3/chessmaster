import { getLocale } from "next-intl/server";
import { AppBody, FONT_CLASS, baseMetadata } from "../root-shell";

export const metadata = baseMetadata;

// Authenticated + auth-flow routes: locale from the `locale` cookie (via
// request.ts fallback). The cookie read makes every route here dynamic —
// intended; none of these pages are indexable.
export default async function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={FONT_CLASS}>
      <AppBody>{children}</AppBody>
    </html>
  );
}
