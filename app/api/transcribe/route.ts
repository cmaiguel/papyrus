import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { rateLimit, getRequestId } from "@/lib/rate-limit";

const log = createLogger("transcribe");

export const runtime   = "nodejs";
export const maxDuration = 30;

/** POST /api/transcribe
 *
 * Body: multipart/form-data
 *   audio    — audio Blob (webm / mp4 / ogg / wav)
 *   language — optional BCP-47 hint, e.g. "en-US" (converted to ISO 639-1 for Whisper)
 *
 * Response:
 *   200 { transcript: string }
 *   400 { error: string }   — bad request
 *   429                     — rate limited
 *   503 { error: string }   — OPENAI_API_KEY not configured
 *   502 { error: string }   — Whisper upstream error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  // ── Feature gate ───────────────────────────────────────────────────────────
  if (!OPENAI_API_KEY) {
    log.warn("OPENAI_API_KEY not set — transcription unavailable");
    return NextResponse.json(
      { error: "Transcription not configured on this server. Add OPENAI_API_KEY to enable." },
      { status: 503 }
    );
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getRequestId(request);
  const rl = rateLimit(`transcribe:${ip}`, { requests: 30, windowMs: 60_000 });
  if (!rl.ok) {
    log.warn("rate limit exceeded", { ip });
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const audio    = form.get("audio")    as File   | null;
  const language = form.get("language") as string | null;

  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: "No audio provided." }, { status: 400 });
  }

  // 25 MB hard limit (Whisper's own limit is 25 MB)
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio too large (max 25 MB)." }, { status: 413 });
  }

  // ── Determine file extension from MIME type ────────────────────────────────
  // Whisper needs the right extension to pick the right decoder.
  const mime = (audio.type || "audio/webm").split(";")[0].trim();
  const ext  = mime.includes("mp4")  ? "mp4"
             : mime.includes("ogg")  ? "ogg"
             : mime.includes("mp3")  ? "mp3"
             : mime.includes("wav")  ? "wav"
             : mime.includes("mpeg") ? "mp3"
             : "webm";

  // ── Build Whisper request ──────────────────────────────────────────────────
  const whisperForm = new FormData();
  whisperForm.append("file", audio, `audio.${ext}`);
  whisperForm.append("model", "whisper-1");
  whisperForm.append("response_format", "json");

  // BCP-47 "en-US" → ISO 639-1 "en" (Whisper only accepts 2-letter codes)
  const lang = (language ?? "").split("-")[0].toLowerCase();
  if (lang && lang.length === 2 && lang !== "au") {
    whisperForm.append("language", lang);
  }

  log.info("transcription request", {
    bytes:    audio.size,
    mimeType: mime,
    ext,
    lang:     lang || "auto",
  });

  // ── Call Whisper ───────────────────────────────────────────────────────────
  let whisperResp: Response;
  try {
    whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method:  "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body:    whisperForm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("whisper fetch failed", { err: msg });
    return NextResponse.json({ error: "Could not reach transcription service." }, { status: 502 });
  }

  if (!whisperResp.ok) {
    const body = await whisperResp.text().catch(() => "");
    log.error("whisper API error", { status: whisperResp.status, body });
    return NextResponse.json(
      { error: `Transcription service error (${whisperResp.status}).` },
      { status: 502 }
    );
  }

  const data = (await whisperResp.json()) as { text?: string };
  const transcript = (data.text ?? "").trim();

  log.info("transcription complete", { chars: transcript.length });
  return NextResponse.json({ transcript });
}
