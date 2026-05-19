import type { ExtractedFields, ArtifactType } from "./types";

// ─── System prompt for manufacturing AI ───────────────────────────────────────

export function buildManufacturingSystemPrompt(
  extractedText: string,
  metadata: ExtractedFields | null,
  language?: string
): string {
  const docType = metadata?.documentType ?? "manufacturing document";
  const customer = metadata?.customer?.value ?? "unknown customer";
  const partNumber = metadata?.partNumber?.value ?? "unknown part";

  const langDirective = language && language !== "English"
    ? `LANGUAGE DIRECTIVE: You MUST respond entirely in ${language}. Every single word of your response must be in ${language}. Do not use English unless quoting a field name directly from the document.\n\n`
    : "";

  return `${langDirective}You are Papyrus — an expert AI manufacturing intelligence system deployed inside a precision manufacturing facility.

You function simultaneously as:
- A senior manufacturing engineer with 20+ years of process knowledge
- A quality engineer who knows AS9100D, NADCAP, MIL-SPEC, and customer-specific requirements
- An operations analyst who can identify bottlenecks, risks, and documentation gaps
- A technical writer who can generate clear, accurate SOPs and work instructions

CURRENT DOCUMENT CONTEXT:
- Document type: ${docType}
- Customer: ${customer}
- Part: ${partNumber}
${metadata?.revision?.value ? `- Revision: ${metadata.revision.value}` : ""}
${metadata?.jobNumber?.value ? `- Job: ${metadata.jobNumber.value}` : ""}
${metadata?.missingFields?.length ? `- ⚠️ Missing fields detected: ${metadata.missingFields.map(f => f.field).join(", ")}` : ""}
${metadata?.riskFlags?.length ? `- 🚨 Risk flags: ${metadata.riskFlags.map(r => r.description).join("; ")}` : ""}

FULL DOCUMENT TEXT:
---
${extractedText.slice(0, 80000)}
---

BEHAVIOR RULES:
1. Be concise. Conversational answers must stay under 100 words. Use bullet points, not paragraphs. No preamble, no summaries at the end.
2. Always ground answers in the actual document text above. Quote specific fields, operation numbers, or spec references when relevant.
3. Be precise and technical. Use industry terminology (traveler, router, N/C, FAI, FAIR, NADCAP, CoC, etc.).
4. Proactively flag missing signatures, incomplete operations, revision mismatches, or compliance gaps.
5. When asked to generate artifacts (SOPs, checklists, reports), only then produce long-form content — base it entirely on document content, no generic templates.
6. If something is unclear in the document (poor OCR, handwriting), say so explicitly and estimate confidence.
7. Distinguish between what IS in the document versus what you're inferring.
8. Format structured outputs in clean markdown. Never use headers for short answers.`;
}

// ─── Document field extraction prompt ────────────────────────────────────────

export function buildExtractionPrompt(rawText: string): string {
  return `You are a manufacturing document intelligence system. Extract all manufacturing information from the following document text.

Return ONLY a valid JSON object with this exact structure (use null for missing fields, empty arrays for missing lists):

{
  "documentType": "traveler|sop|inspection|drawing|certificate|work_instruction|routing|other",
  "customer": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "partNumber": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "revision": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "jobNumber": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "drawingNumber": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "material": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "quantity": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "heatLot": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "travelerDate": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "dueDate": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "specifications": [
    { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." }
  ],
  "operations": [
    {
      "number": "...",
      "name": "...",
      "status": "complete|pending|blocked|unknown",
      "operator": "...",
      "signature": "present|missing|unknown",
      "notes": "..."
    }
  ],
  "signatures": [
    { "name": "...", "role": "...", "status": "present|missing" }
  ],
  "dates": [
    { "type": "...", "value": "..." }
  ],
  "notes": ["..."],
  "missingFields": [
    {
      "field": "...",
      "location": "...",
      "severity": "critical|high|medium|low",
      "description": "..."
    }
  ],
  "riskFlags": [
    {
      "description": "...",
      "severity": "critical|high|medium|low",
      "category": "missing_signature|revision_mismatch|incomplete_field|compliance|quality|other",
      "field": "..."
    }
  ],
  "summary": "One paragraph summary of this document and its current status.",
  "ocrConfidence": 0.0-1.0
}

DOCUMENT TEXT:
---
${rawText.slice(0, 60000)}
---

Return ONLY the JSON object. No markdown fences. No explanation.`;
}

