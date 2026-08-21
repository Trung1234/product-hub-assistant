"use client";

import React, { useEffect } from "react";
import { X, Download, ExternalLink, Sparkles, Layers, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
  caption?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  alt = "Product Visual Design",
  caption
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `printway_design_${Date.now()}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B21]/90 p-4 sm:p-6 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] shadow-[0_0_50px_rgba(0,255,136,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0A0E2A] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-[#00FF88] to-[#00D2FF]">
              <Sparkles className="h-3.5 w-3.5 text-[#080B21]" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-white">
              Visual Design Inspector & Spec Viewer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#121A45] px-3 py-1.5 text-xs font-semibold text-[#00FF88] hover:border-[#00FF88] transition-all cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Tải ảnh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-col md:flex-row overflow-y-auto max-h-[calc(92vh-60px)]">
          {/* Left: Big Image Preview */}
          <div className="flex flex-1 items-center justify-center bg-[#060919] p-6">
            <img
              src={imageUrl}
              alt={alt}
              className="max-h-[60vh] w-auto rounded-xl object-contain shadow-2xl transition-transform hover:scale-105 duration-300"
            />
          </div>

          {/* Right: Technical Specs & R&D Notes */}
          <div className="flex w-full md:w-80 flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800 bg-[#0E1538] p-5">
            <div className="space-y-4">
              <div>
                <span className="rounded-full bg-[#00FF88]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#00FF88] border border-[#00FF88]/30">
                  Printway In-House Spec
                </span>
                <h3 className="mt-2 text-base font-bold text-white leading-snug">
                  {alt || "Mẫu Thiết Kế Thịnh Hành"}
                </h3>
                {caption && (
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    {caption}
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-slate-800/80 bg-[#080B21]/60 p-3 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Chất liệu:</span>
                  <span className="font-semibold text-white">Mica quang học 3mm / Gỗ sồi</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Công nghệ in:</span>
                  <span className="font-semibold text-[#00D2FF]">In UV phẳng 4 lớp + Phủ bóng</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Giá vốn Printway:</span>
                  <span className="font-bold text-[#00FF88]">$2.20 - $4.50</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Giá bán lẻ đề xuất:</span>
                  <span className="font-bold text-amber-400">$18.99 - $29.99</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <h5 className="text-[11px] font-bold uppercase text-[#00FF88]">
                  Chiến thuật thiết kế Pinterest:
                </h5>
                <ul className="space-y-1 text-[11px] text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="h-3 w-3 text-[#00FF88] mt-0.5 shrink-0" />
                    <span>Dùng font chữ Serif mềm mại kết hợp chữ ký tay cá nhân hóa.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="h-3 w-3 text-[#00FF88] mt-0.5 shrink-0" />
                    <span>Background trong suốt tạo chiều sâu xuyên sáng cho sản phẩm.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800">
              <Button
                type="button"
                onClick={handleDownload}
                className="w-full rounded-xl border border-[#00FF88] bg-[#00FF88] py-2 text-xs font-bold text-[#080B21] hover:bg-[#00FF88]/85 shadow-[0_0_15px_rgba(0,255,136,0.4)] cursor-pointer"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Tải Xuống Ảnh Mẫu Mockup
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
