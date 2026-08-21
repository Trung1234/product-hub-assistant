"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  Download,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Share2,
  Printer
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageActionBarProps {
  content: string;
  onFollowUpClick?: (prompt: string) => void;
}

export const MessageActionBar = React.memo<MessageActionBarProps>(({
  content,
  onFollowUpClick
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handleDownloadCsv = () => {
    const link = document.createElement("a");
    link.href = "http://127.0.0.1:8001/reports/product_opportunities.csv";
    link.download = "product_opportunities.csv";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPdf = () => {
    const link = document.createElement("a");
    link.href = "http://127.0.0.1:8001/reports/product_opportunity_report.pdf";
    link.download = "product_opportunity_report.pdf";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-xs text-slate-400 no-print">
      {/* Left Action Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer",
            copied
              ? "border-[#00FF88]/50 bg-[#00FF88]/15 text-[#00FF88]"
              : "border-slate-800 bg-[#0E1538]/60 text-slate-300 hover:border-[#00FF88]/40 hover:bg-[#121A45] hover:text-white"
          )}
          title="Sao chép toàn bộ báo cáo Markdown"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#00FF88]" />
              <span>Đã sao chép</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Sao chép</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0E1538]/60 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-slate-300 transition-all hover:border-[#00D2FF]/40 hover:bg-[#121A45] hover:text-[#00D2FF] cursor-pointer"
          title="Tải bảng ma trận 23 cột file CSV"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Tải CSV</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0E1538]/60 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-slate-300 transition-all hover:border-[#00FF88]/40 hover:bg-[#121A45] hover:text-[#00FF88] cursor-pointer"
          title="Tải bản báo cáo PDF chính thức"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Tải PDF</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0E1538]/60 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-slate-300 transition-all hover:border-amber-400/40 hover:bg-[#121A45] hover:text-amber-300 cursor-pointer"
          title="In hoặc lưu file PDF từ trình duyệt"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>In báo cáo</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer",
            shared
              ? "border-purple-500/50 bg-purple-500/15 text-purple-300"
              : "border-slate-800 bg-[#0E1538]/60 text-slate-300 hover:border-purple-500/40 hover:bg-[#121A45] hover:text-purple-300"
          )}
          title="Sao chép liên kết chia sẻ phiên nghiên cứu"
        >
          {shared ? (
            <>
              <Check className="h-3.5 w-3.5 text-purple-400" />
              <span>Đã sao chép link</span>
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />
              <span>Chia sẻ</span>
            </>
          )}
        </button>
      </div>

      {/* Right Feedback & Rating */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setLiked(liked === true ? null : true)}
          className={cn(
            "rounded-lg p-1.5 transition-all cursor-pointer",
            liked === true
              ? "bg-[#00FF88]/20 text-[#00FF88]"
              : "text-slate-400 hover:bg-[#0E1538] hover:text-white"
          )}
          title="Báo cáo hữu ích"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setLiked(liked === false ? null : false)}
          className={cn(
            "rounded-lg p-1.5 transition-all cursor-pointer",
            liked === false
              ? "bg-rose-500/20 text-rose-400"
              : "text-slate-400 hover:bg-[#0E1538] hover:text-white"
          )}
          title="Báo cáo chưa sát"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

MessageActionBar.displayName = "MessageActionBar";
