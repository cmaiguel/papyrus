"use client";

/**
 * Unified persistence layer for Papyrus.
 *
 * When NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set:
 *   → reads/writes go to Supabase Postgres (with localStorage as write-through fallback)
 *
 * When Supabase is NOT configured:
 *   → reads/writes go to localStorage only (existing behaviour, zero regression)
 *
 * Components import from here instead of @/lib/document-store directly.
 */

import * as localStore from "@/lib/document-store";
import type { PapyrusDocument, JobGroup } from "@/lib/types";

// ── Configuration ─────────────────────────────────────────────────────────────

export const isSupabaseConfigured =
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function getClient() {
  if (!isSupabaseConfigured) return null;
  // Dynamic require keeps the import tree clean when Supabase is not configured
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createSupabaseClient } = require("@/lib/supabase/client");
  return createSupabaseClient() as ReturnType<typeof import("@/lib/supabase/client").createSupabaseClient>;
}

// ── DB ↔ Domain mappers ───────────────────────────────────────────────────────

function rowToDoc(row: Record<string, unknown>): PapyrusDocument {
  return {
    id:               row.id as string,
    fileName:         row.file_name as string,
    fileType:         row.file_type as string,
    fileSizeBytes:    row.file_size_bytes as number,
    extractedText:    (row.extracted_text as string) ?? "",
    pageCount:        row.page_count as number | undefined,
    extractionMethod: row.extraction_method as PapyrusDocument["extractionMethod"],
    metadata:         row.metadata as PapyrusDocument["metadata"],
    artifacts:        (row.artifacts as PapyrusDocument["artifacts"]) ?? {},
    chatHistory:      (row.chat_history as PapyrusDocument["chatHistory"]) ?? [],
    uploadedAt:       row.uploaded_at as string,
    status:           row.status as PapyrusDocument["status"],
    error:            row.error as string | undefined,
    isMockMode:       row.is_mock_mode as boolean | undefined,
  };
}

function docToRow(doc: PapyrusDocument, userId: string): Record<string, unknown> {
  return {
    id:               doc.id,
    user_id:          userId,
    file_name:        doc.fileName,
    file_type:        doc.fileType,
    file_size_bytes:  doc.fileSizeBytes,
    extracted_text:   doc.extractedText,
    page_count:       doc.pageCount ?? null,
    extraction_method: doc.extractionMethod,
    metadata:         doc.metadata,
    artifacts:        doc.artifacts ?? {},
    chat_history:     doc.chatHistory ?? [],
    status:           doc.status,
    error:            doc.error ?? null,
    is_mock_mode:     doc.isMockMode ?? false,
    uploaded_at:      doc.uploadedAt,
    updated_at:       new Date().toISOString(),
  };
}

function rowToGroup(row: Record<string, unknown>): JobGroup {
  return {
    id:          row.id as string,
    jobNumber:   row.job_number as string | undefined,
    client:      row.client as string | undefined,
    partNumber:  row.part_number as string | undefined,
    documentIds: (row.document_ids as string[]) ?? [],
    createdAt:   row.created_at as string,
  };
}

// ── User helper ───────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;
  try {
    const { data: { user } } = await sb.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ── Document operations ───────────────────────────────────────────────────────

export async function loadDocuments(): Promise<PapyrusDocument[]> {
  const sb = getClient();
  if (!sb) return localStore.getAllDocuments();

  try {
    const { data, error } = await sb
      .from("documents")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(rowToDoc);
  } catch (err) {
    console.warn("[persistence] Supabase loadDocuments failed, using localStorage:", err);
    return localStore.getAllDocuments();
  }
}

export async function persistDocument(doc: PapyrusDocument): Promise<void> {
  // Always write to localStorage as fallback / offline cache
  localStore.saveDocument(doc);

  const sb = getClient();
  if (!sb) return;

  const userId = await getUserId();
  if (!userId) return;

  try {
    const { error } = await sb
      .from("documents")
      .upsert(docToRow(doc, userId), { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    console.warn("[persistence] Supabase persistDocument failed:", err);
  }
}

export async function persistUpdate(
  id: string,
  updates: Partial<PapyrusDocument>
): Promise<void> {
  // Always update localStorage
  localStore.updateDocument(id, updates);

  const sb = getClient();
  if (!sb) return;

  // Map domain field names to column names
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("chatHistory"   in updates) row.chat_history   = updates.chatHistory;
  if ("artifacts"     in updates) row.artifacts       = updates.artifacts;
  if ("status"        in updates) row.status          = updates.status;
  if ("error"         in updates) row.error           = updates.error;
  if ("extractedText" in updates) row.extracted_text  = updates.extractedText;
  if ("metadata"      in updates) row.metadata        = updates.metadata;

  try {
    const { error } = await sb.from("documents").update(row).eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("[persistence] Supabase persistUpdate failed:", err);
  }
}

export async function persistDelete(id: string): Promise<void> {
  localStore.deleteDocumentAndCleanup(id);

  const sb = getClient();
  if (!sb) return;

  try {
    const { error } = await sb.from("documents").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("[persistence] Supabase persistDelete failed:", err);
  }
}

// ── Job group operations ──────────────────────────────────────────────────────

export async function loadJobGroups(): Promise<JobGroup[]> {
  const sb = getClient();
  if (!sb) return localStore.getAllJobGroups();

  try {
    const { data, error } = await sb
      .from("job_groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(rowToGroup);
  } catch (err) {
    console.warn("[persistence] Supabase loadJobGroups failed, using localStorage:", err);
    return localStore.getAllJobGroups();
  }
}

export async function persistJobGroups(groups: JobGroup[]): Promise<void> {
  const sb = getClient();
  if (!sb || groups.length === 0) return;

  const userId = await getUserId();
  if (!userId) return;

  try {
    const rows = groups.map((g) => ({
      id:           g.id,
      user_id:      userId,
      job_number:   g.jobNumber ?? null,
      client:       g.client ?? null,
      part_number:  g.partNumber ?? null,
      document_ids: g.documentIds,
      created_at:   g.createdAt,
    }));

    const { error } = await sb
      .from("job_groups")
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;
  } catch (err) {
    console.warn("[persistence] Supabase persistJobGroups failed:", err);
  }
}

// Re-export synchronous helpers still needed by workspace page
export { autoGroupDocument, getAllJobGroups, saveArtifact } from "@/lib/document-store";
