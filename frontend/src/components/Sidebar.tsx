"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, type ElementType } from "react";
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
  Crown,
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
} from "lucide-react";

type NavItem = { href: string; label: string; icon: ElementType };

type NavSection = {
  key: string;
  label: string;
  icon: ElementType;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    key: "overview",
    label: "Overview",
    icon: Gauge,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/games", label: "Games", icon: Swords },
    ],
  },
  {
    key: "training",
    label: "Training",
    icon: GraduationCap,
    items: [
      { href: "/puzzles", label: "Puzzles", icon: Puzzle },
      { href: "/openings", label: "Openings", icon: BookOpen },
      { href: "/weaknesses", label: "Weaknesses", icon: Target },
      { href: "/endgame", label: "Endgame Drills", icon: Trophy },
    ],
  },
  {
    key: "analysis",
    label: "Analysis",
    icon: BarChart3,
    items: [
      { href: "/time-management", label: "Time Management", icon: Timer },
      { href: "/tilt", label: "Tilt Detector", icon: Flame },
      { href: "/rating-predictor", label: "Rating Predictor", icon: TrendingUp },
      { href: "/peer-comparison", label: "Peer Comparison", icon: Users },
    ],
  },
  {
    key: "tools",
    label: "Tools",
    icon: Wrench,
    items: [
      { href: "/digest", label: "Weekly Digest", icon: Mail },
      { href: "/scouting", label: "Opponent Scout", icon: UserSearch },
      { href: "/import", label: "Import PGN", icon: Upload },
      { href: "/export", label: "Export Data", icon: Download },
      { href: "/report", label: "AI Coach", icon: BotMessageSquare },
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
            {section.label}
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
                    ? "bg-accent-500/10 text-accent-400 font-medium nav-active-indicator"
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
                <span>{item.label}</span>
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#1a1d27]/95 backdrop-blur-md border-b border-gray-800/50 flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          ChessMaster
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
        className={`fixed left-0 top-0 h-screen w-64 bg-[#1a1d27]/95 backdrop-blur-md border-r border-gray-800/50 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        {/* Brand */}
        <div className="p-6 border-b border-gray-800/50">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            ChessMaster
          </h1>
          <p className="text-xs text-gray-500 mt-2 tracking-wider uppercase font-medium">
            Personal Chess Analyzer
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
        <div className="p-4 border-t border-gray-800/50">
          <SyncButton />
        </div>
      </aside>
    </>
  );
}

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={async () => {
          const username = prompt("Enter your Chess.com / Lichess username:");
          if (!username) return;
          setSyncing(true);
          try {
            await fetch("http://localhost:8000/api/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username }),
            });
          } catch {
            alert(
              "Backend not running. Start it with: cd backend && uvicorn app.main:app --reload"
            );
          }
          setSyncing(false);
        }}
        disabled={syncing}
        className="w-full px-4 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg btn-press"
      >
        {syncing ? "Syncing..." : "Sync Games"}
      </button>
      <button
        onClick={async () => {
          setAnalyzing(true);
          try {
            await fetch("http://localhost:8000/api/analyze", {
              method: "POST",
            });
          } catch {
            alert("Backend not running.");
          }
          setAnalyzing(false);
        }}
        disabled={analyzing}
        className="w-full px-4 py-2.5 border border-accent-600 text-accent-400 hover:bg-accent-600/10 disabled:opacity-50 text-sm font-medium rounded-lg btn-press"
      >
        {analyzing ? "Starting..." : "Analyze Games"}
      </button>
    </div>
  );
}
