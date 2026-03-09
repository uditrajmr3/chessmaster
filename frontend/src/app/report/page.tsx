"use client";

import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
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
      let status = await api.getReportStatus();
      while (status.status === "generating") {
        await new Promise((r) => setTimeout(r, 2000));
        status = await api.getReportStatus();
      }
      if (status.status === "error") {
        alert(`Report generation failed: ${status.error}`);
      } else {
        await loadReport();
      }
    } catch {
      alert(
        `Failed to generate report. Make sure ANTHROPIC_API_KEY is set in backend/.env and games have been analyzed.`
      );
    }
    setGenerating(false);
  }

  if (loading) return <ReportSkeleton />;

  return (
    <div className="space-y-6">
      {/* Zone 3 — Page header, no animation on title */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">AI Coach Report</h2>
          <p className="text-gray-400 text-sm">
            Personalized analysis of your recurring patterns and weaknesses
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-6 py-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg btn-press"
        >
          {generating ? "Generating..." : report ? "Regenerate Report" : "Generate Report"}
        </button>
      </div>

      {!report ? (
        <div className="flex flex-col items-center justify-center h-80 gap-6 animate-fade-in-up">
          <FileText className="w-10 h-10 text-gray-500" />
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold">Your coaching report starts here</h3>
            <p className="text-gray-400 text-center max-w-md">
              Sync and analyze your games, then generate a report to get
              personalized coaching insights powered by AI.
            </p>
          </div>
          <p className="text-gray-500 text-xs">
            Requires ANTHROPIC_API_KEY in backend/.env
          </p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>
              Generated: {new Date(report.generated_at).toLocaleString()}
            </span>
            <span>·</span>
            <span>{report.games_count} games analyzed</span>
          </div>

          <div className="bg-[#222639] rounded-xl p-8 card-hover">
            <div className="max-w-none">
              <MarkdownRenderer text={report.report_text} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="skeleton" style={{ height: 32, width: 200, borderRadius: 6 }} />
          <div className="skeleton mt-2" style={{ height: 16, width: 360, borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ height: 40, width: 160, borderRadius: 8 }} />
      </div>
      <div className="skeleton" style={{ height: 16, width: 280, borderRadius: 4 }} />
      <div className="bg-[#222639] rounded-xl p-8">
        <div className="skeleton" style={{ height: 28, width: 300, borderRadius: 6 }} />
        <div className="skeleton mt-4" style={{ height: 16, width: "100%", borderRadius: 4 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: "90%", borderRadius: 4 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: "95%", borderRadius: 4 }} />
        <div className="skeleton mt-6" style={{ height: 24, width: 240, borderRadius: 6 }} />
        <div className="skeleton mt-4" style={{ height: 16, width: "100%", borderRadius: 4 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: "85%", borderRadius: 4 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: "92%", borderRadius: 4 }} />
        <div className="skeleton mt-6" style={{ height: 24, width: 200, borderRadius: 6 }} />
        <div className="skeleton mt-4" style={{ height: 16, width: "100%", borderRadius: 4 }} />
        <div className="skeleton mt-2" style={{ height: 16, width: "88%", borderRadius: 4 }} />
      </div>
    </div>
  );
}

function renderInline(text: string) {
  // Handle **bold**, *italic*, and `code` inline formatting
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={i} className="text-gray-200 italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="text-accent-300 bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

interface Block {
  type: "h1" | "h2" | "h3" | "bold-line" | "bullet" | "numbered" | "code" | "blank" | "paragraph";
  content: string;
  index: number;
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("# ")) return { type: "h1", content: line.slice(2), index: i };
    if (line.startsWith("## ")) return { type: "h2", content: line.slice(3), index: i };
    if (line.startsWith("### ")) return { type: "h3", content: line.slice(4), index: i };
    if (line.startsWith("**") && line.endsWith("**")) return { type: "bold-line", content: line.slice(2, -2), index: i };
    if (line.startsWith("- ")) return { type: "bullet", content: line.slice(2), index: i };
    if (/^\d+\.\s/.test(line)) return { type: "numbered", content: line.replace(/^\d+\.\s/, ""), index: i };
    if (line.startsWith("FEN:") || line.startsWith("`")) return { type: "code", content: line, index: i };
    if (line.trim() === "") return { type: "blank", content: "", index: i };
    return { type: "paragraph", content: line, index: i };
  });
}

function MarkdownRenderer({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // Group consecutive bullet items into a <ul>
    if (block.type === "bullet") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "bullet") {
        items.push(blocks[i]);
        i++;
      }
      elements.push(
        <ul key={`ul-${block.index}`} className="space-y-1.5 my-3 ml-1">
          {items.map((item) => (
            <li key={item.index} className="text-gray-300 leading-relaxed flex gap-2">
              <span className="text-accent-500 mt-1.5 shrink-0">&#8226;</span>
              <span>{renderInline(item.content)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Group consecutive numbered items into an <ol>
    if (block.type === "numbered") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "numbered") {
        items.push(blocks[i]);
        i++;
      }
      elements.push(
        <ol key={`ol-${block.index}`} className="space-y-2 my-3 ml-1 list-none counter-reset-item">
          {items.map((item, idx) => (
            <li key={item.index} className="text-gray-300 leading-relaxed flex gap-3">
              <span className="text-accent-400 font-semibold font-mono text-sm mt-0.5 shrink-0 w-5 text-right">
                {idx + 1}.
              </span>
              <span>{renderInline(item.content)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Group consecutive code lines
    if (block.type === "code") {
      const codeLines: Block[] = [];
      while (i < blocks.length && blocks[i].type === "code") {
        codeLines.push(blocks[i]);
        i++;
      }
      elements.push(
        <pre
          key={`code-${block.index}`}
          className="text-xs font-mono text-gray-400 bg-gray-800/60 border border-gray-700/50 p-3 rounded-lg my-3 overflow-x-auto"
        >
          {codeLines.map((cl) => cl.content.replace(/^`|`$/g, "")).join("\n")}
        </pre>
      );
      continue;
    }

    // Skip consecutive blank lines (render at most one spacer)
    if (block.type === "blank") {
      // Only add spacer if not at the start
      if (elements.length > 0) {
        elements.push(<div key={`sp-${block.index}`} className="h-2" />);
      }
      i++;
      // Skip additional consecutive blanks
      while (i < blocks.length && blocks[i].type === "blank") i++;
      continue;
    }

    if (block.type === "h1") {
      elements.push(
        <h1 key={block.index} className="text-2xl font-bold mt-8 mb-3 text-white first:mt-0">
          {renderInline(block.content)}
        </h1>
      );
    } else if (block.type === "h2") {
      elements.push(
        <h2 key={block.index} className="text-xl font-bold mt-8 mb-3 text-accent-400 border-b border-gray-700/50 pb-2">
          {renderInline(block.content)}
        </h2>
      );
    } else if (block.type === "h3") {
      elements.push(
        <h3 key={block.index} className="text-lg font-semibold mt-5 mb-2 text-accent-300">
          {renderInline(block.content)}
        </h3>
      );
    } else if (block.type === "bold-line") {
      elements.push(
        <p key={block.index} className="font-semibold text-white mt-4 mb-1">
          {renderInline(block.content)}
        </p>
      );
    } else if (block.type === "paragraph") {
      elements.push(
        <p key={block.index} className="text-gray-300 leading-relaxed my-1.5">
          {renderInline(block.content)}
        </p>
      );
    }

    i++;
  }

  return <div className="space-y-0">{elements}</div>;
}