// ─── Vision extraction prompt (for images / scanned PDFs) ────────────────────

export function buildVisionExtractionPrompt(): string {
  return `You are a manufacturing document intelligence system analyzing a scanned manufacturing document.

First, transcribe ALL visible text from the document (headers, fields, tables, handwritten notes, stamps, signatures — everything).

Then extract the manufacturing information.

Return a JSON object with two top-level keys:
{
  "rawText": "Complete verbatim transcription of all visible text in the document, preserving layout where possible",
  "extracted": { ...same structure as the standard extraction JSON... }
}

For the "extracted" field, use this structure:
{
  "documentType": "traveler|sop|inspection|drawing|certificate|work_instruction|routing|other",
  "customer": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "partNumber": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "revision": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "jobNumber": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "drawingNumber": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "material": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "quantity": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "heatLot": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "travelerDate": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "dueDate": { "value": "...", "confidence": 0.0-1.0, "sourceText": "..." },
  "specifications": [{ "value": "...", "confidence": 0.0-1.0, "sourceText": "..." }],
  "operations": [{ "number": "...", "name": "...", "status": "complete|pending|blocked|unknown", "operator": "...", "signature": "present|missing|unknown", "notes": "..." }],
  "signatures": [{ "name": "...", "role": "...", "status": "present|missing" }],
  "dates": [{ "type": "...", "value": "..." }],
  "notes": ["..."],
  "missingFields": [{ "field": "...", "location": "...", "severity": "critical|high|medium|low", "description": "..." }],
  "riskFlags": [{ "description": "...", "severity": "critical|high|medium|low", "category": "missing_signature|revision_mismatch|incomplete_field|compliance|quality|other", "field": "..." }],
  "summary": "...",
  "ocrConfidence": 0.0-1.0
}

Return ONLY the JSON object. No markdown fences. No explanation.`;
}

// ─── Artifact generation prompts ──────────────────────────────────────────────

