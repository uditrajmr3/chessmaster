"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const { user, refresh } = useAuth();

  const [lichessUsername, setLichessUsername] = useState("");
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from the auth context user on mount / when user changes
  useEffect(() => {
    if (user) {
      setLichessUsername(user.lichess_username ?? "");
      setChesscomUsername(user.chesscom_username ?? "");
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.updateMe({
        lichess_username: lichessUsername || "",
        chesscom_username: chesscomUsername || "",
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-accent-400" />
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

      <div className="surface-card p-6 space-y-6">
        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">
            Email address
          </label>
          <input
            type="email"
            value={user?.email ?? ""}
            readOnly
            className="w-full px-3 py-2 bg-white/[0.04] border border-gray-700/60 rounded-lg text-gray-300 text-sm cursor-not-allowed focus:outline-none"
            aria-label="Email address"
          />
          <p className="text-xs text-gray-500 mt-1">
            Your account email cannot be changed.
          </p>
        </div>

        {/* Lichess */}
        <div>
          <label
            htmlFor="lichess-username"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            Lichess username
          </label>
          <input
            id="lichess-username"
            type="text"
            value={lichessUsername}
            onChange={(e) => setLichessUsername(e.target.value)}
            placeholder="e.g. DrNykterstein"
            className="w-full px-3 py-2 bg-white/[0.04] border border-gray-700/60 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>

        {/* Chess.com */}
        <div>
          <label
            htmlFor="chesscom-username"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            Chess.com username
          </label>
          <input
            id="chesscom-username"
            type="text"
            value={chesscomUsername}
            onChange={(e) => setChesscomUsername(e.target.value)}
            placeholder="e.g. Hikaru"
            className="w-full px-3 py-2 bg-white/[0.04] border border-gray-700/60 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>

        {/* Feedback */}
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-green-400">
            Settings saved successfully.
          </p>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors btn-press"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
