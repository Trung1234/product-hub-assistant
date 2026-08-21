"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Bot,
  Search,
  Sparkles,
  TrendingUp,
  Calculator,
  Factory,
  Layers,
  CheckCircle2,
  Loader2,
  AlertCircle
} from "lucide-react";
import type { SubAgent } from "@/app/types/types";
import { cn } from "@/lib/utils";

interface SubAgentIndicatorProps {
  subAgent: SubAgent;
  onClick: () => void;
  isExpanded?: boolean;
}

interface SubAgentMeta {
  title: string;
  badge: string;
  icon: React.ElementType;
  gradient: string;
  borderColor: string;
  textColor: string;
}

function getSubAgentMeta(name: string): SubAgentMeta {
  const lower = name.toLowerCase();
  if (lower.includes("market") || lower.includes("research") || lower.includes("scraper") || lower.includes("etsy") || lower.includes("amazon")) {
    return {
      title: "Chuyên Gia Nghiên Cứu Thị Trường & Sàn TMĐT",
      badge: "Market Research Subagent",
      icon: Search,
      gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
      borderColor: "border-emerald-500/30",
      textColor: "text-emerald-400",
    };
  }
  if (lower.includes("pinterest") || lower.includes("visual") || lower.includes("design") || lower.includes("trend")) {
    return {
      title: "Chuyên Gia Xu Hướng Thẩm Mỹ & Pinterest",
      badge: "Pinterest Visual Subagent",
      icon: Sparkles,
      gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
      borderColor: "border-rose-500/30",
      textColor: "text-rose-400",
    };
  }
  if (lower.includes("pric") || lower.includes("profit") || lower.includes("cost") || lower.includes("calculat")) {
    return {
      title: "Chuyên Gia Định Giá & Biên Lợi Nhuận",
      badge: "Pricing & Margin Subagent",
      icon: Calculator,
      gradient: "from-amber-500/20 via-yellow-500/10 to-transparent",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-400",
    };
  }
  if (lower.includes("printway") || lower.includes("fulfill") || lower.includes("factory") || lower.includes("sku")) {
    return {
      title: "Chuyên Gia Năng Lực Xưởng In Printway",
      badge: "Printway Fulfillment Subagent",
      icon: Factory,
      gradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
      borderColor: "border-cyan-500/30",
      textColor: "text-cyan-400",
    };
  }
  return {
    title: `Sub-Agent: ${name}`,
    badge: "Specialized Deep Agent",
    icon: Bot,
    gradient: "from-purple-500/20 via-indigo-500/10 to-transparent",
    borderColor: "border-purple-500/30",
    textColor: "text-purple-400",
  };
}

export const SubAgentIndicator = React.memo<SubAgentIndicatorProps>(
  ({ subAgent, onClick, isExpanded = true }) => {
    const meta = getSubAgentMeta(subAgent.subAgentName);
    const IconComp = meta.icon;

    return (
      <div
        className={cn(
          "w-full overflow-hidden rounded-xl border bg-[#0E1538]/90 transition-all duration-200 backdrop-blur-md",
          meta.borderColor,
          isExpanded ? "shadow-[0_0_20px_rgba(0,255,136,0.12)]" : "hover:border-[#00FF88]/50"
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors bg-gradient-to-r",
            meta.gradient
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#080B21] border",
              meta.borderColor,
              meta.textColor
            )}>
              <IconComp className="h-4 w-4" />
            </div>
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">
                  {meta.title}
                </span>
                <span className={cn(
                  "hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.2 border bg-[#080B21]/60",
                  meta.borderColor,
                  meta.textColor
                )}>
                  {meta.badge}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono truncate">
                ID: {subAgent.subAgentName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hidden xs:inline">
              {isExpanded ? "Đóng" : "Chi tiết"}
            </span>
            {isExpanded ? (
              <ChevronUp size={14} className={meta.textColor} />
            ) : (
              <ChevronDown size={14} className="text-slate-400" />
            )}
          </div>
        </button>
      </div>
    );
  }
);

SubAgentIndicator.displayName = "SubAgentIndicator";
