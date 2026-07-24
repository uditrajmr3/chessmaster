import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation for PUBLIC routes: <Link href="/about"> renders
// "/about" for English and "/hi/about" for Hindi automatically. Use these
// ONLY for hrefs inside PUBLIC_PATHS; app/auth routes ("/login",
// "/settings", …) have no locale segment — keep next/link for those.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
