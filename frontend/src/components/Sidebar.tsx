"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect, useRef, type ElementType } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { runAnalysis } from "@/lib/analyze";
import { emitDataRefresh } from "@/lib/useDataRefresh";
import { emitAnalysisDone, requestNotifyPermission, systemNotify } from "@/lib/notify";
import Logo from "@/components/Logo";
import {
  LayoutDashboard,
  Swords,
  Puzzle,
  BookOpen,
  Target,
  Timer,
  Flame,
  UserSearch,
  BotMessageSquare,
  Trophy,
  TrendingUp,
  Mail,
  Users,
  Upload,
  Download,
  Menu,
  X,
  ChevronDown,
  Gauge,
  GraduationCap,
  BarChart3,
  Wrench,
  Settings,
  LogOut,
  Lightbulb,
} from "lucide-react";

type NavItem = { href: string; labelKey: string; icon: ElementType };

type NavSection = {
  key: string;
  labelKey: string;
  icon: ElementType;
  items: NavItem[];
};

// labelKey values are looked up in the "nav" message namespace at render time.
const navSections: NavSection[] = [
  {
    key: "overview",
    labelKey: "overview",
    icon: Gauge,
    items: [
      { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
      { href: "/games", labelKey: "games", icon: Swords },
    ],
  },
  {
    key: "training",
    labelKey: "training",
    icon: GraduationCap,
    items: [
      { href: "/learn", labelKey: "learnChess", icon: Lightbulb },
      { href: "/puzzles", labelKey: "puzzles", icon: Puzzle },
      { href: "/openings", labelKey: "openings", icon: BookOpen },
      { href: "/weaknesses", labelKey: "weaknesses", icon: Target },
      { href: "/endgame", labelKey: "endgameDrills", icon: Trophy },
    ],
  },
  {
    key: "analysis",
    labelKey: "analysis",
    icon: BarChart3,
    items: [
      { href: "/time-management", labelKey: "timeManagement", icon: Timer },
      { href: "/tilt", labelKey: "tilt", icon: Flame },
      { href: "/rating-predictor", labelKey: "ratingPredictor", icon: TrendingUp },
      { href: "/peer-comparison", labelKey: "peerComparison", icon: Users },
    ],
  },
  {
    key: "tools",
    labelKey: "tools",
    icon: Wrench,
    items: [
      { href: "/digest", labelKey: "weeklyDigest", icon: Mail },
      { href: "/scouting", labelKey: "opponentScout", icon: UserSearch },
      { href: "/import", labelKey: "importPgn", icon: Upload },
      { href: "/export", labelKey: "exportData", icon: Download },
      { href: "/report", labelKey: "aiCoach", icon: BotMessageSquare },
    ],
  },
];

function findSectionForPath(pathname: string): string {
  for (const section of navSections) {
    for (const item of section.items) {
      if (
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(item.href))
      ) {
        return section.key;
      }
    }
  }
  return navSections[0].key;
}

