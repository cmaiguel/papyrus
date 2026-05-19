"use client";

import { useState } from "react";
import { X, Zap, AlertTriangle, FileText, CheckSquare, BarChart2, BookOpen } from "lucide-react";
import type { PapyrusDocument, ProactiveSuggestion, ArtifactType } from "@/lib/types";

// ─── Derive suggestions from real document metadata ──────────────────────────

export function deriveProactiveSuggestions(doc: PapyrusDocument): ProactiveSuggestion[] {
  const meta = doc.metadata;
  if (!meta) return [];

  const suggestions: ProactiveSuggestion[] = [];

  // 1. Missing signatures → corrective action
  const missingSigs = meta.signatures?.filter((s) => s.status === "missing") ?? [];
  if (missingSigs.length > 0) {
    suggestions.push({
      id: "missing-signatures",
      title: `${missingSigs.length} missing signature${missingSigs.length > 1 ? "s" : ""} detected`,
      description: `${missingSigs.map((s) => s.role).join(", ")} — job cannot ship without sign-off`,
      actionLabel: "Generate Risk Report",
      artifactType: "risk_report",
      severity: "critical",
    });
  }

  // 2. Critical / high risk flags
  const highRisks = meta.riskFlags?.filter((r) => r.severity === "critical" || r.severity === "high") ?? [];
  if (highRisks.length > 0 && missingSigs.length === 0) {
    suggestions.push({
      id: "risk-flags",
      title: `${highRisks.length} quality risk${highRisks.length > 1 ? "s" : ""} flagged`,
      description: highRisks[0].description,
      actionLabel: "Generate Risk Report",
      artifactType: "risk_report",
      severity: "warning",
    });
  }

  // 3. Traveler → suggest traveler summary
  if (meta.documentType === "traveler") {
    suggestions.push({
      id: "traveler-summary",
      title: "Traveler ready for summary",
      description: "Generate a clean summary for shift handoff or filing",
      actionLabel: "Generate Summary",
      artifactType: "traveler_summary",
      severity: "info",
    });
  }

  // 4. Has operations → suggest SOP
  if ((meta.operations?.length ?? 0) > 2) {
    suggestions.push({
      id: "sop",
      title: `${meta.operations.length} operations — SOP ready`,
      description: "Turn these operations into a step-by-step operator SOP",
      actionLabel: "Generate SOP",
      artifactType: "sop",
      severity: "info",
    });
  }

  // 5. Inspection doc → checklist
  if (meta.documentType === "inspection") {
    suggestions.push({
      id: "inspection-checklist",
      title: "Inspection document detected",
      description: "Generate a structured checklist with acceptance criteria",
      actionLabel: "Generate Checklist",
      artifactType: "inspection_checklist",
      severity: "info",
    });
  }

  return suggestions.slice(0, 3);
}

// ─── Icon per suggestion ──────────────────────────────────────────────────────

function SuggestionIcon({ s }: { s: ProactiveSuggestion }) {
  if (s.severity === "critical") return <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  if (s.severity === "warning")  return <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
  if (s.artifactType === "traveler_summary") return <FileText className="w-3.5 h-3.5 text-[#F5C800] shrink-0" />;
  if (s.artifactType === "sop")              return <BookOpen className="w-3.5 h-3.5 text-[#F5C800] shrink-0" />;
  if (s.artifactType === "inspection_checklist") return <CheckSquare className="w-3.5 h-3.5 text-[#F5C800] shrink-0" />;
  if (s.artifactType === "risk_report")      return <BarChart2 className="w-3.5 h-3.5 text-[#F5C800] shrink-0" />;
  return <Zap className="w-3.5 h-3.5 text-[#F5C800] shrink-0" />;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/25 bg-red-500/5",
  warning:  "border-orange-500/25 bg-orange-500/5",
  info:     "border-[#F5C800]/20 bg-[#F5C800]/3",
};

const ACTION_STYLES: Record<string, string> = {
  critical: "text-red-400 hover:bg-red-400/10 border-red-400/20",
  warning:  "text-orange-400 hover:bg-orange-400/10 border-orange-400/20",
  info:     "text-[#F5C800] hover:bg-[#F5C800]/10 border-[#F5C800]/20",
};

// ─── Component ───────────────────────────────────────────────────────────────

interface ProactiveBannerProps {
  document: PapyrusDocument;
  onGenerateArtifact: (type: ArtifactType) => void;
}

export default function ProactiveBanner({ document, onGenerateArtifact }: ProactiveBannerProps) {
  const all = deriveProactiveSuggestions(document);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = all.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  return (
    <div className="px-3 pt-2.5 pb-0 space-y-1.5 shrink-0">
      <div className="flex items-center gap-1 mb-1">
        <Zap className="w-3 h-3 text-[#F5C800]" />
        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
          AI Suggestions
        </span>
      </div>
      {visible.map((s) => (
        <div
          key={s.id}
          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${SEVERITY_STYLES[s.severity]}`}
        >
          <SuggestionIcon s={s} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-200 leading-tight">{s.title}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{s.description}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {s.artifactType && (
              <button
                onClick={() => {
                  onGenerateArtifact(s.artifactType!);
                  setDismissed((prev) => new Set([...prev, s.id]));
                }}
                className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${ACTION_STYLES[s.severity]}`}
              >
                {s.actionLabel}
              </button>
            )}
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, s.id]))}
              className="p-0.5 rounded text-slate-600 hover:text-slate-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
