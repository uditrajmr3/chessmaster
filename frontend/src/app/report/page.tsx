"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReportData } from "@/lib/types";

export default function ReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      const data = await api.getLatestReport();
      setReport(data);
    } catch {
      // no report yet
    }
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await api.generateReport();
      await loadReport();
    } catch (e) {
      alert(
        `Failed to generate report. Make sure ANTHROPIC_API_KEY is set in backend/.env and games have been analyzed.`
      );
    }
    setGenerating(false);
  }

  if (loading) return <div className="text-gray-400">Loading report...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">AI Coach Report</h2>
          <p className="text-gray-400 text-sm">
            Personalized analysis of your recurring patterns and weaknesses
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {generating ? "Generating..." : report ? "Regenerate Report" : "Generate Report"}
        </button>
      </div>

      {!report ? (
        <div className="flex flex-col items-center justify-center h-80 gap-4">
          <div className="text-5xl">🤖</div>
          <p className="text-gray-400 text-center max-w-md">
            No report generated yet. Make sure you have synced and analyzed your
            games, then click &quot;Generate Report&quot; to get your personalized coaching
            analysis.
          </p>
          <p className="text-gray-500 text-sm">
            Requires ANTHROPIC_API_KEY in backend/.env
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>
              Generated: {new Date(report.generated_at).toLocaleString()}
            </span>
            <span>·</span>
            <span>{report.games_count} games analyzed</span>
          </div>

          <div className="bg-[#222639] rounded-xl p-8">
            <div className="prose prose-invert max-w-none">
              {report.report_text.split("\n").map((line, i) => {
                if (line.startsWith("# ")) {
                  return (
                    <h1 key={i} className="text-2xl font-bold mt-8 mb-3 text-white">
                      {line.slice(2)}
                    </h1>
                  );
                }
                if (line.startsWith("## ")) {
                  return (
                    <h2 key={i} className="text-xl font-bold mt-6 mb-2 text-blue-400">
                      {line.slice(3)}
                    </h2>
                  );
                }
                if (line.startsWith("### ")) {
                  return (
                    <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-purple-400">
                      {line.slice(4)}
                    </h3>
                  );
                }
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <p key={i} className="font-bold text-white mt-3">
                      {line.slice(2, -2)}
                    </p>
                  );
                }
                if (line.startsWith("- ")) {
                  return (
                    <li key={i} className="text-gray-300 ml-4 list-disc">
                      {renderBold(line.slice(2))}
                    </li>
                  );
                }
                if (line.startsWith("FEN:") || line.startsWith("`")) {
                  return (
                    <code
                      key={i}
                      className="block text-xs font-mono text-gray-500 bg-gray-800 p-2 rounded my-1"
                    >
                      {line}
                    </code>
                  );
                }
                if (line.trim() === "") {
                  return <br key={i} />;
                }
                return (
                  <p key={i} className="text-gray-300 leading-relaxed">
                    {renderBold(line)}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
