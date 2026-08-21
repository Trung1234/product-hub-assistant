import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
  Loader2,
  CircleCheckBigIcon,
  StopCircle,
  Search,
  TrendingUp,
  ShoppingBag,
  Package,
  Calculator,
  Tag,
  FileText,
  Bot,
  Sparkles,
  Layers,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolCall, ActionRequest, ReviewConfig } from "@/app/types/types";
import { cn } from "@/lib/utils";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { ToolApprovalInterrupt } from "@/app/components/ToolApprovalInterrupt";

interface ToolCallBoxProps {
  toolCall: ToolCall;
  uiComponent?: any;
  stream?: any;
  graphId?: string;
  actionRequest?: ActionRequest;
  reviewConfig?: ReviewConfig;
  onResume?: (value: any) => void;
  isLoading?: boolean;
}

interface ToolMeta {
  title: string;
  badge: string;
  icon: React.ElementType;
  color: string;
}

function getToolMeta(name: string): ToolMeta {
  const lower = name.toLowerCase();
  if (lower.includes("etsy")) {
    return {
      title: "Cào Dữ Liệu Sản Phẩm Bán Chạy Etsy (Realtime Scraper)",
      badge: "Etsy Scraper",
      icon: ShoppingBag,
      color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    };
  }
  if (lower.includes("amazon") || lower.includes("bsr")) {
    return {
      title: "Quét Dữ Liệu Bestsellers & BSR Amazon",
      badge: "Amazon API",
      icon: Package,
      color: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    };
  }
  if (lower.includes("trend") || lower.includes("google")) {
    return {
      title: "Phân Tích Xu Hướng & Seasonality Google Trends",
      badge: "Google Trends",
      icon: TrendingUp,
      color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    };
  }
  if (lower.includes("pinterest") || lower.includes("pin")) {
    return {
      title: "Quét Xu Hướng Thẩm Mỹ & Cứu Cánh Pinterest",
      badge: "Pinterest Visual",
      icon: Sparkles,
      color: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    };
  }
  if (lower.includes("calc") || lower.includes("profit") || lower.includes("price") || lower.includes("cost")) {
    return {
      title: "Tính Giá Vốn & Lợi Nhuận Xưởng Printway",
      badge: "Profit Engine",
      icon: Calculator,
      color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    };
  }
  if (lower.includes("tag") || lower.includes("seo")) {
    return {
      title: "Tạo 13 SEO Keywords / Tags Listing",
      badge: "SEO Tags",
      icon: Tag,
      color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    };
  }
  if (lower.includes("file") || lower.includes("write") || lower.includes("read")) {
    return {
      title: "Quản Lý & Lưu Trữ Tệp Dữ Liệu",
      badge: "File System",
      icon: FileText,
      color: "text-slate-400 border-slate-700 bg-slate-800/40",
    };
  }
  if (lower.includes("task") || lower.includes("subagent")) {
    return {
      title: "Điều Phối Tiến Trình Sub-Agent Chuyên Sâu",
      badge: "Sub-Agent Pipeline",
      icon: Bot,
      color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    };
  }
  return {
    title: `Công Cụ: ${name}`,
    badge: "Tool Call",
    icon: Terminal,
    color: "text-[#00FF88] border-[#00FF88]/30 bg-[#00FF88]/10",
  };
}

export const ToolCallBox = React.memo<ToolCallBoxProps>(
  ({
    toolCall,
    uiComponent,
    stream,
    graphId,
    actionRequest,
    reviewConfig,
    onResume,
    isLoading,
  }) => {
    const [isExpanded, setIsExpanded] = useState(
      () => !!uiComponent || !!actionRequest
    );
    const [copied, setCopied] = useState(false);

    const { name, args, result, status } = useMemo(() => {
      return {
        name: toolCall.name || "Unknown Tool",
        args: toolCall.args || {},
        result: toolCall.result,
        status: toolCall.status || "completed",
      };
    }, [toolCall]);

    const meta = useMemo(() => getToolMeta(name), [name]);
    const ToolIcon = meta.icon;

    const statusIcon = useMemo(() => {
      switch (status) {
        case "completed":
          return <CircleCheckBigIcon className="h-3.5 w-3.5 text-[#00FF88] shrink-0" />;
        case "error":
          return <AlertCircle size={14} className="text-red-400 shrink-0" />;
        case "pending":
          return <Loader2 size={14} className="animate-spin text-[#00D2FF] shrink-0" />;
        case "interrupted":
          return <StopCircle size={14} className="text-amber-400 shrink-0" />;
        default:
          return <Terminal size={14} className="text-slate-400 shrink-0" />;
      }
    }, [status]);

    const toggleExpanded = useCallback((e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      setIsExpanded((prev) => !prev);
    }, []);

    const handleCopyPayload = useCallback(() => {
      const payload = {
        tool: name,
        arguments: args,
        result: result,
      };
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, [name, args, result]);

    return (
      <div
        className={cn(
          "w-full overflow-hidden rounded-xl border bg-[#0E1538]/75 transition-all duration-200 backdrop-blur-md",
          isExpanded
            ? "border-[#00FF88]/40 bg-[#0E1538]/95 shadow-[0_0_15px_rgba(0,255,136,0.1)]"
            : "border-slate-800/90 hover:border-[#00FF88]/30 hover:bg-[#121A45]/80"
        )}
      >
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 sm:px-3.5 py-2.5 text-left text-xs font-semibold text-white focus:outline-none"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border", meta.color)}>
              <ToolIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 truncate">
              <span className="text-slate-200 text-xs font-medium truncate">
                {meta.title}
              </span>
              <span className={cn(
                "hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.2 border",
                meta.color
              )}>
                {meta.badge}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-slate-400">
            {statusIcon}
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hidden xs:inline">
              {isExpanded ? "Đóng" : "Chi tiết"}
            </span>
            {isExpanded ? (
              <ChevronUp size={13} className="text-[#00FF88]" />
            ) : (
              <ChevronDown size={13} className="text-slate-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-slate-800 px-3.5 py-3 text-xs bg-[#080B21]/60">
            {uiComponent && stream && graphId ? (
              <div className="mt-2">
                <LoadExternalComponent
                  key={uiComponent.id}
                  stream={stream}
                  message={uiComponent}
                  namespace={graphId}
                  meta={{ status, args, result: result ?? "Chưa có kết quả" }}
                />
              </div>
            ) : actionRequest && onResume ? (
              <div className="mt-2">
                <ToolApprovalInterrupt
                  actionRequest={actionRequest}
                  reviewConfig={reviewConfig}
                  onResume={onResume}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">
                    Tool Method: <span className="text-[#00D2FF]">{name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#00FF88] transition-colors cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-[#00FF88]" /> : <Copy size={12} />}
                    <span>{copied ? "Đã sao chép" : "Sao chép JSON"}</span>
                  </button>
                </div>

                {Object.keys(args).length > 0 && (
                  <div>
                    <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">
                      Tham số đầu vào (Arguments)
                    </h4>
                    <pre className="max-h-48 overflow-x-auto rounded-lg border border-slate-800 bg-[#080B21] p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 scrollbar-pretty">
                      {JSON.stringify(args, null, 2)}
                    </pre>
                  </div>
                )}

                {result && (
                  <div>
                    <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
                      Kết quả thực thi (Result)
                    </h4>
                    <pre className="max-h-60 overflow-x-auto rounded-lg border border-slate-800 bg-[#080B21] p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 scrollbar-pretty">
                      {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToolCallBox.displayName = "ToolCallBox";

