"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  SquarePen,
  Settings,
  Sparkles,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Clock,
  CheckCircle,
  Loader2,
  Search,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useThreads, ThreadItem } from "@/app/hooks/useThreads";

interface AppSidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (id: string | null) => void;
  onNewResearch: () => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  interruptCount?: number;
  onMutateReady?: (mutate: () => void) => void;
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
  if (!title) return "Research Session";
  const clean = title.trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength) + "...";
}

export const AppSidebar = React.memo<AppSidebarProps>(({
  currentThreadId,
  onThreadSelect,
  onNewResearch,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
  interruptCount = 0,
  onMutateReady,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "relative flex h-screen flex-col border-r border-[#00FF88]/15 bg-[#0A0E2A] text-white transition-all duration-300 ease-in-out select-none shrink-0 z-30",
          collapsed ? "w-16" : "w-[280px]"
        )}
      >
        {/* TOP SECTION: Header / Logo & Collapse Toggle */}
        <div className="flex h-14 shrink-0 items-center justify-between px-3.5 border-b border-[#00FF88]/10 bg-[#0E1538]/60">
          {!collapsed ? (
            <div className="flex items-center">
              <div className="flex h-8 px-2.5 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                <img
                  src="/logo_header.png"
                  alt="Printway.io"
                  className="h-4.5 w-auto object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm overflow-hidden p-1">
              <img
                src="/logo_header.png"
                alt="Printway"
                className="h-3.5 w-auto object-contain"
              />
            </div>
          )}

          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-[#121A45] hover:text-[#00FF88] transition-colors"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00FF88]/30 text-white text-xs">
                Thu gọn Sidebar
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* NEW RESEARCH BUTTON */}
        <div className="p-3 shrink-0">
          {!collapsed ? (
            <Button
              type="button"
              onClick={onNewResearch}
              className="w-full justify-start gap-2.5 rounded-xl border border-[#00FF88]/40 bg-[#00FF88]/15 px-3.5 py-2 text-xs font-bold text-[#00FF88] shadow-[0_0_12px_rgba(0,255,136,0.15)] hover:bg-[#00FF88] hover:text-[#080B21] transition-all cursor-pointer"
            >
              <SquarePen className="h-4 w-4 shrink-0" />
              <span className="truncate">New research</span>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onNewResearch}
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#00FF88]/40 bg-[#00FF88]/15 text-[#00FF88] shadow-[0_0_10px_rgba(0,255,136,0.15)] hover:bg-[#00FF88] hover:text-[#080B21] transition-all cursor-pointer"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00FF88]/30 text-white text-xs">
                New research
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* COLLAPSED EXPAND BUTTON */}
        {collapsed && (
          <div className="px-3 pb-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-[#121A45] hover:text-[#00FF88] transition-colors cursor-pointer"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00FF88]/30 text-white text-xs">
                Mở rộng Sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* SEARCH THREADS INPUT (WHEN EXPANDED) */}
        {!collapsed && (
          <div className="px-3 pb-2 shrink-0">
            <div className="group flex items-center gap-2 rounded-xl border border-slate-800/80 bg-[#0E1538]/60 px-3 py-1.5 text-xs transition-all duration-200 focus-within:border-[#00FF88]/50 focus-within:bg-[#0E1538] focus-within:shadow-[0_0_15px_rgba(0,255,136,0.15)]">
              <Search className="h-3.5 w-3.5 text-slate-500 group-focus-within:text-[#00FF88] transition-colors shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm phiên nghiên cứu..."
                className="w-full bg-transparent text-[11px] text-white placeholder:text-slate-500 outline-none focus:outline-none focus:ring-0 border-0 p-0 shadow-none ring-0 leading-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-full p-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* MIDDLE SECTION: RECENTS / HISTORY LIST (SCROLLABLE) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {!collapsed && (
            <div className="py-2 pb-6 space-y-1">
              <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                <span>Recents</span>
                {interruptCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/40">
                    {interruptCount} attention
                  </span>
                )}
              </div>

              {isLoading && (
                <div className="flex items-center justify-center py-6 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-[#00FF88]" />
                  Loading threads...
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
                  const rawTitle = thread.title || thread.description || "Research Session";
                  const displayTitle = truncateTitle(rawTitle, 28);

                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => onThreadSelect(thread.id)}
                      className={cn(
                        "group relative flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-200 cursor-pointer",
                        isActive
                          ? "border border-[#00FF88]/40 bg-[#0E1538] text-white shadow-[0_0_15px_rgba(0,255,136,0.15)] font-semibold"
                          : "text-slate-300 hover:bg-[#121A45]/80 hover:text-white border border-transparent"
                      )}
                      title={rawTitle}
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

                      <span
                        className={cn(
                          "shrink-0 text-[10px] tabular-nums whitespace-nowrap pl-1",
                          isActive ? "text-[#00D2FF]" : "text-slate-500"
                        )}
                      >
                        {formatTime(thread.updatedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: USER PROFILE & SETTINGS */}
        <div className="p-3 shrink-0 border-t border-[#00FF88]/10 bg-[#0E1538]/80 flex flex-col gap-2">
          {/* Settings Button */}
          {!collapsed ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-[#121A45] hover:text-[#00FF88] transition-colors cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-[#121A45] hover:text-[#00FF88] transition-colors cursor-pointer"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00FF88]/30 text-white text-xs">
                Settings
              </TooltipContent>
            </Tooltip>
          )}

          {/* User Profile Card */}
          {!collapsed ? (
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 bg-[#080B21]/70 border border-slate-800/80">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E293B] border border-[#00FF88]/30 text-[11px] font-bold text-[#00FF88]">
                PN
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-slate-200 truncate">Phương Nguyễn</span>
                <span className="text-[9px] text-[#94A3B8] truncate">Printway R&D In-house</span>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#1E293B] border border-[#00FF88]/30 text-[11px] font-bold text-[#00FF88] cursor-pointer">
                  PN
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00FF88]/30 text-white text-xs">
                Phương Nguyễn (Printway R&D)
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
});

AppSidebar.displayName = "AppSidebar";
