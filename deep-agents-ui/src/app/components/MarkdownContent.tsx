"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CyberpunkChartRenderer } from "@/app/components/CyberpunkChartRenderer";
import { SuggestedQuestionsRenderer } from "@/app/components/SuggestedQuestionsRenderer";
import { Sparkles, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent = React.memo<MarkdownContentProps>(
  ({ content, className }) => {
    return (
      <div
        className={cn(
          "prose prose-invert max-w-none break-words text-sm leading-relaxed",
          "prose-headings:font-bold prose-headings:tracking-tight",
          "prose-h1:text-xl prose-h1:text-[#00FF88] prose-h1:border-b prose-h1:border-[#00FF88]/30 prose-h1:pb-2",
          "prose-h2:text-lg prose-h2:text-[#00D2FF] prose-h2:mt-4",
          "prose-h3:text-base prose-h3:text-white prose-h3:mt-3",
          "prose-p:text-slate-200 prose-p:my-2",
          "prose-strong:text-white prose-strong:font-bold",
          "prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5",
          "prose-li:my-0.5 prose-li:text-slate-300",
          "prose-table:w-full prose-table:my-4 prose-table:border-collapse prose-table:rounded-xl prose-table:overflow-hidden",
          "prose-th:bg-[#0E1538] prose-th:text-[#00FF88] prose-th:p-2.5 prose-th:text-xs prose-th:font-bold prose-th:border prose-th:border-slate-800",
          "prose-td:p-2.5 prose-td:text-xs prose-td:text-slate-300 prose-td:border prose-td:border-slate-800/80",
          "prose-tr:even:bg-[#080B21]/50 prose-tr:hover:bg-[#0E1538]/60 prose-tr:transition-colors",
          "prose-blockquote:border-l-4 prose-blockquote:border-[#00FF88] prose-blockquote:bg-[#0E1538]/60 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-xl prose-blockquote:text-slate-300",
          "prose-a:text-[#00D2FF] prose-a:underline hover:prose-a:text-[#00FF88] prose-a:transition-colors",
          className
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({
              inline,
              className,
              children,
              ...props
            }: {
              inline?: boolean;
              className?: string;
              children?: React.ReactNode;
            }) {
              const match = /language-([\w:-]+)/.exec(className || "");
              const lang = match ? match[1].toLowerCase() : "";
              const codeStr = String(children).replace(/\n$/, "");

              // Intercept chart code blocks for visual rendering
              if (!inline && (lang === "chart" || lang.startsWith("chart:") || lang === "radar" || lang === "gauge")) {
                return <CyberpunkChartRenderer code={codeStr} />;
              }

              // Intercept suggestions / follow-up question blocks for interactive action chips
              if (!inline && (lang === "suggestions" || lang.startsWith("suggestion") || lang === "followup" || lang === "questions")) {
                return <SuggestedQuestionsRenderer code={codeStr} />;
              }

              return !inline && match ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={lang}
                  PreTag="div"
                  className="max-w-full rounded-xl text-xs border border-slate-800"
                  wrapLines={true}
                  wrapLongLines={true}
                  lineProps={{
                    style: {
                      wordBreak: "break-all",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                    },
                  }}
                  customStyle={{
                    margin: 0,
                    maxWidth: "100%",
                    overflowX: "auto",
                    fontSize: "0.82rem",
                    backgroundColor: "#060919",
                    padding: "1rem",
                  }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              ) : (
                <code
                  className="bg-[#121A45] text-[#00FF88] rounded px-1.5 py-0.5 font-mono text-[0.88em] border border-[#00FF88]/20"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            img({ src, alt, ...props }: { src?: string; alt?: string }) {
              if (!src) return null;
              return (
                <div
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("open-image-lightbox", {
                          detail: { imageUrl: src, alt: alt || "Product Visual Design" },
                        })
                      );
                    }
                  }}
                  className="group relative my-4 overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] shadow-[0_0_30px_rgba(0,255,136,0.15)] transition-all duration-300 hover:border-[#00FF88] hover:shadow-[0_0_40px_rgba(0,255,136,0.35)] cursor-pointer"
                >
                  <img
                    src={src}
                    alt={alt || "Product Design"}
                    className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    {...props}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080B21]/90 via-[#080B21]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#00FF88]" />
                      {alt || "Xem phóng to & thông số xưởng Printway"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-[#00FF88] text-[#080B21] px-2.5 py-1 text-[11px] font-bold shadow-lg">
                      <ZoomIn className="h-3 w-3" />
                      Phóng to
                    </span>
                  </div>
                </div>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownContent.displayName = "MarkdownContent";
