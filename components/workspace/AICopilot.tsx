"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  ChevronRight,
  WifiOff,
  Mic,
  MicOff,
  Volume2,
  Square,
  Camera,
} from "lucide-react";
import type { PapyrusDocument, ChatMessage, ArtifactType } from "@/lib/types";
import { appendChatMessage } from "@/lib/document-store";
import ProactiveBanner from "./ProactiveBanner";
import CameraModal from "./CameraModal";
import { useLanguage } from "@/lib/language-context";
import { LANGUAGE_NAMES, type Locale } from "@/lib/i18n";

// ── Web Speech API type declarations ─────────────────────────────────────────

interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }
interface SpeechRecognitionResult      { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionResultList  { readonly length: number; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onstart:  ((ev: Event) => void) | null;
  onend:    ((ev: Event) => void) | null;
  onerror:  ((ev: Event & { error?: string }) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
}
interface SpeechRecognitionCtor { new(): SpeechRecognitionInstance; }

declare global {
  interface Window {
    SpeechRecognition?:       SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

// ── Locale → BCP-47 language tag ─────────────────────────────────────────────

const LOCALE_BCP47: Record<Locale, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-BR",
  zh: "zh-CN",
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface AICopilotProps {
  document:           PapyrusDocument | null;
  onGenerateArtifact: (type: string) => void;
  onChatUpdated:      (history: ChatMessage[]) => void;
  /** Called when user clicks "Add to Workspace" inside CameraModal */
  onAddToWorkspace?:  (imageDataUrl: string, analysisText: string) => void;
}

function formatContent(content: string): React.ReactNode {
  return content.split("\n").map((line, i) => {
    if (line.startsWith("## ") || line.startsWith("# ")) {
      return <p key={i} className="font-bold text-slate-100 text-sm mt-2 first:mt-0">{line.replace(/^#+\s+/, "")}</p>;
    }
    if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
      return <p key={i} className="font-semibold text-slate-200 mt-1">{line.trim().slice(2, -2)}</p>;
    }
    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      return <p key={i} className="text-slate-300 leading-relaxed pl-2">· {line.slice(2)}</p>;
    }
    if (line === "") return <br key={i} />;
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={i} className="text-slate-300 leading-relaxed">
        {parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j} className="text-slate-100 font-semibold">{part}</strong> : part
        )}
      </p>
    );
  });
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AICopilot({ document, onGenerateArtifact, onChatUpdated, onAddToWorkspace }: AICopilotProps) {
  const { locale, tr } = useLanguage();

  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming]     = useState(false);
  const [input, setInput]               = useState("");
  const [error, setError]               = useState<string | null>(null);

  // Voice state
  const [isListening, setIsListening]         = useState(false);
  const [isSpeaking, setIsSpeaking]           = useState(false);
  const [interimText, setInterimText]         = useState("");
  const [sttSupported, setSttSupported]       = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx]   = useState<number | null>(null);
  const [micError, setMicError]               = useState<string | null>(null);

  // Camera state
  const [showCamera, setShowCamera]           = useState(false);

