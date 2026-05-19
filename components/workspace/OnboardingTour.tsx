"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

const TOUR_KEY = "papyrus_tour_v3";
const PAD = 20; // spotlight padding around target

interface Step {
  target: string;
  title: string;
  description: string;
  emoji: string;
}

const STEPS: Step[] = [
  {
    target: '[data-tour="nav-panel"]',
    title: "Upload Manufacturing Documents",
    description:
      "Upload traveler packets, SOPs, inspection sheets, drawings, or work instructions directly into Corello. Documents are automatically organized by job number, making it easy to manage and retrieve production knowledge. You can also upload entire local folders to build an interactive knowledge base for your facility.",
    emoji: "📂",
  },
  {
    target: '[data-tour="doc-viewer"]',
    title: "Interactive Document Viewer",
    description:
      "Access a digital version of every document in one place. View the original file alongside AI-generated insights and extracted data. Navigate through tabs to explore structured information, key details, and operational context from each document.",
    emoji: "📄",
  },
  {
    target: '[data-tour="ai-copilot"]',
    title: "Your AI Coworker",
    description:
      "Ask your Coworker anything about your documents — specifications, procedures, risks, tolerances, or quality concerns. Get instant answers using the full context of your manufacturing documentation.",
    emoji: "✨",
  },
  {
    target: '[data-tour="mic-btn"]',
    title: "Multimodal Interaction",
    description:
      "Interact with your Coworker using voice, video, images, or text. Tap the microphone to ask questions verbally — transcribed in real time, responded to in any language. Tap the camera to point at a part, label, or defect and get instant AI analysis. Choose the interaction method that works best for your team.",
    emoji: "🎤",
  },
  {
    target: '[data-tour="artifacts-panel"]',
    title: "Artifact Creation",
    description:
      "Turn insights into action with Corello. Generate reports, summaries, charts, graphs, and shareable documents to help your team better understand operations, quality trends, and production performance.",
    emoji: "🗂️",
  },
  {
    target: '[data-tour="lang-strip"]',
    title: "Multilingual Experience",
    description:
      "Switch the entire Corello interface between English, Spanish, French, Portuguese, and Chinese instantly. AI responses, navigation, and workflows automatically adapt to the selected language.",
    emoji: "🌐",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function OnboardingTour() {
  const [step, setStep]       = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect]       = useState<Rect | null>(null);
  const [animating, setAnimating] = useState(false);

  // Show tour once per install
  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) setTimeout(() => setVisible(true), 900);
  }, []);

  // Retry until the target element has non-zero dimensions (layout settled)
  const updateRect = useCallback((idx: number) => {
    let attempts = 0;
    const MAX = 10;
    const tryGet = () => {
      const el = document.querySelector(STEPS[idx].target);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          return;
        }
      }
      if (++attempts < MAX) setTimeout(tryGet, 150);
    };
    tryGet();
  }, []);

  useEffect(() => {
    if (visible) updateRect(step);
  }, [visible, step, updateRect]);

  useEffect(() => {
    if (!visible) return;
    const handle = () => updateRect(step);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [visible, step, updateRect]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(TOUR_KEY, "1");
  }, []);

  const goTo = (idx: number) => {
    if (animating) return;
    setAnimating(true);
    setStep(idx);
    setTimeout(() => setAnimating(false), 320);
  };

  const next = () => {
    if (step < STEPS.length - 1) goTo(step + 1);
    else dismiss();
  };

  const back = () => {
    if (step > 0) goTo(step - 1);
  };

  if (!visible || !rect) return null;

  // Spotlight geometry
  const cx  = rect.left + rect.width  / 2;
  const cy  = rect.top  + rect.height / 2;
  const rx  = rect.width  / 2 + PAD;
  const ry  = rect.height / 2 + PAD;

  // The mask creates a clear ellipse; everything outside is blurred/dimmed
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, transparent 0%, transparent 65%, black 95%)`;

  // Card positioning: try right → left → below
  const CARD_W = 310;
  const winW   = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const winH   = typeof window !== "undefined" ? window.innerHeight : 900;
  const rightX = rect.left + rect.width + 28;
  const leftX  = rect.left - CARD_W - 28;
  const cardX  = rightX + CARD_W < winW - 16 ? rightX
               : leftX > 16               ? leftX
               : Math.max(16, (winW - CARD_W) / 2);
  const cardY  = Math.min(
    Math.max(16, rect.top + rect.height / 2 - 130),
    winH - 280
  );

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: "none" }}>

      {/* ── Blurred backdrop with spotlight cutout ─────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(4px) brightness(0.45) saturate(0.7)",
          WebkitBackdropFilter: "blur(4px) brightness(0.45) saturate(0.7)",
          background: "rgba(8, 11, 18, 0.5)",
          maskImage: mask,
          WebkitMaskImage: mask,
          pointerEvents: "auto",
          transition: "mask-image 0.3s ease",
        }}
        onClick={dismiss}
      />

      {/* ── Spotlight glow ring ────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top:    rect.top    - PAD,
          left:   rect.left   - PAD,
          width:  rect.width  + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: 18,
          boxShadow: [
            "0 0 0 2px rgba(245, 200, 0, 0.9)",
            "0 0 0 5px rgba(245, 200, 0, 0.18)",
            "0 0 32px 8px rgba(245, 200, 0, 0.2)",
            "inset 0 0 24px 4px rgba(245, 200, 0, 0.04)",
          ].join(", "),
          transition: "all 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: "none",
        }}
      />

      {/* ── Step card ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top:    cardY,
          left:   cardX,
          width:  CARD_W,
          pointerEvents: "auto",
          transition: "top 0.32s cubic-bezier(0.4,0,0.2,1), left 0.32s cubic-bezier(0.4,0,0.2,1)",
          opacity: animating ? 0 : 1,
        }}
      >
        {/* Glass card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(18, 24, 36, 0.92)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            border: "1px solid rgba(245, 200, 0, 0.22)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          {/* Accent top bar */}
          <div
            className="h-[3px] w-full"
            style={{
              background: `linear-gradient(90deg, transparent, #F5C800 ${(step / (STEPS.length - 1)) * 100}%, transparent)`,
              transition: "background 0.4s ease",
            }}
          />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{
                    background: "rgba(245, 200, 0, 0.12)",
                    border: "1px solid rgba(245, 200, 0, 0.25)",
                  }}
                >
                  {STEPS[step].emoji}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#F5C800]/70 mb-0.5">
                    {step + 1} / {STEPS.length}
                  </p>
                  <h3 className="text-[13px] font-bold text-slate-100 leading-tight">
                    {STEPS[step].title}
                  </h3>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="text-slate-600 hover:text-slate-300 transition-colors mt-0.5 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <p className="text-[12px] text-slate-400 leading-relaxed mb-5">
              {STEPS[step].description}
            </p>

            {/* Progress pills */}
            <div className="flex items-center gap-1.5 mb-5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    height: 5,
                    borderRadius: 99,
                    background:
                      i === step   ? "#F5C800" :
                      i < step     ? "rgba(245,200,0,0.35)" :
                                     "rgba(255,255,255,0.08)",
                    width: i === step ? 22 : 7,
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    border: "none",
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center justify-between">
              {step > 0 ? (
                <button
                  onClick={back}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors py-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              ) : (
                <button
                  onClick={dismiss}
                  className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors py-1"
                >
                  Skip tour
                </button>
              )}

              <button
                onClick={next}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: step === STEPS.length - 1
                    ? "linear-gradient(135deg, #F5C800, #FFB300)"
                    : "#F5C800",
                  color: "#0f1117",
                  boxShadow: "0 4px 16px rgba(245,200,0,0.3)",
                }}
              >
                {step === STEPS.length - 1 ? (
                  <>Let&apos;s go! <Sparkles className="w-3 h-3" /></>
                ) : (
                  <>Next <ChevronRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
