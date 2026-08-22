"use client";

import React, {
  useCallback,
  useMemo,
  useEffect,
  useState
} from "react";
import {
  Sparkles,
  Zap,
  ArrowDown
} from "lucide-react";
import { ChatMessage } from "@/app/components/ChatMessage";
import { ChatInput } from "@/app/components/ChatInput";
import type {
  ToolCall,
  ActionRequest,
  ReviewConfig,
} from "@/app/types/types";
import { Assistant, Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent } from "@/app/utils/utils";
import { useChatContext } from "@/providers/ChatProvider";
import { useStickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
  assistant: Assistant | null;
}

const QUICK_PROMPTS = [
  {
    id: 1,
    title: "🎄 Giáng Sinh: Baby First Ornament",
    query: "Nghiên cứu xu hướng và cơ hội sản phẩm 'Baby First Christmas Ornament 2026 Custom Acrylic Keepsake' trên Etsy, Amazon, Google Trends và Pinterest.",
    badge: "Mica Trong Suốt 3mm",
  },
  {
    id: 2,
    title: "👨‍👩‍👧 Ngày Của Cha: Kỷ Niệm Chương LED",
    query: "Phân tích tiềm năng ngách 'Personalized Grandpa Gift For Father Day Custom Shape Acrylic Desk Plaque With Wood Base Light' cho thị trường US.",
    badge: "Mica Đèn LED Đế Gỗ",
  },
  {
    id: 3,
    title: "👕 Thời Trang: Áo Nỉ Thêu Tên Con",
    query: "Đánh giá cơ hội thị trường cho 'Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve'. Phân tích nhu cầu tìm kiếm, cạnh tranh và gu thẩm mỹ Pinterest.",
    badge: "Nỉ Bông Cotton 80/20",
  },
  {
    id: 4,
    title: "🥤 Đồ Uống: Ly Giữ Nhiệt 40oz Quai Cầm",
    query: "Kiểm tra tiềm năng sản phẩm 'Custom Stainless Steel Tumbler 40oz with handle Teacher Appreciation Gift'. Đánh giá vận tốc bán hàng Amazon và biên lợi nhuận xưởng Printway.",
    badge: "Inox 304 2 Lớp",
  },
];

