"use client";

import React, { useState, useMemo } from "react";
import {
  Copy,
  Check,
  Download,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Printer,
  Mail
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmailReportModal } from "@/app/components/EmailReportModal";
import { toast } from "@/components/ui/sonner";

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
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Extract keyword from markdown title or content
  const extractedKeyword = useMemo(() => {
    const match = content.match(/#+\s+(.+)/m) || content.match(/BÁO CÁO.+?:\s*(.+)/i);
    if (match && match[1]) {
      return match[1].replace(/[*_#]/g, "").trim();
    }
    return "Cơ hội sản phẩm POD R&D";
  }, [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Đã sao chép báo cáo", {
        description: "Nội dung Markdown đã được lưu vào khay nhớ tạm.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
      toast.error("Không thể sao chép", {
        description: "Vui lòng cấp quyền truy cập clipboard cho trình duyệt.",
      });
    }
  };

  const handleDownloadCsv = () => {
    const link = document.createElement("a");
    link.href = "/reports/product_opportunities.csv";
    link.download = "product_opportunities.csv";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đang tải tệp CSV", {
      description: "Bảng dữ liệu 23 cột R&D đang được tải về máy tính.",
    });
  };

  const handleDownloadPdf = () => {
    const link = document.createElement("a");
    link.href = "/reports/product_opportunity_report.pdf";
    link.download = "product_opportunity_report.pdf";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đang tải báo cáo PDF", {
      description: "Bản báo cáo chính thức PDF đang được tải về.",
    });
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
        toast.info("Đã sao chép liên kết", {
          description: "Link phiên nghiên cứu đã được lưu vào khay nhớ tạm.",
        });
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      toast.error("Không thể sao chép liên kết");
    }
  };

  return (
    <>
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

          {/* Resend Email Button */}
          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#00FF88]/30 bg-[#00FF88]/10 px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-[#00FF88] transition-all hover:border-[#00FF88] hover:bg-[#00FF88]/20 cursor-pointer shadow-[0_0_10px_rgba(0,255,136,0.1)]"
            title="Gửi báo cáo này về email qua Resend"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Gửi Email</span>
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

      {/* Resend Email Delivery Modal */}
      <EmailReportModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        reportSummary={{
          keyword: extractedKeyword,
          score: 88,
          recommendation: "RECOMMEND",
        }}
      />
    </>
  );
});

MessageActionBar.displayName = "MessageActionBar";
