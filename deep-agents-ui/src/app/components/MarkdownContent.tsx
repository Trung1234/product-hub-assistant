"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { CyberpunkChartRenderer } from "@/app/components/CyberpunkChartRenderer";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent = React.memo<MarkdownContentProps>(
  ({ content, className = "" }) => {
    return (
      <div
        className={cn(
          "prose min-w-0 max-w-full overflow-hidden break-words text-sm leading-relaxed text-inherit",
          "prose-headings:text-white prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-slate-200 prose-strong:text-[#00FF88]",
          "[&_h1:first-child]:mt-0 [&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:font-bold",
          "[&_h2:first-child]:mt-0 [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:font-bold",
          "[&_h3:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-semibold",
          "[&_h4:first-child]:mt-0 [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:font-semibold",
          "[&_p:last-child]:mb-0 [&_p]:mb-3",
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
            pre({ children }: { children?: React.ReactNode }) {
              return (
                <div className="my-3 max-w-full overflow-hidden last:mb-0">
                  {children}
                </div>
              );
            },
            a({
              href,
              children,
            }: {
              href?: string;
              children?: React.ReactNode;
            }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00D2FF] font-semibold underline decoration-[#00D2FF]/40 underline-offset-2 hover:text-[#00FF88] hover:decoration-[#00FF88] transition-colors"
                >
                  {children}
                </a>
              );
            },
            blockquote({ children }: { children?: React.ReactNode }) {
              return (
                <blockquote className="my-4 rounded-xl border-l-4 border-[#00FF88] bg-[#0E1538]/70 p-3.5 text-slate-200 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
                  {children}
                </blockquote>
              );
            },
            ul({ children }: { children?: React.ReactNode }) {
              return (
                <ul className="my-3 space-y-1.5 pl-5 list-disc marker:text-[#00FF88]">
                  {children}
                </ul>
              );
            },
            ol({ children }: { children?: React.ReactNode }) {
              return (
                <ol className="my-3 space-y-1.5 pl-5 list-decimal marker:text-[#00D2FF]">
                  {children}
                </ol>
              );
            },
            table({ children }: { children?: React.ReactNode }) {
              return (
                <div className="my-4 overflow-x-auto rounded-xl border border-[#00FF88]/20 bg-[#0E1538]/80 shadow-[0_0_15px_rgba(0,255,136,0.08)]">
                  <table className="w-full border-collapse text-left text-xs">
                    {children}
                  </table>
                </div>
              );
            },
            thead({ children }: { children?: React.ReactNode }) {
              return (
                <thead className="border-b border-[#00FF88]/20 bg-[#121A45] text-[#00FF88] font-bold">
                  {children}
                </thead>
              );
            },
            tbody({ children }: { children?: React.ReactNode }) {
              return <tbody className="divide-y divide-[#00FF88]/10 text-slate-200">{children}</tbody>;
            },
            tr({ children }: { children?: React.ReactNode }) {
              return <tr className="hover:bg-[#121A45]/50 transition-colors">{children}</tr>;
            },
            th({ children }: { children?: React.ReactNode }) {
              return <th className="px-3.5 py-2.5 font-semibold text-[#00FF88]">{children}</th>;
            },
            td({ children }: { children?: React.ReactNode }) {
              return <td className="px-3.5 py-2.5">{children}</td>;
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
