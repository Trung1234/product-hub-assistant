"use client";

import React, { useMemo } from "react";
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
  Loader2
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

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentThreadId,
  onThreadSelect,
  onNewResearch,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
  interruptCount = 0,
  onMutateReady,
}) => {
  const threads = useThreads({ limit: 35 });

  const flattened = useMemo(() => {
    return threads.data?.flat() ?? [];
  }, [threads.data]);

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
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-[#00FF88] to-[#00D2FF] shadow-[0_0_12px_rgba(0,255,136,0.4)]">
                <Sparkles className="h-4 w-4 text-[#080B21]" />
              </div>
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-xs tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] to-[#00D2FF]">
                  PRINTWAY R&D
                </span>
                <span className="text-[9px] font-medium text-[#94A3B8] tracking-widest uppercase">
                  Opportunity Hub
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[#00FF88] to-[#00D2FF] shadow-[0_0_10px_rgba(0,255,136,0.4)]">
              <Sparkles className="h-4 w-4 text-[#080B21]" />
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
              className="w-full justify-start gap-2.5 rounded-xl border border-[#00FF88]/40 bg-[#00FF88]/15 px-3.5 py-2 text-xs font-bold text-[#00FF88] shadow-[0_0_12px_rgba(0,255,136,0.15)] hover:bg-[#00FF88] hover:text-[#080B21] transition-all"
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
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[#00FF88]/40 bg-[#00FF88]/15 text-[#00FF88] shadow-[0_0_10px_rgba(0,255,136,0.15)] hover:bg-[#00FF88] hover:text-[#080B21] transition-all"
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
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-[#121A45] hover:text-[#00FF88] transition-colors"
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

        {/* MIDDLE SECTION: RECENTS / HISTORY LIST */}
        <ScrollArea className="flex-1 px-3">
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

              {!isLoading && flattened.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-slate-500 italic">
                  Chưa có lịch sử nghiên cứu
                </div>
              )}

              <div className="space-y-1">
                {flattened.map((thread) => {
                  const isActive = currentThreadId === thread.id;
                  const rawTitle = thread.title || thread.description || "Research Session";
                  const displayTitle = truncateTitle(rawTitle, 28);

                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => onThreadSelect(thread.id)}
                      title={rawTitle}
                      className={cn(
                        "group relative flex w-full items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 text-left text-xs transition-all",
                        isActive
                          ? "border border-[#00FF88]/40 bg-[#0E1538] text-[#00FF88] font-semibold shadow-[0_0_10px_rgba(0,255,136,0.12)]"
                          : "border border-transparent text-slate-300 hover:bg-[#121A45]/70 hover:text-white"
                      )}
                    >
                      <span className="block min-w-0 flex-1 truncate text-[12px] leading-snug">
                        {displayTitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* BOTTOM SECTION: SETTINGS & USER AVATAR */}
        <div className="shrink-0 border-t border-[#00FF88]/15 bg-[#0E1538]/90 p-3 space-y-1.5 z-40 backdrop-blur-md">
          {/* Settings Button */}
          {!collapsed ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-300 hover:bg-[#121A45] hover:text-[#00D2FF] transition-colors"
            >
              <Settings className="h-4 w-4 text-[#00D2FF]" />
              <span>Settings</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-[#121A45] hover:text-[#00D2FF] transition-colors"
                >
                  <Settings className="h-4 w-4 text-[#00D2FF]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[#0E1538] border-[#00D2FF]/30 text-white text-xs">
                Settings
              </TooltipContent>
            </Tooltip>
          )}

          {/* User Profile Bar */}
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
};
