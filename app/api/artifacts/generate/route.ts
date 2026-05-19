import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildArtifactPrompt } from "@/lib/manufacturing-prompts";
import type { ArtifactRequest, ArtifactResponse, ArtifactType } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { rateLimit, getRequestId } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("artifacts");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const ARTIFACT_TITLES: Record<ArtifactType, string> = {
  traveler_summary: "Traveler Summary",
  sop: "Standard Operating Procedure",
  inspection_checklist: "Inspection Checklist",
  operator_checklist: "Operator Checklist",
  risk_report: "Risk Analysis Report",
  structured_json: "Structured Data Extraction",
  shift_handoff: "Shift Handoff Summary",
};

const MOCK_ARTIFACTS: Record<ArtifactType, string> = {
  traveler_summary: `## Traveler Summary — Mock Mode

> **Add ANTHROPIC_API_KEY to .env.local to generate real artifacts from your uploaded document.**

This artifact will be generated from your actual uploaded document content once the API key is configured.`,

  sop: `## Standard Operating Procedure — Mock Mode

> **Add ANTHROPIC_API_KEY to .env.local to generate real SOPs from your uploaded document.**`,

  inspection_checklist: `## Inspection Checklist — Mock Mode

> **Add ANTHROPIC_API_KEY to .env.local to generate real checklists from your uploaded document.**`,

  operator_checklist: `## Operator Checklist — Mock Mode

> **Add ANTHROPIC_API_KEY to .env.local to generate real operator checklists from your uploaded document.**`,

  risk_report: `## Risk Analysis Report — Mock Mode

> **Add ANTHROPIC_API_KEY to .env.local to generate real risk reports from your uploaded document.**`,

  structured_json: `{"mockMode": true, "message": "Add ANTHROPIC_API_KEY to .env.local to generate real structured data from your uploaded document."}`,

  shift_handoff: `## Shift Handoff Summary — Mock Mode

> **Add ANTHROPIC_API_KEY to .env.local to generate real shift handoff documents from your uploaded document.**`,
};

export async function POST(
  request: NextRequest
): Promise<NextResponse<ArtifactResponse>> {
  const ip = getRequestId(request);

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rl = rateLimit(`artifacts:${ip}`, { requests: 30, windowMs: 60_000 });
  if (!rl.ok) {
    log.warn("rate limit exceeded", { ip, resetInMs: rl.resetInMs });
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." } as unknown as ArtifactResponse,
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  let body: ArtifactRequest;
  try {
    body = await request.json();
  } catch {
    log.warn("invalid json body", { ip });
    return NextResponse.json({ error: "Invalid JSON" } as unknown as ArtifactResponse, {
      status: 400,
    });
  }

  const { extractedText, metadata, artifactType } = body;

  if (!extractedText || extractedText.trim().length < 10) {
    return NextResponse.json(
      {
        type: artifactType,
        title: ARTIFACT_TITLES[artifactType],
        content: "No document text available to generate artifact from.",
      },
      { status: 400 }
    );
  }

  // ── Mock mode ────────────────────────────────────────────────────────────────
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      type: artifactType,
      title: ARTIFACT_TITLES[artifactType],
      content: MOCK_ARTIFACTS[artifactType] ?? "Mock mode — API key required.",
    });
  }

  // ── Real Claude generation ─────────────────────────────────────────────────
  log.info("artifact generation started", { ip, artifactType, textLength: extractedText.length });

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const prompt = buildArtifactPrompt(artifactType, extractedText, metadata);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    // For structured_json type, clean up markdown fences if present
    const finalContent =
      artifactType === "structured_json"
        ? content
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim()
        : content;

    log.info("artifact generation complete", { ip, artifactType, contentLength: finalContent.length });

    return NextResponse.json({
      type: artifactType,
      title: ARTIFACT_TITLES[artifactType],
      content: finalContent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("artifact generation failed", { ip, artifactType, err: message });
    return NextResponse.json(
      {
        type: artifactType,
        title: ARTIFACT_TITLES[artifactType],
        content: `Error generating artifact: ${message}`,
        error: message,
      } as ArtifactResponse,
      { status: 500 }
    );
  }
}
