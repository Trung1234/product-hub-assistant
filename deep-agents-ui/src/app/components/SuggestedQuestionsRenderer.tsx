"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRight, CornerDownLeft } from "lucide-react";

interface SuggestedQuestionsRendererProps {
  code: string;
}

export const SuggestedQuestionsRenderer: React.FC<SuggestedQuestionsRendererProps> = ({ code }) => {
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);

  const questions: string[] = React.useMemo(() => {
    try {
      const parsed = JSON.parse(code.trim());
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fallback: parse bullet lines
      return code
        .split("\n")
        .map((line) => line.replace(/^[-*•\d.]\s*/, "").replace(/^\[|\]$/g, "").trim())
        .filter((line) => line.length > 5);
    }
    return [];
  }, [code]);

  if (questions.length === 0) return null;

  const handleSelectQuestion = (q: string, idx: number) => {
    setClickedIndex(idx);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("send-chat-prompt", { detail: q }));
    }
  };

  return (
    <div className="my-4 rounded-2xl border border-[#00FF88]/30 bg-[#0A0E2A]/90 p-4 shadow-[0_0_20px_rgba(0,255,136,0.12)] backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-tr from-[#00FF88] to-[#00D2FF] shadow-[0_0_8px_rgba(0,255,136,0.5)]">
          <Sparkles className="h-3 w-3 text-[#080B21]" />
        </div>
        <span className="text-xs font-extrabold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] to-[#00D2FF]">
          Gợi Ý Câu Hỏi Nghiên Cứu Tiếp Theo
        </span>
        <span className="text-[10px] text-slate-400 font-mono font-normal">
          (Bấm 1-Click để gửi ngay)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {questions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectQuestion(q, idx)}
            className="group relative flex items-center justify-between gap-2.5 rounded-xl border border-[#00FF88]/25 bg-[#0E1538] p-3 text-left text-xs font-medium text-slate-200 shadow-[0_0_10px_rgba(0,255,136,0.06)] hover:border-[#00FF88] hover:bg-[#121A45] hover:text-[#00FF88] hover:shadow-[0_0_15px_rgba(0,255,136,0.25)] transition-all duration-200"
          >
            <div className="flex items-start gap-2 min-w-0">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00FF88]/15 text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30 group-hover:bg-[#00FF88] group-hover:text-[#080B21] transition-colors">
                {idx + 1}
              </span>
              <span className="line-clamp-2 leading-snug">{q}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-50 group-hover:opacity-100 group-hover:text-[#00FF88] group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
};
