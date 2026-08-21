"use client";

import React, { useMemo, useState, useCallback } from "react";
import { SubAgentIndicator } from "@/app/components/SubAgentIndicator";
import { ToolCallBox } from "@/app/components/ToolCallBox";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { SuggestedQuestionsRenderer } from "@/app/components/SuggestedQuestionsRenderer";
import type {
  SubAgent,
  ToolCall,
  ActionRequest,
  ReviewConfig,
} from "@/app/types/types";
import { Message } from "@langchain/langgraph-sdk";
import {
  extractSubAgentContent,
  extractStringFromMessageContent,
} from "@/app/utils/utils";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
  toolCalls: ToolCall[];
  isLoading?: boolean;
  actionRequestsMap?: Map<string, ActionRequest>;
  reviewConfigsMap?: Map<string, ReviewConfig>;
  ui?: any[];
  stream?: any;
  onResumeInterrupt?: (value: any) => void;
  graphId?: string;
}

function deriveContextualQuestions(content: string): string[] {
  const lower = content.toLowerCase();
  
  if (lower.includes("ornament") || lower.includes("christmas") || lower.includes("xmas") || lower.includes("baby first")) {
    return [
      "Phân tích sâu Top 3 đối thủ Acrylic Ornament bán chạy nhất trên Amazon",
      "Gợi ý 5 biến thể thiết kế Stained Glass và Sun-catcher trên Pinterest",
      "Dự báo thời điểm đạt đỉnh Google Trends cho mùa Giáng Sinh 2026",
      "Tính toán chi phí phôi mica Printway ($2.20) và dải giá bán lẻ tối ưu"
    ];
  } else if (lower.includes("plaque") || lower.includes("desk") || lower.includes("father") || lower.includes("grandpa")) {
    return [
      "Phân tích Top 3 mẫu Acrylic Desk Plaque chân đế LED bán chạy nhất Etsy",
      "Khám phá 5 phong cách khắc chân dung và Spotify Code trên Pinterest",
      "Dự báo chu kỳ tìm kiếm Google Trends dịp Father's Day tháng 5-6",
      "Đánh giá biên lợi nhuận đế gỗ LED xưởng Printway (Giá vốn $4.50)"
    ];
  } else if (lower.includes("tumbler") || lower.includes("drinkware") || lower.includes("cup") || lower.includes("teacher")) {
    return [
      "Đánh giá Top 3 mẫu ly giữ nhiệt Inox 20oz bán chạy nhất Amazon",
      "Khám phá 5 bảng màu Pastel và hoa văn laser thịnh hành trên Pinterest",
      "Phân tích đà tăng trưởng Google Trends cho ngách Teacher Appreciation Gift",
      "So sánh biên lợi nhuận xưởng Printway giữa in UV và khắc Laser 360"
    ];
  } else if (lower.includes("sweatshirt") || lower.includes("hoodie") || lower.includes("mama") || lower.includes("apparel")) {
    return [
      "Phân tích Top 3 shop bán áo thêu cổ tay Custom Mama chạy nhất trên Etsy",
      "Gợi ý 5 bảng phối màu chỉ thêu Satin và Vintage Varsity trên Pinterest",
      "Dự báo chu kỳ tăng trưởng Google Trends cho dịp Mother's Day",
      "Tính toán chi phí thêu nỉ bông 320 GSM tại xưởng Printway"
    ];
  }

  return [
    "Phân tích sâu Top 3 đối thủ cạnh tranh trực tiếp trên Etsy và Amazon",
    "Gợi ý 5 phong cách thiết kế độc đáo để khác biệt hóa trên Pinterest",
    "Dự báo chu kỳ tìm kiếm Google Trends trong 60 ngày tới",
    "Đánh giá chi phí sản xuất xưởng Printway và dải giá bán lẻ tối ưu"
  ];
}