  // Refs
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const abortRef          = useRef<AbortController | null>(null);
  const recognitionRef    = useRef<SpeechRecognitionInstance | null>(null);
  const wasVoiceInput     = useRef(false);
  const keepAliveRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  // Pending voice transcript — used for auto-send after STT ends
  const pendingVoiceText  = useRef("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSttSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(document ? (document.chatHistory ?? []) : []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const hasDocument = document !== null && document.status === "ready";

  // ── TTS ───────────────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined") return;
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingMsgIdx(null);
  }, []);

  const speak = useCallback((text: string, msgIdx?: number) => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    // Cancel anything playing
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    synth.cancel();

    const cleaned = stripMarkdown(text);
    if (!cleaned) return;

    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang  = LOCALE_BCP47[locale];   // ← use app locale, not browser locale
    utter.rate  = 1.0;
    utter.pitch = 1.0;

    // Chrome cuts off TTS after ~15 s — keep alive with pause/resume
    utter.onstart = () => {
      setIsSpeaking(true);
      if (msgIdx !== undefined) setSpeakingMsgIdx(msgIdx);
      keepAliveRef.current = setInterval(() => {
        if (!synth.speaking) { clearInterval(keepAliveRef.current!); keepAliveRef.current = null; return; }
        synth.pause();
        synth.resume();
      }, 10_000);
    };

    utter.onend = utter.onerror = () => {
      if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
      setIsSpeaking(false);
      setSpeakingMsgIdx(null);
    };

    synth.speak(utter);
  }, [locale]); // ← locale in deps so language updates correctly

  // Prime TTS during a user-gesture so Chrome doesn't block async calls later
  const primeTTS = useCallback(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    const silent = new SpeechSynthesisUtterance(" ");
    silent.volume = 0;
    synth.speak(silent);
    synth.cancel();
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string, fromVoice = false) => {
      if (!text.trim() || !hasDocument || isStreaming) return;
      stopSpeaking();
      // Honour wasVoiceInput flag even when called from keyboard send
      const speakReply = fromVoice || wasVoiceInput.current;
      wasVoiceInput.current = false;

      const userMsg: ChatMessage = {
        role: "user",
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setInput("");
      setInterimText("");
      setError(null);
      setIsStreaming(true);
      setStreamingText("");

      if (document?.id) appendChatMessage(document.id, userMsg);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            documentId: document!.id,
            extractedText: document!.extractedText,
            metadata: document!.metadata,
            userMessage: text,
            chatHistory: updatedHistory.slice(-20),
            language: LANGUAGE_NAMES[locale],
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) { accumulated += parsed.text; setStreamingText(accumulated); }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
            }
          }
        }

        const newIdx = updatedHistory.length;
        const aiMsg: ChatMessage = {
          role: "assistant",
          content: accumulated,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        const finalHistory = [...updatedHistory, aiMsg];
        setMessages(finalHistory);
        setStreamingText("");
        onChatUpdated(finalHistory);
        if (document?.id) appendChatMessage(document.id, aiMsg);

        // Speak back automatically when question came from voice
        if (speakReply && accumulated) speak(accumulated, newIdx);

        // Auto-suggest artifact
        const lower = text.toLowerCase();
        if (lower.includes("sop") || lower.includes("procedure"))             onGenerateArtifact("sop");
        else if (lower.includes("checklist") || lower.includes("inspection")) onGenerateArtifact("inspection_checklist");
        else if (lower.includes("risk") || lower.includes("flag"))            onGenerateArtifact("risk_report");
        else if (lower.includes("handoff") || lower.includes("shift"))        onGenerateArtifact("shift_handoff");
        else if (lower.includes("summary") || lower.includes("traveler"))     onGenerateArtifact("traveler_summary");

      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStreaming(false);
        setStreamingText("");
        abortRef.current = null;
      }
    },
    [messages, hasDocument, isStreaming, document, locale,
     onGenerateArtifact, onChatUpdated, speak, stopSpeaking]
  );

  // ── Camera analysis result → inject into chat ────────────────────────────

  const handleCameraAnalysis = useCallback(
    (imageDataUrl: string, question: string, response: string) => {
      void imageDataUrl; // thumbnail not stored — session-only

      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const userMsg: ChatMessage = {
        role: "user",
        content: `📷 ${question}`,
        timestamp: ts,
      };
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: response,
        timestamp: ts,
      };

      const updated = [...messages, userMsg, aiMsg];
      setMessages(updated);
      onChatUpdated(updated);

      if (document?.id) {
        appendChatMessage(document.id, userMsg);
        appendChatMessage(document.id, aiMsg);
      }

      setShowCamera(false);
    },
    [messages, document, onChatUpdated]
  );

  // ── STT ───────────────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    setMicError(null);
    pendingVoiceText.current = "";

    // Prime TTS NOW — during this user gesture — so Chrome allows async speak later
    primeTTS();

    const rec = new Ctor();
    rec.lang            = LOCALE_BCP47[locale]; // ← use app locale
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => { setIsListening(true); wasVoiceInput.current = true; };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (interim) setInterimText(interim);
      if (final) {
        pendingVoiceText.current = (pendingVoiceText.current + " " + final).trim();
        setInput(pendingVoiceText.current);
        setInterimText("");
      }
    };

    rec.onerror = (e: Event & { error?: string }) => {
      const code = (e as { error?: string }).error ?? "unknown";
      const msgs: Record<string, string> = {
        "not-allowed":    "Microphone access denied. Allow it in browser settings.",
        "no-speech":      "No speech detected. Try again.",
        "network":        "Network error during voice recognition.",
        "audio-capture":  "No microphone found.",
        "aborted":        "",
      };
      const msg = msgs[code] ?? `Voice error: ${code}`;
      if (msg) setMicError(msg);
      setIsListening(false);
      setInterimText("");
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;

      // Populate input for user to review — do NOT auto-send
      // Factory-floor: let the operator verify transcript before sending
      const captured = pendingVoiceText.current.trim();
      if (captured) {
        setInput(captured);
        pendingVoiceText.current = "";
        // Signal that this came from voice so TTS reply is enabled on send
        wasVoiceInput.current = true;
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.error("[STT] start error", err);
      setIsListening(false);
      setMicError("Could not start microphone. Check browser permissions.");
    }
  }, [locale, hasDocument, sendMessage, primeTTS]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
    pendingVoiceText.current = "";
    wasVoiceInput.current = false;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div data-tour="ai-copilot" className="flex flex-col h-full bg-[#232B38] border-r border-white/5 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#F5C800]/20 border border-[#F5C800]/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#F5C800]" />
          </div>
          <span className="text-sm font-semibold text-slate-200">{tr.aiCopilot}</span>
          {document?.isMockMode && (
            <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">Mock</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F5C800]/10 border border-[#F5C800]/30 text-[#F5C800] text-[10px] hover:bg-[#F5C800]/20 transition-colors"
            >
              <Square className="w-2.5 h-2.5" />{tr.stop}
            </button>
          )}
          {hasDocument ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-slate-500">{document?.isMockMode ? "Tesseract" : tr.liveBadge}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-600">{tr.noDocumentBadge}</span>
            </div>
          )}
        </div>
      </div>

      {/* Proactive suggestions */}
      {hasDocument && document && (
        <div className="border-b border-white/8">
          <ProactiveBanner document={document} onGenerateArtifact={(type: ArtifactType) => onGenerateArtifact(type)} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {!hasDocument && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F5C800]/10 border border-[#F5C800]/20 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-[#F5C800]" />
            </div>
            <p className="text-sm text-slate-400 font-medium mb-1">{tr.copilotTitle}</p>
            <p className="text-xs text-slate-600">{tr.copilotSubtitle}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === "assistant" ? "bg-[#F5C800]/20 border border-[#F5C800]/30" : "bg-slate-700 border border-white/10"
            }`}>
              {msg.role === "assistant" ? <Sparkles className="w-3.5 h-3.5 text-[#F5C800]" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
            </div>
            <div className={`flex-1 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`rounded-xl px-3 py-2.5 text-[12px] leading-relaxed max-w-[92%] ${
                msg.role === "user"
                  ? "bg-[#F5C800]/10 border border-[#F5C800]/20 text-slate-200 self-end"
                  : "bg-[#1A202C] border border-white/8 self-start w-full"
              }`}>
                {msg.role === "assistant"
                  ? <div className="space-y-0.5">{formatContent(msg.content)}</div>
                  : msg.content}
              </div>
              <div className="flex items-center gap-2 mt-1 px-1">
                <span className="text-[9px] text-slate-600">{msg.timestamp}</span>
                {msg.role === "assistant" && (
                  <button
                    onClick={() => speakingMsgIdx === i ? stopSpeaking() : speak(msg.content, i)}
                    title={speakingMsgIdx === i ? "Stop" : tr.readAloud}
                    className={`transition-colors ${speakingMsgIdx === i ? "text-[#F5C800]" : "text-slate-600 hover:text-[#F5C800]"}`}
                  >
                    {speakingMsgIdx === i ? <Square className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming */}
        {isStreaming && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#F5C800]/20 border border-[#F5C800]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-[#F5C800] animate-pulse" />
            </div>
            <div className="flex-1 bg-[#1A202C] border border-white/8 rounded-xl px-3 py-2.5">
              {streamingText ? (
                <div className="space-y-0.5">
                  {formatContent(streamingText)}
                  <span className="inline-block w-1.5 h-3.5 bg-[#F5C800] ml-0.5 animate-pulse" />
                </div>
              ) : (
                <div className="flex items-center gap-1 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5C800] animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5C800] animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5C800] animate-bounce [animation-delay:300ms]" />
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {hasDocument && messages.length === 0 && (
        <div className="px-3 pb-2 shrink-0">
          <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">{tr.askDocSection}</div>
          <div className="flex flex-col gap-1.5">
            {tr.prompts.slice(0, 4).map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={isStreaming}
                className="text-left text-[11px] text-slate-400 hover:text-[#F5C800] bg-[#1A202C] border border-white/8 hover:border-[#F5C800]/30 rounded-lg px-3 py-2 transition-all flex items-center justify-between group disabled:opacity-40"
              >
                <span>{prompt}</span>
                <ChevronRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-4 pt-3 border-t border-white/8 shrink-0">

        {/* Mic error */}
        {micError && (
          <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-[11px] text-red-300">{micError}</span>
            <button onClick={() => setMicError(null)} className="text-red-400 hover:text-red-300 text-xs ml-2">✕</button>
          </div>
        )}

        {/* Input box — border turns red while listening */}
        <div className={`flex gap-2 items-end bg-[#1A202C] rounded-xl p-2 transition-colors border ${
          isListening ? "border-red-500/60" : "border-white/10 focus-within:border-[#F5C800]/40"
        }`}>
          <div className="flex-1 relative">
            <textarea
              value={isListening ? (input + (interimText ? (input ? " " : "") + interimText : "")) : input}
              onChange={(e) => { if (!isListening) { setInput(e.target.value); wasVoiceInput.current = false; } }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
              placeholder={hasDocument ? tr.askDocPlaceholder : tr.uploadToStartPlaceholder}
              disabled={!hasDocument || isStreaming}
              rows={1}
              className="w-full bg-transparent text-xs text-slate-300 placeholder-slate-600 outline-none resize-none min-h-[20px] max-h-[80px] disabled:cursor-not-allowed"
              style={{ lineHeight: "1.5" }}
            />
            {/* Listening waveform overlay inside textarea */}
            {isListening && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none">
                {[0, 150, 300, 150, 0].map((delay, k) => (
                  <span key={k} className="w-0.5 bg-red-400 rounded-full animate-bounce"
                    style={{ height: `${5 + k * 2}px`, animationDelay: `${delay}ms` }} />
                ))}
              </div>
            )}
          </div>

          {/* Mic button */}
          {sttSupported && (
            <button
              data-tour="mic-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={isListening ? stopListening : startListening}
              disabled={!hasDocument || isStreaming}
              title={isListening ? "Stop listening" : "Speak (any language)"}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
                isListening
                  ? "bg-red-500 hover:bg-red-400"
                  : "bg-white/8 hover:bg-white/15 text-slate-400 hover:text-slate-200"
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Camera button */}
          <button
            onClick={() => setShowCamera(true)}
            disabled={isStreaming}
            title="Visual analysis — show a traveler, part, or drawing to the camera"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 bg-white/8 hover:bg-white/15 text-slate-400 hover:text-[#F5C800] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Send */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || !hasDocument || isStreaming}
            className="w-7 h-7 rounded-lg bg-[#F5C800] flex items-center justify-center hover:bg-[#FFD700] disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-[#0f1117]" />
          </button>
        </div>

        <p className="text-[9px] text-slate-600 text-center mt-1.5">
          {sttSupported ? tr.voiceHint : tr.keyboardHint}
        </p>
      </div>

      {/* Camera modal */}
      {showCamera && (
        <CameraModal
          onClose={() => setShowCamera(false)}
          onAnalysisComplete={handleCameraAnalysis}
          onAddToWorkspace={onAddToWorkspace}
          documentContext={document?.extractedText ?? ""}
          jobContext={[
            document?.metadata?.jobNumber?.value  ? `Job ${document.metadata.jobNumber.value}`   : null,
            document?.metadata?.partNumber?.value ? `Part ${document.metadata.partNumber.value}` : null,
            document?.metadata?.customer?.value   ? `Customer: ${document.metadata.customer.value}` : null,
            document?.metadata?.revision?.value   ? `Rev ${document.metadata.revision.value}`    : null,
          ].filter(Boolean).join(" · ")}
          language={LANGUAGE_NAMES[locale]}
        />
      )}
    </div>
  );
}
