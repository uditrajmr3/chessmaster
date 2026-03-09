"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ElementType } from "react";
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
  Menu,
  X,
} from "lucide-react";

const navItems: { href: string; label: string; icon: ElementType }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/games", label: "Games", icon: Swords },
  { href: "/puzzles", label: "Puzzles", icon: Puzzle },
  { href: "/openings", label: "Openings", icon: BookOpen },
  { href: "/weaknesses", label: "Weaknesses", icon: Target },
  { href: "/time-management", label: "Time Management", icon: Timer },
  { href: "/tilt", label: "Tilt Detector", icon: Flame },
  { href: "/endgame", label: "Endgame Drills", icon: Trophy },
  { href: "/rating-predictor", label: "Rating Predictor", icon: TrendingUp },
  { href: "/digest", label: "Weekly Digest", icon: Mail },
  { href: "/peer-comparison", label: "Peer Comparison", icon: Users },
  { href: "/scouting", label: "Opponent Scout", icon: UserSearch },
  { href: "/report", label: "AI Coach", icon: BotMessageSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#1a1d27]/95 backdrop-blur-md border-b border-gray-800/50 flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          ChessMaster
        </h1>
        <button
          onClick={() => setOpen(!open)}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-[#1a1d27]/95 backdrop-blur-md border-r border-gray-800/50 flex flex-col z-50 transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
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
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-accent-500/10 text-accent-400 font-medium nav-active-indicator"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                }`}
              >
                <item.icon
                  className={`w-4.5 h-4.5 transition-transform duration-200 ${
                    isActive ? "" : "group-hover:scale-110"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
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
            alert("Backend not running. Start it with: cd backend && uvicorn app.main:app --reload");
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
            await fetch("http://localhost:8000/api/analyze", { method: "POST" });
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
