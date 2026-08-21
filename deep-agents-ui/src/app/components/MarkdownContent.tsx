import React, { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, ZoomIn, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazily load heavy interactive widgets with cyberpunk neon skeleton fallbacks
const CyberpunkChartRenderer = dynamic(
  () => import("@/app/components/CyberpunkChartRenderer").then((m) => m.CyberpunkChartRenderer),
  {
    ssr: false,
    loading: () => (
      <div className="my-4 h-64 w-full animate-pulse rounded-2xl border border-[#00FF88]/20 bg-[#0E1538]/60 flex items-center justify-center">
        <span className="text-xs text-[#00FF88] font-mono">Đang tải biểu đồ 5D Radar...</span>
      </div>
    ),
  }
);

const ProfitCalculatorWidget = dynamic(
  () => import("@/app/components/InteractiveWidgets").then((m) => m.ProfitCalculatorWidget),
  {
    ssr: false,
    loading: () => (
      <div className="my-4 h-44 w-full animate-pulse rounded-2xl border border-[#00FF88]/20 bg-[#0E1538]/60 flex items-center justify-center">
        <span className="text-xs text-[#00FF88] font-mono">Đang tải bảng tính ROI & Lợi nhuận...</span>
      </div>
    ),
  }
);

const SeoTagsWidget = dynamic(
  () => import("@/app/components/InteractiveWidgets").then((m) => m.SeoTagsWidget),
  {
    ssr: false,
    loading: () => (
      <div className="my-4 h-28 w-full animate-pulse rounded-2xl border border-cyan-500/20 bg-[#0E1538]/60 flex items-center justify-center">
        <span className="text-xs text-cyan-400 font-mono">Đang tải 13 SEO Tags...</span>
      </div>
    ),
  }
);

const PrintwaySkuCardWidget = dynamic(
  () => import("@/app/components/InteractiveWidgets").then((m) => m.PrintwaySkuCardWidget),
  {
    ssr: false,
    loading: () => (
      <div className="my-4 h-36 w-full animate-pulse rounded-2xl border border-[#00FF88]/20 bg-[#0E1538]/60 flex items-center justify-center">
        <span className="text-xs text-[#00FF88] font-mono">Đang tải thông số xưởng Printway...</span>
      </div>
    ),
  }
);

const SuggestedQuestionsRenderer = dynamic(
  () => import("@/app/components/SuggestedQuestionsRenderer").then((m) => m.SuggestedQuestionsRenderer),
  { ssr: false }
);

interface MarkdownContentProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

/**
 * Throttles content updates during active LLM token streaming.
 * Batches incoming tokens to ~50ms intervals so React AST Remark parser
 * doesn't block the browser's main thread on every single character.
 */
function useThrottledContent(
  content: string,
  isStreaming?: boolean,
  throttleMs = 45
): string {
  const [throttled, setThrottled] = useState(content);
  const lastUpdateRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setThrottled(content);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    const scheduleUpdate = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        lastUpdateRef.current = Date.now();
        setThrottled(content);
      });
    };

    if (elapsed >= throttleMs) {
      scheduleUpdate();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(scheduleUpdate, throttleMs - elapsed);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [content, isStreaming, throttleMs]);

  return throttled;
}