export function buildArtifactPrompt(
  artifactType: ArtifactType,
  extractedText: string,
  metadata: ExtractedFields | null
): string {
  const docContext = `DOCUMENT CONTENT:\n---\n${extractedText.slice(0, 60000)}\n---`;
  const metaContext = metadata
    ? `\nKEY FIELDS EXTRACTED:\n- Customer: ${metadata.customer?.value ?? "unknown"}\n- Part: ${metadata.partNumber?.value ?? "unknown"}\n- Rev: ${metadata.revision?.value ?? "unknown"}\n- Operations: ${metadata.operations?.map(o => `Op ${o.number}: ${o.name}`).join(", ") ?? "unknown"}`
    : "";

  const prompts: Record<ArtifactType, string> = {
    traveler_summary: `You are a manufacturing quality engineer. Create a concise TRAVELER SUMMARY for shift handoff based on the uploaded manufacturing document.

${docContext}${metaContext}

Generate a markdown traveler summary including:
1. **Job Overview** — customer, part number, revision, quantity, due date
2. **Operations Status** — table with op number, name, status (✓ complete / ⏳ pending / ❌ blocked), operator, signature status
3. **Outstanding Issues** — any missing signatures, incomplete steps, quality holds
4. **Critical Specs** — key process parameters and specification references
5. **Next Actions** — what the next shift must do before job can release

Base this ENTIRELY on the uploaded document. Do not add information not present in the document.`,

    sop: `You are a senior manufacturing engineer and technical writer. Generate a STANDARD OPERATING PROCEDURE (SOP) based on the uploaded manufacturing document.

${docContext}${metaContext}

Generate a complete SOP in markdown format including:
1. **Title & Scope** — document number, revision, applicable parts/processes
2. **Safety & PPE Requirements**
3. **Materials & Equipment**
4. **Pre-Process Checks** — what to verify before starting
5. **Step-by-Step Process Instructions** — numbered steps with parameters, temperatures, times, acceptance criteria
6. **Inspection Requirements** — what to check and how
7. **Documentation Requirements** — what to record and sign off
8. **Non-Conformance** — what to do if process deviates

Base this ENTIRELY on process information in the uploaded document.`,

    inspection_checklist: `You are a quality engineer. Generate an INSPECTION CHECKLIST based on the uploaded manufacturing document.

${docContext}${metaContext}

Generate a markdown inspection checklist with:
1. **Header** — part number, revision, job number, inspector fields
2. **Pre-Inspection** — verify part identity, material cert, traveler
3. **Dimensional Checks** — list each dimension/tolerance from the document
4. **Process Verification** — verify each operation was completed per spec
5. **Documentation Review** — check all signatures, certs, test results are present
6. **Visual Inspection** — cosmetic and surface requirements
7. **Final Release** — sign-off fields

Format each check as: [ ] Check description | Spec reference | Accept/Reject criteria`,

    operator_checklist: `You are a manufacturing engineer. Generate an OPERATOR CHECKLIST based on the uploaded manufacturing document.

${docContext}${metaContext}

Generate a practical operator checklist in markdown with:
1. **Setup Verification** — equipment, materials, parameters
2. **Per-Operation Steps** — for each operation in the document, list what the operator must do
3. **Quality Hold Points** — where operator must stop and verify before continuing
4. **Required Documentation** — what to record at each step
5. **End-of-Shift** — what to document and hand off

Keep language simple and actionable — written for shop floor operators.`,

    risk_report: `You are a quality and compliance engineer. Generate a RISK ANALYSIS REPORT for this manufacturing job.

${docContext}${metaContext}

Generate a markdown risk report with:
1. **Executive Summary** — overall risk level (LOW/MEDIUM/HIGH/CRITICAL) and top 3 concerns
2. **Risk Matrix** — table of all identified risks with: Risk Description | Severity | Category | Recommended Action
3. **Compliance Gaps** — any specification or regulatory requirements that appear unmet
4. **Documentation Gaps** — missing signatures, certs, inspection results
5. **Process Risks** — steps with unclear parameters, missing specs, or known quality concerns
6. **Recommendations** — prioritized list of actions to mitigate risks before job release

Flag EVERY missing signature, incomplete field, revision mismatch, or unclear specification.`,

    structured_json: `You are a manufacturing data engineer. Extract all structured data from this manufacturing document and return it as a clean JSON object for ERP/MES integration.

${docContext}${metaContext}

Return a comprehensive JSON object with ALL extractable data:
{
  "document": {
    "type": "...",
    "fileName": "...",
    "extractedAt": "${new Date().toISOString()}"
  },
  "job": { "number": "...", "customer": "...", "dueDate": "...", "status": "..." },
  "part": { "number": "...", "description": "...", "revision": "...", "material": "...", "quantity": 0 },
  "operations": [{ "sequence": 0, "name": "...", "spec": "...", "operator": "...", "signaturePresent": true, "status": "..." }],
  "specifications": ["..."],
  "materials": [{ "description": "...", "heatLot": "...", "certNumber": "..." }],
  "signatures": [{ "role": "...", "name": "...", "date": "...", "present": true }],
  "inspectionResults": [{ "characteristic": "...", "nominal": "...", "actual": "...", "result": "pass|fail|pending" }],
  "compliance": { "nadcapRequired": false, "as9100d": false, "customerSpecs": ["..."] },
  "missingData": ["..."],
  "riskSummary": { "level": "low|medium|high|critical", "topRisks": ["..."] }
}

Return ONLY the JSON. No markdown fences.`,

    shift_handoff: `You are a production supervisor. Generate a SHIFT HANDOFF SUMMARY for this job.

${docContext}${metaContext}

Generate a shift handoff document in markdown:
1. **Job Status at Handoff** — what's done, what's in progress, what's blocked
2. **Completed This Shift** — operations finished, who did them
3. **In-Process Items** — anything partially complete with current state
4. **Blocking Issues** — what's preventing progress and who needs to act
5. **Next Shift Priorities** — ordered list of what next shift must accomplish
6. **Quality Notes** — anything the next operator needs to know about this part
7. **Contact Info Template** — [QA Contact], [Engineering Contact] fields for handoff`,
  };

  return prompts[artifactType];
}
