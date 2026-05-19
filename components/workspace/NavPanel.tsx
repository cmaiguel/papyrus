"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  FolderOpen,
  Trash2,
} from "lucide-react";
import type { PapyrusDocument, JobGroup } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { LOCALES } from "@/lib/i18n";

interface NavPanelProps {
  documents: PapyrusDocument[];
  jobGroups: JobGroup[];
  activeDocId: string | null;
  onDocSelect: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onUploadRequest: () => void;
  onLogout?: () => void;
}

function docStatusIcon(doc: PapyrusDocument) {
  if (doc.status === "uploading" || doc.status === "extracting")
    return <Loader2 className="w-2.5 h-2.5 text-yellow-400 animate-spin shrink-0" />;
  if (doc.status === "error")
    return <AlertCircle className="w-2.5 h-2.5 text-red-400 shrink-0" />;
  return <CheckCircle2 className="w-2.5 h-2.5 text-green-400 shrink-0" />;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function docLabel(doc: PapyrusDocument): string {
  const docType = doc.metadata?.documentType;
  const partNum = (doc.metadata?.partNumber as { value?: string } | null | undefined)?.value;
  if (partNum) return partNum;
  if (docType && docType !== "other") return docType.charAt(0).toUpperCase() + docType.slice(1);
  return doc.fileName.replace(/\.[^.]+$/, "");
}

function ungroupedDocs(docs: PapyrusDocument[], groups: JobGroup[]): PapyrusDocument[] {
  const grouped = new Set(groups.flatMap((g) => g.documentIds));
  return docs.filter((d) => !grouped.has(d.id));
}

// ── Doc row with hover-reveal delete ─────────────────────────────────────────

function DocRow({
  doc,
  isActive,
  indent = false,
  onSelect,
  onDelete,
}: {
  doc: PapyrusDocument;
  isActive: boolean;
  indent?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { tr } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm) { setConfirm(true); return; }
    onDelete();
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setConfirm(false);
  };

  return (
    <div
      className={`group relative flex items-center border-l-2 cursor-pointer transition-colors ${
        indent ? "pl-8 pr-2 py-1.5" : "px-3 py-2"
      } ${
        isActive
          ? "border-[#F5C800] bg-[#F5C800]/5"
          : "border-transparent hover:bg-white/5"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onSelect}
    >
      {indent ? (
        <>
          {docStatusIcon(doc)}
          <span className="text-[10px] text-slate-300 truncate flex-1 mx-2">{docLabel(doc)}</span>
          {!hovered && <span className="text-[9px] text-slate-600 shrink-0">{formatTime(doc.uploadedAt)}</span>}
        </>
      ) : (
        <>
          {docStatusIcon(doc)}
          <div className="flex-1 min-w-0 mx-2">
            <div className="text-[11px] font-medium text-slate-200 truncate">{docLabel(doc)}</div>
            {!hovered && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                <span className="text-[9px] text-slate-600">{formatTime(doc.uploadedAt)}</span>
              </div>
            )}
          </div>
          {!hovered && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
        </>
      )}

      {/* Delete button — only on hover */}
      {hovered && (
        <button
          onClick={handleDelete}
          title={confirm ? "Click again to confirm" : "Delete traveler"}
          className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
            confirm
              ? "bg-red-500/20 text-red-400 border border-red-500/40"
              : "text-slate-500 hover:text-red-400 hover:bg-red-400/10"
          }`}
        >
          <Trash2 className="w-3 h-3" />
          {confirm && <span>{tr.sureDelete}</span>}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NavPanel({
  documents,
  jobGroups,
  activeDocId,
  onDocSelect,
  onDeleteDoc,
  onUploadRequest,
  onLogout,
}: NavPanelProps) {
  const { locale, setLocale, tr } = useLanguage();
  const [searchQuery,    setSearchQuery]    = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(jobGroups.map((g) => g.id)));

  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const q = searchQuery.toLowerCase().trim();

  const filteredDocs = q
    ? documents.filter((d) => {
        const client  = (d.metadata?.customer   as { value?: string } | null | undefined)?.value ?? "";
        const partNum = (d.metadata?.partNumber as { value?: string } | null | undefined)?.value ?? "";
        const jobNum  = (d.metadata?.jobNumber  as { value?: string } | null | undefined)?.value ?? "";
        return (
          d.fileName.toLowerCase().includes(q) ||
          client.toLowerCase().includes(q) ||
          partNum.toLowerCase().includes(q) ||
          jobNum.toLowerCase().includes(q)
        );
      })
    : documents;

  const filteredGroups = q
    ? jobGroups.filter((g) =>
        g.jobNumber?.toLowerCase().includes(q) ||
        g.client?.toLowerCase().includes(q) ||
        g.partNumber?.toLowerCase().includes(q)
      )
    : jobGroups;

  const loose = ungroupedDocs(filteredDocs, filteredGroups);

  return (
    <div className="flex flex-col h-full bg-[#232B38] border-r border-white/8 overflow-hidden">

      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 shrink-0">
            <Image src="/corello-logo-dark.png" alt="Corello" fill sizes="28px" className="object-contain" />
          </div>
          <div>
            <div className="text-white font-bold text-[13px] leading-none tracking-tight">Papyrus</div>
            <div className="text-[#F5C800] text-[8px] tracking-[0.2em] uppercase leading-none mt-0.5 opacity-80">by Corello</div>
          </div>
        </div>
      </div>

      {/* Upload CTA */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onUploadRequest}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#F5C800] text-[#0f1117] text-xs font-bold hover:bg-[#FFD700] active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {tr.scanNewTraveler}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 border-b border-white/8">
        <div className="flex items-center gap-2 bg-[#1A202C] rounded-lg px-3 py-2 border border-white/8 focus-within:border-[#F5C800]/40 transition-colors">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr.searchPlaceholder}
            className="bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5C800]/10 border border-[#F5C800]/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#F5C800]/60" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">{tr.noTravelersYet}</p>
              <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                {tr.uploadToGetStarted}
              </p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{tr.travelersLabel}</span>
              <span className="text-[10px] text-slate-600 font-mono">{documents.length}</span>
            </div>

            {/* Job groups */}
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const groupDocs  = group.documentIds
                .map((id) => documents.find((d) => d.id === id))
                .filter(Boolean) as PapyrusDocument[];

              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-[#F5C800]/70 shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[11px] font-semibold text-slate-200 truncate">
                        {group.client ?? group.jobNumber ?? tr.unknownClient}
                      </div>
                      {group.jobNumber && (
                        <div className="text-[9px] text-slate-500 truncate">{tr.jobLabel}{group.jobNumber}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-slate-600 font-mono">{groupDocs.length}</span>
                      {isExpanded
                        ? <ChevronDown className="w-3 h-3 text-slate-600" />
                        : <ChevronRight className="w-3 h-3 text-slate-600" />}
                    </div>
                  </button>

                  {isExpanded && groupDocs.map((doc) => (
                    <DocRow
                      key={doc.id}
                      doc={doc}
                      isActive={activeDocId === doc.id}
                      indent
                      onSelect={() => onDocSelect(doc.id)}
                      onDelete={() => onDeleteDoc(doc.id)}
                    />
                  ))}
                </div>
              );
            })}

            {/* Ungrouped */}
            {loose.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                isActive={activeDocId === doc.id}
                onSelect={() => onDocSelect(doc.id)}
                onDelete={() => onDeleteDoc(doc.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Language selector */}
      <div data-tour="lang-strip" className="border-t border-white/8 px-3 py-2.5">
        <div className="flex items-center gap-1 bg-[#1A202C] rounded-lg p-1">
          {LOCALES.map(({ code, flag, label }) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              title={code.toUpperCase()}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-semibold transition-all ${
                locale === code
                  ? "bg-[#F5C800] text-[#0f1117] shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className="text-[11px]">{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/8 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#F5C800]/20 border border-[#F5C800]/30 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#F5C800]">JD</span>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-200">John D.</div>
            <div className="text-[9px] text-slate-500">{tr.engineerRole}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
            <Bell className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onLogout}
            title="Sign out"
            className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
