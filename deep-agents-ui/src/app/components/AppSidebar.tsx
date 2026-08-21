"use client";

import React, { useMemo, useState, useCallback } from "react";
import { format } from "date-fns";
import {
  SquarePen,
  Sparkles,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Clock,
  CheckCircle,
  Loader2,
  Search,
  X,
  Trash2,
  ChevronDown,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useThreads, ThreadItem } from "@/app/hooks/useThreads";
import { useClient } from "@/providers/ClientProvider";
import { useAuth } from "@/providers/AuthProvider";

interface AppSidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (id: string | null) => void;
  onNewResearch: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  interruptCount?: number;
  onMutateReady?: (mutate: () => void) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  currentView?: "chat" | "schedules";
  onChangeView?: (view: "chat" | "schedules") => void;
  activeScheduleCount?: number;
}

function formatTime(date: Date, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return format(date, "HH:mm");
  if (days === 1) return "Hôm qua";
  if (days < 7) return format(date, "EEEE");
  return format(date, "MM/dd");
}

function truncateTitle(title: string, maxLength: number = 28): string {
  if (!title) return "Phiên nghiên cứu";
  const clean = title.trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength) + "...";
}

export const AppSidebar = React.memo<AppSidebarProps>(({
  currentThreadId,
  onThreadSelect,
  onNewResearch,
  collapsed,
  onToggleCollapse,
  interruptCount = 0,
  onMutateReady,
  mobileOpen = false,
  onMobileClose,
  currentView = "chat",
  onChangeView,
  activeScheduleCount = 0,
}) => {
  const client = useClient();
  const { user, profile, signOut } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const threads = useThreads({ limit: 35 });

  const flattened = useMemo(() => {
    return threads.data?.flat() ?? [];
  }, [threads.data]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return flattened;
    const q = searchQuery.toLowerCase();
    return flattened.filter(
      (t) =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [flattened, searchQuery]);

  const isLoading = threads.isLoading && !threads.data;

  const handleThreadClick = useCallback((id: string | null) => {
    onThreadSelect(id);
    onMobileClose?.();
  }, [onThreadSelect, onMobileClose]);

  const handleNewResearchClick = useCallback(() => {
    onNewResearch();
    onMobileClose?.();
  }, [onNewResearch, onMobileClose]);

  const handleDeleteThread = useCallback(
    async (e: React.MouseEvent, threadId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!confirm("Bạn có chắc chắn muốn xóa phiên nghiên cứu này?")) return;
      try {
        setDeletingId(threadId);
        await client.threads.delete(threadId);
        threads.mutate();
        if (currentThreadId === threadId) {
          onNewResearch();
        }
      } catch (err) {
        console.error("Failed to delete thread:", err);
      } finally {
        setDeletingId(null);
      }
    },
    [client, currentThreadId, onNewResearch, threads]
  );

  return (
    <TooltipProvider delayDuration={200}>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#080B21]/80 backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-[#00FF88]/15 bg-[#0A0E2A] text-white transition-all duration-300 ease-in-out select-none shrink-0 shadow-2xl md:shadow-none md:static md:z-30 md:h-screen",
          // Mobile state: slide in / out
          mobileOpen ? "translate-x-0 w-[280px] max-w-[85vw]" : "-translate-x-full md:translate-x-0",
          // Desktop state: 16 (collapsed) or 280px
          collapsed ? "md:w-16" : "md:w-[280px]"
        )}
      >
        {/* TOP HEADER SECTION */}
        <div className="flex h-14 items-center justify-between px-3 border-b border-[#00FF88]/10 shrink-0">
          {(!collapsed || mobileOpen) ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-8 px-2.5 items-center justify-center rounded-lg bg-white shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                <img
                  src="/logo_header.png"
                  alt="Printway.io"
                  className="h-4 w-auto object-contain"
                />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00FF88] bg-[#00FF88]/15 px-1.5 py-0.5 rounded border border-[#00FF88]/30">
                R&D Hub
              </span>
            </div>
          ) : (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-[0_0_15px_rgba(255,255,255,0.15)] p-1">
              <img
                src="/logo_header.png"
                alt="Printway.io"
                className="h-full w-full object-contain"
              />
            </div>
          )}

          {/* Desktop Toggle Collapse / Mobile Close Button */}
          {mobileOpen ? (
            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-[#121A45] hover:text-white transition-colors cursor-pointer"
              title="Đóng thanh bên"
              aria-label="Đóng thanh bên"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-[#121A45] hover:text-[#00FF88] transition-colors cursor-pointer"
              title={collapsed ? "Mở rộng thanh bên (Cmd+B)" : "Thu gọn thanh bên (Cmd+B)"}
              aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* NAVIGATION TABS: SCHEDULE MANAGEMENT & AUTOMATION */}
        <div className="px-3 pt-2 pb-1 shrink-0 flex flex-col gap-1">
          {(!collapsed || mobileOpen) ? (
            <button
              type="button"
              onClick={() => onChangeView?.(currentView === "schedules" ? "chat" : "schedules")}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer",
                currentView === "schedules"
                  ? "bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/30 shadow-[0_0_12px_rgba(0,212,255,0.15)]"
                  : "text-slate-400 hover:bg-[#121A45] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4" />
                <span>Lịch Quét & Email</span>
              </div>
              {activeScheduleCount !== undefined && activeScheduleCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00D4FF] px-1 text-[10px] font-black text-[#080B21]">
                  {activeScheduleCount}
                </span>
              )}
            </button>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onChangeView?.(currentView === "schedules" ? "chat" : "schedules")}
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-pointer",
                      currentView === "schedules"
                        ? "bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40"
                        : "text-slate-400 hover:bg-[#121A45] hover:text-white"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    {activeScheduleCount !== undefined && activeScheduleCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#00D4FF] text-[9px] font-black text-[#080B21]">
                        {activeScheduleCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#0E1538] border-[#00D4FF]/30 text-white text-xs">
                  Quản Lý Lịch Quét & Email ({activeScheduleCount || 0})
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* ACTION BUTTON: NEW RESEARCH */}
        <div className="p-3 shrink-0">
          {(!collapsed || mobileOpen) ? (
            <button
              type="button"
              onClick={handleNewResearchClick}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[#00FF88]/30 bg-gradient-to-r from-[#00FF88]/15 via-[#00D2FF]/10 to-transparent px-3 py-2.5 text-xs font-bold text-[#00FF88] shadow-[0_0_15px_rgba(0,255,136,0.15)] hover:border-[#00FF88] hover:bg-[#00FF88]/25 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all duration-200 cursor-pointer"
            >
              <SquarePen className="h-4 w-4" />
              <span>Nghiên cứu mới</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleNewResearchClick}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20 transition-colors cursor-pointer"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00FF88]/30 text-white text-xs">
                Nghiên cứu mới (Cmd + Shift + N)
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* SEARCH BAR (WHEN EXPANDED) */}
        {(!collapsed || mobileOpen) && (
          <div className="px-3 pb-2 shrink-0">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Tìm kiếm phiên nghiên cứu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-[#080B21] py-1.5 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-[#00FF88]/50 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-500 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* THREAD LIST CONTAINER */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 scrollbar-pretty">
          {(!collapsed || mobileOpen) && (
            <div className="py-2 pb-6 space-y-1">
              <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <span>Gần đây</span>
                {interruptCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/40">
                    {interruptCount} cần phản hồi
                  </span>
                )}
              </div>

              {isLoading && (
                <div className="flex items-center justify-center py-6 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#00FF88]" />
                  Đang tải lịch sử nghiên cứu...
                </div>
              )}

              {!isLoading && filteredThreads.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-slate-500 italic">
                  {searchQuery ? "Không tìm thấy kết quả" : "Chưa có lịch sử nghiên cứu"}
                </div>
              )}

              <div className="space-y-1">
                {filteredThreads.map((thread) => {
                  const isActive = currentThreadId === thread.id;
                  const rawTitle = thread.title || thread.description || "Phiên nghiên cứu";
                  const displayTitle = truncateTitle(rawTitle, 26);
                  const isDeleting = deletingId === thread.id;

                  return (
                    <div
                      key={thread.id}
                      onClick={() => handleThreadClick(thread.id)}
                      className={cn(
                        "group relative flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-200 cursor-pointer",
                        isActive
                          ? "border border-[#00FF88]/40 bg-[#0E1538] text-white shadow-[0_0_15px_rgba(0,255,136,0.15)] font-semibold"
                          : "text-slate-300 hover:bg-[#121A45]/80 hover:text-white border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                        <MessageSquare
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-colors",
                            isActive ? "text-[#00FF88]" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        <span className="text-xs truncate block">
                          {displayTitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Normal timestamp view */}
                        <span
                          className={cn(
                            "text-[10px] tabular-nums whitespace-nowrap pl-1 transition-opacity",
                            "group-hover:hidden",
                            isActive ? "text-[#00D2FF]" : "text-slate-500"
                          )}
                        >
                          {formatTime(thread.updatedAt)}
                        </span>

                        {/* Hover Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteThread(e, thread.id)}
                          disabled={isDeleting}
                          className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Xóa phiên nghiên cứu"
                          aria-label="Xóa phiên nghiên cứu"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin text-red-400" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: DYNAMIC USER PROFILE & LOGOUT ACTION */}
        <div className="p-3 shrink-0 border-t border-[#00FF88]/10 bg-[#0E1538]/80 relative">
          {profileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl bg-[#080B21] border border-white/10 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl">
              <div className="flex items-center gap-2.5 mb-2 pb-2 border-b border-white/5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E293B] border border-[#00FF88]/50 text-xs font-bold text-[#00FF88]">
                  {profile?.full_name ? profile.full_name.slice(0, 2).toUpperCase() : (user?.email?.slice(0, 2).toUpperCase() || "US")}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-bold text-white truncate">{profile?.full_name || user?.email?.split("@")[0]}</span>
                  <span className="text-[10px] text-slate-400 truncate">{user?.email}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 mb-2 px-1 text-[10px]">
                <span className="text-slate-400">Workspace:</span>
                <span className="text-[#00FF88] font-bold">{profile?.org_id === "org_vip_sellers" ? "VIP Sellers" : "Printway Internal"}</span>
              </div>

              <button
                type="button"
                data-testid="sidebar-logout-button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold border border-red-500/20 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng Xuất (Log Out)</span>
              </button>
            </div>
          )}

          {(!collapsed || mobileOpen) ? (
            <div
              data-testid="sidebar-profile-trigger"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex items-center justify-between rounded-xl px-2.5 py-2 bg-[#080B21]/70 border border-slate-800/80 hover:border-[#00FF88]/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E293B] border border-[#00FF88]/40 group-hover:border-[#00FF88] text-[11px] font-bold text-[#00FF88]">
                  {profile?.full_name ? profile.full_name.slice(0, 2).toUpperCase() : (user?.email?.slice(0, 2).toUpperCase() || "US")}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                    {profile?.full_name || user?.email?.split("@")[0] || "Printway User"}
                  </span>
                  <span className="text-[9px] text-[#00FF88] font-medium truncate uppercase tracking-wider">
                    {profile?.role === "lead_rd" ? "🚀 Lead R&D" : profile?.role === "seller" ? "🛍️ VIP Seller" : "🎨 POD Designer"}
                  </span>
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 group-hover:text-[#00FF88] transition-transform duration-200 ${profileMenuOpen ? "rotate-180" : ""}`} />
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#1E293B] border border-[#00FF88]/40 text-[11px] font-bold text-[#00FF88] cursor-pointer hover:border-[#00FF88] hover:scale-105 transition-all"
                >
                  {profile?.full_name ? profile.full_name.slice(0, 2).toUpperCase() : "US"}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00FF88]/30 text-white text-xs">
                {profile?.full_name || user?.email || "User"} (Click để Đăng Xuất)
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
});

AppSidebar.displayName = "AppSidebar";
