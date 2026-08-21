"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  FormEvent,
  Fragment,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Square,
  ArrowUp,
  CheckCircle,
  Clock,
  Circle,
  FileIcon,
  Sparkles,
  Zap,
  Loader2,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Send,
  MessageCircleQuestion
} from "lucide-react";
import { ChatMessage } from "@/app/components/ChatMessage";
import type {
  TodoItem,
  ToolCall,
  ActionRequest,
  ReviewConfig,
} from "@/app/types/types";
import { Assistant, Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent } from "@/app/utils/utils";
import { useChatContext } from "@/providers/ChatProvider";
import { cn } from "@/lib/utils";
import { useStickToBottom } from "use-stick-to-bottom";
import { FilesPopover } from "@/app/components/TasksFilesSidebar";

interface ChatInterfaceProps {
  assistant: Assistant | null;
}

const getStatusIcon = (status: TodoItem["status"], className?: string) => {
  switch (status) {
    case "completed":
      return (
        <CheckCircle
          size={15}
          className={cn("text-[#00FF88]", className)}
        />
      );
    case "in_progress":
      return (
        <Clock
          size={15}
          className={cn("text-amber-400 animate-spin", className)}
        />
      );
    default:
      return (
        <Circle
          size={15}
          className={cn("text-slate-500", className)}
        />
      );
  }
};

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
  const [metaOpen, setMetaOpen] = useState<"tasks" | "files" | null>(null);
  const tasksContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [input, setInput] = useState("");
  const { scrollRef, contentRef } = useStickToBottom();

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

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      const messageText = input.trim();
      if (!messageText || isLoading || submitDisabled) return;
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }
      sendMessage(messageText);
    },
    [input, isLoading, sendMessage, setInput, submitDisabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleQuickPromptClick = useCallback(
    (query: string) => {
      if (isLoading || submitDisabled) return;
      sendMessage(query);
    },
    [isLoading, sendMessage, submitDisabled]
  );

  // Listen for 1-click follow-up prompt events from SuggestedQuestionsRenderer
  React.useEffect(() => {
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
        const toolCallsInMessage = message.tool_calls || [];
        const isInterruptedMessage =
          interrupt &&
          (interrupt.value as any)?.action_requests?.some(
            (actionRequest: ActionRequest) =>
              toolCallsInMessage.some(
                (tc: { id?: string }) => tc.id === actionRequest.name
              )
          );
        if (toolCallsInMessage.length === 0 && isInterruptedMessage) {
          return;
        }
        const toolCallsWithStatus = toolCallsInMessage.map(
          (toolCall: {
            id?: string;
            function?: { name?: string; arguments?: unknown };
            name?: string;
            type?: string;
            args?: unknown;
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

  const groupedTodos = {
    in_progress: todos.filter((t) => t.status === "in_progress"),
    pending: todos.filter((t) => t.status === "pending"),
    completed: todos.filter((t) => t.status === "completed"),
  };

  const hasTasks = todos.length > 0;
  const hasFiles = Object.keys(files).length > 0;

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
  const [clarificationInput, setClarificationInput] = useState("");
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
      setClarificationInput("");
    },
    [resumeInterrupt, sendMessage]
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#080B21]">
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-pretty"
        ref={scrollRef}
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
            /* Cross Border AI Summit 2026 Welcome Hero Section */
            <div className="my-6 flex flex-col items-center justify-center text-center">
              {/* Banner Image */}
              <div className="relative mb-6 w-full overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538]/90 shadow-[0_0_30px_rgba(0,255,136,0.2)]">
                <img
                  src="/banner_crossborder.png"
                  alt="Cross Border AI Innovation Summit 2026"
                  className="h-auto w-full max-h-[220px] object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080B21] via-transparent to-transparent"></div>
              </div>

              {/* Title & Tagline */}
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
                    className="group relative flex flex-col justify-between rounded-xl border border-[#00FF88]/20 bg-[#0E1538]/70 p-4 transition-all duration-200 hover:border-[#00FF88] hover:bg-[#121A45] hover:shadow-[0_0_20px_rgba(0,255,136,0.25)]"
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

      {/* Input Box with Tasks & Files Drawer */}
      <div className="flex-shrink-0 bg-transparent px-4 pb-5 pt-2">
        <div
          className={cn(
            "mx-auto flex flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538]/90 shadow-[0_0_20px_rgba(0,255,136,0.15)] backdrop-blur-md",
            "w-full max-w-[1024px] transition-all duration-200 ease-in-out focus-within:border-[#00FF88] focus-within:shadow-[0_0_25px_rgba(0,255,136,0.3)]"
          )}
        >
          {/* Tasks & Files Trigger Bar */}
          {(hasTasks || hasFiles) && (
            <div className="flex flex-col border-b border-[#00FF88]/20 bg-[#0A0E2A]">
              {/* Closed State Header / Trigger */}
              {!metaOpen && (
                <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5">
                  {hasTasks && (
                    <button
                      type="button"
                      onClick={() => setMetaOpen("tasks")}
                      className="flex items-center gap-2 text-left text-xs font-semibold text-white hover:text-[#00FF88] transition-colors"
                    >
                      {todos.length === groupedTodos.completed.length ? (
                        <CheckCircle size={15} className="text-[#00FF88]" />
                      ) : (
                        <Clock size={15} className="text-amber-400 animate-spin" />
                      )}
                      <span>
                        Tasks: {groupedTodos.completed.length}/{todos.length} hoàn thành
                      </span>
                      <ChevronDown size={14} className="text-[#00FF88]" />
                    </button>
                  )}

                  {hasFiles && (
                    <button
                      type="button"
                      onClick={() => setMetaOpen("files")}
                      className="flex items-center gap-1.5 text-xs text-[#00D2FF] hover:underline"
                    >
                      <FileIcon size={14} />
                      Files ({Object.keys(files).length})
                      <ChevronDown size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Opened Drawer State */}
              {metaOpen && (
                <div className="flex flex-col">
                  {/* Drawer Tabs */}
                  <div className="flex items-center justify-between border-b border-[#00FF88]/20 bg-[#0E1538] px-4 py-2 text-xs">
                    <div className="flex items-center gap-3">
                      {hasTasks && (
                        <button
                          type="button"
                          onClick={() => setMetaOpen("tasks")}
                          className={cn(
                            "font-bold transition-colors pb-0.5",
                            metaOpen === "tasks"
                              ? "text-[#00FF88] border-b-2 border-[#00FF88]"
                              : "text-[#94A3B8] hover:text-white"
                          )}
                        >
                          Research Plan ({todos.length})
                        </button>
                      )}
                      {hasFiles && (
                        <button
                          type="button"
                          onClick={() => setMetaOpen("files")}
                          className={cn(
                            "font-bold transition-colors pb-0.5",
                            metaOpen === "files"
                              ? "text-[#00D2FF] border-b-2 border-[#00D2FF]"
                              : "text-[#94A3B8] hover:text-white"
                          )}
                        >
                          State Files ({Object.keys(files).length})
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMetaOpen(null)}
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                    >
                      <span>Đóng</span>
                      <ChevronUp size={14} />
                    </button>
                  </div>

                  {/* Drawer Content */}
                  <div
                    ref={tasksContainerRef}
                    className="max-h-60 overflow-y-auto px-4 py-3 text-xs"
                  >
                    {metaOpen === "tasks" && (
                      <div className="space-y-3">
                        {Object.entries(groupedTodos)
                          .filter(([_, tList]) => tList.length > 0)
                          .map(([status, tList]) => (
                            <div key={status} className="space-y-1.5">
                              <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">
                                {status === "in_progress"
                                  ? "⚡ Đang thực thi"
                                  : status === "completed"
                                  ? "✅ Đã hoàn thành"
                                  : "⏳ Chờ xử lý"}
                              </h5>
                              <div className="space-y-1 rounded-lg border border-[#00FF88]/15 bg-[#080B21]/70 p-2">
                                {tList.map((todo, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-2 text-slate-200"
                                  >
                                    <div className="mt-0.5">
                                      {getStatusIcon(todo.status)}
                                    </div>
                                    <span className="leading-relaxed">
                                      {todo.content}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {metaOpen === "files" && (
                      <div className="py-1">
                        <FilesPopover
                          files={files}
                          setFiles={setFiles}
                          editDisabled={
                            isLoading === true || interrupt !== undefined
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PINNED CLARIFICATION / HANDOFF TO USER DRAWER RIGHT ABOVE PROMPT INPUT */}
          {clarificationData && (
            <div className="border-b border-amber-500/30 bg-[#0E1538] p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                    <HelpCircle className="h-3.5 w-3.5 text-[#080B21]" />
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    AI Copilot Cần Làm Rõ Thông Tin (Handoff To User)
                  </span>
                </div>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/40 animate-pulse">
                  Chờ phản hồi của bạn
                </span>
              </div>

              <p className="text-sm font-medium text-slate-100 mb-3 leading-relaxed">
                {clarificationData.question}
              </p>

              {/* Quick Select Option Pills if available */}
              {clarificationData.options.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {clarificationData.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleClarificationSubmit(opt)}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500 hover:text-[#080B21] transition-all shadow-[0_0_10px_rgba(245,158,11,0.1)] cursor-pointer"
                    >
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Dedicated Clarification Reply Input & Send Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={clarificationInput}
                  onChange={(e) => setClarificationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleClarificationSubmit(clarificationInput);
                    }
                  }}
                  placeholder="Nhập câu trả lời hoặc làm rõ yêu cầu của bạn..."
                  className="flex-1 rounded-xl border border-amber-500/30 bg-[#080B21] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none shadow-inner"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleClarificationSubmit(clarificationInput)}
                  disabled={!clarificationInput.trim()}
                  className="rounded-xl border border-amber-400 bg-amber-400 px-4 py-2 text-xs font-bold text-[#080B21] hover:bg-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Gửi Phản Hồi
                </Button>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex flex-col"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "AI đang cào dữ liệu Etsy, Amazon & tự suy luận chiến lược..." : "Nhập ý tưởng sản phẩm, từ khóa POD hoặc hỏi chiến lược R&D (ví dụ: Personalized Grandpa Acrylic Ornament)..."}
              className="font-inherit field-sizing-content flex-1 resize-none border-0 bg-transparent px-[18px] pb-[13px] pt-[14px] text-sm leading-relaxed text-white outline-none placeholder:text-[#64748B]"
              rows={1}
            />
            <div className="flex justify-end items-center gap-2 px-4 py-2.5 bg-[#0A0E2A]/50 border-t border-[#00FF88]/10">
              <Button
                type={isLoading ? "button" : "submit"}
                variant={isLoading ? "destructive" : "default"}
                size="sm"
                onClick={isLoading ? stopStream : undefined}
                disabled={submitDisabled && !isLoading}
                className="rounded-lg border border-[#00FF88] bg-[#00FF88] px-4 py-1.5 text-xs font-bold text-[#080B21] hover:bg-[#00FF88]/85 hover:shadow-[0_0_15px_rgba(0,255,136,0.6)] transition-all"
              >
                {isLoading ? (
                  <>
                    <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    Stop
                  </>
                ) : (
                  <>
                    <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                    Analyze Product
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

ChatInterface.displayName = "ChatInterface";
