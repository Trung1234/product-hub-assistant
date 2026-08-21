"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
  Loader2,
  CircleCheckBigIcon,
  StopCircle,
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
    const [expandedArgs, setExpandedArgs] = useState<Record<string, boolean>>(
      {}
    );

    const { name, args, result, status } = useMemo(() => {
      return {
        name: toolCall.name || "Unknown Tool",
        args: toolCall.args || {},
        result: toolCall.result,
        status: toolCall.status || "completed",
      };
    }, [toolCall]);

    const statusIcon = useMemo(() => {
      switch (status) {
        case "completed":
          return <CircleCheckBigIcon className="h-4 w-4 text-[#00FF88]" />;
        case "error":
          return (
            <AlertCircle
              size={14}
              className="text-red-400"
            />
          );
        case "pending":
          return (
            <Loader2
              size={14}
              className="animate-spin text-[#00D2FF]"
            />
          );
        case "interrupted":
          return (
            <StopCircle
              size={14}
              className="text-amber-400"
            />
          );
        default:
          return (
            <Terminal
              size={14}
              className="text-slate-400"
            />
          );
      }
    }, [status]);

    const toggleExpanded = useCallback((e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      setIsExpanded((prev) => !prev);
    }, []);

    const toggleArgExpanded = useCallback((argKey: string) => {
      setExpandedArgs((prev) => ({
        ...prev,
        [argKey]: !prev[argKey],
      }));
    }, []);

    return (
      <div
        className={cn(
          "w-full overflow-hidden rounded-xl border border-[#00FF88]/15 bg-[#0E1538]/60 transition-all duration-200 hover:border-[#00FF88]/40 hover:bg-[#121A45]",
          isExpanded && "border-[#00FF88]/30 bg-[#0E1538]/90 shadow-[0_0_15px_rgba(0,255,136,0.1)]"
        )}
      >
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-white focus:outline-none"
        >
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="font-mono text-slate-200">
              {name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {isExpanded ? "Collapse" : "Inspect"}
            </span>
            {isExpanded ? (
              <ChevronUp
                size={14}
                className="shrink-0 text-[#00FF88]"
              />
            ) : (
              <ChevronDown
                size={14}
                className="shrink-0 text-slate-400"
              />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-[#00FF88]/15 px-4 py-3 text-xs">
            {uiComponent && stream && graphId ? (
              <div className="mt-2">
                <LoadExternalComponent
                  key={uiComponent.id}
                  stream={stream}
                  message={uiComponent}
                  namespace={graphId}
                  meta={{ status, args, result: result ?? "No Result Yet" }}
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
                {Object.keys(args).length > 0 && (
                  <div>
                    <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">
                      Input Arguments
                    </h4>
                    <pre className="max-h-48 overflow-x-auto rounded-lg border border-[#00FF88]/15 bg-[#080B21]/80 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">
                      {JSON.stringify(args, null, 2)}
                    </pre>
                  </div>
                )}

                {result && (
                  <div>
                    <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
                      Tool Execution Output
                    </h4>
                    <pre className="max-h-60 overflow-x-auto rounded-lg border border-[#00D2FF]/20 bg-[#080B21]/80 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">
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
