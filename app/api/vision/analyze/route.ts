import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@/lib/logger";
import { rateLimit, getRequestId } from "@/lib/rate-limit";

export const runtime   = "nodejs";
export const maxDuration = 120;

const log = createLogger("vision");
const ANTHROPIC_API_KEY    = process.env.ANTHROPIC_API_KEY;
const MAX_B64_CHARS        = 5_600_000;   // ≈ 4 MB decoded
const VALID_B64            = /^[A-Za-z0-9+/=]+$/;
const VALID_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ValidMime = (typeof VALID_MIME)[number];

// ─── SSE helpers ──────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const sse  = (obj: object) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
const done = ()             => enc.encode("data: [DONE]\n\n");

const SSE_HEADERS = {
  "Content-Type":  "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection:      "keep-alive",
};

function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getRequestId(request);

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = rateLimit(`vision:${ip}`, { requests: 30, windowMs: 60_000 });
  if (!rl.ok) {
    log.warn("rate limit exceeded", { ip, resetInMs: rl.resetInMs });
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.warn("invalid json body", { ip });
    return errorResponse("Invalid JSON body.");
  }

  if (typeof body !== "object" || body === null) {
    return errorResponse("Request body must be a JSON object.");
  }

  const b = body as Record<string, unknown>;

  // ── 2. Validate imageBase64 ───────────────────────────────────────────────
  const imageBase64 = b.imageBase64;
  if (typeof imageBase64 !== "string" || !imageBase64) {
    log.warn("missing imageBase64", { ip });
    return errorResponse("Missing required field: imageBase64 (string).");
  }
  if (imageBase64.length > MAX_B64_CHARS) {
    log.warn("image too large", { ip, length: imageBase64.length });
    return errorResponse(
      `Image too large. Maximum encoded size is ${Math.round(MAX_B64_CHARS * 0.75 / 1024 / 1024)} MB.`,
      413,
    );
  }
  if (!VALID_B64.test(imageBase64)) {
    log.warn("invalid base64 chars", { ip });
    return errorResponse("imageBase64 contains invalid characters.");
  }

  // ── 3. Validate mimeType ─────────────────────────────────────────────────
  const rawMime     = typeof b.mimeType === "string" ? b.mimeType : "image/jpeg";
  const mimeType    = VALID_MIME.includes(rawMime as ValidMime)
    ? (rawMime as ValidMime)
    : "image/jpeg";

  // ── 4. Sanitise optional fields ──────────────────────────────────────────
  const question       = typeof b.question === "string"        ? b.question.slice(0, 2000)       : "";
  const documentCtx    = typeof b.documentContext === "string" ? b.documentContext.slice(0, 3000) : "";
  const jobContext     = typeof b.jobContext === "string"      ? b.jobContext.slice(0, 500)       : "";
  const language       = typeof b.language === "string"        ? b.language                       : "English";

  // ── 5. Mock mode ─────────────────────────────────────────────────────────
  if (!ANTHROPIC_API_KEY) {
    const mock =
      "**Mock Mode** — Vision analysis requires ANTHROPIC_API_KEY in .env.local. " +
      "Once configured, Corello will read travelers, extract text, detect part numbers, " +
      "and flag quality issues from camera captures.";
    const stream = new ReadableStream({
      start(ctrl) {
        const words = mock.split(" ");
        let i = 0;
        const iv = setInterval(() => {
          if (i < words.length) ctrl.enqueue(sse({ text: (i === 0 ? "" : " ") + words[i++] }));
          else { ctrl.enqueue(done()); ctrl.close(); clearInterval(iv); }
        }, 28);
      },
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  // ── 6. Build system prompt ────────────────────────────────────────────────
  const langDirective = language !== "English"
    ? `LANGUAGE DIRECTIVE: Respond entirely in ${language}. Every word must be in ${language}.\n\n`
    : "";

  const contradictionSection = documentCtx
    ? "\n7. CONTRADICTION CHECK — if anything in the image conflicts with the loaded document, " +
      "call it out explicitly with a ⚠️ prefix.\n"
    : "";

  const jobSection = jobContext
    ? `\nCurrent job context: ${jobContext}\n`
    : "";

  const systemPrompt =
    `${langDirective}` +
    `You are Corello — an AI manufacturing intelligence system analyzing a live camera capture from a factory floor.\n\n` +
    `SPECIALIZATIONS:\n` +
    `You excel at reading and extracting data from:\n` +
    `• Paper traveler packets and routing sheets\n` +
    `• Work instructions, SOPs, and process sheets\n` +
    `• Engineering drawings and schematics\n` +
    `• Inspection sheets, quality checklists, and certs\n` +
    `• Part labels, barcodes, QR codes, serial numbers\n` +
    `• Handwritten notes, signatures, and stamps\n` +
    `• Visible defects, surface conditions, assembly states\n` +
    `• Machine setups and fixturing contexts\n\n` +
    `EXTRACTION TARGETS — always scan for:\n` +
    `• Job numbers, work order numbers, router numbers\n` +
    `• Part numbers, revision levels, drawing numbers\n` +
    `• Operation numbers and descriptions\n` +
    `• Serial numbers, lot numbers, heat/lot codes\n` +
    `• Customer names and PO numbers\n` +
    `• Due dates and traveler dates\n` +
    `• Inspector names and operator signatures\n` +
    `• Required vs. actual quantities\n` +
    `• Missing signatures or unchecked required fields\n` +
    `• Inspection accept/reject stamps or markings\n` +
    `• Revision numbers and change notices\n` +
    `• Any flagged or circled fields\n\n` +
    `RESPONSE FORMAT:\n` +
    `1. DOCUMENT/OBJECT TYPE — what is this?\n` +
    `2. EXTRACTED DATA — list every visible number, code, name, date\n` +
    `3. COMPLETION STATUS — what is filled in, what is missing or unsigned\n` +
    `4. QUALITY FLAGS — anything abnormal, missing, or risky\n` +
    `5. ANSWER — directly address the user's question if provided\n` +
    `6. RECOMMENDATION — one actionable manufacturing-floor suggestion\n` +
    contradictionSection +
    (documentCtx
      ? `\nCURRENT LOADED DOCUMENT (for cross-reference only — do NOT re-analyze it, just compare):\n${documentCtx}\n`
      : "") +
    jobSection +
    `\nBe concise. Under 200 words unless extraction requires more.`;

  const userQuestion =
    question ||
    "What is this? Extract all visible text, numbers, and codes. List any missing fields or quality concerns.";

  // ── 7. Stream Claude vision response ─────────────────────────────────────
  log.info("vision analysis started", { ip, mimeType, hasQuestion: !!question, hasDocCtx: !!documentCtx });
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model:      "claude-sonnet-4-6",
          max_tokens: 1024,
          system:     systemPrompt,
          messages: [
            {
              role: "user",
              content: [
                {
                  type:   "image",
                  source: { type: "base64", media_type: mimeType, data: imageBase64 },
                },
                { type: "text", text: userQuestion },
              ],
            },
          ],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            ctrl.enqueue(sse({ text: event.delta.text }));
          }
        }
        log.info("vision analysis complete", { ip });
        ctrl.enqueue(done());
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        log.error("vision analysis failed", { ip, err: raw });
        // Sanitise Anthropic error — don't leak internal details
        const friendly =
          raw.includes("overloaded") ? "Corello is busy. Try again in a moment." :
          raw.includes("invalid_api_key") ? "Invalid API key. Check ANTHROPIC_API_KEY." :
          raw.includes("image") ? `Image issue: ${raw.slice(0, 120)}` :
          `Analysis failed: ${raw.slice(0, 120)}`;
        ctrl.enqueue(sse({ error: friendly }));
        ctrl.enqueue(done());
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
