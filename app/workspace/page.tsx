"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import NavPanel from "@/components/workspace/NavPanel";
import OnboardingTour from "@/components/workspace/OnboardingTour";
import DocumentViewer from "@/components/workspace/DocumentViewer";
import AICopilot from "@/components/workspace/AICopilot";
import ArtifactPanel from "@/components/workspace/ArtifactPanel";
import DriveConnectModal from "@/components/workspace/DriveConnectModal";
import {
  loadDocuments,
  persistDocument,
  persistUpdate,
  persistDelete,
  loadJobGroups,
  persistJobGroups,
  isSupabaseConfigured,
  autoGroupDocument,
  getAllJobGroups,
} from "@/lib/persistence";
import type {
  PapyrusDocument,
  ArtifactType,
  ChatMessage,
  UploadResponse,
  JobGroup,
} from "@/lib/types";
import { LanguageProvider } from "@/lib/language-context";
import { dataUrlToFile } from "@/lib/image-utils";

// ── Panel size presets ────────────────────────────────────────────────────────
type PanelSize = "compact" | "normal" | "wide";
const SIZES: PanelSize[] = ["compact", "normal", "wide"];

const NAV_PX:      Record<PanelSize, number> = { compact: 188, normal: 248, wide: 308 };
const CHAT_PX:     Record<PanelSize, number> = { compact: 288, normal: 360, wide: 440 };
const ARTIFACT_PX: Record<PanelSize, number> = { compact: 272, normal: 336, wide: 420 };

function stepSize(current: PanelSize, dir: 1 | -1): PanelSize {
  const idx = SIZES.indexOf(current);
  return SIZES[Math.max(0, Math.min(SIZES.length - 1, idx + dir))];
}

function readSize(key: string, fallback: PanelSize): PanelSize {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return (v === "compact" || v === "normal" || v === "wide") ? v : fallback;
}

// ── Divider with arrow controls ───────────────────────────────────────────────
interface DividerProps {
  shrinkTitle: string;
  expandTitle: string;
  onShrink: () => void;
  onExpand: () => void;
  canShrink: boolean;
  canExpand: boolean;
}

