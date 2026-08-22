"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  GitFork,
  ShieldAlert,
  ArrowLeft,
  Loader2,
  Lock,
  Check,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { CyberpunkChartRenderer } from "@/app/components/CyberpunkChartRenderer";
import { MessageActionBar } from "@/app/components/MessageActionBar";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import type { SharedThreadSnapshot } from "@/app/types/types";


interface SharedViewContentProps {
  token: string;
}

function SharedViewContent({ token }: SharedViewContentProps) {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isForking, setIsForking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<SharedThreadSnapshot | null>(null);

  useEffect(() => {
    async function fetchSharedThread() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/threads/share?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Liên kết chia sẻ không hợp lệ hoặc đã bị thu hồi.");
          return;
        }

        setShareData(data.share);
        if (data.share?.snapshot_data) {
          setSnapshot(data.share.snapshot_data);
        }
      } catch (err: any) {
        setError(`Lỗi kết nối: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      fetchSharedThread();
    }
  }, [token]);

  const handleFork = useCallback(async () => {
    if (!user) {
      toast.info("Vui lòng đăng nhập để nhân bản phiên nghiên cứu vào không gian làm việc của bạn.");
      router.push(`/?shared=${token}`);
      return;
    }

    setIsForking(true);
    try {
      const res = await fetch("/api/threads/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shareToken: token,
          sourceThreadId: shareData?.thread_id,
          targetUserId: user.id,
          targetUserEmail: user.email,
          orgId: profile?.org_id || "printway_internal",
          customTitle: snapshot?.title ? `Bản sao: ${snapshot.title}` : undefined,
          snapshotData: snapshot || shareData?.snapshot_data,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("🚀 Đã nhân bản thành công! Đang chuyển hướng sang phiên làm việc của bạn...");
        setTimeout(() => {
          window.location.href = `/?threadId=${data.newThreadId}`;
        }, 400);
      } else {
        toast.error(`Không thể nhân bản: ${data.error || "Lỗi không xác định"}`);
        setIsForking(false);
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
      setIsForking(false);
    }
  }, [user, profile, token, shareData, snapshot, router]);

  const handleCopyLink = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        toast.success("Đã sao chép liên kết chia sẻ!");
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      toast.error("Không thể sao chép");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#080B21] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00FF88] border-t-transparent shadow-[0_0_15px_rgba(0,255,136,0.3)]" />
          <p className="text-xs font-semibold text-slate-400">Đang tải báo cáo nghiên cứu từ Printway Hub...</p>
        </div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#080B21] p-4 text-white">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-[#0E1538] p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1.5">Không tìm thấy báo cáo chia sẻ</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            {error || "Liên kết này có thể đã hết hạn, bị chủ sở hữu thu hồi hoặc bị xóa."}
          </p>
          <Button
            onClick={() => router.push("/")}
            className="w-full bg-[#00FF88] hover:bg-[#00FF88]/90 text-[#080B21] font-bold text-xs gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại trang chủ R&D</span>
          </Button>
        </div>
      </div>
    );
  }

  const messages = snapshot?.messages || [];
  const authorName = shareData.owner_name || snapshot?.authorName || "Printway R&D";
  const authorRole = shareData.owner_role || snapshot?.authorRole || "lead_rd";
  const createdDate = snapshot?.createdAt ? new Date(snapshot.createdAt).toLocaleDateString("vi-VN") : "";
  const allowFork = shareData.permission !== "view";

  return (
    <div className="flex min-h-screen w-screen flex-col bg-[#080B21] text-white">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#00FF88]/15 bg-[#0A0E2A]/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#080B21] text-slate-400 hover:text-white hover:border-[#00FF88]/40 transition-colors"
            title="Về trang chủ"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-7 px-2 items-center justify-center rounded bg-white shadow-sm">
              <img src="/logo_header.png" alt="Printway Nexus" className="h-3.5 w-auto object-contain" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-[#00FF88] bg-[#00FF88]/15 px-1.5 py-0.5 rounded border border-[#00FF88]/30">
              Shared Snapshot
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 border-slate-800 bg-[#0E1538] text-xs font-semibold text-slate-300 hover:border-[#00FF88]/40 hover:text-[#00FF88] gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#00FF88]" />
                <span>Đã copy link</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy link</span>
              </>
            )}
          </Button>

          {allowFork && (
            <Button
              type="button"
              onClick={handleFork}
              disabled={isForking}
              className="h-8 bg-gradient-to-r from-[#00FF88] to-[#00D2FF] hover:from-[#00FF88]/90 hover:to-[#00D2FF]/90 text-[#080B21] font-bold text-xs shadow-[0_0_15px_rgba(0,255,136,0.3)] gap-1.5"
            >
              {isForking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang nhân bản...</span>
                </>
              ) : (
                <>
                  <GitFork className="h-3.5 w-3.5" />
                  <span>Nhân Bản & Chat Tiếp (Fork)</span>
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* STICKY COLLABORATION BANNER */}
      <div className="bg-gradient-to-r from-[#0E1538] via-[#121A45] to-[#0E1538] border-b border-cyan-500/20 px-4 py-2.5">
        <div className="mx-auto flex max-w-4xl items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E293B] border border-[#00FF88]/40 text-[11px] font-bold text-[#00FF88]">
              {authorName.slice(0, 2).toUpperCase()}
            </div>
            <div className="truncate">
              <span className="text-slate-400">Được chia sẻ bởi </span>
              <span className="font-bold text-white">{authorName}</span>
              <span className="ml-1.5 rounded bg-[#00FF88]/15 px-1.5 py-0.2 text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30">
                {authorRole === "lead_rd" ? "Lead R&D" : authorRole === "seller" ? "VIP Seller" : "Designer"}
              </span>
              {createdDate && (
                <span className="text-slate-500 ml-2 hidden sm:inline">• {createdDate}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-[11px] text-cyan-300 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              <Lock className="h-3 w-3" />
              Chế độ chỉ xem
            </span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="mx-auto flex-1 w-full max-w-4xl px-4 py-6 space-y-6">
        {/* Title Header Card */}
        <div className="rounded-2xl border border-slate-800 bg-[#0E1538]/70 p-5 backdrop-blur-md shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#00FF88] mb-1">
                Báo cáo R&D POD được chia sẻ
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                {snapshot?.title || "Phân tích cơ hội sản phẩm"}
              </h1>
            </div>
            {snapshot?.opportunitySummary && (
              <div className="flex items-center gap-3 bg-[#080B21] px-3.5 py-2 rounded-xl border border-slate-800 shrink-0">
                <div>
                  <div className="text-[10px] text-slate-400">Opportunity Score:</div>
                  <div className="text-base font-black text-[#00FF88]">
                    {snapshot.opportunitySummary.score || 88}/100
                  </div>
                </div>
                <span className="rounded-full bg-[#00FF88]/20 px-2.5 py-1 text-xs font-bold text-[#00FF88] border border-[#00FF88]/40">
                  {snapshot.opportunitySummary.recommendation || "RECOMMEND"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="space-y-6">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0E1538]/40 p-8 text-center text-xs text-slate-400">
              Không có nội dung tin nhắn nào được lưu trong bản chia sẻ này.
            </div>
          ) : (
            messages.map((msg: any, idx: number) => {
              const isHuman = msg.type === "human" || msg.role === "user";
              const rawContent = typeof msg.content === "string" ? msg.content : (msg.content?.[0]?.text || "");

              if (isHuman) {
                return (
                  <div key={msg.id || idx} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-[#00D2FF]/20 to-[#00FF88]/20 border border-[#00FF88]/30 px-4 py-3 text-sm text-white shadow-[0_0_20px_rgba(0,255,136,0.08)]">
                      <p className="whitespace-pre-wrap">{rawContent}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id || idx} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00FF88]/20 border border-[#00FF88]/40 text-[#00FF88]">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-200">Printway R&D Copilot</span>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#0E1538]/80 p-5 text-slate-200 shadow-xl overflow-hidden">
                    <MarkdownContent content={rawContent} />
                    <CyberpunkChartRenderer code={rawContent} />
                    <MessageActionBar content={rawContent} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* BOTTOM LOCKED CHATBAR */}
      <footer className="sticky bottom-0 z-20 border-t border-slate-800 bg-[#0A0E2A]/95 p-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 truncate">
            <Lock className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="truncate">
              Bạn đang ở chế độ xem bản chia sẻ cố định. Để đặt câu hỏi mới, hãy nhân bản phiên này.
            </span>
          </div>

          {allowFork && (
            <Button
              type="button"
              onClick={handleFork}
              disabled={isForking}
              className="bg-[#00FF88] hover:bg-[#00FF88]/90 text-[#080B21] font-bold text-xs shrink-0 px-4 h-8 gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,255,136,0.2)]"
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>Tiếp Tục Nghiên Cứu (Fork)</span>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function SharedThreadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <AuthProvider>
      <SharedViewContent token={resolvedParams.token} />
    </AuthProvider>
  );
}