export const ChatMessage = React.memo<ChatMessageProps>(
  ({
    message,
    toolCalls,
    isLoading,
    actionRequestsMap,
    reviewConfigsMap,
    ui,
    stream,
    onResumeInterrupt,
    graphId,
  }) => {
    const isUser = message.type === "human";
    const rawMessageContent = extractStringFromMessageContent(message);
    const hasContent = rawMessageContent && rawMessageContent.trim() !== "";
    const hasToolCalls = toolCalls.length > 0;

    // Check if the message contains explicit suggestions code block
    const hasExplicitSuggestions = rawMessageContent.includes("```suggestions") || rawMessageContent.includes("```suggestion");

    // Cleaned content for Markdown display if suggestions block is embedded
    const displayContent = useMemo(() => {
      if (!hasContent) return "";
      // If explicit suggestions exist, we let SuggestedQuestionsRenderer handle it cleanly
      return rawMessageContent;
    }, [rawMessageContent, hasContent]);

    const fallbackQuestions = useMemo(() => {
      if (isUser || !hasContent || hasExplicitSuggestions) return [];
      return deriveContextualQuestions(rawMessageContent);
    }, [isUser, hasContent, hasExplicitSuggestions, rawMessageContent]);

    const subAgents = useMemo(() => {
      return toolCalls
        .filter((toolCall: ToolCall) => {
          return (
            toolCall.name === "task" &&
            toolCall.args["subagent_type"] &&
            toolCall.args["subagent_type"] !== "" &&
            toolCall.args["subagent_type"] !== null
          );
        })
        .map((toolCall: ToolCall) => {
          const subagentType = (toolCall.args as Record<string, unknown>)[
            "subagent_type"
          ] as string;
          return {
            id: toolCall.id,
            name: toolCall.name,
            subAgentName: subagentType,
            input: toolCall.args,
            output: toolCall.result ? { result: toolCall.result } : undefined,
            status: toolCall.status,
          } as SubAgent;
        });
    }, [toolCalls]);

    const [expandedSubAgents, setExpandedSubAgents] = useState<
      Record<string, boolean>
    >({});
    const isSubAgentExpanded = useCallback(
      (id: string) => expandedSubAgents[id] ?? true,
      [expandedSubAgents]
    );
    const toggleSubAgent = useCallback((id: string) => {
      setExpandedSubAgents((prev) => ({
        ...prev,
        [id]: prev[id] === undefined ? false : !prev[id],
      }));
    }, []);

    // For user messages: display simple user bubble
    if (isUser) {
      return (
        <div className="flex w-full max-w-full overflow-x-hidden my-3 flex-row-reverse">
          <div className="min-w-0 max-w-[75%]">
            <div className="overflow-hidden break-words rounded-2xl rounded-br-sm border border-[#00D2FF]/40 bg-[#00D2FF]/15 px-4 py-3 text-white shadow-[0_0_15px_rgba(0,210,255,0.2)] backdrop-blur-sm">
              <p className="m-0 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed">
                {rawMessageContent}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // For AI messages: Render Subagents -> Tool Calls -> Response Content -> Follow-Up Question Chips
    return (
      <div className="flex w-full max-w-full overflow-x-hidden my-2">
        <div className="min-w-0 w-full flex flex-col gap-2">
          {/* 1. Sub-Agents (if any) */}
          {subAgents.length > 0 && (
            <div className="flex w-fit max-w-full flex-col gap-3">
              {subAgents.map((subAgent) => (
                <div
                  key={subAgent.id}
                  className="flex w-full flex-col gap-2"
                >
                  <div className="flex items-end gap-2">
                    <div className="w-[calc(100%-100px)]">
                      <SubAgentIndicator
                        subAgent={subAgent}
                        onClick={() => toggleSubAgent(subAgent.id)}
                        isExpanded={isSubAgentExpanded(subAgent.id)}
                      />
                    </div>
                  </div>
                  {isSubAgentExpanded(subAgent.id) && (
                    <div className="w-full max-w-full">
                      <div className="bg-[#0E1538] border-[#00FF88]/20 rounded-xl border p-4 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
                        <h4 className="text-[#00FF88] mb-2 text-xs font-semibold uppercase tracking-wider">
                          Sub-Agent Input
                        </h4>
                        <div className="mb-4 text-xs text-[#94A3B8]">
                          <MarkdownContent
                            content={extractSubAgentContent(subAgent.input)}
                          />
                        </div>
                        {subAgent.output && (
                          <>
                            <h4 className="text-[#00D2FF] mb-2 text-xs font-semibold uppercase tracking-wider">
                              Sub-Agent Insights
                            </h4>
                            <div className="text-xs text-[#94A3B8]">
                              <MarkdownContent
                                content={extractSubAgentContent(subAgent.output)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 2. Tool Calls Display */}
          {hasToolCalls && (
            <div className="flex w-full flex-col gap-2">
              {toolCalls.map((toolCall: ToolCall) => {
                if (toolCall.name === "task") return null;
                const toolCallGenUiComponent = ui?.find(
                  (u) => u.metadata?.tool_call_id === toolCall.id
                );
                const actionRequest = actionRequestsMap?.get(toolCall.name);
                const reviewConfig = reviewConfigsMap?.get(toolCall.name);
                return (
                  <ToolCallBox
                    key={toolCall.id}
                    toolCall={toolCall}
                    uiComponent={toolCallGenUiComponent}
                    stream={stream}
                    graphId={graphId}
                    actionRequest={actionRequest}
                    reviewConfig={reviewConfig}
                    onResume={onResumeInterrupt}
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          )}

          {/* 3. Final Response Content */}
          {hasContent && (
            <div className="relative flex items-end gap-0 w-full mt-2">
              <div className="overflow-hidden break-words text-sm font-normal leading-relaxed text-white w-full">
                <MarkdownContent content={displayContent} />
                
                {/* 4. Universal Fallback Follow-Up Action Chips (Guarantees 100% visibility) */}
                {fallbackQuestions.length > 0 && !hasExplicitSuggestions && (
                  <SuggestedQuestionsRenderer code={JSON.stringify(fallbackQuestions)} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
