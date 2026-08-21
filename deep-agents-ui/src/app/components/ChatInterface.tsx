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

interface ChatInterfaceProps {
  assistant: Assistant | null;
}

const QUICK_PROMPTS = [
  {
    title: "Christmas 2026: Baby First Ornament",
    query: "Nghiên cứu xu hướng và cơ hội sản phẩm 'Baby First Christmas Ornament 2026 Custom Acrylic Keepsake' trên Etsy, Amazon, Google Trends và Pinterest.",
    badge: "Holiday Campaign / Acrylic"
  },
  {
    title: "Father's Day: Grandpa Acrylic Desk Plaque",
    query: "Phân tích tiềm năng ngách 'Personalized Grandpa Gift For Father Day Custom Shape Acrylic Desk Plaque With Wood Base Light' cho thị trường US.",
    badge: "Gifts / Wood & Acrylic"
  },
  {
    title: "Mother's Day: Embroidered Mama Sweatshirt",
    query: "Đánh giá cơ hội thị trường cho 'Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve'. Phân tích nhu cầu tìm kiếm, cạnh tranh và gu thẩm mỹ Pinterest.",
    badge: "Apparel / Cotton Embroidery"
  },
  {
    title: "Everyday Drinkware: Teacher Tumbler 20oz",
    query: "Kiểm tra tiềm năng sản phẩm 'Custom Stainless Steel Tumbler 20oz Teacher Appreciation Gift'. Đánh giá vận tốc bán hàng Amazon và biên lợi nhuận xưởng Printway.",
    badge: "Drinkware / Stainless Steel"
  }
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

  const submitDisabled = isLoading || !assistant;

  // Handle scroll detection to toggle scroll-to-bottom button
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

  // Listen for 1-click follow-up prompt events from SuggestedQuestionsRenderer
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
    const messageMap = new Map<
      string,
      {
        message: Message;
        toolCalls: ToolCall[];
      }
    >();

    messages.forEach((message: Message) => {
      if (message.type === "ai") {
        const rawToolCalls = message.tool_calls || [];
        const toolCallsWithStatus: ToolCall[] = rawToolCalls.map(
          (toolCall: {
            id?: string;
            name?: string;
            function?: { name?: string; arguments?: unknown };
            args?: unknown;
            type?: string;
            input?: unknown;
          }) => {
            const name =
              toolCall.function?.name ||
              toolCall.name ||
              toolCall.type ||
              "unknown";
            const args =
              toolCall.function?.arguments ||
              toolCall.args ||
              toolCall.input ||
              {};
            return {
              id: toolCall.id || `tool-${Math.random()}`,
              name,
              args,
              status: interrupt ? "interrupted" : ("pending" as const),
            } as ToolCall;
          }
        );
        messageMap.set(message.id!, {
          message,
          toolCalls: toolCallsWithStatus,
        });
      } else if (message.type === "tool") {
        const toolCallId = message.tool_call_id;
        if (!toolCallId) {
          return;
        }
        for (const [, data] of messageMap.entries()) {
          const toolCallIndex = data.toolCalls.findIndex(
            (tc: ToolCall) => tc.id === toolCallId
          );
          if (toolCallIndex === -1) {
            continue;
          }
          data.toolCalls[toolCallIndex] = {
            ...data.toolCalls[toolCallIndex],
            status: "completed" as const,
            result: extractStringFromMessageContent(message),
          };
          break;
        }
      } else if (message.type === "human") {
        messageMap.set(message.id!, {
          message,
          toolCalls: [],
        });
      }
    });
    const processedArray = Array.from(messageMap.values());
    return processedArray.map((data, index) => {
      const prevMessage = index > 0 ? processedArray[index - 1].message : null;
      return {
        ...data,
        showAvatar: data.message.type !== prevMessage?.type,
      };
    });
  }, [messages, interrupt]);

  const actionRequestsMap: Map<string, ActionRequest> | null = useMemo(() => {
    const actionRequests =
      interrupt?.value && (interrupt.value as any)["action_requests"];
    if (!actionRequests) return new Map<string, ActionRequest>();
    return new Map(actionRequests.map((ar: ActionRequest) => [ar.name, ar]));
  }, [interrupt]);

  const reviewConfigsMap: Map<string, ReviewConfig> | null = useMemo(() => {
    const reviewConfigs =
      interrupt?.value && (interrupt.value as any)["review_configs"];
    if (!reviewConfigs) return new Map<string, ReviewConfig>();
    return new Map(
      reviewConfigs.map((rc: ReviewConfig) => [rc.actionName, rc])
    );
  }, [interrupt]);

  // Extract Clarification / Handoff Question and Options when interrupt occurs
  const clarificationData = useMemo(() => {
    if (!interrupt && (!actionRequestsMap || actionRequestsMap.size === 0)) return null;

    let question = "AI Copilot cần làm rõ thông tin từ bạn để tiếp tục nghiên cứu:";
    let options: string[] = [];

    if (interrupt?.value) {
      const val = interrupt.value as any;
      if (typeof val === "string") {
        question = val;
      } else if (val?.question) {
        question = val.question;
        if (Array.isArray(val.options)) options = val.options;
      } else if (val?.action_requests && Array.isArray(val.action_requests)) {
        const req = val.action_requests[0];
        if (req?.args?.question) question = req.args.question;
        if (Array.isArray(req?.args?.options)) options = req.args.options;
      }
    }

    const askUserReq = actionRequestsMap?.get("ask_user_clarification");
    if (askUserReq?.args) {
      const args = askUserReq.args as any;
      if (args.question) question = args.question;
      if (Array.isArray(args.options)) options = args.options;
    }

    return { question, options };
  }, [interrupt, actionRequestsMap]);

  const handleClarificationSubmit = useCallback(
    (responseVal: string) => {
      const clean = responseVal.trim();
      if (!clean) return;

      if (resumeInterrupt) {
        resumeInterrupt(clean);
      } else {
        sendMessage(clean);
      }
    },
    [resumeInterrupt, sendMessage]
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#080B21]">
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-pretty"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div
          className="mx-auto w-full max-w-[1024px] px-6 pb-6 pt-4"
          ref={contentRef}
        >
          {isThreadLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-[#00FF88] font-mono animate-pulse">Loading conversation...</p>
            </div>
          ) : processedMessages.length === 0 ? (
            /* Welcome Hero Section */
            <div className="my-6 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6 w-full overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538]/90 shadow-[0_0_30px_rgba(0,255,136,0.2)]">
                <img
                  src="/banner_crossborder.png"
                  alt="Cross Border AI Innovation Summit 2026"
                  className="h-auto w-full max-h-[220px] object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080B21] via-transparent to-transparent"></div>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] via-[#00D2FF] to-[#FFFFFF]">
                  PRINTWAY PRODUCT OPPORTUNITY HUB
                </span>
              </h2>
              <p className="mt-2 max-w-xl text-sm text-[#94A3B8]">
                AI Copilot tự động cào tín hiệu thị trường Etsy & Amazon, tính toán Opportunity Score 0-100 và tự suy luận chiến lược R&D sản phẩm POD toàn cầu.
              </p>

              {/* Quick Prompt Cards */}
              <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 text-left">
                {QUICK_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPromptClick(p.query)}
                    className="group relative flex flex-col justify-between rounded-xl border border-[#00FF88]/20 bg-[#0E1538]/80 p-4 transition-all duration-300 hover:border-[#00FF88] hover:bg-[#121A45] hover:shadow-[0_0_20px_rgba(0,255,136,0.2)] text-left cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-[#00FF88]/15 px-2 py-0.5 text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30">
                          {p.badge}
                        </span>
                        <Zap className="h-3.5 w-3.5 text-[#00D2FF] opacity-70 group-hover:opacity-100 group-hover:text-[#00FF88] transition-colors" />
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-white group-hover:text-[#00FF88] transition-colors">
                        {p.title}
                      </h4>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-[#94A3B8]">
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
                    actionRequestsMap={
                      isLastMessage ? actionRequestsMap : undefined
                    }
                    reviewConfigsMap={
                      isLastMessage ? reviewConfigsMap : undefined
                    }
                    ui={messageUi}
                    stream={stream}
                    onResumeInterrupt={resumeInterrupt}
                    graphId={assistant?.graph_id}
                  />
                );
              })}

              {/* MINIMALIST THINKING: LOGO + 3 ANIMATED DOTS ONLY */}
              {isLoading && (
                <div className="my-3 flex items-center gap-3 w-fit rounded-full border border-[#00FF88]/30 bg-[#0E1538]/80 px-3.5 py-1.5 shadow-[0_0_15px_rgba(0,255,136,0.15)] backdrop-blur-md">
                  <div className="relative flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-tr from-[#00FF88] to-[#00D2FF] shadow-[0_0_8px_rgba(0,255,136,0.5)]">
                    <Sparkles className="h-3 w-3 text-[#080B21]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#00FF88] animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-[#00D2FF] animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-[#8B5CF6] animate-bounce" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* FLOATING SCROLL-TO-BOTTOM BUTTON WHEN SCROLLED UP */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-[#00FF88]/40 bg-[#0E1538]/95 px-4 py-2 text-xs font-bold text-white shadow-[0_0_25px_rgba(0,255,136,0.35)] backdrop-blur-md hover:bg-[#121A45] hover:border-[#00FF88] hover:shadow-[0_0_30px_rgba(0,255,136,0.55)] hover:scale-105 transition-all duration-200 animate-in fade-in zoom-in-95 cursor-pointer"
          title="Cuộn xuống tin nhắn mới nhất"
        >
          <ArrowDown className="h-3.5 w-3.5 text-[#00FF88] animate-bounce" />
          <span className="text-[12px] font-semibold text-[#00FF88]">Cuộn xuống mới nhất</span>
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
