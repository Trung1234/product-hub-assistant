"use client";

import React, { useState } from "react";

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
    <div className="my-6 border-t border-slate-800/80 pt-4">
      <div className="flex flex-col space-y-1.5">
        {questions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectQuestion(q, idx)}
            className="group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-slate-300 hover:bg-[#0E1538]/60 hover:text-white transition-all duration-200 cursor-pointer"
          >
            <span className="shrink-0 text-base leading-none text-slate-500 group-hover:text-[#00FF88] group-hover:translate-x-0.5 transition-all">
              ↳
            </span>
            <span className="flex-1 leading-relaxed text-[13.5px] font-normal group-hover:text-slate-100">
              {q}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
