"use client";

import React, { useMemo, useState, useCallback } from "react";
import { SubAgentIndicator } from "@/app/components/SubAgentIndicator";
import { ToolCallBox } from "@/app/components/ToolCallBox";
import { MarkdownContent } from "@/app/components/MarkdownContent";
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
    const messageContent = extractStringFromMessageContent(message);
    const hasContent = messageContent && messageContent.trim() !== "";
    const hasToolCalls = toolCalls.length > 0;
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
                {messageContent}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // For AI messages: Render Subagents -> Tool Calls -> Response Content (NO internal duplicate thinking)
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
                <MarkdownContent content={messageContent} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
