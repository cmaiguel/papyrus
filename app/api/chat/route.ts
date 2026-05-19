import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildManufacturingSystemPrompt } from "@/lib/manufacturing-prompts";
import type { ChatRequest, ExtractedFields } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { rateLimit, getRequestId } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

const log = createLogger("chat");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ─── Mock response when no API key ───────────────────────────────────────────

const MOCK_RESPONSE = `**Mock Mode Active** — Add \`ANTHROPIC_API_KEY\` to \`.env.local\` to enable real AI responses.

To get started:
1. Get your API key from console.anthropic.com
2. Add \`ANTHROPIC_API_KEY=sk-ant-...\` to \`.env.local\`
3. Restart the dev server with \`npm run dev\`

Your document was successfully uploaded and text was extracted. Real AI chat will be available once the API key is configured.`;

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseChunk(text: string): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`);
}

function sseDone(): Uint8Array {
  return new TextEncoder().encode("data: [DONE]\n\n");
}

function sseError(message: string): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify({ error: message })}\n\n`);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getRequestId(request);

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = rateLimit(`chat:${ip}`, { requests: 60, windowMs: 60_000 });
  if (!rl.ok) {
    log.warn("rate limit exceeded", { ip, resetInMs: rl.resetInMs });
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    log.warn("invalid json body", { ip });
    return new Response("Invalid JSON", { status: 400 });
  }

  const { extractedText, metadata, userMessage, chatHistory, language } = body;

  if (!userMessage?.trim()) {
    return new Response("Missing userMessage", { status: 400 });
  }

  log.info("chat request", { ip, messageLength: userMessage.length, historyLength: chatHistory?.length ?? 0 });

  // ── Mock mode ────────────────────────────────────────────────────────────────
  if (!ANTHROPIC_API_KEY) {
    const stream = new ReadableStream({
      start(controller) {
        const words = MOCK_RESPONSE.split(" ");
        let i = 0;
        const interval = setInterval(() => {
          if (i < words.length) {
            controller.enqueue(sseChunk((i === 0 ? "" : " ") + words[i]));
            i++;
          } else {
            controller.enqueue(sseDone());
            controller.close();
            clearInterval(interval);
          }
        }, 30);
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // ── Real Claude streaming ─────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // Build message history
  const messages: Anthropic.Messages.MessageParam[] = [
    ...(chatHistory ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: buildManufacturingSystemPrompt(extractedText ?? "", metadata as ExtractedFields | null, language),
          messages,
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(sseChunk(event.delta.text));
          }
        }

        log.info("chat stream complete", { ip });
        controller.enqueue(sseDone());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("chat stream error", { ip, err: msg });
        controller.enqueue(sseError(msg));
        controller.enqueue(sseDone());
      } finally {
        controller.close();
      }
    },
    cancel() {
      // client disconnected — nothing to clean up
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
