"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/games", label: "Games", icon: "♟️" },
  { href: "/puzzles", label: "Puzzles", icon: "🧩" },
  { href: "/openings", label: "Openings", icon: "📖" },
  { href: "/weaknesses", label: "Weaknesses", icon: "🎯" },
  { href: "/time-management", label: "Time Management", icon: "⏱️" },
  { href: "/report", label: "AI Coach", icon: "🤖" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#1a1d27] border-b border-gray-800 flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-bold text-white">♚ ChessMaster</h1>
        <button
          onClick={() => setOpen(!open)}
          className="text-gray-400 hover:text-white p-1"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-[#1a1d27] border-r border-gray-800 flex flex-col z-50 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">♚ ChessMaster</h1>
          <p className="text-xs text-gray-500 mt-1">Personal Chess Analyzer</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 font-medium"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <SyncButton />
        </div>
      </aside>
    </>
  );
}

function SyncButton() {
  return (
    <div className="space-y-2">
      <button
        onClick={async () => {
          const username = prompt("Enter your Chess.com / Lichess username:");
          if (!username) return;
          try {
            await fetch("http://localhost:8000/api/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username }),
            });
          } catch {
            alert("Backend not running. Start it with: cd backend && uvicorn app.main:app --reload");
          }
        }}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Sync Games
      </button>
      <button
        onClick={async () => {
          try {
            await fetch("http://localhost:8000/api/analyze", { method: "POST" });
          } catch {
            alert("Backend not running.");
          }
        }}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
      >
        Analyze Games
      </button>
    </div>
  );
}
