"use client";

import React, { useEffect } from "react";
import { X, Download, FileText, FileSpreadsheet, Image as ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  textPreview?: string;
}

interface FilePreviewModalProps {
  file: UploadedFileItem | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (file) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [file, onClose]);

  if (!file) return null;

  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
  const isTextOrCsv = file.textPreview !== undefined || /\.(txt|csv|json|md|log|tsv)$/i.test(file.name);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B21]/90 p-2 sm:p-6 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] shadow-[0_0_50px_rgba(0,255,136,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0A0E2A] px-3.5 sm:px-5 py-3 sm:py-3.5">
          <div className="flex items-center gap-2.5 truncate max-w-[60%] sm:max-w-[70%]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-[#00FF88] to-[#00D2FF] text-[#080B21]">
              {isImage ? (
                <ImageIcon className="h-4 w-4" />
              ) : isTextOrCsv ? (
                <FileSpreadsheet className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-white truncate">
                {file.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {formatFileSize(file.size)} • {file.type || "Tài liệu"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#121A45] px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-[#00FF88] hover:border-[#00FF88] transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tải xuống</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-3 sm:p-6 bg-[#060919] min-h-[220px] max-h-[calc(94vh-70px)]">
          {isImage ? (
            <img
              src={file.url}
              alt={file.name}
              className="max-h-[65vh] w-auto rounded-xl object-contain shadow-2xl transition-transform hover:scale-105 duration-300"
            />
          ) : isPdf ? (
            <iframe
              src={file.url}
              title={file.name}
              className="h-[70vh] w-full rounded-xl border border-slate-800 bg-white"
            />
          ) : isTextOrCsv && file.textPreview ? (
            <div className="w-full h-full max-h-[70vh] overflow-auto rounded-xl border border-slate-800 bg-[#080B21] p-4 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
              {file.textPreview}
            </div>
          ) : (
            <div className="text-center p-8 space-y-3">
              <FileText className="h-12 w-12 text-[#00FF88] mx-auto opacity-70" />
              <p className="text-sm font-semibold text-white">Tài liệu đã sẵn sàng đính kèm</p>
              <p className="text-xs text-slate-400">
                File này sẽ được gửi kèm để AI Copilot phân tích dữ liệu cùng với yêu cầu của bạn.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
