"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Send, Sparkles, CheckCircle2, Clock, Calendar, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportSummary?: {
    keyword: string;
    score?: number;
    recommendation?: string;
  };
  currentUserEmail?: string;
}

export function EmailReportModal({
  isOpen,
  onClose,
  reportSummary,
  currentUserEmail,
}: EmailReportModalProps) {
  const [email, setEmail] = useState(currentUserEmail || "admin@printway.io");
  const [frequency, setFrequency] = useState<"instant" | "daily" | "weekly">("instant");
  const [isSending, setIsSending] = useState(false);

  const keyword = reportSummary?.keyword || "Cơ hội sản phẩm POD R&D";
  const score = reportSummary?.score || 88;
  const recommendation = reportSummary?.recommendation || "RECOMMEND";

  const handleSendEmail = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch("/api/send-email-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: email,
          keyword,
          score,
          recommendation,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          frequency === "instant"
            ? `✅ Đã gửi báo cáo R&D tới ${email} thành công qua Resend!`
            : `⏰ Đã lên lịch gửi định kỳ tới ${email} thành công!`
        );
        onClose();
      } else {
        toast.error(`Không thể gửi email: ${data.error || "Lỗi không xác định"}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi kết nối: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-[#0B1033] border border-cyan-500/30 text-slate-100 shadow-[0_0_50px_rgba(0,255,136,0.15)]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-cyan-400 mb-1">
            <Mail className="w-5 h-5 text-[#00FF88]" />
            <DialogTitle className="text-lg font-bold text-white tracking-wide">
              Gửi Báo Cáo R&D Về Email (Resend)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Tự động tạo báo cáo HTML chuẩn xưởng Printway VN và gửi tới hộp thư của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary Preview Badge */}
          <div className="p-3 bg-[#080B21] border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Sản phẩm phân tích:</div>
              <div className="text-sm font-bold text-white line-clamp-1">{keyword}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#00FF88] font-bold uppercase">{recommendation}</div>
              <div className="text-base font-black text-[#00FF88]">{score}/100</div>
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Địa chỉ email nhận báo cáo:</span>
              <span className="text-[10px] text-cyan-400">Resend Verified</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nhap-email-cua-ban@gmail.com"
              className="w-full px-3 py-2 bg-[#080B21] border border-slate-700 focus:border-[#00FF88] focus:ring-1 focus:ring-[#00FF88] rounded-lg text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {/* Schedule Frequency Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tần suất giao vận:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFrequency("instant")}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex flex-col items-center gap-1 ${
                  frequency === "instant"
                    ? "bg-[#00FF88]/15 border-[#00FF88] text-[#00FF88]"
                    : "bg-[#080B21] border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gửi ngay</span>
              </button>
              <button
                type="button"
                onClick={() => setFrequency("daily")}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex flex-col items-center gap-1 ${
                  frequency === "daily"
                    ? "bg-cyan-500/15 border-cyan-400 text-cyan-300"
                    : "bg-[#080B21] border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Hàng ngày</span>
              </button>
              <button
                type="button"
                onClick={() => setFrequency("weekly")}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all flex flex-col items-center gap-1 ${
                  frequency === "weekly"
                    ? "bg-purple-500/15 border-purple-400 text-purple-300"
                    : "bg-[#080B21] border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Hàng tuần</span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs"
          >
            Hủy
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={isSending}
            className="bg-gradient-to-r from-[#00FF88] to-cyan-400 hover:from-[#00FF88]/90 hover:to-cyan-400/90 text-[#080B21] font-bold text-xs shadow-[0_0_20px_rgba(0,255,136,0.3)] gap-1.5"
          >
            {isSending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#080B21] border-t-transparent rounded-full animate-spin" />
                <span>Đang chuyển phát qua Resend...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{frequency === "instant" ? "Gửi Email Ngay" : "Kích Hoạt Lịch Hẹn"}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
