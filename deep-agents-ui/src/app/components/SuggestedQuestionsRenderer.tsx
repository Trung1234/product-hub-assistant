"use client";

import React, { useState } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";

interface SuggestedQuestionsRendererProps {
  questions?: string[];
  code?: string;
}

export const SuggestedQuestionsRenderer: React.FC<SuggestedQuestionsRendererProps> = ({
  questions: directQuestions,
  code
}) => {
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);

  const questions: string[] = React.useMemo(() => {
    if (directQuestions && directQuestions.length > 0) {
      return directQuestions;
    }
    if (code) {
      try {
        const parsed = JSON.parse(code.trim());
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        return code
          .split("\n")
          .map((line) => line.replace(/^[-*•\d.↳"\[\]]\s*/, "").replace(/^[<]?[^>]+[>]?/, "").replace(/[",\]]/g, "").trim())
          .filter((line) => line.length > 6);
      }
    }
    return [];
  }, [directQuestions, code]);

  if (questions.length === 0) return null;

  const handleSelectQuestion = (q: string, idx: number) => {
    setClickedIndex(idx);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("send-chat-prompt", { detail: q }));
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/10 no-print animate-in fade-in duration-200">
      <div className="flex items-center gap-1.5 mb-2 px-1 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-[#00FF88]" />
        <span>Gợi ý câu hỏi & hành động tiếp theo:</span>
      </div>

      <div className="flex flex-col space-y-1.5">
        {questions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectQuestion(q, idx)}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0E1538]/60 hover:bg-[#121A45] hover:border-[#00FF88]/40 px-3.5 py-2 text-left text-xs sm:text-[13px] text-slate-200 hover:text-white transition-all duration-200 cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 font-mono text-[#00FF88] opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-sm leading-none">
                ↳
              </span>
              <span className="truncate leading-relaxed font-medium">
                {q}
              </span>
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-slate-500 group-hover:text-[#00FF88] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
};
