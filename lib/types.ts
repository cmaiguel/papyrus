// ─── Core document types ──────────────────────────────────────────────────────

export interface ExtractedField {
  value: string;
  confidence: number; // 0–1
  sourcePage?: number;
  sourceText?: string;
}

export interface ExtractedOperation {
  number: string;
  name: string;
  status: "complete" | "pending" | "blocked" | "unknown";
  operator?: string;
  signature?: "present" | "missing" | "unknown";
  notes?: string;
}

export interface MissingField {
  field: string;
  location: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

export interface RiskFlag {
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "missing_signature" | "revision_mismatch" | "incomplete_field" | "compliance" | "quality" | "other";
  field?: string;
}

export interface ExtractedFields {
  documentType: "traveler" | "sop" | "inspection" | "drawing" | "certificate" | "work_instruction" | "routing" | "other";
  customer?: ExtractedField;
  partNumber?: ExtractedField;
  revision?: ExtractedField;
  jobNumber?: ExtractedField;
  drawingNumber?: ExtractedField;
  material?: ExtractedField;
  quantity?: ExtractedField;
  heatLot?: ExtractedField;
  travelerDate?: ExtractedField;
  dueDate?: ExtractedField;
  specifications: ExtractedField[];
  operations: ExtractedOperation[];
  signatures: { name: string; role: string; status: "present" | "missing" }[];
  dates: { type: string; value: string }[];
  notes: string[];
  missingFields: MissingField[];
  riskFlags: RiskFlag[];
  summary: string;
  ocrConfidence?: number; // 0–1, overall OCR quality
}

// ─── Document store types ─────────────────────────────────────────────────────

export type ArtifactType =
  | "traveler_summary"
  | "sop"
  | "inspection_checklist"
  | "operator_checklist"
  | "risk_report"
  | "structured_json"
  | "shift_handoff";

export interface GeneratedArtifact {
  type: ArtifactType;
  title: string;
  content: string; // markdown or JSON string
  generatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type DocumentStatus = "uploading" | "extracting" | "analyzing" | "ready" | "error";

export interface PapyrusDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  extractedText: string;
  pageCount?: number;
  extractionMethod: "pdf_text" | "claude_vision" | "tesseract" | "claude_vision_pdf";
  metadata: ExtractedFields | null;
  artifacts: Partial<Record<ArtifactType, GeneratedArtifact>>;
  chatHistory: ChatMessage[];
  uploadedAt: string;
  status: DocumentStatus;
  error?: string;
  isMockMode?: boolean;
  jobGroupId?: string; // links to a JobGroup
}

// ─── Job group (multiple docs for the same job) ───────────────────────────────

export interface JobGroup {
  id: string;           // UUID or extracted job number
  jobNumber?: string;   // e.g. "J-2024-0891"
  client?: string;      // extracted customer name
  partNumber?: string;
  documentIds: string[];
  createdAt: string;
}

// ─── Proactive AI suggestion ──────────────────────────────────────────────────

export type ProactiveSeverity = "info" | "warning" | "critical";

export interface ProactiveSuggestion {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  artifactType?: ArtifactType;
  severity: ProactiveSeverity;
}

// ─── API request/response types ───────────────────────────────────────────────

export interface UploadResponse {
  documentId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  extractedText: string;
  pageCount?: number;
  extractionMethod: string;
  metadata: ExtractedFields | null;
  isMockMode: boolean;
  error?: string;
}

export interface ChatRequest {
  documentId: string;
  extractedText: string;
  metadata: ExtractedFields | null;
  userMessage: string;
  chatHistory: ChatMessage[];
  language?: string; // e.g. "Spanish", "French"
}

export interface ArtifactRequest {
  documentId: string;
  extractedText: string;
  metadata: ExtractedFields | null;
  artifactType: ArtifactType;
}

export interface ArtifactResponse {
  type: ArtifactType;
  title: string;
  content: string;
}
