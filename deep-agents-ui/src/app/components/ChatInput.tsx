"use client";

import React, { useState, useRef, useCallback, FormEvent } from "react";
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
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon
} from "lucide-react";
import { TodoItem } from "@/app/types/types";
import { cn } from "@/lib/utils";
import { FilesPopover } from "@/app/components/TasksFilesSidebar";
import { FilePreviewModal, UploadedFileItem } from "@/app/components/FilePreviewModal";

interface ChatInputProps {
  isLoading: boolean;
  submitDisabled: boolean;
  onSendMessage: (message: string) => void;
  onStopStream: () => void;
  todos: TodoItem[];
  files: Record<string, string>;
  setFiles: (files: Record<string, string>) => void;
  interrupt?: any;
  clarificationData: { question: string; options: string[] } | null;
  onClarificationSubmit: (response: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const getStatusIcon = (status: TodoItem["status"], className?: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle size={15} className={cn("text-[#00FF88]", className)} />;
    case "in_progress":
      return <Clock size={15} className={cn("text-amber-400 animate-spin", className)} />;
    default:
      return <Circle size={15} className={cn("text-slate-500", className)} />;
  }
};

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

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const tasksContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasTasks = todos.length > 0;
  const hasFiles = Object.keys(files).length > 0;

  const groupedTodos = React.useMemo(() => ({
    in_progress: todos.filter((t) => t.status === "in_progress"),
    pending: todos.filter((t) => t.status === "pending"),
    completed: todos.filter((t) => t.status === "completed"),
  }), [todos]);

  // Handle file uploading from file picker
  const handleFilesAdded = useCallback((fileList: FileList | File[]) => {
    Array.from(fileList).forEach((file) => {
      const isTextOrCsv = /\.(txt|csv|json|md|log|tsv)$/i.test(file.name);
      const isImage = file.type.startsWith("image/");

      const reader = new FileReader();
      if (isTextOrCsv) {
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
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const newItem: UploadedFileItem = {
            id: `file-${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type || (isImage ? "image/png" : "application/octet-stream"),
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

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      const messageText = input.trim();
      if ((!messageText && attachments.length === 0) || isLoading || submitDisabled) return;

      let fullMessage = messageText;

      // If attachments exist, format context for LLM
      if (attachments.length > 0) {
        const fileNames = attachments.map((a) => a.name).join(", ");
        const textSnippets = attachments
          .filter((a) => a.textPreview)
          .map((a) => `\n\n--- Dữ Liệu Tệp [${a.name}] ---\n${a.textPreview?.slice(0, 3000)}`)
          .join("");

        fullMessage = `[Tệp đính kèm: ${fileNames}]\n${messageText || "Hãy phân tích tệp đính kèm này."}${textSnippets}`;
      }

      setInput("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.value = "";
      }
      onSendMessage(fullMessage);
    },
    [input, attachments, isLoading, onSendMessage, submitDisabled]
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
      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewingFile}
        onClose={() => setPreviewingFile(null)}
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json"
        className="hidden"
        onChange={handleFileInputChange}
      />

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
                      className="flex items-center gap-2 text-left text-xs font-semibold text-white hover:text-[#00FF88] transition-colors cursor-pointer"
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
                      className="flex items-center gap-1.5 text-xs text-[#00D2FF] hover:underline cursor-pointer"
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
                  <div className="flex items-center justify-between border-b border-[#00FF88]/20 bg-[#0E1538] px-4 py-2 text-xs">
                    <div className="flex items-center gap-3">
                      {hasTasks && (
                        <button
                          type="button"
                          onClick={() => setMetaOpen("tasks")}
                          className={cn(
                            "font-bold transition-colors pb-0.5 cursor-pointer",
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
                            "font-bold transition-colors pb-0.5 cursor-pointer",
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
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Đóng</span>
                      <ChevronUp size={14} />
                    </button>
                  </div>

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

              {clarificationData.options.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {clarificationData.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleClarificationSend(opt)}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500 hover:text-[#080B21] transition-all shadow-[0_0_10px_rgba(245,158,11,0.1)] cursor-pointer"
                    >
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
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
                  className="flex-1 rounded-xl border border-amber-500/30 bg-[#080B21] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none shadow-inner"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleClarificationSend(clarificationInput)}
                  disabled={!clarificationInput.trim()}
                  className="rounded-xl border border-amber-400 bg-amber-400 px-4 py-2 text-xs font-bold text-[#080B21] hover:bg-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all cursor-pointer"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Gửi Phản Hồi
                </Button>
              </div>
            </div>
          )}

          {/* UPLOADED ATTACHMENTS LIST CHIPS */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2 border-b border-[#00FF88]/10 bg-[#0A0E2A]/50">
              {attachments.map((file) => {
                const isImg = file.type.startsWith("image/");
                return (
                  <div
                    key={file.id}
                    onClick={() => setPreviewingFile(file)}
                    className="group flex items-center gap-2 rounded-xl border border-[#00FF88]/30 bg-[#0E1538] px-2.5 py-1.5 shadow-[0_0_12px_rgba(0,255,136,0.1)] hover:border-[#00FF88] hover:bg-[#121A45] transition-all cursor-pointer"
                    title="Bấm vào để xem trước file"
                  >
                    {isImg ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="h-7 w-7 rounded-lg object-cover border border-[#00FF88]/30"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#080B21] border border-slate-800 text-[#00FF88]">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className="flex flex-col truncate max-w-[140px]">
                      <span className="text-[11px] font-semibold text-white truncate">
                        {file.name}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttachments((prev) => prev.filter((a) => a.id !== file.id));
                      }}
                      className="rounded-full p-0.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                      title="Gỡ tệp"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Prompt Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isLoading ? "AI đang cào dữ liệu Etsy, Amazon & tự suy luận chiến lược..." : "Nhập ý tưởng sản phẩm, từ khóa POD hoặc đính kèm ảnh/tài liệu để phân tích..."}
              className="font-inherit field-sizing-content flex-1 resize-none border-0 bg-transparent px-[18px] pb-[13px] pt-[14px] text-sm leading-relaxed text-white outline-none placeholder:text-[#64748B]"
              rows={1}
            />
            <div className="flex justify-between items-center gap-2 px-4 py-2.5 bg-[#0A0E2A]/50 border-t border-[#00FF88]/10">
              {/* Attachment Button */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-[#00FF88] hover:bg-[#121A45] border border-transparent hover:border-[#00FF88]/30 transition-all cursor-pointer"
                  title="Đính kèm ảnh hoặc tài liệu (PDF, CSV, TXT, JSON, DOCX)"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                {attachments.length > 0 && (
                  <span className="text-[11px] text-[#00FF88] font-semibold">
                    {attachments.length} tệp đính kèm
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
                className="rounded-lg border border-[#00FF88] bg-[#00FF88] px-4 py-1.5 text-xs font-bold text-[#080B21] hover:bg-[#00FF88]/85 hover:shadow-[0_0_15px_rgba(0,255,136,0.6)] transition-all cursor-pointer"
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
    </>
  );
});

ChatInput.displayName = "ChatInput";
