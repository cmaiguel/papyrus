/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { X, HardDrive, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface DriveConnectModalProps {
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
}

type Provider = "google" | "sharepoint";
type Status = "idle" | "connecting" | "connected" | "error";

const GOOGLE_CLIENT_ID  = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const AZURE_CLIENT_ID   = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? "";
const GOOGLE_API_KEY    = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";

export default function DriveConnectModal({ onClose }: DriveConnectModalProps) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const googleReady   = Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY);
  const sharepointReady = Boolean(AZURE_CLIENT_ID);

  // ── Google Drive Picker ───────────────────────────────────────────────────
  function handleGoogleConnect() {
    if (!googleReady) { setProvider("google"); return; }
    setProvider("google");
    setStatus("connecting");

    // Load Google APIs
    const script = window.document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      (window as any).gapi.load("picker", () => {
        (window as any).gapi.load("auth2", () => {
          const authInstance = (window as any).gapi.auth2.getAuthInstance();
          if (!authInstance) {
            (window as any).gapi.auth2.init({ client_id: GOOGLE_CLIENT_ID }).then(() => {
              openGooglePicker();
            });
          } else {
            openGooglePicker();
          }
        });
      });
    };
    window.document.head.appendChild(script);
  }

  function openGooglePicker() {
    (window as any).gapi.auth2.getAuthInstance().signIn().then((user: any) => {
      const token = user.getAuthResponse().access_token;
      const picker = new (window as any).google.picker.PickerBuilder()
        .addView((window as any).google.picker.ViewId.DOCS)
        .setOAuthToken(token)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setCallback((data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            setStatus("connected");
            // Download each picked file via Drive API
            data.docs.forEach(async (doc: any) => {
              const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const blob = await res.blob();
              const file = new File([blob], doc.name, { type: doc.mimeType });
              // trigger parent upload
              (window as any).__papyrus_drive_file?.(file);
            });
          }
        })
        .build();
      picker.setVisible(true);
      setStatus("connected");
    });
  }

  // ── SharePoint (MSAL) ─────────────────────────────────────────────────────
  async function handleSharepointConnect() {
    if (!sharepointReady) { setProvider("sharepoint"); return; }
    setProvider("sharepoint");
    setStatus("connecting");

    try {
      const { PublicClientApplication } = await import("@azure/msal-browser");
      const msalInstance = new PublicClientApplication({
        auth: {
          clientId: AZURE_CLIENT_ID,
          redirectUri: window.location.origin,
        },
      });
      await msalInstance.initialize();
      const result = await msalInstance.loginPopup({
        scopes: ["Files.Read", "Sites.Read.All"],
      });
      console.log("SharePoint auth token:", result.accessToken);
      setStatus("connected");
      // TODO: open SharePoint file picker using MS Graph
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-[#232B38] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">Connect Drive</div>
              <div className="text-[10px] text-slate-500">Browse files without downloading</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">

          {/* Google Drive */}
          <div className={`rounded-xl border p-4 transition-all ${
            provider === "google" ? "border-[#F5C800]/40 bg-[#F5C800]/3" : "border-white/10"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {/* Google Drive icon */}
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M4.5 20.5L8.5 13.5L4.5 6.5H12L16 13.5L12 20.5H4.5Z" fill="#0F9D58"/>
                  <path d="M8.5 13.5L12 20.5H19.5L15.5 13.5H8.5Z" fill="#4285F4"/>
                  <path d="M8.5 13.5L4.5 6.5H12L15.5 13.5H8.5Z" fill="#FBBC04"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-200">Google Drive</div>
                <div className="text-[10px] text-slate-500">Browse and import PDFs or images</div>
              </div>
              {googleReady ? (
                <button
                  onClick={handleGoogleConnect}
                  disabled={status === "connecting"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5C800] text-[#0f1117] text-xs font-bold hover:bg-[#FFD700] disabled:opacity-60 transition-all"
                >
                  {status === "connecting" && provider === "google" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </button>
              ) : (
                <span className="text-[9px] text-slate-500 bg-slate-700/50 px-2 py-1 rounded-full">Setup required</span>
              )}
            </div>

            {!googleReady && (
              <div className="bg-[#1A202C] rounded-lg p-3 text-[10px] text-slate-400 space-y-1.5 border border-white/5">
                <p className="font-semibold text-slate-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-yellow-400" />
                  Requires Google Cloud setup
                </p>
                <ol className="space-y-1 list-decimal list-inside text-slate-500">
                  <li>Create a project at <span className="text-blue-400">console.cloud.google.com</span></li>
                  <li>Enable the Google Drive API</li>
                  <li>Create OAuth credentials (Web application)</li>
                  <li>Add <code className="text-[#F5C800]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and <code className="text-[#F5C800]">NEXT_PUBLIC_GOOGLE_API_KEY</code> to <code className="text-[#F5C800]">.env.local</code></li>
                </ol>
                <a
                  href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-1"
                >
                  Open Google Cloud Console
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>

          {/* SharePoint */}
          <div className={`rounded-xl border p-4 transition-all ${
            provider === "sharepoint" ? "border-blue-400/40 bg-blue-400/3" : "border-white/10"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="3" fill="#0078D4"/>
                  <path d="M6 12 A6 6 0 1 1 18 12 A6 6 0 1 1 6 12 Z" fill="white" opacity="0.15"/>
                  <circle cx="12" cy="12" r="4" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-200">SharePoint</div>
                <div className="text-[10px] text-slate-500">Connect to your organization&apos;s SharePoint</div>
              </div>
              {sharepointReady ? (
                <button
                  onClick={handleSharepointConnect}
                  disabled={status === "connecting"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-400 disabled:opacity-60 transition-all"
                >
                  {status === "connecting" && provider === "sharepoint" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </button>
              ) : (
                <span className="text-[9px] text-slate-500 bg-slate-700/50 px-2 py-1 rounded-full">Setup required</span>
              )}
            </div>

            {!sharepointReady && (
              <div className="bg-[#1A202C] rounded-lg p-3 text-[10px] text-slate-400 space-y-1.5 border border-white/5">
                <p className="font-semibold text-slate-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-yellow-400" />
                  Requires Azure AD setup
                </p>
                <ol className="space-y-1 list-decimal list-inside text-slate-500">
                  <li>Register an app at <span className="text-blue-400">portal.azure.com</span></li>
                  <li>Add permissions: <code className="text-[#F5C800]">Files.Read</code>, <code className="text-[#F5C800]">Sites.Read.All</code></li>
                  <li>Add <code className="text-[#F5C800]">NEXT_PUBLIC_AZURE_CLIENT_ID</code> to <code className="text-[#F5C800]">.env.local</code></li>
                </ol>
                <a
                  href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-1"
                >
                  Open Azure Portal
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>

          {status === "connected" && (
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Connected — select your file in the picker that opened
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Authentication failed — check your credentials and try again
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between">
          <p className="text-[10px] text-slate-600">
            Files are fetched directly — nothing is stored on our servers
          </p>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
