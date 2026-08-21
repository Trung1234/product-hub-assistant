"use client";

import React, { useState, useRef, useCallback, FormEvent, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Square,
  ArrowUp,
  CheckCircle,
  Clock,
  Circle,
  FileIcon,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Send,
  Paperclip,
  Mic,
  MicOff,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { TodoItem } from "@/app/types/types";
import { cn } from "@/lib/utils";
import { FilesPopover } from "@/app/components/TasksFilesSidebar";
import type { UploadedFileItem } from "@/app/components/FilePreviewModal";

const FilePreviewModal = dynamic(
  () => import("@/app/components/FilePreviewModal").then((m) => m.FilePreviewModal),
  { ssr: false }
);

interface ChatInputProps {
  isLoading: boolean;
  submitDisabled: boolean;
  onSendMessage: (message: string | any[]) => void;
  onStopStream: () => void;
  todos: TodoItem[];
  files: Record<string, string>;
  setFiles: (files: Record<string, string>) => Promise<void> | void;
  interrupt?: any;
  clarificationData: { question: string; options: string[] } | null;
  onClarificationSubmit: (response: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusIcon(status: TodoItem["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle size={14} className="text-[#00FF88] shrink-0" />;
    case "in_progress":
      return <Clock size={14} className="text-amber-400 animate-spin shrink-0" />;
    default:
      return <Circle size={12} className="text-slate-500 shrink-0" />;
  }
}

export const ChatInput = React.memo<ChatInputProps>(({
  isLoading,
  submitDisabled,
  onSendMessage,
  onStopStream,
  todos,
  files,
  setFiles,
  interrupt,
  clarificationData,
  onClarificationSubmit,
}) => {
  const [input, setInput] = useState("");
  const [clarificationInput, setClarificationInput] = useState("");
  const [metaOpen, setMetaOpen] = useState<"tasks" | "files" | null>(null);
  const [attachments, setAttachments] = useState<UploadedFileItem[]>([]);
  const [previewingFile, setPreviewingFile] = useState<UploadedFileItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Real-time LLM-generated dynamic completion
  const [llmSuggestion, setLlmSuggestion] = useState<string>("");
  const [isLlmFetching, setIsLlmFetching] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const tasksContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói Web Speech.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Đang lắng nghe giọng nói... Hãy nói từ khóa hoặc ý tưởng POD của bạn.");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          toast.success("Đã ghi nhận giọng nói!");
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition init error:", err);
      setIsListening(false);
    }
  }, [isListening]);

  const hasTasks = todos.length > 0;
  const hasFiles = Object.keys(files).length > 0;

  // Real-time Dynamic LLM Autocomplete Effect
  useEffect(() => {
    const trimmed = input.trim();
    if (suggestionDismissed || trimmed.length < 3) {
      setLlmSuggestion("");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/prompt-autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: trimmed }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.completion && typeof data.completion === "string" && data.completion.trim().length > trimmed.length) {
            setLlmSuggestion(data.completion.trim());
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Dynamic LLM autocomplete error:", err);
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, suggestionDismissed]);

  const activeSuggestion = useMemo(() => {
    if (suggestionDismissed) return null;
    if (llmSuggestion && llmSuggestion.length > input.trim().length) {
      return llmSuggestion;
    }
    return null;
  }, [llmSuggestion, input, suggestionDismissed]);

  const ghostSuffix = useMemo(() => {
    if (!activeSuggestion) return "";
    if (activeSuggestion.toLowerCase().startsWith(input.toLowerCase())) {
      return activeSuggestion.slice(input.length);
    }
    return "";
  }, [activeSuggestion, input]);

  const groupedTodos = React.useMemo(() => ({
    in_progress: todos.filter((t) => t.status === "in_progress"),
    pending: todos.filter((t) => t.status === "pending"),
    completed: todos.filter((t) => t.status === "completed"),
  }), [todos]);

  // Handle file uploading from file picker, drag-and-drop, or paste
  const handleFilesAdded = useCallback((fileList: FileList | File[]) => {
    Array.from(fileList).forEach((file) => {
      const isTextOrCsv = /\.(txt|csv|json|md|log|tsv)$/i.test(file.name);
      const isImage = file.type.startsWith("image/");

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const newItem: UploadedFileItem = {
            id: `file-${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type || "image/png",
            url: dataUrl,
          };
          setAttachments((prev) => [...prev, newItem]);
        };
        reader.readAsDataURL(file);
      } else if (isTextOrCsv) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const newItem: UploadedFileItem = {
            id: `file-${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type || "text/plain",
            url: URL.createObjectURL(file),
            textPreview: text,
          };
          setAttachments((prev) => [...prev, newItem]);
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const newItem: UploadedFileItem = {
            id: `file-${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            url: dataUrl || URL.createObjectURL(file),
          };
          setAttachments((prev) => [...prev, newItem]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
      e.target.value = "";
    }
  };

  // Support pasting image / document from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleFilesAdded(e.clipboardData.files);
    }
  }, [handleFilesAdded]);

  // Support Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleAcceptSuggestion = useCallback(() => {
    if (activeSuggestion) {
      setInput(activeSuggestion);
      setSuggestionDismissed(true);
      setLlmSuggestion("");
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [activeSuggestion]);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      const messageText = input.trim();
      if ((!messageText && attachments.length === 0) || isLoading || submitDisabled) return;

      const imageAttachments = attachments.filter(
        (a) => a.type?.startsWith("image/") || a.url?.startsWith("data:image/")
      );
      const docAttachments = attachments.filter(
        (a) => !imageAttachments.includes(a)
      );

      let textContent = messageText;
      if (docAttachments.length > 0) {
        const textSnippets = docAttachments
          .filter((a) => a.textPreview)
          .map((a) => `\n\n--- Dữ Liệu Tệp [${a.name}] ---\n${a.textPreview?.slice(0, 5000)}`)
          .join("");
        const docNames = docAttachments.map((a) => a.name).join(", ");
        textContent = `[Tệp tài liệu: ${docNames}]\n${messageText || "Hãy phân tích tài liệu đính kèm này."}${textSnippets}`;
      }

      setInput("");
      setAttachments([]);
      setSuggestionDismissed(false);
      setLlmSuggestion("");
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }

      // If images exist: send true multimodal payload to LLM
      if (imageAttachments.length > 0) {
        const promptText = textContent || "Hãy xem kỹ hình ảnh sản phẩm đính kèm này và phân tích chi tiết: tên sản phẩm, chất liệu xưởng Printway, tiềm năng bán trên Etsy/Amazon/TikTok Shop, giá bán đề xuất và biên lợi nhuận.";
        const contentArray: any[] = [
          {
            type: "text",
            text: promptText,
          },
        ];

        imageAttachments.forEach((img) => {
          if (img.url) {
            contentArray.push({
              type: "image_url",
              image_url: {
                url: img.url,
              },
            });
          }
        });

        onSendMessage(contentArray);
      } else {
        onSendMessage(textContent);
      }
    },
    [input, attachments, isLoading, onSendMessage, submitDisabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // TAB key: Accept Dynamic LLM Auto-Complete Suggestion
      if (e.key === "Tab" && activeSuggestion && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleAcceptSuggestion();
        return;
      }

      // Escape key: Dismiss Suggestion
      if (e.key === "Escape" && activeSuggestion) {
        e.preventDefault();
        setSuggestionDismissed(true);
        setLlmSuggestion("");
        return;
      }

      // Enter key: Submit
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }
    },
    [handleSubmit, activeSuggestion, handleAcceptSuggestion]
  );

  const handleClarificationSend = useCallback(
    (responseVal: string) => {
      const clean = responseVal.trim();
      if (!clean) return;
      onClarificationSubmit(clean);
      setClarificationInput("");
    },
    [onClarificationSubmit]
  );

  return (
    <>
      {/* File Preview Modal - Mounted conditionally on demand */}
      {previewingFile && (
        <FilePreviewModal
          file={previewingFile}
          onClose={() => setPreviewingFile(null)}
        />
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="flex-shrink-0 bg-transparent px-2.5 sm:px-4 pb-3 sm:pb-5 pt-1.5 sm:pt-2">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "mx-auto flex flex-shrink-0 flex-col overflow-hidden rounded-2xl border bg-[#0E1538]/90 shadow-[0_0_20px_rgba(0,255,136,0.15)] backdrop-blur-md",
            isDragging
              ? "border-[#00FF88] shadow-[0_0_35px_rgba(0,255,136,0.4)] bg-[#121A45]"
              : "border-[#00FF88]/30 focus-within:border-[#00FF88] focus-within:shadow-[0_0_25px_rgba(0,255,136,0.3)]",
            "w-full max-w-[1024px] transition-all duration-200 ease-in-out relative"
          )}
        >
          {/* Drag Overlay Hint */}
          {isDragging && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#080B21]/90 backdrop-blur-sm pointer-events-none p-4 text-center">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#00FF88] animate-bounce">
                <Paperclip className="h-4 sm:h-5 w-4 sm:w-5 shrink-0" />
                <span>Thả ảnh hoặc tài liệu vào đây để đính kèm</span>
              </div>
            </div>
          )}

          {/* Tasks & Files Trigger Bar */}
          {(hasTasks || hasFiles) && (
            <div className="flex flex-col border-b border-[#00FF88]/20 bg-[#0A0E2A]">
              {/* Closed State Header / Trigger */}
              {!metaOpen && (
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 gap-2 overflow-hidden">
                  {hasTasks && (
                    <button
                      type="button"
                      onClick={() => setMetaOpen("tasks")}
                      className="flex items-center gap-1.5 sm:gap-2 text-left text-[11px] sm:text-xs font-semibold text-white hover:text-[#00FF88] transition-colors cursor-pointer truncate"
                    >
                      {todos.length === groupedTodos.completed.length ? (
                        <CheckCircle size={14} className="text-[#00FF88] shrink-0" />
                      ) : (
                        <Clock size={14} className="text-amber-400 animate-spin shrink-0" />
                      )}
                      <span className="truncate">
                        Nhiệm vụ: {groupedTodos.completed.length}/{todos.length} xong
                      </span>
                      <ChevronDown size={13} className="text-[#00FF88] shrink-0" />
                    </button>
                  )}

                  {hasFiles && (
                    <button
                      type="button"
                      onClick={() => setMetaOpen("files")}
                      className="flex items-center gap-1 text-[11px] sm:text-xs text-[#00D2FF] hover:underline cursor-pointer shrink-0"
                    >
                      <FileIcon size={13} />
                      <span>Tệp ({Object.keys(files).length})</span>
                      <ChevronDown size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Opened Drawer State */}
              {metaOpen && (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between border-b border-[#00FF88]/20 bg-[#0E1538] px-3 sm:px-4 py-2 text-xs">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {hasTasks && (
                        <button
                          type="button"
                          onClick={() => setMetaOpen("tasks")}
                          className={cn(
                            "font-bold transition-colors pb-0.5 cursor-pointer text-xs truncate",
                            metaOpen === "tasks"
                              ? "text-[#00FF88] border-b-2 border-[#00FF88]"
                              : "text-[#94A3B8] hover:text-white"
                          )}
                        >
                          Kế hoạch R&D ({todos.length})
                        </button>
                      )}
                      {hasFiles && (
                        <button
                          type="button"
                          onClick={() => setMetaOpen("files")}
                          className={cn(
                            "font-bold transition-colors pb-0.5 cursor-pointer text-xs truncate",
                            metaOpen === "files"
                              ? "text-[#00D2FF] border-b-2 border-[#00D2FF]"
                              : "text-[#94A3B8] hover:text-white"
                          )}
                        >
                          Tệp ({Object.keys(files).length})
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMetaOpen(null)}
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 text-xs"
                    >
                      <span>Đóng</span>
                      <ChevronUp size={13} />
                    </button>
                  </div>

                  <div
                    ref={tasksContainerRef}
                    className="max-h-60 overflow-y-auto px-3 sm:px-4 py-2.5 sm:py-3 text-xs"
                  >
                    {metaOpen === "tasks" && (
                      <div className="space-y-2">
                        {todos.map((todo, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 rounded-lg bg-[#080B21]/60 p-2 border border-slate-800 text-xs"
                          >
                            <span className="mt-0.5">{getStatusIcon(todo.status)}</span>
                            <span className="text-slate-200 leading-relaxed break-words flex-1">
                              {todo.content}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {metaOpen === "files" && (
                      <div className="max-h-48 overflow-y-auto">
                        <FilesPopover
                          files={files}
                          setFiles={async (f) => {
                            await Promise.resolve(setFiles(f));
                          }}
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
            <div className="border-b border-amber-500/30 bg-[#0E1538] p-3 sm:p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] shrink-0">
                    <HelpCircle className="h-3.5 w-3.5 text-[#080B21]" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    AI Copilot Cần Làm Rõ Thông Tin
                  </span>
                </div>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-400 border border-amber-500/40 animate-pulse">
                  Chờ bạn chọn hoặc phản hồi
                </span>
              </div>

              <p className="text-xs sm:text-sm font-medium text-slate-100 mb-3 leading-relaxed">
                {clarificationData.question}
              </p>

              {clarificationData.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                  {clarificationData.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleClarificationSend(opt)}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-amber-300 hover:bg-amber-500 hover:text-[#080B21] transition-all shadow-[0_0_10px_rgba(245,158,11,0.1)] cursor-pointer text-left"
                    >
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={clarificationInput}
                  onChange={(e) => setClarificationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleClarificationSend(clarificationInput);
                    }
                  }}
                  placeholder="Nhập câu trả lời hoặc làm rõ yêu cầu của bạn..."
                  className="flex-1 rounded-xl border border-amber-500/30 bg-[#080B21] px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none shadow-inner"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleClarificationSend(clarificationInput)}
                  disabled={!clarificationInput.trim()}
                  className="rounded-xl border border-amber-400 bg-amber-400 px-4 py-2 text-xs font-bold text-[#080B21] hover:bg-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all cursor-pointer shrink-0"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Gửi Phản Hồi
                </Button>
              </div>
            </div>
          )}

          {/* UPLOADED ATTACHMENTS LIST CHIPS */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-4 pt-2.5 pb-2 border-b border-[#00FF88]/10 bg-[#0A0E2A]/50 max-h-28 overflow-y-auto">
              {attachments.map((file) => {
                const isImg = file.type?.startsWith("image/") || file.url?.startsWith("data:image/");
                return (
                  <div
                    key={file.id}
                    onClick={() => setPreviewingFile(file)}
                    className="group flex items-center gap-2 rounded-xl border border-[#00FF88]/30 bg-[#0E1538] px-2 py-1 sm:px-2.5 sm:py-1.5 shadow-[0_0_12px_rgba(0,255,136,0.1)] hover:border-[#00FF88] hover:bg-[#121A45] transition-all cursor-pointer"
                    title="Bấm vào để xem trước file"
                  >
                    {isImg ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg object-cover border border-[#00FF88]/30 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-[#080B21] border border-slate-800 text-[#00FF88] shrink-0">
                        <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </div>
                    )}
                    <div className="flex flex-col truncate max-w-[110px] sm:max-w-[140px]">
                      <span className="text-[10px] sm:text-[11px] font-semibold text-white truncate">
                        {file.name}
                      </span>
                      <span className="text-[8px] sm:text-[9px] text-slate-400">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttachments((prev) => prev.filter((a) => a.id !== file.id));
                      }}
                      className="rounded-full p-0.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Gỡ tệp"
                    >
                      <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Prompt Form with Ghost Text Overlay */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col relative"
          >
            <div className="relative flex-1">
              {/* Ghost Text Overlay */}
              {ghostSuffix && (
                <div
                  className="pointer-events-none absolute inset-0 z-0 overflow-hidden px-3.5 sm:px-[18px] pb-3 sm:pb-[13px] pt-3 sm:pt-[14px] text-base sm:text-sm leading-relaxed whitespace-pre-wrap break-words font-inherit select-none"
                  aria-hidden="true"
                >
                  <span className="opacity-0">{input}</span>
                  <span className="text-slate-500/70 font-normal italic">
                    {ghostSuffix}
                  </span>
                </div>
              )}

              {/* Real Input Textarea: 16px on iOS to avoid auto-zoom */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setSuggestionDismissed(false);
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isLoading ? "AI đang cào dữ liệu Etsy, Amazon & tự suy luận chiến lược..." : "Nhập ý tưởng sản phẩm, từ khóa POD hoặc đính kèm ảnh..."}
                className="font-inherit field-sizing-content relative z-10 w-full resize-none border-0 bg-transparent px-3.5 sm:px-[18px] pb-3 sm:pb-[13px] pt-3 sm:pt-[14px] text-base sm:text-sm leading-relaxed text-white outline-none placeholder:text-[#64748B]"
                rows={1}
              />
            </div>

            {/* Bottom Bar: Action Tools & Suggestion Pill */}
            <div className="flex justify-between items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0A0E2A]/50 border-t border-[#00FF88]/10 relative z-20">
              {/* Left Side: Attachment & Voice Input Button & File Count */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#00FF88] hover:bg-[#121A45] border border-transparent hover:border-[#00FF88]/30 transition-all cursor-pointer"
                  title="Đính kèm ảnh hoặc tài liệu (PDF, CSV, TXT, JSON, DOCX)"
                  aria-label="Đính kèm ảnh hoặc tài liệu"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {/* Speech to text Voice Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer",
                    isListening
                      ? "border-rose-500/60 bg-rose-500/20 text-rose-400 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                      : "border-transparent text-slate-400 hover:text-[#00D2FF] hover:bg-[#121A45] hover:border-[#00D2FF]/30"
                  )}
                  title={isListening ? "Đang ghi âm (Bấm để dừng)" : "Nhập bằng giọng nói (Tiếng Việt / English)"}
                  aria-label="Nhập bằng giọng nói"
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>

                {attachments.length > 0 && (
                  <span className="text-[10px] sm:text-[11px] text-[#00FF88] font-semibold flex items-center gap-1 ml-1">
                    <CheckCircle className="h-3 w-3" />
                    {attachments.length} tệp
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type={isLoading ? "button" : "submit"}
                variant={isLoading ? "destructive" : "default"}
                size="sm"
                onClick={isLoading ? onStopStream : undefined}
                disabled={submitDisabled && !isLoading}
                className="rounded-lg border border-[#00FF88] bg-[#00FF88] px-3.5 sm:px-4 py-1.5 text-xs font-bold text-[#080B21] hover:bg-[#00FF88]/85 hover:shadow-[0_0_15px_rgba(0,255,136,0.6)] transition-all cursor-pointer shrink-0"
              >
                {isLoading ? (
                  <>
                    <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    Dừng
                  </>
                ) : (
                  <>
                    <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
                    Gửi
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
});

ChatInput.displayName = "ChatInput";
