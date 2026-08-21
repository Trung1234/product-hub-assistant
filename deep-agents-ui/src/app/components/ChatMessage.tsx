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
  isLastMessage?: boolean;
  actionRequestsMap?: Map<string, ActionRequest>;
  reviewConfigsMap?: Map<string, ReviewConfig>;
  ui?: any[];
  stream?: any;
  onResumeInterrupt?: (value: any) => void;
  graphId?: string;
}

function extractDynamicQuestions(content: string): string[] {
  if (!content) return [];

  // 1. Try extracting from ```suggestions ... ``` code block
  const codeMatch = content.match(/```(?:suggestions|suggestion|followup|questions)\s*([\s\S]*?)\s*```/i);
  if (codeMatch && codeMatch[1]) {
    try {
      const parsed = JSON.parse(codeMatch[1].trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch {
      const lines = codeMatch[1]
        .split("\n")
        .map((l) => l.replace(/^[-*•\d.↳"\[\]]\s*/, "").replace(/[",\]]/g, "").trim())
        .filter((l) => l.length > 6);
      if (lines.length > 0) return lines;
    }
  }

  // 2. Try extracting from "### 💡 Câu Hỏi Gợi Ý" or similar header in content
  const sectionMatch = content.match(/(?:###|\*\*|💡)?\s*(?:Câu Hỏi Gợi Ý|Gợi ý câu hỏi|Follow-up Questions)[^\n]*\n([\s\S]*?)(?:\n\n[#*]|\n---|$)/i);
  if (sectionMatch && sectionMatch[1]) {
    const lines = sectionMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.↳]\s*/, "").trim())
      .filter((l) => l.length > 8);
    if (lines.length > 0) return lines.slice(0, 4);
  }

  // 3. Dynamic context-based synthesis from the actual text (extracting product title, scores, metrics)
  const titleMatch = content.match(/###\s*🎯\s*Khuyến Nghị R&D:[^\n]*?\*\*([^*]+)\*\*/i) ||
                     content.match(/keyword[:=]\s*"([^"]+)"/i) ||
                     content.match(/sản phẩm\s*['"“]([^'"”]+)['"”]/i) ||
                     content.match(/cơ hội\s*['"“]([^'"”]+)['"”]/i);
  const productName = titleMatch ? titleMatch[1].trim() : "";

  if (productName) {
    return [
      `Phân tích sâu top 3 đối thủ cạnh tranh có doanh số cao nhất cho ${productName}`,
      `Gợi ý 5 biến thể thiết kế và màu sắc thịnh hành trên Pinterest cho ${productName}`,
      `Dự báo chi tiết xu hướng tăng trưởng tìm kiếm Google Trends trong 60 ngày tới`,
      `Tính toán chi tiết biên lợi nhuận xưởng Printway và dải giá bán lẻ tối ưu`
    ];
  }

  return [];
}

export const ChatMessage = React.memo<ChatMessageProps>(
  ({
    message,
    toolCalls,
    isLoading,
    isLastMessage = true,
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

    // Dynamic extraction of follow-up questions from the LLM content
    const dynamicQuestions = useMemo(() => {
      if (isUser || !hasContent || !isLastMessage) return [];
      return extractDynamicQuestions(rawMessageContent);
    }, [isUser, hasContent, isLastMessage, rawMessageContent]);

    // Cleaned content for Markdown display: strip raw suggestions code block so it renders as interactive list at the bottom
    const displayContent = useMemo(() => {
      if (!hasContent) return "";
      return rawMessageContent
        .replace(/```(?:suggestions|suggestion|followup|questions)[\s\S]*?```/gi, "")
        .replace(/(?:###|\*\*|💡)?\s*(?:Câu Hỏi Gợi Ý|Gợi ý câu hỏi|Follow-up Questions)[^\n]*\n([\s\S]*?)(?:\n\n[#*]|\n---|$)/gi, "")
        .trim();
    }, [rawMessageContent, hasContent]);

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

    // For AI messages: Render Subagents -> Tool Calls -> Response Content -> Follow-Up Question List (Last response only)
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
            <div className="relative flex flex-col w-full mt-2">
              <div className="overflow-hidden break-words text-sm font-normal leading-relaxed text-white w-full">
                <MarkdownContent content={displayContent} />
                
                {/* 4. Dynamic LLM Follow-Up Questions (Rendered ONLY on the latest message) */}
                {isLastMessage && dynamicQuestions.length > 0 && (
                  <SuggestedQuestionsRenderer code={JSON.stringify(dynamicQuestions)} />
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