// Lightweight, ultra-fast code renderer that avoids heavy Prism thread blocking during streaming
const FastCodeBlock = React.memo<{
  codeStr: string;
  lang: string;
}>(({ codeStr, lang }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-slate-800 bg-[#060919]">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#0A0E2A]/70 px-3 py-1.5 text-[11px] text-slate-400">
        <span className="font-mono text-[10px] uppercase font-bold text-[#00D2FF]">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[#00FF88]" />
              <span className="text-[#00FF88]">Đã sao chép</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
        {codeStr}
      </pre>
    </div>
  );
});

FastCodeBlock.displayName = "FastCodeBlock";

export const MarkdownContent = React.memo<MarkdownContentProps>(
  ({ content, className, isStreaming }) => {
    // Throttle content parsing during streaming
    const displayContent = useThrottledContent(content, isStreaming, 50);

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

              // 1. Chart Widgets (Radar, Gauge, Horizontal Bars)
              if (
                !inline &&
                (lang === "chart" ||
                  lang.startsWith("chart:") ||
                  lang === "radar" ||
                  lang === "gauge")
              ) {
                return <CyberpunkChartRenderer code={codeStr} />;
              }

              // 2. Interactive Profit & Break-Even Calculator Widget
              if (
                !inline &&
                (lang === "profit_calc" ||
                  lang === "calculator" ||
                  lang === "calc" ||
                  lang === "profit")
              ) {
                return <ProfitCalculatorWidget code={codeStr} />;
              }

              // 3. 13 SEO Keywords & Tags Copier Widget
              if (
                !inline &&
                (lang === "seo_tags" ||
                  lang === "tags" ||
                  lang === "keywords" ||
                  lang === "seo")
              ) {
                return <SeoTagsWidget code={codeStr} />;
              }

              // 4. Printway Factory SKU Specs Widget
              if (
                !inline &&
                (lang === "printway_sku" ||
                  lang === "sku_specs" ||
                  lang === "factory_specs" ||
                  lang === "specs")
              ) {
                return <PrintwaySkuCardWidget code={codeStr} />;
              }

              // 6. Interactive follow-up question action chips
              if (
                !inline &&
                (lang === "suggestions" ||
                  lang.startsWith("suggestion") ||
                  lang === "followup" ||
                  lang === "questions")
              ) {
                return <SuggestedQuestionsRenderer code={codeStr} />;
              }

              // Standard code block
              return !inline && match ? (
                <FastCodeBlock codeStr={codeStr} lang={lang} />
              ) : (
                <code
                  className="bg-[#121A45] text-[#00FF88] rounded px-1.5 py-0.5 font-mono text-[0.88em] border border-[#00FF88]/20 break-words"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            blockquote({ children, ...props }) {
              return (
                <blockquote
                  className="my-3.5 rounded-xl border-l-4 border-[#00FF88] bg-[#0E1538]/80 px-4 py-3 text-xs leading-relaxed text-slate-300 shadow-sm"
                  {...props}
                >
                  {children}
                </blockquote>
              );
            },
            table({ children, ...props }) {
              return (
                <div className="my-4 w-full overflow-x-auto rounded-xl border border-slate-800/80 bg-[#080B21]/40 scrollbar-pretty -mx-0.5 sm:mx-0">
                  <table className="w-full border-collapse min-w-[500px]" {...props}>
                    {children}
                  </table>
                </div>
              );
            },
            img(props: any) {
              const src = typeof props.src === "string" ? props.src : "";
              const alt = typeof props.alt === "string" ? props.alt : "Product Visual Design";
              if (!src) return null;
              return (
                <div
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("open-image-lightbox", {
                          detail: {
                            imageUrl: src,
                            alt: alt,
                          },
                        })
                      );
                    }
                  }}
                  className="group relative my-4 overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] shadow-[0_0_30px_rgba(0,255,136,0.15)] transition-all duration-300 hover:border-[#00FF88] hover:shadow-[0_0_40px_rgba(0,255,136,0.35)] cursor-pointer"
                >
                  <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080B21]/90 via-[#080B21]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 sm:p-4 justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate max-w-[70%]">
                      <Sparkles className="h-3.5 w-3.5 text-[#00FF88] shrink-0" />
                      <span className="truncate">{alt}</span>
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-[#00FF88] text-[#080B21] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold shadow-lg shrink-0">
                      <ZoomIn className="h-3 w-3" />
                      Phóng to
                    </span>
                  </div>
                </div>
              );
            },
          }}
        >
          {displayContent}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownContent.displayName = "MarkdownContent";
