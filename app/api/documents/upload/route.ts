import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import { buildExtractionPrompt, buildVisionExtractionPrompt } from "@/lib/manufacturing-prompts";
import type { ExtractedFields, UploadResponse } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { rateLimit, getRequestId } from "@/lib/rate-limit";

const log = createLogger("upload");

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE   = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIMES   = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/bmp",
]);

export const runtime = "nodejs";
export const maxDuration = 120;

// ─── Safe JSON helpers ────────────────────────────────────────────────────────

/**
 * Strip markdown fences and attempt to parse JSON.
 * If truncated (unterminated), try to auto-close the structure first.
 */
function safeParseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // First attempt: parse as-is
  try {
    return JSON.parse(cleaned);
  } catch {
    // Second attempt: try to close any open braces/brackets
    try {
      const repaired = repairJson(cleaned);
      return JSON.parse(repaired);
    } catch {
      console.warn("[upload] JSON parse failed even after repair, returning null");
      return null;
    }
  }
}

/** Naive JSON repair: close any unclosed strings, arrays, objects. */
function repairJson(s: string): string {
  // Remove trailing partial key/value that caused the truncation
  const trimmed = s.replace(/,\s*$/, "").replace(/"\s*:\s*"[^"]*$/, '"": ""').replace(/"\s*:\s*$/, '"": null');
  const opens = (trimmed.match(/\{/g) ?? []).length - (trimmed.match(/\}/g) ?? []).length;
  const arrOpen = (trimmed.match(/\[/g) ?? []).length - (trimmed.match(/\]/g) ?? []).length;
  return trimmed + "]".repeat(Math.max(0, arrOpen)) + "}".repeat(Math.max(0, opens));
}

/** Minimal valid ExtractedFields for when Claude's response can't be parsed. */
function buildEmptyFields(): import("@/lib/types").ExtractedFields {
  return {
    documentType: "other",
    specifications: [],
    operations: [],
    signatures: [],
    dates: [],
    notes: [],
    missingFields: [],
    riskFlags: [],
    summary: "Document uploaded. AI field extraction could not be completed — the document may be too large or complex. Try chatting with the AI directly.",
  };
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const isMockMode = !ANTHROPIC_API_KEY;

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // pdf-parse v2 uses class-based API with { data: buffer }
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  const result = await parser.getText();
  const info = await parser.getInfo({ parsePageInfo: true });
  await parser.destroy();
  return {
    text: result.text?.trim() ?? "",
    pageCount: (info as { total?: number }).total ?? 1,
  };
}

// ─── Tesseract OCR (fallback, no API key) ────────────────────────────────────

async function tesseractOcr(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Tesseract = require("tesseract.js");
  const { data } = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
  return data.text?.trim() ?? "";
}

// ─── Claude Vision extraction ─────────────────────────────────────────────────

async function claudeVisionExtract(
  buffer: Buffer,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf"
): Promise<{ rawText: string; extracted: ExtractedFields }> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const contentBlock =
    mediaType === "application/pdf"
      ? ({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: buffer.toString("base64"),
          },
        } as const)
      : ({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: buffer.toString("base64"),
          },
        } as const);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          { type: "text", text: buildVisionExtractionPrompt() },
        ],
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = safeParseJson(raw);
  return {
    rawText:  typeof parsed?.rawText === "string" ? parsed.rawText : "",
    extracted: (parsed?.extracted as ExtractedFields | undefined) ?? buildEmptyFields(),
  };
}

// ─── Claude text-based extraction ────────────────────────────────────────────

async function claudeTextExtract(rawText: string): Promise<ExtractedFields> {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      { role: "user", content: buildExtractionPrompt(rawText) },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
  return (safeParseJson(raw) as ExtractedFields | null) ?? buildEmptyFields();
}

// ─── MIME type detection ──────────────────────────────────────────────────────

function detectMimeType(fileName: string, declaredType: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const extMap: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    tiff: "image/tiff",
    tif: "image/tiff",
    bmp: "image/bmp",
    gif: "image/gif",
    webp: "image/webp",
  };
  return extMap[ext] ?? declaredType ?? "application/octet-stream";
}