function AccordionSection({
  section,
  isOpen,
  onToggle,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(0);
  const t = useTranslations("nav");

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [section.items.length]);

  const hasActiveItem = section.items.some(
    (item) =>
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href))
  );

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm transition-colors duration-200 ${
          hasActiveItem
            ? "text-accent-400"
            : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <section.icon className="w-4 h-4" />
          <span className="font-medium tracking-wide text-xs uppercase">
            {t(section.labelKey)}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-300`}
          style={{
            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
            transitionTimingFunction: "var(--spring)",
          }}
        />
      </button>

      <div
        className="overflow-hidden transition-[height,opacity] duration-300"
        style={{
          height: isOpen ? height : 0,
          opacity: isOpen ? 1 : 0,
          transitionTimingFunction: "var(--ease-out)",
        }}
      >
        <div ref={contentRef} className="pt-0.5 pb-1 pl-2">
          {section.items.map((item, i) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`group flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-accent-500/10 text-accent-300 font-medium ring-1 ring-inset ring-accent-500/20"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                }`}
                style={{
                  animationDelay: isOpen ? `${i * 40}ms` : "0ms",
                }}
              >
                <item.icon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isActive ? "" : "group-hover:scale-110"
                  }`}
                />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const tCommon = useTranslations("common");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState(() =>
    findSectionForPath(pathname)
  );

  // Auto-expand section when route changes
  useEffect(() => {
    setOpenSection(findSectionForPath(pathname));
  }, [pathname]);

  const handleToggle = (key: string) => {
    setOpenSection((prev) => (prev === key ? "" : key));
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-ink-900/90 backdrop-blur-md border-b border-white/6 flex items-center justify-between px-4 py-3">
        <h1 className="font-display text-lg font-semibold text-white flex items-center gap-2">
          <Logo className="w-5 h-5 text-accent-300" />
          ChessInt
        </h1>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-ink-900/95 backdrop-blur-md border-r border-white/6 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        {/* Brand */}
        <div className="px-6 pt-6 pb-5 border-b border-white/6">
          <h1 className="font-display text-xl font-semibold text-white flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/12 border border-accent-500/25">
              <Logo className="w-5 h-5 text-accent-300" />
            </span>
            ChessInt
          </h1>
          <p className="text-[0.65rem] text-gray-500 mt-2.5 ml-0.5 tracking-wider uppercase font-medium">
            {tCommon("appTagline")}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navSections.map((section) => (
            <AccordionSection
              key={section.key}
              section={section}
              isOpen={openSection === section.key}
              onToggle={() => handleToggle(section.key)}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Action buttons */}
        <div className="p-4 border-t border-gray-800/50 space-y-3">
          <SyncButton />
          <UserFooter onNavigate={() => setMobileOpen(false)} />
        </div>
      </aside>
    </>
  );
}

function SyncButton() {
  const { user } = useAuth();
  const t = useTranslations("nav");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [analysisDone, setAnalysisDone] = useState(0);
  const [analysisTotal, setAnalysisTotal] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  const hasLinkedAccount =
    Boolean(user?.lichess_username) || Boolean(user?.chesscom_username);

  const handleSync = async () => {
    if (!hasLinkedAccount) {
      setSyncError(t("linkAccountFirst"));
      return;
    }
    setSyncing(true);
    setSyncError(null);
    try {
      await api.startSync();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Sync failed. Please try again.";
      setSyncError(msg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleSync}
        disabled={syncing || !hasLinkedAccount}
        title={!hasLinkedAccount ? t("linkAccountFirst") : undefined}
        className="w-full px-4 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg btn-press"
      >
        {syncing ? t("syncing") : t("syncGames")}
      </button>

      {!hasLinkedAccount && (
        <p className="text-xs text-amber-400 text-center">
          <Link href="/settings" className="underline underline-offset-2 hover:text-amber-300">
            {t("linkAccountCta")}
          </Link>
          {t("linkAccountSuffix")}
        </p>
      )}

      {syncError && hasLinkedAccount && (
        <p className="text-xs text-red-400 text-center">{syncError}</p>
      )}

      <button
        onClick={async () => {
          setAnalyzing(true);
          setAnalysisDone(0);
          setAnalysisTotal(0);
          // Ask up front (needs the click gesture) so we can notify on finish.
          requestNotifyPermission();
          let finalDone = 0;
          let finalTotal = 0;
          try {
            await runAnalysis((done, total) => {
              setAnalysisDone(done);
              setAnalysisTotal(total);
              finalDone = done;
              finalTotal = total;
              if (done === total && total > 0) {
                emitDataRefresh();
              }
            });
            emitDataRefresh();
            // Notify on completion — system notification (reaches you on another
            // tab) + an in-app banner via the StatusBar.
            if (finalTotal === 0) {
              systemNotify("ChessInt", "You're all caught up — no new games to analyze.");
            } else {
              systemNotify(
                "ChessInt — Analysis complete",
                `${finalDone} games analyzed. Open ChessInt to see your results.`
              );
            }
            emitAnalysisDone(finalTotal === 0 ? 0 : finalDone);
          } catch (err) {
            console.error("Analysis error:", err);
            // Refresh even on error so partially-analyzed games become visible
            emitDataRefresh();
            alert("Analysis failed. Check the console for details.");
          }
          setAnalyzing(false);
        }}
        disabled={analyzing}
        className="w-full px-4 py-2.5 border border-accent-600 text-accent-400 hover:bg-accent-600/10 disabled:opacity-50 text-sm font-medium rounded-lg btn-press"
      >
        {analyzing
          ? analysisTotal > 0
            ? t("analyzingProgress", { done: analysisDone, total: analysisTotal })
            : t("starting")
          : t("analyzeGames")}
      </button>
    </div>
  );
}

function UserFooter({ onNavigate }: { onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const t = useTranslations("common");
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="border-t border-gray-800/40 pt-3 space-y-1">
      {/* User email */}
      <p
        className="text-xs text-gray-500 px-2 truncate"
        title={user.email}
      >
        {user.email}
      </p>

      {/* Language */}
      <div className="px-2 py-1.5">
        <LanguageSwitcher />
      </div>

      {/* Settings link */}
      <Link
        href="/settings"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/4 transition-colors"
      >
        <Settings className="w-4 h-4" />
        <span>{t("settings")}</span>
      </Link>

      {/* Logout */}
      <button
        onClick={handleLogout}
        data-testid="logout-button"
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/6 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>{t("logout")}</span>
      </button>
    </div>
  );
}
