"use client";

import type { PapyrusDocument, ChatMessage, GeneratedArtifact, ArtifactType, JobGroup } from "./types";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "papyrus_documents";
const GROUPS_KEY  = "papyrus_job_groups";
const MAX_STORED_DOCS = 20;

// ─── Read/write helpers ───────────────────────────────────────────────────────

function readStore(): Record<string, PapyrusDocument> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, PapyrusDocument>): void {
  if (typeof window === "undefined") return;
  try {
    // Prune oldest docs if exceeding limit
    const entries = Object.entries(store).sort(
      ([, a], [, b]) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    const pruned = Object.fromEntries(entries.slice(0, MAX_STORED_DOCS));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage might be full; fail silently
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAllDocuments(): PapyrusDocument[] {
  const store = readStore();
  return Object.values(store).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export function getDocument(id: string): PapyrusDocument | null {
  return readStore()[id] ?? null;
}

export function saveDocument(doc: PapyrusDocument): void {
  const store = readStore();
  store[doc.id] = doc;
  writeStore(store);
}

export function updateDocument(
  id: string,
  updates: Partial<PapyrusDocument>
): PapyrusDocument | null {
  const store = readStore();
  if (!store[id]) return null;
  store[id] = { ...store[id], ...updates };
  writeStore(store);
  return store[id];
}

export function deleteDocument(id: string): void {
  const store = readStore();
  delete store[id];
  writeStore(store);
}

/** Delete a document and remove it from its job group (prune empty groups). */
export function deleteDocumentAndCleanup(id: string): void {
  deleteDocument(id);
  const groups = readGroups();
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    g.documentIds = g.documentIds.filter((d) => d !== id);
    if (g.documentIds.length === 0) {
      delete groups[key]; // remove empty group
    } else {
      groups[key] = g;
    }
  }
  writeGroups(groups);
}

export function appendChatMessage(id: string, message: ChatMessage): void {
  const store = readStore();
  if (!store[id]) return;
  store[id].chatHistory = [...(store[id].chatHistory ?? []), message];
  writeStore(store);
}

export function saveArtifact(
  id: string,
  artifact: GeneratedArtifact
): void {
  const store = readStore();
  if (!store[id]) return;
  store[id].artifacts = { ...(store[id].artifacts ?? {}), [artifact.type]: artifact };
  writeStore(store);
}

export function clearAllDocuments(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(GROUPS_KEY);
}

// ─── Job Group CRUD ───────────────────────────────────────────────────────────

function readGroups(): Record<string, JobGroup> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeGroups(groups: Record<string, JobGroup>): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); } catch {}
}

export function getAllJobGroups(): JobGroup[] {
  return Object.values(readGroups()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function saveJobGroup(group: JobGroup): void {
  const groups = readGroups();
  groups[group.id] = group;
  writeGroups(groups);
}

export function updateJobGroup(id: string, updates: Partial<JobGroup>): void {
  const groups = readGroups();
  if (!groups[id]) return;
  groups[id] = { ...groups[id], ...updates };
  writeGroups(groups);
}

/**
 * After a document is saved, auto-assign it to an existing job group (by job
 * number) or create a new one. Updates both the group and the document.
 */
export function autoGroupDocument(docId: string): void {
  const store = readStore();
  const doc = store[docId];
  if (!doc) return;

  const jobNum = (doc.metadata?.jobNumber as { value?: string } | null | undefined)?.value?.trim();
  const client  = (doc.metadata?.customer   as { value?: string } | null | undefined)?.value?.trim();
  const partNum = (doc.metadata?.partNumber as { value?: string } | null | undefined)?.value?.trim();

  const groups = readGroups();

  // Try to find an existing group with the same job number
  let targetGroup: JobGroup | undefined;
  if (jobNum) {
    targetGroup = Object.values(groups).find((g) => g.jobNumber === jobNum);
  }

  if (targetGroup) {
    if (!targetGroup.documentIds.includes(docId)) {
      targetGroup.documentIds.push(docId);
    }
    if (client && !targetGroup.client) targetGroup.client = client;
    if (partNum && !targetGroup.partNumber) targetGroup.partNumber = partNum;
    groups[targetGroup.id] = targetGroup;
  } else {
    // Create a new group
    const newGroup: JobGroup = {
      id: jobNum ?? uuidv4(),
      jobNumber: jobNum,
      client,
      partNumber: partNum,
      documentIds: [docId],
      createdAt: new Date().toISOString(),
    };
    targetGroup = newGroup;
    groups[newGroup.id] = newGroup;
  }

  writeGroups(groups);

  // Stamp the doc with its group id
  if (store[docId]) {
    store[docId].jobGroupId = targetGroup.id;
    writeStore(store);
  }
}

// ─── Create a new document stub (before upload completes) ─────────────────────

export function createDocumentStub(
  id: string,
  fileName: string,
  fileType: string,
  fileSizeBytes: number
): PapyrusDocument {
  const doc: PapyrusDocument = {
    id,
    fileName,
    fileType,
    fileSizeBytes,
    extractedText: "",
    extractionMethod: "pdf_text",
    metadata: null,
    artifacts: {},
    chatHistory: [],
    uploadedAt: new Date().toISOString(),
    status: "uploading",
  };
  saveDocument(doc);
  return doc;
}
