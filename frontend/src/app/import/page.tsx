"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-kit";

export default function ImportPage() {
  const [pgnText, setPgnText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setPgnText(text);
  };

  const handleImport = async () => {
    if (!pgnText.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await api.importPgnText(pgnText);
      setResult(res);
    } catch {
      setResult({ imported: 0, skipped: 0, errors: ["Failed to connect to backend"] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import PGN"
        subtitle="Import games from PGN files for OTB games or other platforms."
      />

      {/* Upload area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File upload */}
        <button
          type="button"
          className="surface-card bg-ink-800 p-8 border border-dashed border-white/10 hover:border-accent-500 transition-colors cursor-pointer text-center animate-fade-in-up flex flex-col items-center justify-center"
          onClick={() => fileRef.current?.click()}
          aria-label="Upload a PGN file"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pgn"
            onChange={handleFileUpload}
            className="hidden"
          />
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/10 border border-accent-500/20">
            <Upload className="w-6 h-6 text-accent-300" strokeWidth={1.5} />
          </span>
          <p className="text-white font-medium">Upload PGN file</p>
          <p className="text-white/45 text-xs mt-1">Click to select a .pgn file</p>
        </button>

        {/* Or paste */}
        <div className="surface-card p-5 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-white/45" />
            <label htmlFor="pgn-text" className="text-sm text-white/55">
              Or paste PGN text
            </label>
          </div>
          <textarea
            id="pgn-text"
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder="[Event &quot;Casual Game&quot;]&#10;[White &quot;Player1&quot;]&#10;[Black &quot;Player2&quot;]&#10;[Result &quot;1-0&quot;]&#10;&#10;1. e4 e5 2. Nf3 Nc6 1-0"
            className="w-full h-40 bg-ink-800 border border-white/10 rounded-lg px-4 py-3 text-gray-300 text-sm font-mono resize-none transition-colors focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30"
          />
        </div>
      </div>

      {/* Import button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleImport}
          disabled={loading || !pgnText.trim()}
          className="px-6 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg btn-press"
        >
          {loading ? "Importing..." : "Import Games"}
        </button>
        {pgnText && (
          <p className="text-xs text-white/45">
            <span className="font-mono text-white/70">
              {pgnText.split("[Event").length - 1}
            </span>{" "}
            game(s) detected
          </p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="surface-card p-6 animate-fade-in-up">
          <h2 className="text-base font-semibold text-white mb-4">Import Result</h2>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-2xl font-bold font-mono text-green-400">{result.imported}</p>
              </div>
              <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium">Imported</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-white/55">{result.skipped}</p>
              <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium">Skipped</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                {result.errors.length > 0 && (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <p className={`text-2xl font-bold font-mono ${result.errors.length > 0 ? "text-red-400" : "text-white/55"}`}>
                  {result.errors.length}
                </p>
              </div>
              <p className="text-[0.7rem] uppercase tracking-wider text-gray-500 font-medium">Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1 border-t border-white/5 pt-4">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-400">{err}</p>
              ))}
            </div>
          )}
          {result.imported > 0 && (
            <p className="text-sm text-green-400 mt-4">
              Games imported successfully. Run analysis to get move-by-move insights.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
