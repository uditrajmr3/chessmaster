"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Settings, KeyRound, Check } from "lucide-react";

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const t = useTranslations("settings");

  const [lichessUsername, setLichessUsername] = useState("");
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    setApiKeySaving(true);
    setApiKeySaved(false);
    setApiKeyError(null);
    try {
      await api.updateMe({ own_anthropic_api_key: apiKey.trim() });
      await refresh();
      setApiKey("");
      setApiKeySaved(true);
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleRemoveApiKey = async () => {
    setApiKeySaving(true);
    setApiKeySaved(false);
    setApiKeyError(null);
    try {
      await api.updateMe({ own_anthropic_api_key: "" });
      await refresh();
      setApiKey("");
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setApiKeySaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-accent-400" />
        <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      </div>

      <div className="surface-card p-6 space-y-6">
        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">
            {t("emailLabel")}
          </label>
          <input
            type="email"
            value={user?.email ?? ""}
            readOnly
            className="w-full px-3 py-2 bg-white/[0.04] border border-gray-700/60 rounded-lg text-gray-300 text-sm cursor-not-allowed focus:outline-none"
            aria-label={t("emailLabel")}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t("emailHint")}
          </p>
        </div>

        {/* Lichess */}
        <div>
          <label
            htmlFor="lichess-username"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {t("lichessLabel")}
          </label>
          <input
            id="lichess-username"
            type="text"
            value={lichessUsername}
            onChange={(e) => setLichessUsername(e.target.value)}
            placeholder={t("lichessPlaceholder")}
            className="w-full px-3 py-2 bg-white/[0.04] border border-gray-700/60 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>

        {/* Chess.com */}
        <div>
          <label
            htmlFor="chesscom-username"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {t("chesscomLabel")}
          </label>
          <input
            id="chesscom-username"
            type="text"
            value={chesscomUsername}
            onChange={(e) => setChesscomUsername(e.target.value)}
            placeholder={t("chesscomPlaceholder")}
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
            {t("saved")}
          </p>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors btn-press"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>

      {/* Bring-your-own Anthropic API key */}
      <div className="surface-card mt-6 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent-400" />
          <h2 className="text-sm font-semibold text-white">{t("apiKeyTitle")}</h2>
        </div>
        <p className="text-xs leading-relaxed text-gray-500">{t("apiKeyHint")}</p>

        {user?.has_own_api_key ? (
          <div className="flex items-center justify-between rounded-lg border border-green-700/40 bg-green-500/10 p-3">
            <p className="flex items-center gap-2 text-sm text-green-300">
              <Check className="h-4 w-4" />
              {t("apiKeyActive")}
            </p>
            <button
              onClick={handleRemoveApiKey}
              disabled={apiKeySaving}
              className="text-xs font-medium text-gray-400 underline underline-offset-4 hover:text-white disabled:opacity-50"
            >
              {t("apiKeyRemove")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              id="own-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("apiKeyPlaceholder")}
              autoComplete="off"
              className="w-full px-3 py-2 bg-white/[0.04] border border-gray-700/60 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent-500 transition-colors"
            />
            <button
              onClick={handleSaveApiKey}
              disabled={apiKeySaving || !apiKey.trim()}
              className="shrink-0 px-4 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors btn-press"
            >
              {apiKeySaving ? t("saving") : t("apiKeySave")}
            </button>
          </div>
        )}

        {apiKeyError && (
          <p role="alert" className="text-sm text-red-400">
            {apiKeyError}
          </p>
        )}
        {apiKeySaved && (
          <p role="status" className="text-sm text-green-400">
            {t("apiKeySavedMsg")}
          </p>
        )}
      </div>
    </div>
  );
}
