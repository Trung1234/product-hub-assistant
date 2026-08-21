"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { FileText, Copy, Download, Edit, Save, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import type { FileItem } from "@/app/types/types";
import useSWRMutation from "swr/mutation";

const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  cpp: "cpp",
  c: "c",
  cs: "csharp",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  json: "json",
  xml: "xml",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  dockerfile: "dockerfile",
  makefile: "makefile",
};

export const FileViewDialog = React.memo<{
  file: FileItem | null;
  onSaveFile: (fileName: string, content: string) => Promise<void>;
  onClose: () => void;
  editDisabled: boolean;
}>(({ file, onSaveFile, onClose, editDisabled }) => {
  const [isEditingMode, setIsEditingMode] = useState(file === null);
  const [fileName, setFileName] = useState(String(file?.path || ""));
  const [fileContent, setFileContent] = useState(String(file?.content || ""));

  const fileUpdate = useSWRMutation(
    { kind: "files-update", fileName, fileContent },
    async ({ fileName, fileContent }) => {
      if (!fileName || !fileContent) return;
      return await onSaveFile(fileName, fileContent);
    },
    {
      onSuccess: () => setIsEditingMode(false),
      onError: (error) => toast.error(`Lưu tệp thất bại: ${error}`),
    }
  );

  useEffect(() => {
    setFileName(String(file?.path || ""));
    setFileContent(String(file?.content || ""));
    setIsEditingMode(file === null);
  }, [file]);

  const fileExtension = useMemo(() => {
    const fileNameStr = String(fileName || "");
    return fileNameStr.split(".").pop()?.toLowerCase() || "";
  }, [fileName]);

  const isMarkdown = useMemo(() => {
    return fileExtension === "md" || fileExtension === "markdown";
  }, [fileExtension]);

  const language = useMemo(() => {
    return LANGUAGE_MAP[fileExtension] || "text";
  }, [fileExtension]);

  const handleCopy = useCallback(() => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent);
      toast.success("Đã sao chép nội dung tệp");
    }
  }, [fileContent]);

  const handleDownload = useCallback(() => {
    if (fileContent && fileName) {
      const blob = new Blob([fileContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [fileContent, fileName]);

  const handleEdit = useCallback(() => {
    setIsEditingMode(true);
  }, []);

  const handleCancel = useCallback(() => {
    if (file === null) {
      onClose();
    } else {
      setFileName(String(file.path));
      setFileContent(String(file.content));
      setIsEditingMode(false);
    }
  }, [file, onClose]);

  const fileNameIsValid = useMemo(() => {
    return (
      fileName.trim() !== "" &&
      !fileName.includes("/") &&
      !fileName.includes(" ")
    );
  }, [fileName]);

  return (
    <Dialog
      open={true}
      onOpenChange={onClose}
    >
      <DialogContent className="flex h-[88vh] max-h-[88vh] w-[94vw] sm:min-w-[60vw] max-w-4xl flex-col p-4 sm:p-6 bg-[#0E1538] border-[#00FF88]/30 text-white rounded-2xl">
        <DialogTitle className="sr-only">
          {file?.path || "Tệp mới"}
        </DialogTitle>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex min-w-0 items-center gap-2 truncate max-w-[60%] sm:max-w-[70%]">
            <FileText className="text-[#00FF88] h-5 w-5 shrink-0" />
            {isEditingMode && file === null ? (
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Nhập tên tệp..."
                className="text-sm font-medium bg-[#080B21] border-slate-800 text-white"
                aria-invalid={!fileNameIsValid}
              />
            ) : (
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm sm:text-base font-medium text-[#00FF88]">
                {file?.path}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isEditingMode && (
              <>
                <Button
                  onClick={handleEdit}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-slate-300 hover:text-white"
                  disabled={editDisabled}
                >
                  <Edit
                    size={16}
                    className="mr-1"
                  />
                  Chỉnh sửa
                </Button>
                <Button
                  onClick={handleCopy}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-slate-300 hover:text-white"
                >
                  <Copy
                    size={16}
                    className="mr-1"
                  />
                  Sao chép
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-slate-300 hover:text-white"
                >
                  <Download
                    size={16}
                    className="mr-1"
                  />
                  Tải về
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {isEditingMode ? (
            <Textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder="Nhập nội dung tệp..."
              className="h-full min-h-[400px] resize-none font-mono text-sm bg-[#080B21] border-slate-800 text-white"
            />
          ) : (
            <ScrollArea className="bg-[#080B21] h-full rounded-md border border-slate-800/80">
              <div className="p-4">
                {fileContent ? (
                  isMarkdown ? (
                    <div className="rounded-md p-6">
                      <MarkdownContent content={fileContent} />
                    </div>
                  ) : (
                    <SyntaxHighlighter
                      language={language}
                      style={oneDark}
                      customStyle={{
                        margin: 0,
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                        backgroundColor: "#080B21"
                      }}
                      showLineNumbers
                      wrapLines={true}
                      lineProps={{
                        style: {
                          whiteSpace: "pre-wrap",
                        },
                      }}
                    >
                      {fileContent}
                    </SyntaxHighlighter>
                  )
                ) : (
                  <div className="flex items-center justify-center p-12">
                    <p className="text-sm text-slate-500">
                      Tệp rỗng
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
        {isEditingMode && (
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-800 pt-4">
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <X
                size={16}
                className="mr-1"
              />
              Hủy bỏ
            </Button>
            <Button
              onClick={() => fileUpdate.trigger()}
              size="sm"
              className="border border-[#00FF88] bg-[#00FF88] text-[#080B21] font-bold hover:bg-[#00FF88]/85"
              disabled={
                fileUpdate.isMutating ||
                !fileName.trim() ||
                !fileContent.trim() ||
                !fileNameIsValid
              }
            >
              {fileUpdate.isMutating ? (
                <Loader2
                  size={16}
                  className="mr-1 animate-spin"
                />
              ) : (
                <Save
                  size={16}
                  className="mr-1"
                />
              )}
              Lưu lại
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

FileViewDialog.displayName = "FileViewDialog";
