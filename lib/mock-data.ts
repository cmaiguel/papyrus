export const MOCK_JOBS = [
  {
    id: "J-2024-0891",
    customer: "Boeing Defense",
    part: "737-MAX Frame Bracket",
    partNumber: "BA-7737-FBK-009",
    revision: "Rev C",
    status: "active",
    dueDate: "2024-06-15",
    qty: 24,
    operations: ["Surface Prep", "Alodine Coat", "Prime", "Topcoat", "Inspect"],
    documents: 7,
  },
  {
    id: "J-2024-0887",
    customer: "Lockheed Martin",
    part: "F-35 Actuator Housing",
    partNumber: "LM-F35-AH-112",
    revision: "Rev B",
    status: "on_hold",
    dueDate: "2024-06-10",
    qty: 6,
    operations: ["Blast", "HVOF Spray", "Grind", "NDT Inspect"],
    documents: 12,
  },
  {
    id: "J-2024-0881",
    customer: "Raytheon",
    part: "Missile Fin Assembly",
    partNumber: "RTX-MF-441-A",
    revision: "Rev A",
    status: "complete",
    dueDate: "2024-05-30",
    qty: 48,
    operations: ["Degrease", "Anodize", "Seal", "QA Release"],
    documents: 9,
  },
  {
    id: "J-2024-0876",
    customer: "Northrop Grumman",
    part: "Radar Housing Panel",
    partNumber: "NG-RHP-2209",
    revision: "Rev D",
    status: "active",
    dueDate: "2024-06-20",
    qty: 3,
    operations: ["Machine", "Passivate", "Prime", "EMI Coat", "Final Inspect"],
    documents: 5,
  },
];

export const MOCK_CUSTOMERS = [
  {
    id: "c1",
    name: "Boeing Defense",
    code: "BAC",
    industry: "Aerospace",
    activeJobs: 3,
    totalDocs: 142,
    requirements: ["AS9100D", "NADCAP", "BAC 5555"],
  },
  {
    id: "c2",
    name: "Lockheed Martin",
    code: "LM",
    industry: "Defense",
    activeJobs: 2,
    totalDocs: 89,
    requirements: ["DCAS", "AS9100D", "MIL-C-5541"],
  },
  {
    id: "c3",
    name: "Raytheon Technologies",
    code: "RTX",
    industry: "Defense",
    activeJobs: 1,
    totalDocs: 67,
    requirements: ["AS9100D", "NADCAP", "MIL-PRF-23377"],
  },
  {
    id: "c4",
    name: "Northrop Grumman",
    code: "NOC",
    industry: "Aerospace",
    activeJobs: 2,
    totalDocs: 54,
    requirements: ["AS9100D", "IPC-6012", "MIL-DTL-5541"],
  },
];

export const MOCK_PARTS = [
  {
    partNumber: "BA-7737-FBK-009",
    customer: "Boeing Defense",
    description: "737-MAX Frame Bracket",
    material: "7075-T6 Aluminum",
    revision: "Rev C",
    processes: ["Alodine", "Prime", "Topcoat"],
    criticalTolerances: ["±0.002\" ID", "±0.005\" OD", "0.001 flatness"],
  },
  {
    partNumber: "LM-F35-AH-112",
    customer: "Lockheed Martin",
    description: "F-35 Actuator Housing",
    material: "Ti-6Al-4V",
    revision: "Rev B",
    processes: ["HVOF", "Grind", "NDT"],
    criticalTolerances: ["±0.0005\" bore", "Ra 16 finish", "0.0002 runout"],
  },
];

export const MOCK_RECENT_UPLOADS = [
  { id: "d1", name: "Boeing_BA-7737_Traveler.pdf", type: "traveler", uploadedAt: "2 min ago", status: "ready" },
  { id: "d2", name: "LM_F35_AH_Inspection_Sheet.pdf", type: "inspection", uploadedAt: "14 min ago", status: "ready" },
  { id: "d3", name: "Raytheon_SOP_Anodize_Rev4.pdf", type: "sop", uploadedAt: "1 hr ago", status: "ready" },
  { id: "d4", name: "NG_RHP_Drawing_Rev_D.pdf", type: "drawing", uploadedAt: "3 hr ago", status: "processing" },
  { id: "d5", name: "Boeing_CoC_Heat_Lot_2247.pdf", type: "certificate", uploadedAt: "1 day ago", status: "ready" },
];

export const MOCK_AI_INSIGHTS = [
  {
    id: "i1",
    type: "missing_signature",
    severity: "high",
    title: "Missing Final Inspection Signature",
    description: "Traveler J-2024-0891 is missing the QA Inspector signature on Operation 5 (Final Inspect). Document cannot be closed without it.",
    docRef: "Boeing_BA-7737_Traveler.pdf",
    action: "Generate Signature Request",
  },
  {
    id: "i2",
    type: "revision_mismatch",
    severity: "medium",
    title: "Revision Mismatch Detected",
    description: "Drawing references Rev B but active traveler calls out Rev C process parameters. Verify correct revision is being used.",
    docRef: "LM_F35_AH_Inspection_Sheet.pdf",
    action: "View Comparison",
  },
  {
    id: "i3",
    type: "incomplete_field",
    severity: "low",
    title: "Incomplete Process Parameters",
    description: "Anodize SOP is missing bath temperature specification for Step 4. Cross-reference with customer spec MIL-A-8625.",
    docRef: "Raytheon_SOP_Anodize_Rev4.pdf",
    action: "Generate Corrected SOP",
  },
  {
    id: "i4",
    type: "risk",
    severity: "high",
    title: "NADCAP Requirement Not Documented",
    description: "Boeing job J-2024-0891 requires NADCAP-accredited processing per BAC 5555. No NADCAP certification on file for this operation.",
    docRef: "J-2024-0891",
    action: "Generate Audit Checklist",
  },
];