function toClaudeImageType(mime: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (mime === "image/png") return "image/png";
  if (mime === "image/gif") return "image/gif";
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg"; // default for tiff/bmp/jpg
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  const requestId = uuidv4();
  const ip = getRequestId(request);

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = rateLimit(`upload:${ip}`, { requests: 20, windowMs: 60_000 });
  if (!rl.ok) {
    log.warn("rate limit exceeded", { ip, requestId, resetInMs: rl.resetInMs });
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment." } as unknown as UploadResponse,
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      log.warn("no file in request", { requestId, ip });
      return NextResponse.json({ error: "No file provided" } as unknown as UploadResponse, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = detectMimeType(file.name, file.type);

    // ── File size validation ─────────────────────────────────────────────────
    if (buffer.length > MAX_FILE_SIZE) {
      log.warn("file too large", { requestId, ip, fileName: file.name, fileSizeBytes: buffer.length });
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` } as unknown as UploadResponse,
        { status: 413 }
      );
    }

    // ── MIME type validation ─────────────────────────────────────────────────
    if (!ALLOWED_MIMES.has(mimeType)) {
      log.warn("unsupported file type", { requestId, ip, fileName: file.name, mimeType });
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Upload PDF or image files only.` } as unknown as UploadResponse,
        { status: 415 }
      );
    }

    const documentId = uuidv4();
    log.info("upload started", { requestId, documentId, ip, fileName: file.name, fileSizeBytes: buffer.length, mimeType });
    const isPdf = mimeType === "application/pdf";
    const isImage = mimeType.startsWith("image/");

    let extractedText = "";
    let pageCount: number | undefined;
    let extractionMethod: UploadResponse["extractionMethod"] = "pdf_text";
    let metadata: ExtractedFields | null = null;

    // ── PDF handling ──────────────────────────────────────────────────────────
    if (isPdf) {
      const pdfResult = await extractPdfText(buffer);
      pageCount = pdfResult.pageCount;
      // A real text-layer PDF typically has >50 chars per page of actual content
      const hasTextLayer = pdfResult.text.length > Math.max(50, pdfResult.pageCount * 30);

      if (hasTextLayer) {
        // Native PDF with text layer
        extractedText = pdfResult.text;
        extractionMethod = "pdf_text";
        log.info("pdf text layer extracted", { requestId, documentId, chars: extractedText.length, pageCount });

        if (!isMockMode) {
          // Use Claude to extract structured fields from text
          metadata = await claudeTextExtract(extractedText);
          log.info("claude text extraction complete", { requestId, documentId });
        }
      } else {
        // Scanned PDF — no text layer, use Claude Vision
        extractionMethod = "claude_vision_pdf";
        log.info("scanned pdf detected, using vision", { requestId, documentId, pageCount });

        if (!isMockMode) {
          const visionResult = await claudeVisionExtract(buffer, "application/pdf");
          extractedText = visionResult.rawText;
          metadata = visionResult.extracted;
          log.info("claude vision pdf extraction complete", { requestId, documentId, chars: extractedText.length });
        } else {
          // Mock mode fallback: use empty text
          extractedText = pdfResult.text || "[Scanned PDF — requires ANTHROPIC_API_KEY for text extraction]";
        }
      }
    }

    // ── Image handling ─────────────────────────────────────────────────────────
    if (isImage) {
      if (!isMockMode) {
        extractionMethod = "claude_vision";
        log.info("image upload, using vision", { requestId, documentId, mimeType });
        const visionResult = await claudeVisionExtract(buffer, toClaudeImageType(mimeType));
        extractedText = visionResult.rawText;
        metadata = visionResult.extracted;
        log.info("claude vision image extraction complete", { requestId, documentId, chars: extractedText.length });
      } else {
        // Tesseract fallback when no API key
        extractionMethod = "tesseract";
        extractedText = await tesseractOcr(buffer);
        log.info("tesseract ocr complete (mock mode)", { requestId, documentId, chars: extractedText.length });
      }
    }

    log.info("upload complete", { requestId, documentId, extractionMethod, isMockMode });

    return NextResponse.json({
      documentId,
      fileName: file.name,
      fileType: mimeType,
      fileSizeBytes: buffer.length,
      extractedText,
      pageCount,
      extractionMethod,
      metadata,
      isMockMode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("upload handler failed", { requestId, ip, err: message });
    return NextResponse.json(
      {
        documentId: uuidv4(),
        fileName: "unknown",
        fileType: "unknown",
        fileSizeBytes: 0,
        extractedText: "",
        extractionMethod: "pdf_text",
        metadata: null,
        isMockMode,
        error: message,
      },
      { status: 500 }
    );
  }
}
