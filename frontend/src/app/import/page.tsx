"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

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
      <div>
        <h2 className="text-3xl font-bold">Import PGN</h2>
        <p className="text-gray-400 text-sm">
          Import games from PGN files — for OTB games or other platforms
        </p>
      </div>

      {/* Upload area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File upload */}
        <div
          className="bg-[#222639] rounded-xl p-8 border-2 border-dashed border-gray-700 hover:border-accent-500 transition-colors cursor-pointer text-center animate-fade-in-up"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pgn"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-300 font-medium">Upload PGN File</p>
          <p className="text-gray-500 text-xs mt-1">Click to select a .pgn file</p>
        </div>

        {/* Or paste */}
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-gray-500" />
            <label className="text-sm text-gray-400">Or paste PGN text</label>
          </div>
          <textarea
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder="[Event &quot;Casual Game&quot;]&#10;[White &quot;Player1&quot;]&#10;[Black &quot;Player2&quot;]&#10;[Result &quot;1-0&quot;]&#10;&#10;1. e4 e5 2. Nf3 Nc6 1-0"
            className="w-full h-40 bg-[#1a1d27] border border-gray-700 rounded-lg px-4 py-3 text-gray-300 text-sm font-mono resize-none focus:outline-none focus:border-accent-500"
          />
        </div>
      </div>

      {/* Import button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleImport}
          disabled={loading || !pgnText.trim()}
          className="px-6 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg btn-press"
        >
          {loading ? "Importing..." : "Import Games"}
        </button>
        {pgnText && (
          <p className="text-xs text-gray-500">
            {pgnText.split("[Event").length - 1} game(s) detected
          </p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-[#222639] rounded-xl p-5 animate-fade-in-up">
          <h3 className="text-xl font-semibold mb-3">Import Result</h3>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-2xl font-bold text-green-400">{result.imported}</p>
              </div>
              <p className="text-xs text-gray-500">Imported</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
              <p className="text-xs text-gray-500">Skipped</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                {result.errors.length > 0 && (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
                <p className={`text-2xl font-bold ${result.errors.length > 0 ? "text-red-400" : "text-gray-400"}`}>
                  {result.errors.length}
                </p>
              </div>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-400">{err}</p>
              ))}
            </div>
          )}
          {result.imported > 0 && (
            <p className="text-sm text-green-400 mt-3">
              Games imported successfully! Run analysis to get move-by-move insights.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
