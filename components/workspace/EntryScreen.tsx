"use client";

import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, FolderOpen, HardDrive, ChevronDown, X } from "lucide-react";

interface EntryScreenProps {
  onFilesSelected: (files: File[]) => void;
  onDriveConnect: () => void;
}

export default function EntryScreen({ onFilesSelected, onDriveConnect }: EntryScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback(
    (accepted: File[]) => { if (accepted.length > 0) onFilesSelected(accepted); },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"],
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const singleOpen = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp";
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length) onFilesSelected(files);
    };
    input.click();
    setMenuOpen(false);
  }, [onFilesSelected]);

  const batchOpen = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? []);
      if (files.length) onFilesSelected(files);
    };
    input.click();
    setMenuOpen(false);
  }, [onFilesSelected]);

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col flex-1 min-w-0 bg-[#1A202C] border-r border-white/8 relative transition-colors ${
        isDragActive ? "bg-[#F5C800]/3" : ""
      }`}
    >
      <input {...getInputProps()} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-[#232B38] shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#F5C800]" />
          <span className="text-sm font-medium text-slate-200">Document Viewer</span>
        </div>

        {/* Upload options dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5C800]/10 border border-[#F5C800]/20 text-[#F5C800] text-xs font-medium hover:bg-[#F5C800]/15 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
            <ChevronDown className={`w-3 h-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-20 w-56 bg-[#232B38] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                <button
                  onClick={singleOpen}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/8"
                >
                  <FileText className="w-4 h-4 text-[#F5C800] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Single Traveler</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">One PDF or image</div>
                  </div>
                </button>
                <button
                  onClick={batchOpen}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/8"
                >
                  <FolderOpen className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Job Pack</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Multiple docs, auto-grouped</div>
                  </div>
                </button>
                <button
                  onClick={() => { onDriveConnect(); setMenuOpen(false); }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <HardDrive className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Connect Drive</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Google Drive · SharePoint</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          onClick={open}
          className={`w-full max-w-md border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-[#F5C800] bg-[#F5C800]/5"
              : "border-white/15 hover:border-[#F5C800]/40 hover:bg-[#F5C800]/3"
          }`}
        >
          <div className="flex justify-center mb-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
              isDragActive ? "bg-[#F5C800]/20 border border-[#F5C800]/40" : "bg-[#F5C800]/10 border border-[#F5C800]/20"
            }`}>
              <Upload className="w-7 h-7 text-[#F5C800]" />
            </div>
          </div>
          <h3 className="text-base font-semibold text-slate-200 mb-2">
            {isDragActive ? "Drop to upload" : "Drop a paper traveler here"}
          </h3>
          <p className="text-sm text-slate-500 mb-1">
            Travelers · SOPs · Inspection Sheets · Drawings
          </p>
          <p className="text-xs text-slate-600 mb-6">PDF · PNG · JPG · TIFF · up to 20 MB</p>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5C800]/10 border border-[#F5C800]/20 rounded-lg text-[#F5C800] text-sm font-medium hover:bg-[#F5C800]/15 transition-colors">
            <FileText className="w-3.5 h-3.5" />
            Browse Files
          </span>
        </div>
      </div>
    </div>
  );
}
