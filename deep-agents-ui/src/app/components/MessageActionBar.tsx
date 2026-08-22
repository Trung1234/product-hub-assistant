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
import { ShareThreadModal } from "@/app/components/ShareThreadModal";
import { toast } from "sonner";
import { useQueryState } from "nuqs";

interface MessageActionBarProps {
  content: string;
  onFollowUpClick?: (prompt: string) => void;
}

export const MessageActionBar = React.memo<MessageActionBarProps>(({
  content,
  onFollowUpClick
}) => {
  const [threadId] = useQueryState("threadId");
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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

  const handleVote = (vote: boolean) => {
    setLiked(liked === vote ? null : vote);
  };

  return (
    <>
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs text-slate-400 no-print">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-[13px] font-medium transition-all cursor-pointer",
              copied
                ? "border-[#00FF88]/50 bg-[#00FF88]/15 text-[#00FF88]"
                : "border-slate-800 bg-[#0E1538]/60 text-slate-200 hover:border-[#00FF88]/40 hover:bg-[#121A45] hover:text-white"
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
            className="flex items-center gap-1.5 rounded-xl border border-[#00FF88]/30 bg-[#00FF88]/10 px-3 py-1.5 text-xs sm:text-[13px] font-bold text-[#00FF88] transition-all hover:border-[#00FF88] hover:bg-[#00FF88]/20 cursor-pointer shadow-[0_0_10px_rgba(0,255,136,0.1)]"
            title="Gửi báo cáo này về email qua Resend"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Gửi Email</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0E1538]/60 px-3 py-1.5 text-xs sm:text-[13px] font-medium text-slate-200 transition-all hover:border-[#00D2FF]/40 hover:bg-[#121A45] hover:text-[#00D2FF] cursor-pointer"
            title="Tải bảng ma trận 23 cột file CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0E1538]/60 px-3 py-1.5 text-xs sm:text-[13px] font-medium text-slate-200 transition-all hover:border-[#00FF88]/40 hover:bg-[#121A45] hover:text-[#00FF88] cursor-pointer"
            title="Tải bản báo cáo PDF chính thức"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#0E1538]/60 px-3 py-1.5 text-xs sm:text-[13px] font-medium text-slate-200 transition-all hover:border-amber-400/40 hover:bg-[#121A45] hover:text-amber-300 cursor-pointer"
            title="In hoặc lưu file PDF từ trình duyệt"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>In báo cáo</span>
          </button>
        </div>

        {/* Right Feedback Buttons & Share */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs sm:text-[13px] font-bold text-purple-300 transition-all hover:border-purple-400 hover:bg-purple-500/20 cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.1)]"
            title="Tạo link chia sẻ công khai hoặc nội bộ"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Chia sẻ</span>
          </button>

          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-[#080B21]/80 p-1">
            <button
              type="button"
              onClick={() => handleVote(true)}
              className={cn(
                "rounded-lg p-1.5 transition-colors cursor-pointer",
                liked === true
                  ? "bg-[#00FF88]/20 text-[#00FF88]"
                  : "text-slate-400 hover:text-slate-200"
              )}
              title="Báo cáo hữu ích"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleVote(false)}
              className={cn(
                "rounded-lg p-1.5 transition-colors cursor-pointer",
                liked === false
                  ? "bg-rose-500/20 text-rose-400"
                  : "text-slate-400 hover:text-slate-200"
              )}
              title="Báo cáo chưa chuẩn"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
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

      {/* Share Thread Modal */}
      {isShareModalOpen && (
        <ShareThreadModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          threadId={threadId}
          threadTitle={extractedKeyword}
          opportunitySummary={{
            keyword: extractedKeyword,
            score: 88,
            recommendation: "RECOMMEND",
          }}
        />
      )}
    </>
  );
});

MessageActionBar.displayName = "MessageActionBar";