export const MOCK_CHAT_MESSAGES = [
  {
    role: "assistant" as const,
    content: "I've analyzed the uploaded traveler for Job J-2024-0891 (Boeing 737-MAX Frame Bracket). Here's what I found:\n\n**Customer:** Boeing Defense\n**Part:** BA-7737-FBK-009 Rev C\n**Material:** 7075-T6 Aluminum\n\n**5 operations detected:**\n1. Surface Prep\n2. Alodine Coat (Type I, MIL-C-5541)\n3. Prime (BAC 5555 compliant)\n4. Topcoat\n5. Final Inspection\n\n⚠️ I flagged **2 issues** you should review. Ask me anything about this job.",
    timestamp: "2:14 PM",
  },
];

export const MOCK_SUGGESTED_PROMPTS = [
  "What are the critical tolerances for this part?",
  "Generate an operator SOP for the Alodine process",
  "What NADCAP requirements apply to this job?",
  "Summarize this traveler for shift handoff",
  "Show me all Boeing jobs with similar processes",
  "What's missing from this documentation package?",
  "Generate an inspection checklist",
  "Identify the highest risk operation",
];

export const MOCK_EXTRACTED_FIELDS = {
  jobNumber: "J-2024-0891",
  customer: "Boeing Defense",
  partNumber: "BA-7737-FBK-009",
  revision: "Rev C",
  material: "7075-T6 Aluminum",
  qty: "24 pieces",
  heatLot: "HL-2247-A",
  travelerDate: "05/07/2024",
  engineerApproval: "M. Torres",
  qaMgr: "— MISSING —",
  specReference: "BAC 5555, MIL-C-5541",
  surfaceArea: "12.4 sq ft",
};

export const MOCK_ARTIFACTS = {
  sop: `# Alodine Coating SOP — Boeing BA-7737-FBK-009

**Part:** 737-MAX Frame Bracket | **Rev:** C | **Process:** Alodine Type I

## Pre-Process Requirements
- [ ] Verify part is 7075-T6 Aluminum
- [ ] Confirm NADCAP accreditation current
- [ ] Check bath chemistry per MIL-C-5541

## Process Steps
1. **Degrease** — Alkaline soak 140°F ±5°F, 10–15 min
2. **Rinse** — DI water cascade, 2 stages
3. **Etch** — Sodium hydroxide 90°F, 2–5 min
4. **Deox** — Nitric/HF deox solution, 3 min
5. **Alodine** — Type I solution, 70–80°F, 2–5 min
6. **Rinse** — DI water, 3 min minimum
7. **Air dry** — 140°F max, no contact

## Inspection Criteria
- Color: Golden iridescent (acceptable range: light gold to brown)
- No bare metal visible
- Adhesion: Pass tape test per ASTM D3359`,

  checklist: [
    { item: "Part identification verified (P/N, Rev, S/N)", checked: true },
    { item: "Material cert on file (Heat Lot 2247-A)", checked: true },
    { item: "Pre-process visual inspection complete", checked: true },
    { item: "Bath chemistry in spec (Alodine Type I)", checked: true },
    { item: "Process parameters recorded", checked: true },
    { item: "Post-process visual inspection", checked: false },
    { item: "QA Inspector signature — Step 5", checked: false },
    { item: "Final dimensional check", checked: false },
    { item: "Certificate of Conformance signed", checked: false },
  ],

  riskFlags: [
    { level: "HIGH", text: "Missing QA Inspector signature — job cannot ship" },
    { level: "HIGH", text: "NADCAP cert not on file for this lot" },
    { level: "MED", text: "Bath temperature log shows 3 readings outside ±5°F window" },
    { level: "LOW", text: "Traveler date may not match actual process date" },
  ],

  extractedJSON: {
    job_number: "J-2024-0891",
    customer: "Boeing Defense",
    part_number: "BA-7737-FBK-009",
    revision: "Rev C",
    material: "7075-T6 Aluminum",
    quantity: 24,
    process_spec: "MIL-C-5541 Type I",
    customer_spec: "BAC 5555",
    operations: [
      { seq: 1, name: "Surface Prep", status: "complete" },
      { seq: 2, name: "Alodine Coat", status: "complete" },
      { seq: 3, name: "Prime", status: "complete" },
      { seq: 4, name: "Topcoat", status: "complete" },
      { seq: 5, name: "Final Inspect", status: "pending_signature" },
    ],
    compliance: {
      nadcap_required: true,
      nadcap_on_file: false,
      as9100d: true,
    },
  },
};

export type Job = typeof MOCK_JOBS[0];
export type Customer = typeof MOCK_CUSTOMERS[0];
export type Insight = typeof MOCK_AI_INSIGHTS[0];
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
