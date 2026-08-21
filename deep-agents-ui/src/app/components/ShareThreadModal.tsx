"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Copy,
  Check,
  Globe,
  UserPlus,
  Trash2,
  Eye,
  GitFork,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import type { ShareMode, SharePermission, ThreadCollaborator } from "@/app/types/types";


interface ShareThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string | null;
  threadTitle?: string;
  messages?: any[];
  opportunitySummary?: {
    keyword?: string;
    score?: number;
    recommendation?: string;
  };
}

export function ShareThreadModal({
  isOpen,
  onClose,
  threadId,
  threadTitle,
  messages = [],
  opportunitySummary,
}: ShareThreadModalProps) {
  const { user, profile } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sharing state
  const [isActive, setIsActive] = useState(true);
  const [shareToken, setShareToken] = useState<string>("");
  const [shareMode, setShareMode] = useState<ShareMode>("public_link");
  const [permission, setPermission] = useState<SharePermission>("fork");
  const [viewCount, setViewCount] = useState(0);

  // Collaborators state
  const [collaborators, setCollaborators] = useState<ThreadCollaborator[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");

  const displayTitle = useMemo(() => {
    return threadTitle || opportunitySummary?.keyword || "Phiên nghiên cứu sản phẩm";
  }, [threadTitle, opportunitySummary]);

  // Construct full share URL
  const shareUrl = useMemo(() => {
    if (!shareToken || typeof window === "undefined") return "";
    return `${window.location.origin}/share/${shareToken}`;
  }, [shareToken]);

  // Fetch current share configuration when modal opens
  const fetchShareConfig = useCallback(async () => {
    if (!threadId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/threads/share?threadId=${encodeURIComponent(threadId)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.share) {
          setIsActive(data.share.is_active !== false);
          setShareToken(data.share.share_token || "");
          setShareMode(data.share.share_mode || "public_link");
          setPermission(data.share.permission || "fork");
          setViewCount(data.share.view_count || 0);
        } else {
          // Defaults if no share record exists yet
          setIsActive(true);
          setShareMode("public_link");
          setPermission("fork");
        }
        if (data.collaborators) {
          setCollaborators(data.collaborators);
        }
      }
    } catch (err) {
      console.error("Failed to fetch share config:", err);
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (isOpen && threadId) {
      fetchShareConfig();
    }
  }, [isOpen, threadId, fetchShareConfig]);

  // Handle Save / Create Share Link
  const handleSaveShare = async (explicitActiveState?: boolean) => {
    if (!threadId) return;
    setIsSaving(true);
    try {
      const activeToSave = explicitActiveState !== undefined ? explicitActiveState : isActive;

      const snapshotData = {
        title: displayTitle,
        threadId,
        authorName: profile?.full_name || user?.email?.split("@")[0] || "Printway R&D",
        authorEmail: user?.email || "analyst@printway.io",
        authorRole: profile?.role || "lead_rd",
        createdAt: new Date().toISOString(),
        messages: messages.slice(-20), // capture last 20 messages with results & widgets
        opportunitySummary: opportunitySummary || {
          keyword: displayTitle,
          score: 88,
          recommendation: "RECOMMEND",
        },
      };

      const res = await fetch("/api/threads/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          shareToken: shareToken || undefined,
          shareMode,
          permission,
          isActive: activeToSave,
          snapshotData,
          ownerId: user?.id,
          orgId: profile?.org_id || "printway_internal",
          collaborators,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShareToken(data.shareToken);
        setIsActive(activeToSave);
        toast.success(
          activeToSave
            ? "✅ Đã lưu cấu hình chia sẻ và kích hoạt liên kết!"
            : "🔒 Đã vô hiệu hóa liên kết chia sẻ của phiên này."
        );
        return data.shareToken;
      } else {
        toast.error(`Lỗi: ${data.error || "Không thể lưu cấu hình"}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi kết nối: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Link with Automatic Save if token doesn't exist yet
  const handleCopyLink = async () => {
    let currentToken = shareToken;
    if (!currentToken || !isActive) {
      const savedToken = await handleSaveShare(true);
      if (savedToken) currentToken = savedToken;
    }

    if (!currentToken && typeof window !== "undefined") {
      toast.error("Vui lòng kích hoạt liên kết trước.");
      return;
    }

    const fullUrl = `${window.location.origin}/share/${currentToken}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Đã sao chép liên kết chia sẻ!", {
        description: "Bất kỳ ai có liên kết này có thể xem báo cáo nghiên cứu.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Không thể sao chép liên kết vào clipboard.");
    }
  };

  // Add collaborator
  const handleAddCollaborator = () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    if (collaborators.some((c) => c.email?.toLowerCase() === inviteEmail.toLowerCase())) {
      toast.error("Thành viên này đã được thêm vào danh sách.");
      return;
    }

    const newCollab: ThreadCollaborator = {
      id: "collab_" + Math.random().toString(36).substring(2, 9),
      thread_id: threadId || "",
      user_id: "user_" + Math.random().toString(36).substring(2, 9),
      email: inviteEmail.trim(),
      role: inviteRole,
      created_at: new Date().toISOString(),
    };

    setCollaborators([...collaborators, newCollab]);
    setInviteEmail("");
    toast.info(`Đã thêm ${inviteEmail} với vai trò ${inviteRole === "editor" ? "Chỉnh sửa" : "Chỉ xem"}`);
  };

  // Remove collaborator
  const handleRemoveCollaborator = (index: number) => {
    const updated = [...collaborators];
    updated.splice(index, 1);
    setCollaborators(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] bg-[#0A0E2A] border border-[#00FF88]/30 text-slate-100 shadow-[0_0_50px_rgba(0,255,136,0.15)] rounded-2xl p-0 overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-5 bg-gradient-to-b from-[#0E1538] to-[#0A0E2A] border-b border-[#00FF88]/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88]">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white tracking-wide">
                  Chia Sẻ Phiên Nghiên Cứu R&D
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Cấp quyền truy cập cho đồng nghiệp hoặc tạo liên kết báo cáo trực tiếp
                </DialogDescription>
              </div>
            </div>
            {viewCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 border border-cyan-500/30">
                <Eye className="h-3 w-3" />
                {viewCount} lượt xem
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4.5 max-h-[70vh] overflow-y-auto scrollbar-pretty">
          {/* Thread Title Preview */}
          <div className="p-3 bg-[#080B21] border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <div className="text-[10px] uppercase font-bold text-[#00FF88] tracking-wider">Phiên đang chọn:</div>
              <div className="text-xs font-bold text-white truncate">{displayTitle}</div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-slate-400 bg-[#0E1538] px-2.5 py-1 rounded-lg border border-slate-700">
              <ShieldCheck className="h-3 w-3 text-[#00FF88]" />
              <span>Chủ sở hữu: Bạn</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#00FF88]" />
              Đang tải thông tin chia sẻ...
            </div>
          ) : (
            <>
              {/* LINK SHARING TOGGLE & URL */}
              <div className="space-y-2.5 p-3.5 bg-[#080B21]/90 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-[#00D2FF]" />
                    <span className="text-xs font-bold text-white">Chia sẻ qua liên kết bí mật</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !isActive;
                      setIsActive(nextState);
                      handleSaveShare(nextState);
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isActive ? "bg-[#00FF88]" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#080B21] shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isActive ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {isActive && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          readOnly
                          value={shareUrl || "Đang khởi tạo liên kết..."}
                          className="w-full rounded-lg border border-slate-700 bg-[#0E1538] py-1.5 pl-3 pr-8 text-xs text-slate-300 font-mono outline-none select-all"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleCopyLink}
                        disabled={isSaving}
                        className="bg-[#00FF88] hover:bg-[#00FF88]/90 text-[#080B21] font-bold text-xs shrink-0 px-3 h-8 shadow-[0_0_12px_rgba(0,255,136,0.2)] gap-1.5 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Sao chép link</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* PERMISSION SELECTOR */}
                    <div className="grid grid-cols-2 gap-2 pt-1.5">
                      <button
                        type="button"
                        onClick={() => setPermission("view")}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          permission === "view"
                            ? "bg-[#00D2FF]/15 border-[#00D2FF] text-white"
                            : "bg-[#0E1538] border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                          <span>Chỉ xem (View-only)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">
                          Người có link chỉ xem báo cáo, không sửa hoặc fork
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPermission("fork")}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          permission === "fork"
                            ? "bg-[#00FF88]/15 border-[#00FF88] text-white shadow-[0_0_12px_rgba(0,255,136,0.1)]"
                            : "bg-[#0E1538] border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#00FF88]">
                          <GitFork className="h-3.5 w-3.5" />
                          <span>Xem & Nhân bản (Fork)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 leading-tight">
                          Người nhận có thể Fork sang workspace để chat tiếp
                        </span>
                      </button>
                    </div>

                    {/* SCOPE SELECTOR */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400">Phạm vi truy cập:</span>
                      <div className="flex items-center gap-1 bg-[#0E1538] p-0.5 rounded-lg border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShareMode("public_link")}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            shareMode === "public_link"
                              ? "bg-[#00FF88]/20 text-[#00FF88] font-bold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          🌐 Bất kỳ ai có link
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareMode("org_only")}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            shareMode === "org_only"
                              ? "bg-cyan-500/20 text-cyan-300 font-bold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          🏢 Cùng tổ chức ({profile?.org_id === "org_vip_sellers" ? "VIP Sellers" : "Printway"})
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* DIRECT COLLABORATORS INVITATION */}
              <div className="space-y-2.5 p-3.5 bg-[#080B21]/90 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <UserPlus className="h-4 w-4 text-[#00FF88]" />
                  <span>Mời đồng nghiệp qua Email</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="dongnghiep@printway.io"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-700 bg-[#0E1538] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#00FF88] outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="rounded-lg border border-slate-700 bg-[#0E1538] px-2 py-1.5 text-xs text-slate-200 outline-none"
                  >
                    <option value="viewer">Chỉ xem (Viewer)</option>
                    <option value="editor">Chỉnh sửa (Editor)</option>
                  </select>
                  <Button
                    type="button"
                    onClick={handleAddCollaborator}
                    variant="outline"
                    className="h-8 border-slate-700 bg-[#0E1538] text-xs font-bold text-white hover:border-[#00FF88] hover:text-[#00FF88]"
                  >
                    Thêm
                  </Button>
                </div>

                {/* Collaborator List */}
                {collaborators.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Đã cấp quyền:</div>
                    {collaborators.map((collab, idx) => (
                      <div
                        key={collab.id || idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#0E1538] border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className="h-5 w-5 rounded-full bg-[#1E293B] flex items-center justify-center text-[9px] font-bold text-[#00FF88]">
                            {collab.email?.slice(0, 2).toUpperCase() || "US"}
                          </div>
                          <span className="text-slate-200 truncate">{collab.email}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-cyan-400 font-medium">
                            {collab.role === "editor" ? "Chỉnh sửa" : "Chỉ xem"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCollaborator(idx)}
                            className="text-slate-500 hover:text-red-400 p-1"
                            title="Xóa quyền"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-[#080B21] border-t border-[#00FF88]/15 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white"
          >
            Đóng
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => handleSaveShare()}
              disabled={isSaving}
              className="bg-gradient-to-r from-[#00FF88] to-[#00D2FF] hover:from-[#00FF88]/90 hover:to-[#00D2FF]/90 text-[#080B21] font-bold text-xs shadow-[0_0_20px_rgba(0,255,136,0.3)] gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Lưu & Cập Nhật</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
