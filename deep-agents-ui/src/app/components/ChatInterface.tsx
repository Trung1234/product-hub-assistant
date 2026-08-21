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
    title: "Giáng Sinh: Baby First Ornament",
    query: "Nghiên cứu xu hướng và cơ hội sản phẩm 'Baby First Christmas Ornament 2026 Custom Acrylic Keepsake' trên Etsy, Amazon, Google Trends và Pinterest.",
    badge: "Chiến dịch Giáng Sinh / Mica 3mm"
  },
  {
    title: "Ngày của Cha: Kỷ niệm chương Mica đế gỗ LED",
    query: "Phân tích tiềm năng ngách 'Personalized Grandpa Gift For Father Day Custom Shape Acrylic Desk Plaque With Wood Base Light' cho thị trường US.",
    badge: "Quà tặng Cha / Gỗ & Mica LED"
  },
  {
    title: "Ngày của Mẹ: Áo nỉ thêu tên con",
    query: "Đánh giá cơ hội thị trường cho 'Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve'. Phân tích nhu cầu tìm kiếm, cạnh tranh và gu thẩm mỹ Pinterest.",
    badge: "Thời trang / Áo nỉ thêu vi tính"
  },
  {
    title: "Đồ uống hàng ngày: Ly giữ nhiệt 40oz quai cầm",
    query: "Kiểm tra tiềm năng sản phẩm 'Custom Stainless Steel Tumbler 40oz with handle Teacher Appreciation Gift'. Đánh giá vận tốc bán hàng Amazon và biên lợi nhuận xưởng Printway.",
    badge: "Ly giữ nhiệt / Inox 304"
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

    // O(1) Index Map to find the parent AI message and tool call index
    const toolCallIndexMap = new Map<
      string,
      { aiMsgId: string; tcIdx: number }
    >();

    messages.forEach((message: Message) => {
      if (message.type === "ai") {
        const rawToolCalls = message.tool_calls || [];
        const toolCallsWithStatus: ToolCall[] = rawToolCalls.map(
          (
            toolCall: {
              id?: string;
              name?: string;
              function?: { name?: string; arguments?: unknown };
              args?: unknown;
              type?: string;
              input?: unknown;
            },
            tcIdx: number
          ) => {
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
            const tcId = toolCall.id || `tc-${message.id}-${tcIdx}`;

            toolCallIndexMap.set(tcId, {
              aiMsgId: message.id!,
              tcIdx,
            });

            return {
              id: tcId,
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
        if (!toolCallId) return;

        const lookup = toolCallIndexMap.get(toolCallId);
        if (lookup) {
          const parentAi = messageMap.get(lookup.aiMsgId);
          if (parentAi && parentAi.toolCalls[lookup.tcIdx]) {
            parentAi.toolCalls[lookup.tcIdx] = {
              ...parentAi.toolCalls[lookup.tcIdx],
              status: "completed" as const,
              result: extractStringFromMessageContent(message),
            };
          }
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
          className="mx-auto w-full max-w-[1024px] px-3 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4"
          ref={contentRef}
        >
          {isThreadLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-[#00FF88] font-mono animate-pulse text-xs sm:text-sm">Đang tải cuộc trò chuyện...</p>
            </div>
          ) : processedMessages.length === 0 ? (
            /* Welcome Hero Section */
            <div className="my-4 sm:my-6 flex flex-col items-center justify-center text-center">
              <div className="relative mb-4 sm:mb-6 w-full overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538]/90 shadow-[0_0_30px_rgba(0,255,136,0.2)]">
                <img
                  src="/banner_crossborder.png"
                  alt="Cross Border AI Innovation Summit 2026"
                  className="h-auto w-full max-h-[160px] sm:max-h-[220px] object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080B21] via-transparent to-transparent"></div>
              </div>

              <div className="flex items-center justify-center gap-3 mb-3 sm:mb-4">
                <div className="flex items-center justify-center px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white shadow-[0_0_25px_rgba(255,255,255,0.2)]">
                  <img
                    src="/logo_header.png"
                    alt="Printway.io"
                    className="h-5 sm:h-6 w-auto object-contain"
                  />
                </div>
              </div>

              <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl md:text-3xl">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] via-[#00D2FF] to-[#FFFFFF]">
                  PRINTWAY PRODUCT OPPORTUNITY HUB
                </span>
              </h2>
              <p className="mt-1.5 sm:mt-2 max-w-xl text-xs sm:text-sm text-[#94A3B8] px-2">
                AI Copilot tự động cào tín hiệu thị trường Etsy, Amazon & Pinterest, tính toán Opportunity Score và tự suy luận chiến lược R&D sản phẩm POD xưởng Printway.
              </p>

              {/* Quick Prompt Cards */}
              <div className="mt-4 sm:mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
                {QUICK_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPromptClick(p.query)}
                    className="group relative flex flex-col justify-between rounded-xl border border-[#00FF88]/20 bg-[#0E1538]/80 p-3 sm:p-4 transition-all duration-300 hover:border-[#00FF88] hover:bg-[#121A45] hover:shadow-[0_0_20px_rgba(0,255,136,0.2)] text-left cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-[#00FF88]/15 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30">
                          {p.badge}
                        </span>
                        <Zap className="h-3.5 w-3.5 text-[#00D2FF] opacity-70 group-hover:opacity-100 group-hover:text-[#00FF88] transition-colors" />
                      </div>
                      <h4 className="mt-2 text-xs sm:text-sm font-semibold text-white group-hover:text-[#00FF88] transition-colors">
                        {p.title}
                      </h4>
                    </div>
                    <p className="mt-1.5 sm:mt-2 line-clamp-2 text-[11px] sm:text-xs text-[#94A3B8]">
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
