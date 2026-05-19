"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  CheckSquare,
  AlertTriangle,
  Code2,
  Download,
  RefreshCw,
  Sparkles,
  Shield,
  ClipboardList,
  Layers,
  Users,
  Loader2,
} from "lucide-react";
import type { PapyrusDocument, ArtifactType, GeneratedArtifact } from "@/lib/types";
import { saveArtifact } from "@/lib/document-store";

interface ArtifactPanelProps {
  document: PapyrusDocument | null;
  activeArtifactType: ArtifactType | null;
}

const ARTIFACT_CONFIG: {
  type: ArtifactType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    type: "traveler_summary",
    label: "Traveler Summary",
    icon: <Layers className="w-3.5 h-3.5" />,
    description: "Job overview, operation status, next actions",
  },
  {
    type: "sop",
    label: "SOP",
    icon: <FileText className="w-3.5 h-3.5" />,
    description: "Step-by-step standard operating procedure",
  },
  {
    type: "inspection_checklist",
    label: "Inspection Checklist",
    icon: <CheckSquare className="w-3.5 h-3.5" />,
    description: "QA inspection checklist with acceptance criteria",
  },
  {
    type: "operator_checklist",
    label: "Operator Checklist",
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    description: "Shop-floor operator step-by-step checklist",
  },
  {
    type: "risk_report",
    label: "Risk Report",
    icon: <Shield className="w-3.5 h-3.5" />,
    description: "Compliance gaps, missing docs, quality risks",
  },
  {
    type: "structured_json",
    label: "JSON Extract",
    icon: <Code2 className="w-3.5 h-3.5" />,
    description: "Structured data for ERP/MES integration",
  },
  {
    type: "shift_handoff",
    label: "Shift Handoff",
    icon: <Users className="w-3.5 h-3.5" />,
    description: "Handoff summary for next shift",
  },
];

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <div key={i} className="font-bold text-slate-100 text-sm mt-3 mb-1 first:mt-0 border-b border-white/8 pb-1">
              {line.slice(3)}
            </div>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <div key={i} className="font-bold text-[#F5C800] text-base mt-2 mb-2 first:mt-0">
              {line.slice(2)}
            </div>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <div key={i} className="font-semibold text-slate-200 text-xs mt-2 mb-1">
              {line.slice(4)}
            </div>
          );
        }
        if (line.startsWith("- [ ]") || line.startsWith("- [x]") || line.startsWith("- [X]")) {
          const checked = line.includes("[x]") || line.includes("[X]");
          return (
            <div key={i} className={`flex items-start gap-2 py-0.5 ${checked ? "text-slate-500 line-through" : ""}`}>
              <span className={`mt-0.5 shrink-0 ${checked ? "text-green-500" : "text-slate-500"}`}>
                {checked ? "☑" : "☐"}
              </span>
              <span>{line.slice(line.indexOf("]") + 2)}</span>
            </div>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex items-start gap-1.5 py-0.5">
              <span className="text-[#F5C800] shrink-0 mt-0.5">·</span>
              <span>
                {line
                  .slice(2)
                  .split(/\*\*(.*?)\*\*/g)
                  .map((part, j) =>
                    j % 2 === 1 ? (
                      <strong key={j} className="text-slate-100">
                        {part}
                      </strong>
                    ) : (
                      part
                    )
                  )}
              </span>
            </div>
          );
        }
        if (line === "") return <div key={i} className="h-1.5" />;
        // Bold inline
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <div key={i} className="py-0.5">
            {parts.map((part, j) =>
              j % 2 === 1 ? (
                <strong key={j} className="text-slate-100">
                  {part}
                </strong>
              ) : (
                part
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ArtifactPanel({ document, activeArtifactType }: ArtifactPanelProps) {
  const [selectedType, setSelectedType] = useState<ArtifactType>("traveler_summary");
  const [loadingType, setLoadingType] = useState<ArtifactType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localArtifacts, setLocalArtifacts] = useState<
    Partial<Record<ArtifactType, GeneratedArtifact>>
  >({});

  const hasDocument = document !== null && document.status === "ready";

  // Merge stored artifacts with locally generated ones
  const artifacts = { ...(document?.artifacts ?? {}), ...localArtifacts };
  const currentArtifact = artifacts[selectedType];

  const generate = useCallback(
    async (type: ArtifactType) => {
      if (!hasDocument || loadingType) return;
      setSelectedType(type);
      setLoadingType(type);
      setError(null);

      try {
        const res = await fetch("/api/artifacts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: document!.id,
            extractedText: document!.extractedText,
            metadata: document!.metadata,
            artifactType: type,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body}`);
        }

        const data = await res.json();
        const artifact: GeneratedArtifact = {
          type: data.type,
          title: data.title,
          content: data.content,
          generatedAt: new Date().toISOString(),
        };

        setLocalArtifacts((prev) => ({ ...prev, [type]: artifact }));

        // Persist to localStorage
        if (document?.id) saveArtifact(document.id, artifact);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingType(null);
      }
    },
    [hasDocument, loadingType, document]
  );

  // Auto-generate when activeArtifactType changes
  const lastTriggered = useState<ArtifactType | null>(null);

  const handleDownload = () => {
    if (!currentArtifact) return;
    const blob = new Blob([currentArtifact.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = globalThis.document.createElement("a");
    a.href = url;
    a.download = `${currentArtifact.title.replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#232B38] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200">Artifacts</span>
        </div>
        <div className="flex items-center gap-1">
          {currentArtifact && (
            <>
              <button
                onClick={() => generate(selectedType)}
                disabled={!!loadingType || !hasDocument}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#F5C800] transition-colors px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30"
              >
                {loadingType === selectedType ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Regen
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-[#F5C800] transition-colors px-2 py-1 rounded hover:bg-white/5"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* No document state */}
      {!hasDocument ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
            <Layers className="w-6 h-6 text-purple-400" />
          </div>
          <p className="text-sm text-slate-400 font-medium mb-2">No Artifacts Yet</p>
          <p className="text-xs text-slate-600 mb-6">
            Upload a manufacturing document and AI will generate real SOPs, checklists, risk
            reports, and structured data from your actual document content.
          </p>
          <div className="space-y-2 w-full">
            {ARTIFACT_CONFIG.slice(0, 4).map(({ icon, label, description }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 bg-[#1A202C] rounded-lg px-3 py-2 border border-white/5"
              >
                <span className="text-slate-600">{icon}</span>
                <div className="text-left">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="text-[9px] text-slate-700">{description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Artifact type selector */}
          <div className="px-3 pt-3 pb-2 border-b border-white/8 shrink-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Generate
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ARTIFACT_CONFIG.map(({ type, label, icon }) => {
                const isGenerated = !!artifacts[type];
                const isLoading = loadingType === type;
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                      if (!isGenerated && !isLoading) generate(type);
                    }}
                    disabled={!!loadingType}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] transition-all border disabled:opacity-50 ${
                      isSelected
                        ? "bg-[#F5C800]/10 border-[#F5C800]/30 text-[#F5C800]"
                        : isGenerated
                        ? "bg-green-400/5 border-green-400/20 text-green-400 hover:border-green-400/40"
                        : "bg-[#1A202C] border-white/8 text-slate-400 hover:text-[#F5C800] hover:border-[#F5C800]/30"
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    ) : (
                      <span className="shrink-0">{icon}</span>
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Artifact content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}

            {loadingType === selectedType && !currentArtifact ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-6 h-6 text-[#F5C800] animate-spin" />
                <p className="text-xs text-slate-500">
                  Generating {ARTIFACT_CONFIG.find((a) => a.type === selectedType)?.label}…
                </p>
                <p className="text-[10px] text-slate-600 text-center">
                  Coworker is reading your document and building this artifact
                </p>
              </div>
            ) : currentArtifact ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-slate-200">
                    {currentArtifact.title}
                  </div>
                  <span className="text-[9px] text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                    {document?.isMockMode ? "Mock" : "AI Generated"}
                  </span>
                </div>

                {selectedType === "structured_json" ? (
                  <div className="bg-[#0f1117] rounded-xl border border-white/8 p-4 overflow-x-auto">
                    <pre className="text-[10px] font-mono leading-relaxed text-green-300 whitespace-pre-wrap">
                      {currentArtifact.content}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-[#1A202C] rounded-xl border border-white/8 p-4">
                    <MarkdownContent content={currentArtifact.content} />
                  </div>
                )}

                <div className="mt-3 text-[9px] text-slate-600 text-center">
                  Generated{" "}
                  {new Date(currentArtifact.generatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-[#F5C800]/30 mb-3">
                  {ARTIFACT_CONFIG.find((a) => a.type === selectedType)?.icon}
                </div>
                <p className="text-xs text-slate-500 font-medium mb-1">
                  {ARTIFACT_CONFIG.find((a) => a.type === selectedType)?.label}
                </p>
                <p className="text-[10px] text-slate-600 mb-4">
                  {ARTIFACT_CONFIG.find((a) => a.type === selectedType)?.description}
                </p>
                <button
                  onClick={() => generate(selectedType)}
                  disabled={!!loadingType}
                  className="px-4 py-2 rounded-lg bg-[#F5C800]/10 border border-[#F5C800]/20 text-[#F5C800] text-xs font-medium hover:bg-[#F5C800]/15 transition-colors disabled:opacity-40"
                >
                  Generate Now
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
