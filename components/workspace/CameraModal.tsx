"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Camera, Scan, RefreshCw, AlertCircle, Sparkles, FolderPlus, CheckCircle,
} from "lucide-react";
import { compressAndValidateImage } from "@/lib/image-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CameraModalProps {
  onClose:            () => void;
  onAnalysisComplete: (imageDataUrl: string, question: string, response: string) => void;
  /** Fires when user wants to save capture as a workspace document */
  onAddToWorkspace?:  (imageDataUrl: string, analysisText: string) => void;
  documentContext?:   string;   // extracted text from loaded doc
  jobContext?:        string;   // "Job J-0891 | Part ABC-123 | Customer Acme"
  language:           string;   // "English" | "Spanish" | …
}

type Phase = "camera" | "compressing" | "captured" | "analyzing" | "done";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CameraModal({
  onClose,
  onAnalysisComplete,
  onAddToWorkspace,
  documentContext,
  jobContext,
  language,
}: CameraModalProps) {
  const [phase, setPhase]                   = useState<Phase>("camera");
  const [capturedImage, setCapturedImage]   = useState<string | null>(null);
  const [imageSizeKB, setImageSizeKB]       = useState<number | null>(null);
  const [question, setQuestion]             = useState("");
  const [streamingText, setStreamingText]   = useState("");
  const [finalResponse, setFinalResponse]   = useState("");
  const [error, setError]                   = useState<string | null>(null);
  const [cameraReady, setCameraReady]       = useState(false);
  const [scanLine, setScanLine]             = useState(0);
  const [savedToWorkspace, setSavedToWorkspace] = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const abortRef   = useRef<AbortController | null>(null);
  const scanRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Camera lifecycle ───────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; setCameraReady(true); }
    } catch (err) {
      const e = err as DOMException;
      const msgs: Record<string, string> = {
        NotAllowedError:       "Camera access denied. Allow camera in browser settings.",
        PermissionDeniedError: "Camera access denied. Allow camera in browser settings.",
        NotFoundError:         "No camera found on this device.",
        DevicesNotFoundError:  "No camera found on this device.",
        NotReadableError:      "Camera is already in use by another application.",
      };
      setError(msgs[e.name] ?? `Camera error: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera();
    return () => {
      stopCamera();
      abortRef.current?.abort();
      if (scanRef.current) clearInterval(scanRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scan-line animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === "analyzing") {
      scanRef.current = setInterval(() => setScanLine((p) => (p >= 100 ? 0 : p + 2)), 20);
    } else {
      if (scanRef.current) { clearInterval(scanRef.current); scanRef.current = null; }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScanLine(0);
    }
  }, [phase]);

  // ── Capture + compress ─────────────────────────────────────────────────────

  const capture = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;

    // Grab raw frame
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 1.0);

    stopCamera();
    setPhase("compressing");
    setError(null);

    // Compress + validate
    const result = await compressAndValidateImage(rawDataUrl, "image/jpeg");
    if (!result.valid || !result.compressedDataUrl) {
      setError(result.error ?? "Image processing failed.");
      setPhase("camera");
      startCamera();
      return;
    }

    setCapturedImage(result.compressedDataUrl);
    setImageSizeKB(result.sizeKB ?? null);
    setPhase("captured");
  }, [cameraReady, stopCamera, startCamera]);

  const retake = () => {
    setCapturedImage(null);
    setStreamingText("");
    setFinalResponse("");
    setError(null);
    setQuestion("");
    setSavedToWorkspace(false);
    setImageSizeKB(null);
    setPhase("camera");
    startCamera();
  };

  // ── Analyze ────────────────────────────────────────────────────────────────

  const analyze = useCallback(async () => {
    if (!capturedImage || phase !== "captured") return;
    setPhase("analyzing");
    setStreamingText("");

    const base64 = capturedImage.split(",")[1];
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/vision/analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  controller.signal,
        body: JSON.stringify({
          imageBase64:     base64,
          mimeType:        "image/jpeg",
          question:        question.trim() || undefined,
          documentContext: documentContext ?? "",
          jobContext:      jobContext ?? "",
          language,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer      = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) { accumulated += parsed.text; setStreamingText(accumulated); }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
          }
        }
      }

      setFinalResponse(accumulated);
      setPhase("done");
      const q = question.trim() || "Analyze this image";
      onAnalysisComplete(capturedImage, q, accumulated);

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setPhase("captured");
    }
  }, [capturedImage, phase, question, documentContext, jobContext, language, onAnalysisComplete]);

  // ── Add to Workspace ───────────────────────────────────────────────────────

  const handleAddToWorkspace = () => {
    if (!capturedImage || !onAddToWorkspace) return;
    onAddToWorkspace(capturedImage, finalResponse);
    setSavedToWorkspace(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: "rgba(5, 8, 15, 0.88)" }}
    >
      <div
        className="relative flex flex-col bg-[#161B26] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        style={{ width: 620, maxWidth: "95vw", maxHeight: "90vh" }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#1E2530] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#F5C800]/15 border border-[#F5C800]/25 flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-[#F5C800]" />
            </div>
            <span className="text-sm font-semibold text-slate-200">Visual Analysis</span>
            {phase === "compressing" && (
              <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 animate-pulse">
                Compressing…
              </span>
            )}
            {phase === "analyzing" && (
              <span className="flex items-center gap-1 text-[10px] text-[#F5C800] bg-[#F5C800]/10 px-2 py-0.5 rounded-full border border-[#F5C800]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F5C800] animate-pulse" />
                Analyzing…
              </span>
            )}
            {phase === "done" && (
              <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                ✓ Complete
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {imageSizeKB && (
              <span className="text-[9px] text-slate-600">{imageSizeKB} KB</span>
            )}
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Video / Captured frame ─────────────────────────────────────────── */}
        <div className="relative bg-black overflow-hidden shrink-0" style={{ aspectRatio: "16/9" }}>

          {/* Live video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              phase === "camera" ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
            }`}
          />

          {/* Captured still */}
          {capturedImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
          )}

          {/* Starting/compressing spinner */}
          {(phase === "camera" && !cameraReady && !error) || phase === "compressing" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600">
              <Camera className="w-10 h-10 animate-pulse" />
              <span className="text-sm">
                {phase === "compressing" ? "Processing image…" : "Starting camera…"}
              </span>
            </div>
          ) : null}

          {/* Viewfinder */}
          {phase === "camera" && cameraReady && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-56 h-36">
                  <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#F5C800] rounded-tl-sm" />
                  <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#F5C800] rounded-tr-sm" />
                  <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#F5C800] rounded-bl-sm" />
                  <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#F5C800] rounded-br-sm" />
                </div>
              </div>
              <p className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-white/50">
                Point at a traveler, drawing, part, label, or inspection sheet
              </p>
            </div>
          )}

          {/* Scan-line overlay */}
          {phase === "analyzing" && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute inset-0 bg-black/30" />
              <div
                className="absolute left-0 right-0 h-0.5"
                style={{
                  top: `${scanLine}%`,
                  background: "linear-gradient(90deg, transparent 0%, #F5C800 30%, #FFD700 50%, #F5C800 70%, transparent 100%)",
                  boxShadow: "0 0 12px 4px rgba(245,200,0,0.45)",
                }}
              />
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(245,200,0,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(245,200,0,0.4) 1px,transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Scan className="w-8 h-8 text-[#F5C800] animate-pulse" />
                  <span className="text-xs text-[#F5C800]/80 font-medium tracking-wide">
                    Reading document…
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Error */}
          {error && (
            <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Streaming / final analysis */}
          {(phase === "analyzing" || phase === "done") && streamingText && (
            <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-[#1E2530] border border-[#F5C800]/15 max-h-48 overflow-y-auto">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3 h-3 text-[#F5C800]" />
                <span className="text-[9px] text-[#F5C800]/70 font-semibold uppercase tracking-wider">
                  Corello Analysis
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                {streamingText}
              </p>
              {phase === "analyzing" && (
                <span className="inline-block w-1 h-3 bg-[#F5C800] animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}

          {/* Job context badge */}
          {jobContext && phase !== "camera" && (
            <div className="mx-4 mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/4 border border-white/8">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Context</span>
              <span className="text-[10px] text-slate-400 truncate">{jobContext}</span>
            </div>
          )}

          {/* Question input */}
          {(phase === "captured" || phase === "analyzing") && (
            <div className="px-4 mt-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && phase === "captured") analyze(); }}
                placeholder='Ask a specific question… e.g. "Is op 30 signed?" (optional)'
                disabled={phase === "analyzing"}
                autoFocus
                className="w-full bg-[#1E2530] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-[#F5C800]/40 disabled:opacity-50 transition-colors"
              />
              <p className="text-[9px] text-slate-600 mt-1.5 pl-1">
                Examples: &ldquo;What job number?&rdquo; · &ldquo;Any missing signatures?&rdquo; · &ldquo;What material is listed?&rdquo; · &ldquo;Are there defects?&rdquo;
              </p>
            </div>
          )}

          {/* Add to Workspace row — shown after analysis */}
          {phase === "done" && onAddToWorkspace && (
            <div className="mx-4 mt-3 mb-1">
              {savedToWorkspace ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-400/10 border border-green-400/20">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-[11px] text-green-300">
                    Added to workspace — find it in the left panel
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleAddToWorkspace}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-[#F5C800]/30 text-xs text-slate-300 hover:text-slate-100 transition-all group"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#F5C800] transition-colors" />
                  Add capture to workspace as document
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="px-4 py-3.5 border-t border-white/8 bg-[#1E2530] shrink-0 flex items-center justify-between gap-3">
          <div>
            {phase === "captured" && (
              <button onClick={retake} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Retake
              </button>
            )}
            {phase === "done" && (
              <button onClick={retake} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                <Camera className="w-3.5 h-3.5" /> New capture
              </button>
            )}
            {phase === "camera" && (
              <span className="text-[10px] text-slate-600">
                {cameraReady ? "Camera ready" : error ? "" : "Initializing…"}
              </span>
            )}
            {phase === "analyzing" && (
              <span className="text-[10px] text-slate-600">Reading image…</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {phase === "camera" && (
              <button
                onClick={capture}
                disabled={!cameraReady}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#F5C800] text-[#0f1117] text-[11px] font-bold hover:bg-[#FFD700] disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(245,200,0,0.25)]"
              >
                <Scan className="w-3.5 h-3.5" /> Capture
              </button>
            )}
            {phase === "captured" && (
              <button
                onClick={analyze}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#F5C800] text-[#0f1117] text-[11px] font-bold hover:bg-[#FFD700] transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(245,200,0,0.25)]"
              >
                <Sparkles className="w-3.5 h-3.5" /> Analyze with Corello
              </button>
            )}
            {phase === "done" && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#F5C800] text-[#0f1117] text-[11px] font-bold hover:bg-[#FFD700] transition-all shadow-[0_4px_16px_rgba(245,200,0,0.25)]"
              >
                View in chat →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