function PanelDivider({ shrinkTitle, expandTitle, onShrink, onExpand, canShrink, canExpand }: DividerProps) {
  return (
    <div className="relative w-5 shrink-0 flex items-center justify-center z-20 group/div">
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/6 group-hover/div:bg-[#F5C800]/20 transition-colors duration-200" />
      <div className="relative flex flex-col gap-0.5 bg-[#1c2330] border border-white/8 rounded-full py-1 px-0.5 shadow-md opacity-40 group-hover/div:opacity-100 transition-opacity duration-150">
        <button
          onClick={onShrink}
          disabled={!canShrink}
          title={shrinkTitle}
          className={`w-[18px] h-[18px] flex items-center justify-center rounded-full transition-all duration-100
            ${canShrink
              ? "text-slate-400 hover:text-[#F5C800] hover:bg-[#F5C800]/12 active:scale-90"
              : "text-slate-700 cursor-not-allowed"}`}
        >
          <ChevronLeft className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={onExpand}
          disabled={!canExpand}
          title={expandTitle}
          className={`w-[18px] h-[18px] flex items-center justify-center rounded-full transition-all duration-100
            ${canExpand
              ? "text-slate-400 hover:text-[#F5C800] hover:bg-[#F5C800]/12 active:scale-90"
              : "text-slate-700 cursor-not-allowed"}`}
        >
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

// ── Processing stages ─────────────────────────────────────────────────────────
const PROCESSING_STAGES = [
  "Uploading file…",
  "Extracting text…",
  "Analyzing structure…",
  "Detecting manufacturing fields…",
  "Ready",
];

// ── Main workspace ────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const router = useRouter();

  const [documents, setDocuments]     = useState<PapyrusDocument[]>([]);
  const [jobGroups, setJobGroups]     = useState<JobGroup[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [processingIds, setProcessingIds]       = useState<Set<string>>(new Set());
  const [processingStages, setProcessingStages] = useState<Record<string, string>>({});
  const [activeArtifactType, setActiveArtifactType] = useState<ArtifactType | null>(null);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [docsLoading, setDocsLoading] = useState(true);

  // ── Panel sizes (localStorage-backed) ──────────────────────────────────────
  const [navSize,      setNavSize]      = useState<PanelSize>(() => readSize("papyrus-nav-size",      "normal"));
  const [chatSize,     setChatSize]     = useState<PanelSize>(() => readSize("papyrus-chat-size",     "normal"));
  const [artifactSize, setArtifactSize] = useState<PanelSize>(() => readSize("papyrus-artifact-size", "normal"));

  useEffect(() => { localStorage.setItem("papyrus-nav-size",      navSize);      }, [navSize]);
  useEffect(() => { localStorage.setItem("papyrus-chat-size",     chatSize);     }, [chatSize]);
  useEffect(() => { localStorage.setItem("papyrus-artifact-size", artifactSize); }, [artifactSize]);

  // ── Session-only object URLs for original file viewing ──────────────────────
  // State (not a ref) so reads during render are safe and trigger correct updates.
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map());

  // ── Load documents on mount (Supabase or localStorage) ─────────────────────
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [docs, groups] = await Promise.all([loadDocuments(), loadJobGroups()]);
        if (cancelled) return;
        setDocuments(docs);
        setJobGroups(groups);
        if (docs.length > 0) setActiveDocId(docs[0].id);
      } catch (err) {
        console.error("[workspace] Failed to load documents:", err);
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const activeDocument = documents.find((d) => d.id === activeDocId) ?? null;

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        const { createSupabaseClient } = await import("@/lib/supabase/client");
        await createSupabaseClient().auth.signOut();
      } catch (err) {
        console.warn("[workspace] Sign-out error:", err);
      }
    }
    router.push("/login");
  }, [router]);

  // ── Multi-file upload ───────────────────────────────────────────────────────
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const stubs: PapyrusDocument[] = files.map((file) => ({
      id: `uploading-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      extractedText: "",
      extractionMethod: "pdf_text" as const,
      metadata: null,
      artifacts: {},
      chatHistory: [],
      uploadedAt: new Date().toISOString(),
      status: "uploading" as const,
    }));

    setDocuments((prev) => [...stubs, ...prev]);
    setActiveDocId(stubs[0].id);

    setFileUrls((prev) => {
      const next = new Map(prev);
      stubs.forEach((stub, idx) => next.set(stub.id, URL.createObjectURL(files[idx])));
      return next;
    });

    await Promise.all(
      stubs.map(async (stub, idx) => {
        const file   = files[idx];
        const tempId = stub.id;

        setProcessingIds((s) => new Set([...s, tempId]));
        setProcessingStages((s) => ({ ...s, [tempId]: PROCESSING_STAGES[0] }));

        const advance = (stage: number, delay: number) =>
          setTimeout(
            () => setProcessingStages((s) => ({ ...s, [tempId]: PROCESSING_STAGES[stage] })),
            delay
          );

        advance(1, 500);
        advance(2, 1800);
        advance(3, 2800);

        try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
          if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);

          const data: UploadResponse = await res.json();
          if (data.error && !data.extractedText) throw new Error(data.error);

          const finalDoc: PapyrusDocument = {
            id: data.documentId,
            fileName: data.fileName,
            fileType: data.fileType,
            fileSizeBytes: data.fileSizeBytes,
            extractedText: data.extractedText,
            pageCount: data.pageCount,
            extractionMethod: data.extractionMethod as PapyrusDocument["extractionMethod"],
            metadata: data.metadata,
            artifacts: {},
            chatHistory: [],
            uploadedAt: new Date().toISOString(),
            status: "ready",
            isMockMode: data.isMockMode,
          };

          // Persist to Supabase (+ localStorage fallback)
          await persistDocument(finalDoc);

          // Update job groups (still localStorage-backed; synced to Supabase below)
          autoGroupDocument(finalDoc.id);
          const updatedGroups = getAllJobGroups();
          setJobGroups(updatedGroups);
          persistJobGroups(updatedGroups).catch(() => {/* best-effort */});

          // Remap object URL from temp id → final doc id
          setFileUrls((prev) => {
            const existing = prev.get(tempId);
            if (!existing) return prev;
            const next = new Map(prev);
            next.set(finalDoc.id, existing);
            next.delete(tempId);
            return next;
          });

          setDocuments((prev) => [finalDoc, ...prev.filter((d) => d.id !== tempId)]);
          setActiveDocId(finalDoc.id);
          setProcessingStages((s) => ({ ...s, [finalDoc.id]: PROCESSING_STAGES[4] }));
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === tempId ? { ...d, status: "error" as const, error: errorMsg } : d
            )
          );
        } finally {
          setProcessingIds((s) => {
            const next = new Set(s);
            next.delete(tempId);
            return next;
          });
        }
      })
    );
  }, []);

  // ── Single-file upload (convenience wrapper) ────────────────────────────────
  const handleFileSelected = useCallback(
    (file: File) => handleFilesSelected([file]),
    [handleFilesSelected]
  );

  // ── Delete document ─────────────────────────────────────────────────────────
  const handleDeleteDoc = useCallback(async (id: string) => {
    await persistDelete(id);

    setDocuments((prev) => prev.filter((d) => d.id !== id));

    const updatedGroups = getAllJobGroups();
    setJobGroups(updatedGroups);
    persistJobGroups(updatedGroups).catch(() => {/* best-effort */});

    setFileUrls((prev) => {
      const url = prev.get(id);
      if (url) URL.revokeObjectURL(url);
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

    setActiveDocId((prev) => {
      if (prev !== id) return prev;
      const remaining = documents.filter((d) => d.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }, [documents]);

  // ── Chat history update ─────────────────────────────────────────────────────
  const handleChatUpdated = useCallback(
    async (history: ChatMessage[]) => {
      if (!activeDocId) return;
      await persistUpdate(activeDocId, { chatHistory: history });
      setDocuments((prev) =>
        prev.map((d) => (d.id === activeDocId ? { ...d, chatHistory: history } : d))
      );
    },
    [activeDocId]
  );

  // ── Artifact generation trigger ─────────────────────────────────────────────
  const handleGenerateArtifact = useCallback((type: string) => {
    setActiveArtifactType(type as ArtifactType);
  }, []);

  // ── File picker ─────────────────────────────────────────────────────────────
  const openFilePicker = useCallback(() => {
    const input = window.document.createElement("input");
    input.type     = "file";
    input.accept   = ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length) handleFilesSelected(files);
    };
    input.click();
  }, [handleFilesSelected]);

  const isProcessing    = processingIds.size > 0;
  const processingStage =
    activeDocId && processingStages[activeDocId]
      ? processingStages[activeDocId]
      : PROCESSING_STAGES[0];

  const navW      = NAV_PX[navSize];
  const chatW     = CHAT_PX[chatSize];
  const artifactW = ARTIFACT_PX[artifactSize];

  return (
    <LanguageProvider>
      <OnboardingTour />

      {/* Modals */}
      {showDriveModal && (
        <DriveConnectModal
          onClose={() => setShowDriveModal(false)}
          onFilesSelected={(files) => { setShowDriveModal(false); handleFilesSelected(files); }}
        />
      )}

      {/* ── Workspace shell ─────────────────────────────────────────────── */}
      <div className="h-full w-full flex overflow-hidden bg-[#1A202C]">

        {/* ── Panel 1 — Navigation ────────────────────────────────────────── */}
        <div
          data-tour="nav-panel"
          style={{ width: navW, transition: "width 220ms cubic-bezier(0.4,0,0.2,1)" }}
          className="shrink-0 overflow-hidden"
        >
          <NavPanel
            documents={documents}
            jobGroups={jobGroups}
            activeDocId={activeDocId}
            onDocSelect={setActiveDocId}
            onDeleteDoc={handleDeleteDoc}
            onUploadRequest={openFilePicker}
            onLogout={handleLogout}
          />
        </div>

        {/* ── Divider 1 ───────────────────────────────────────────────────── */}
        <PanelDivider
          shrinkTitle="Compact nav panel"
          expandTitle="Widen nav panel"
          onShrink={() => setNavSize((s) => stepSize(s, -1))}
          onExpand={() => setNavSize((s) => stepSize(s, 1))}
          canShrink={navSize !== "compact"}
          canExpand={navSize !== "wide"}
        />

        {/* ── Panel 2 — Document Viewer ────────────────────────────────────── */}
        <div
          data-tour="doc-viewer"
          className="flex-1 min-w-[260px] overflow-hidden"
        >
          {/* Loading skeleton */}
          {docsLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#F5C800]/30 border-t-[#F5C800] rounded-full animate-spin" />
                <p className="text-xs text-slate-500">Loading workspace…</p>
              </div>
            </div>
          ) : (
            <DocumentViewer
              document={activeDocument}
              fileUrl={fileUrls.get(activeDocId ?? "") ?? null}
              isProcessing={isProcessing && !!activeDocId?.startsWith("uploading")}
              processingStage={processingStage}
              onFileSelected={handleFileSelected}
              onFilesSelected={handleFilesSelected}
              onDriveConnect={() => setShowDriveModal(true)}
            />
          )}
        </div>

        {/* ── Divider 2 ───────────────────────────────────────────────────── */}
        <PanelDivider
          shrinkTitle="Compact chat panel"
          expandTitle="Widen chat panel"
          onShrink={() => setChatSize((s) => stepSize(s, -1))}
          onExpand={() => setChatSize((s) => stepSize(s, 1))}
          canShrink={chatSize !== "compact"}
          canExpand={chatSize !== "wide"}
        />

        {/* ── Panel 3 — Coworker ──────────────────────────────────────────── */}
        <div
          style={{ width: chatW, transition: "width 220ms cubic-bezier(0.4,0,0.2,1)" }}
          className="shrink-0 overflow-hidden"
        >
          <AICopilot
            document={activeDocument}
            onGenerateArtifact={handleGenerateArtifact}
            onChatUpdated={handleChatUpdated}
            onAddToWorkspace={(imageDataUrl, _analysisText) => {
              const file = dataUrlToFile(imageDataUrl, `camera-capture-${Date.now()}.jpg`);
              handleFilesSelected([file]);
            }}
          />
        </div>

        {/* ── Divider 3 ───────────────────────────────────────────────────── */}
        <PanelDivider
          shrinkTitle="Compact artifact panel"
          expandTitle="Widen artifact panel"
          onShrink={() => setArtifactSize((s) => stepSize(s, -1))}
          onExpand={() => setArtifactSize((s) => stepSize(s, 1))}
          canShrink={artifactSize !== "compact"}
          canExpand={artifactSize !== "wide"}
        />

        {/* ── Panel 4 — Artifacts ─────────────────────────────────────────── */}
        <div
          data-tour="artifacts-panel"
          style={{ width: artifactW, transition: "width 220ms cubic-bezier(0.4,0,0.2,1)" }}
          className="shrink-0 overflow-hidden"
        >
          <ArtifactPanel
            document={activeDocument}
            activeArtifactType={activeArtifactType}
          />
        </div>

      </div>
    </LanguageProvider>
  );
}