export const ChatInterface = React.memo<ChatInterfaceProps>(({ assistant }) => {
  const { scrollRef, contentRef, scrollToBottom } = useStickToBottom();
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const {
    stream,
    messages,
    todos,
    files,
    ui,
    setFiles,
    isLoading,
    isThreadLoading,
    interrupt,
    sendMessage,
    stopStream,
    resumeInterrupt,
  } = useChatContext();

  const submitDisabled = isLoading;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 180);
  }, [scrollRef]);

  const handleScrollToBottom = useCallback(() => {
    if (scrollToBottom) {
      scrollToBottom();
    } else if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [scrollToBottom, scrollRef]);

  const handleQuickPromptClick = useCallback(
    (query: string) => {
      if (isLoading || submitDisabled) return;
      sendMessage(query);
    },
    [isLoading, sendMessage, submitDisabled]
  );

  useEffect(() => {
    const handleSendPromptEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && !isLoading) {
        sendMessage(customEvent.detail);
      }
    };

    window.addEventListener("send-chat-prompt", handleSendPromptEvent);
    return () => {
      window.removeEventListener("send-chat-prompt", handleSendPromptEvent);
    };
  }, [isLoading, sendMessage]);

  const processedMessages = useMemo(() => {
    const messageMap = new Map<string, { message: Message; toolCalls: ToolCall[] }>();
    const toolCallIndexMap = new Map<string, { aiMsgId: string; tcIdx: number }>();

    messages.forEach((message: Message) => {
      if (message.type === "ai") {
        const rawToolCalls = message.tool_calls || [];
        const toolCallsWithStatus: ToolCall[] = rawToolCalls.map(
          (toolCall: any, tcIdx: number) => {
            const name = toolCall.function?.name || toolCall.name || toolCall.type || "unknown";
            const args = typeof toolCall.function?.arguments === "string"
                ? JSON.parse(toolCall.function.arguments || "{}")
                : toolCall.function?.arguments || toolCall.args || toolCall.input || {};
            const id = toolCall.id || `${message.id}-tc-${tcIdx}`;

            toolCallIndexMap.set(id, { aiMsgId: message.id!, tcIdx });

            return {
              id,
              name,
              args,
              status: "pending", // Initially pending while waiting for the tool execution response
            } as ToolCall;
          }
        );

        messageMap.set(message.id!, {
          message,
          toolCalls: toolCallsWithStatus,
        });
      } else if (message.type === "tool") {
        const toolCallId = message.tool_call_id;
        if (toolCallId && toolCallIndexMap.has(toolCallId)) {
          const { aiMsgId, tcIdx } = toolCallIndexMap.get(toolCallId)!;
          const parentMsg = messageMap.get(aiMsgId);
          if (parentMsg && parentMsg.toolCalls[tcIdx]) {
            const result: string = typeof message.content === "string" ? message.content : extractStringFromMessageContent(message);
            const isError =
              message.status === "error" ||
              (typeof result === "string" && (result.toLowerCase().startsWith("error:") || result.toLowerCase().startsWith("traceback")));
            const status: "completed" | "error" | "pending" | "interrupted" = isError ? "error" : "completed";

            parentMsg.toolCalls[tcIdx] = {
              ...parentMsg.toolCalls[tcIdx],
              result,
              status,
            };
          }
        }
      } else {
        messageMap.set(message.id!, {
          message,
          toolCalls: [],
        });
      }
    });

    // If stream is completely finished, convert any lingering pending tools without results
    if (!isLoading) {
      messageMap.forEach((entry) => {
        entry.toolCalls.forEach((tc) => {
          if (tc.status === "pending") {
            tc.status = tc.result ? "completed" : "interrupted";
          }
        });
      });
    }

    return Array.from(messageMap.values());
  }, [messages, isLoading]);

  const hasAiResponseText = useMemo(() => {
    if (processedMessages.length === 0) return false;
    const last = processedMessages[processedMessages.length - 1];
    if (last.message.type === "ai") {
      const content = extractStringFromMessageContent(last.message);
      return Boolean(content && content.trim().length > 0);
    }
    return false;
  }, [processedMessages]);

  const clarificationData = useMemo(() => {
    if (!interrupt) return null;
    if (typeof interrupt === "string") {
      return { question: interrupt, options: [] };
    }
    if (typeof interrupt === "object") {
      const val = interrupt as any;
      const q = val.question || val.prompt || val.message || JSON.stringify(val);
      const opts = Array.isArray(val.options) ? val.options : [];
      return { question: q, options: opts };
    }
    return null;
  }, [interrupt]);

  const handleClarificationSubmit = useCallback(
    (response: string) => {
      resumeInterrupt({ response });
    },
    [resumeInterrupt]
  );

  const actionRequestsMap: Map<string, ActionRequest> | undefined = useMemo(() => {
    if (!interrupt || typeof interrupt !== "object" || !("action_requests" in interrupt)) return undefined;
    const reqs = (interrupt as any).action_requests as ActionRequest[];
    if (!Array.isArray(reqs)) return undefined;
    return new Map<string, ActionRequest>(reqs.map((req) => [req.name, req]));
  }, [interrupt]);

  const reviewConfigsMap: Map<string, ReviewConfig> | undefined = useMemo(() => {
    if (!interrupt || typeof interrupt !== "object" || !("review_configs" in interrupt)) return undefined;
    const configs = (interrupt as any).review_configs as ReviewConfig[];
    if (!Array.isArray(configs)) return undefined;
    return new Map<string, ReviewConfig>(configs.map((config) => [config.actionName, config]));
  }, [interrupt]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#080B21]">
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-pretty"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div
          className="mx-auto w-full max-w-[1024px] px-3 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4"
          ref={contentRef}
        >
          {isThreadLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-[#00FF88] font-mono animate-pulse text-xs sm:text-sm">Đang tải cuộc trò chuyện...</p>
            </div>
          ) : processedMessages.length === 0 ? (
            <div className="my-2 sm:my-4 flex flex-col items-center justify-center text-center">
              {/* Competition Banner */}
              <div className="relative mb-3 sm:mb-4 w-full overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538]/90 shadow-[0_0_25px_rgba(0,255,136,0.15)]">
                <img
                  src="/banner_crossborder.png"
                  alt="Cross Border AI Innovation Summit 2026"
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-full max-h-[130px] sm:max-h-[160px] object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080B21] via-transparent to-transparent"></div>
              </div>

              {/* Logo & Header */}
              <div className="flex items-center justify-center mb-2">
                <img
                  src="/logo_header.png"
                  alt="Printway Nexus"
                  loading="lazy"
                  decoding="async"
                  className="h-8 sm:h-9 w-auto object-contain"
                />
              </div>

              <h2 className="text-lg font-black tracking-tight text-white sm:text-2xl">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] via-[#00D2FF] to-[#FFFFFF]">
                  PRINTWAY PRODUCT OPPORTUNITY HUB
                </span>
              </h2>
              <p className="mt-1 max-w-lg text-xs text-[#94A3B8] px-2 leading-relaxed">
                AI Copilot tự động cào tín hiệu thị trường Etsy, Amazon & Pinterest, chấm điểm Opportunity Score 5D và gợi ý chiến lược R&D xưởng Printway.
              </p>

              {/* 4 Quick Prompts 2x2 Grid */}
              <div className="mt-4 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleQuickPromptClick(p.query)}
                    className="group relative flex flex-col justify-between rounded-xl border border-[#00FF88]/20 bg-[#0E1538]/80 p-3 sm:p-3.5 transition-all duration-200 hover:border-[#00FF88] hover:bg-[#121A45] hover:shadow-[0_0_15px_rgba(0,255,136,0.15)] text-left cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-[#00FF88]/15 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30">
                          {p.badge}
                        </span>
                        <Zap className="h-3.5 w-3.5 text-[#00D2FF] opacity-70 group-hover:opacity-100 group-hover:text-[#00FF88] transition-colors" />
                      </div>
                      <h4 className="mt-1.5 text-xs sm:text-sm font-semibold text-white group-hover:text-[#00FF88] transition-colors">
                        {p.title}
                      </h4>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#94A3B8] leading-relaxed">
                      {p.query}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {processedMessages.map((data, index) => {
                const messageUi = ui?.filter(
                  (u: any) => u.metadata?.message_id === data.message.id
                );
                const isLastMessage = index === processedMessages.length - 1;
                return (
                  <ChatMessage
                    key={data.message.id}
                    message={data.message}
                    toolCalls={data.toolCalls}
                    isLoading={isLoading}
                    isLastMessage={isLastMessage}
                    actionRequestsMap={isLastMessage ? actionRequestsMap : undefined}
                    reviewConfigsMap={isLastMessage ? reviewConfigsMap : undefined}
                    ui={messageUi}
                    onResumeInterrupt={resumeInterrupt}
                    graphId={assistant?.graph_id}
                  />
                );
              })}

              {isLoading && !hasAiResponseText && (
                <div className="my-2.5 flex items-center gap-2.5 w-fit rounded-full border border-[#00FF88]/30 bg-[#0E1538]/90 px-3 py-1.5 shadow-[0_0_15px_rgba(0,255,136,0.15)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-1">
                  <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#00FF88] to-[#00D2FF] shadow-[0_0_8px_rgba(0,255,136,0.4)]">
                    <Sparkles className="h-3 w-3 text-[#080B21] animate-spin" />
                  </div>
                  <div className="flex items-center gap-1.5 px-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00D2FF] animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] animate-bounce" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MINIMALIST FLOATING SCROLL-TO-BOTTOM BUTTON WHEN SCROLLED UP */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          className="group absolute bottom-32 sm:bottom-36 left-1/2 -translate-x-1/2 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-[#00FF88]/40 bg-[#0E1538]/90 shadow-[0_0_20px_rgba(0,255,136,0.3)] backdrop-blur-md hover:bg-[#121A45] hover:border-[#00FF88] hover:shadow-[0_0_25px_rgba(0,255,136,0.6)] hover:scale-110 active:scale-95 transition-all duration-200 animate-in fade-in zoom-in-90 cursor-pointer"
          title="Cuộn xuống tin nhắn mới nhất"
          aria-label="Cuộn xuống tin nhắn mới nhất"
        >
          <ArrowDown className="h-4 w-4 text-[#00FF88]" />
        </button>
      )}

      {/* ISOLATED ZERO-LAG CHAT INPUT */}
      <ChatInput
        isLoading={isLoading}
        submitDisabled={submitDisabled}
        onSendMessage={sendMessage}
        onStopStream={stopStream}
        todos={todos}
        files={files}
        setFiles={setFiles}
        interrupt={interrupt}
        clarificationData={clarificationData}
        onClarificationSubmit={handleClarificationSubmit}
      />
    </div>
  );
});

ChatInterface.displayName = "ChatInterface";
