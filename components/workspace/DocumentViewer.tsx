"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileText,
  ZoomIn,
  ZoomOut,
  Grid,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSearch,
  Cpu,
  ScanLine,
} from "lucide-react";
import type { PapyrusDocument } from "@/lib/types";
import EntryScreen from "./EntryScreen";

interface DocumentViewerProps {
  document: PapyrusDocument | null;
  fileUrl: string | null;           // object URL of the original file
  isProcessing: boolean;
  processingStage: string;
  onFileSelected: (file: File) => void;
  onFilesSelected: (files: File[]) => void;
  onDriveConnect: () => void;
}

const STATUS_ICON = {
  critical: <XCircle className="w-3 h-3 text-red-400" />,
  high: <AlertTriangle className="w-3 h-3 text-orange-400" />,
  medium: <AlertTriangle className="w-3 h-3 text-yellow-400" />,
  low: <AlertTriangle className="w-3 h-3 text-blue-400" />,
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-400/10 text-red-400 border-red-400/20",
  high: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  medium: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  low: "bg-blue-400/10 text-blue-400 border-blue-400/20",
};

type ViewMode = "document" | "analysis" | "text";

export default function DocumentViewer({
  document,
  fileUrl,
  isProcessing,
  processingStage,
  onFileSelected,
  onFilesSelected,
  onDriveConnect,
}: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<ViewMode>("document");
  const [showFields, setShowFields] = useState(true);
  const [activeFieldTab, setActiveFieldTab] = useState<"fields" | "risks" | "ops">("fields");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"],
    },
    multiple: false,
  });

  const meta = document?.metadata;
  const hasText = (document?.extractedText?.length ?? 0) > 20;
  const isPdf = document?.fileType === "application/pdf";
  const isImage = document?.fileType?.startsWith("image/");

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!document && !isProcessing) {
    return (
      <EntryScreen
        onFilesSelected={onFilesSelected}
        onDriveConnect={onDriveConnect}
      />
    );
  }

  // ── Processing state ───────────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <div className="flex flex-col flex-1 min-w-0 bg-[#1A202C] border-r border-white/8">
        <div className="flex items-center px-4 py-2.5 border-b border-white/8 bg-[#232B38]">
          <Layers className="w-4 h-4 text-[#F5C800] mr-2" />
          <span className="text-sm font-medium text-slate-200">
            {document?.fileName ?? "Uploading…"}
          </span>
          <span className="ml-2 flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            {processingStage}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F5C800]/10 border border-[#F5C800]/20 flex items-center justify-center">
            <Cpu className="w-7 h-7 text-[#F5C800] animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-200 mb-1">{processingStage}</p>
            <p className="text-xs text-slate-500">Papyrus is analyzing your document…</p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {["Uploading", "Extracting text", "Analyzing structure", "Detecting fields"].map((stage) => (
              <div
                key={stage}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full bg-[#232B38] border border-white/8 text-slate-500"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    processingStage.includes(stage.split(" ")[0])
                      ? "bg-[#F5C800] animate-pulse"
                      : "bg-slate-700"
                  }`}
                />
                {stage}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Document loaded ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-w-0 bg-[#1A202C] border-r border-white/8 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-[#232B38] shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-[#F5C800] shrink-0" />
          <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">
            {document?.fileName}
          </span>
          <span className="text-[10px] text-slate-600 font-mono shrink-0">
            {document?.pageCount ? `${document.pageCount}p` : ""}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full shrink-0">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {document?.isMockMode ? "OCR" : "AI Analyzed"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* View mode tabs */}
          {fileUrl && (
            <button
              onClick={() => setViewMode("document")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] transition-colors ${
                viewMode === "document"
                  ? "bg-[#F5C800]/15 text-[#F5C800] border border-[#F5C800]/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              <ScanLine className="w-3 h-3" />
              Original
            </button>
          )}
          <button
            onClick={() => setViewMode("analysis")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] transition-colors ${
              viewMode === "analysis"
                ? "bg-[#F5C800]/15 text-[#F5C800] border border-[#F5C800]/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <FileSearch className="w-3 h-3" />
            Analysis
          </button>
          <button
            onClick={() => setViewMode("text")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] transition-colors ${
              viewMode === "text"
                ? "bg-[#F5C800]/15 text-[#F5C800] border border-[#F5C800]/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <FileText className="w-3 h-3" />
            Text
          </button>

          <button
            onClick={() => setShowFields(!showFields)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] transition-colors ml-1 ${
              showFields
                ? "bg-[#F5C800]/15 text-[#F5C800] border border-[#F5C800]/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <Grid className="w-3 h-3" />
            Fields
          </button>

          {viewMode !== "document" && (
            <>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-500 font-mono w-10 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Drop new file — minimal strip */}
      <div
        {...getRootProps()}
        className={`shrink-0 border-b border-white/5 px-4 py-1.5 text-center cursor-pointer transition-all ${
          isDragActive ? "bg-[#F5C800]/8 border-[#F5C800]/20" : "hover:bg-white/3"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-[10px] text-slate-600 hover:text-slate-500 transition-colors">
          {isDragActive ? "↓ Drop to replace" : "Drop or click to replace document"}
        </p>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Original document view ─────────────────────────────────────── */}
        {viewMode === "document" && (
          <div className="flex-1 overflow-hidden p-3">
            {fileUrl ? (
              isPdf ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-full rounded-xl border border-white/10"
                  title={document?.fileName}
                />
              ) : isImage ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl}
                    alt={document?.fileName}
                    className="max-w-full max-h-full object-contain rounded-xl border border-white/10"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  Preview not available for this file type
                </div>
              )
            ) : (
              /* File not available (loaded from localStorage after page refresh) */
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400 mb-1">Original file not available</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The original file is only available during the current session.<br />
                    Re-upload the file to view it again, or switch to Analysis view.
                  </p>
                </div>
                <button
                  onClick={() => setViewMode("analysis")}
                  className="text-xs text-[#F5C800] hover:underline"
                >
                  View Analysis instead →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Analysis view ──────────────────────────────────────────────── */}
        {viewMode === "analysis" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {meta?.summary && (
                <div className="bg-[#232B38] rounded-xl border border-[#F5C800]/20 p-4">
                  <div className="text-[10px] text-[#F5C800] uppercase tracking-wider font-semibold mb-2">
                    AI Document Summary
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{meta.summary}</p>
                </div>
              )}

              {(meta?.operations?.length ?? 0) > 0 && (
                <div className="bg-[#232B38] rounded-xl border border-white/8 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/8 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Operations ({meta!.operations.length})
                  </div>
                  <div className="divide-y divide-white/5">
                    {meta!.operations.map((op, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[10px] font-mono text-slate-500 w-8 shrink-0">{op.number}</span>
                        <span className="text-[12px] text-slate-200 flex-1 truncate">{op.name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${
                          op.status === "complete" ? "bg-green-400/10 text-green-400 border-green-400/20"
                          : op.status === "blocked" ? "bg-red-400/10 text-red-400 border-red-400/20"
                          : "bg-slate-400/10 text-slate-400 border-slate-400/20"
                        }`}>
                          {op.status}
                        </span>
                        {op.signature === "missing" && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        {op.signature === "present" && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(meta?.riskFlags?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-1">
                    Risk Flags ({meta!.riskFlags.length})
                  </div>
                  {meta!.riskFlags.map((flag, i) => (
                    <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${SEVERITY_BADGE[flag.severity]}`}>
                      {STATUS_ICON[flag.severity]}
                      <span className="text-[11px] leading-snug">{flag.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {!meta && hasText && (
                <div className="bg-[#232B38] rounded-xl border border-white/8 p-4 text-center text-slate-500 text-sm">
                  Document text extracted. AI field analysis requires{" "}
                  <code className="text-[#F5C800] text-xs">ANTHROPIC_API_KEY</code>.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Raw text view ──────────────────────────────────────────────── */}
        {viewMode === "text" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div
              className="bg-[#232B38] rounded-xl border border-white/8 p-4 font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap"
              style={{ fontSize: `${(zoom / 100) * 11}px` }}
            >
              {hasText
                ? document!.extractedText
                : "No text extracted — document may be a scanned image. AI vision analysis was used."}
            </div>
          </div>
        )}

        {/* ── Fields sidebar ─────────────────────────────────────────────── */}
        {showFields && meta && (
          <div className="w-52 shrink-0 border-l border-white/8 overflow-y-auto bg-[#232B38]/50">
            <div className="flex border-b border-white/8 sticky top-0 bg-[#232B38]">
              {(["fields", "ops", "risks"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFieldTab(tab)}
                  className={`flex-1 py-2 text-[10px] capitalize transition-colors ${
                    activeFieldTab === tab
                      ? "text-[#F5C800] border-b border-[#F5C800]"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-3 space-y-2.5">
              {activeFieldTab === "fields" && (
                <>
                  {[
                    ["Customer", meta.customer],
                    ["Part Number", meta.partNumber],
                    ["Revision", meta.revision],
                    ["Job Number", meta.jobNumber],
                    ["Material", meta.material],
                    ["Quantity", meta.quantity],
                    ["Heat Lot", meta.heatLot],
                    ["Date", meta.travelerDate],
                  ]
                    .filter(([, field]) => field != null)
                    .map(([label, field]) => {
                      const f = field as { value: string; confidence: number };
                      return (
                        <div key={label as string}>
                          <div className="text-[9px] text-slate-600 uppercase tracking-wider">{label as string}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="text-[11px] font-mono text-slate-300 truncate flex-1">{f.value}</div>
                            <span className={`text-[9px] shrink-0 ${
                              f.confidence > 0.8 ? "text-green-400" : f.confidence > 0.5 ? "text-yellow-400" : "text-red-400"
                            }`}>
                              {Math.round(f.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  {(meta.specifications?.length ?? 0) > 0 && (
                    <div>
                      <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Specs</div>
                      {meta.specifications!.map((s, i) => (
                        <div key={i} className="text-[10px] font-mono text-slate-400 truncate">{s.value}</div>
                      ))}
                    </div>
                  )}

                  {(meta.missingFields?.length ?? 0) > 0 && (
                    <div className="pt-1 border-t border-white/8">
                      <div className="text-[9px] text-red-400 uppercase tracking-wider mb-1.5">Missing</div>
                      {meta.missingFields!.map((mf, i) => (
                        <div key={i} className="text-[10px] text-red-300 flex items-start gap-1">
                          <span className="shrink-0 mt-0.5">⚠</span>
                          {mf.field}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeFieldTab === "ops" && (
                <>
                  {meta.operations?.map((op, i) => (
                    <div key={i} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-slate-600">{op.number}</span>
                        <span className="text-[10px] text-slate-300 truncate flex-1">{op.name}</span>
                      </div>
                      <div className="flex gap-1.5 mt-0.5">
                        <span className={`text-[8px] px-1.5 rounded ${op.status === "complete" ? "bg-green-400/10 text-green-400" : "bg-slate-700 text-slate-500"}`}>
                          {op.status}
                        </span>
                        <span className={`text-[8px] px-1.5 rounded ${op.signature === "present" ? "bg-green-400/10 text-green-400" : op.signature === "missing" ? "bg-red-400/10 text-red-400" : "bg-slate-700 text-slate-500"}`}>
                          sig: {op.signature ?? "?"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!meta.operations?.length && <p className="text-[10px] text-slate-600">No operations detected</p>}
                </>
              )}

              {activeFieldTab === "risks" && (
                <>
                  {meta.riskFlags?.map((flag, i) => (
                    <div key={i} className={`p-2 rounded-lg border text-[10px] leading-snug ${SEVERITY_BADGE[flag.severity]}`}>
                      <span className="font-semibold uppercase text-[8px] block mb-0.5">{flag.severity}</span>
                      {flag.description}
                    </div>
                  ))}
                  {!meta.riskFlags?.length && <p className="text-[10px] text-green-400">No risks detected</p>}
                </>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
