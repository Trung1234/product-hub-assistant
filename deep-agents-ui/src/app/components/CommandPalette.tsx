"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Sparkles,
  Plus,
  Settings,
  Download,
  Zap,
  ArrowRight,
  Command,
  PanelLeft,
  X
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
  onNewResearch: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

const COMMAND_ITEMS = [
  {
    category: "Gợi Ý Nghiên Cứu R&D POD",
    items: [
      {
        icon: Sparkles,
        title: "Holiday 2026: Baby First Christmas Ornament",
        subtitle: "Phân tích nhu cầu tìm kiếm, đối thủ Etsy & Amazon và mẫu thiết kế",
        prompt: "Nghiên cứu xu hướng và cơ hội sản phẩm 'Baby First Christmas Ornament 2026 Custom Acrylic Keepsake' trên Etsy, Amazon, Google Trends và Pinterest."
      },
      {
        icon: Sparkles,
        title: "Father's Day: Grandpa Acrylic Desk Plaque",
        subtitle: "Đánh giá biên lợi nhuận đế gỗ LED và xu hướng thị trường US",
        prompt: "Phân tích tiềm năng ngách 'Personalized Grandpa Gift For Father Day Custom Shape Acrylic Desk Plaque With Wood Base Light' cho thị trường US."
      },
      {
        icon: Sparkles,
        title: "Mother's Day: Embroidered Mama Sweatshirt",
        subtitle: "Kiểm tra dung lượng thị trường áo thêu tên con trên cổ tay",
        prompt: "Đánh giá cơ hội thị trường cho 'Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve'. Phân tích nhu cầu tìm kiếm, cạnh tranh và gu thẩm mỹ Pinterest."
      },
      {
        icon: Sparkles,
        title: "Everyday Drinkware: Teacher Tumbler 20oz",
        subtitle: "Phân tích vận tốc bán hàng Amazon BSR và giá vốn xưởng Printway",
        prompt: "Kiểm tra tiềm năng sản phẩm 'Custom Stainless Steel Tumbler 20oz Teacher Appreciation Gift'. Đánh giá vận tốc bán hàng Amazon và biên lợi nhuận xưởng Printway."
      }
    ]
  },
  {
    category: "Thao Tác Nhanh (System Actions)",
    items: [
      {
        icon: Plus,
        title: "Tạo phiên nghiên cứu sản phẩm mới",
        subtitle: "Mở một luồng nghiên cứu sạch sẽ (Cmd + Shift + N)",
        action: "new_research"
      },
      {
        icon: Download,
        title: "Tải toàn bộ cơ sở dữ liệu Opportunity Matrix CSV",
        subtitle: "Tải file 23 cột chứa toàn bộ sản phẩm đã phân tích",
        action: "download_csv"
      },
      {
        icon: PanelLeft,
        title: "Đóng / Mở thanh Sidebar",
        subtitle: "Thu gọn không gian làm việc (Cmd + B)",
        action: "toggle_sidebar"
      },
      {
        icon: Settings,
        title: "Cấu hình hệ thống & API Key",
        subtitle: "Mở cài đặt Endpoint và Model (Cmd + ,)",
        action: "open_settings"
      }
    ]
  }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
  onNewResearch,
  onOpenSettings,
  onToggleSidebar,
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      setQuery("");
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAction = (item: any) => {
    if (item.prompt) {
      onSelectPrompt(item.prompt);
      onClose();
    } else if (item.action === "new_research") {
      onNewResearch();
      onClose();
    } else if (item.action === "download_csv") {
      const link = document.createElement("a");
      link.href = "http://127.0.0.1:8001/reports/product_opportunities.csv";
      link.download = "product_opportunities.csv";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onClose();
    } else if (item.action === "open_settings") {
      onOpenSettings();
      onClose();
    } else if (item.action === "toggle_sidebar") {
      onToggleSidebar();
      onClose();
    }
  };

  const filteredCategories = COMMAND_ITEMS.map((cat) => {
    const matchingItems = cat.items.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase())
    );
    return { ...cat, items: matchingItems };
  }).filter((cat) => cat.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#080B21]/80 pt-[12vh] px-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] shadow-[0_0_50px_rgba(0,255,136,0.2)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 border-b border-slate-800 bg-[#0A0E2A] px-4 py-3.5">
          <Search className="h-4 w-4 text-[#00FF88]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm mẫu prompt, thao tác hoặc lệnh nhanh (hoặc gõ từ khóa)..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-700 bg-[#121A45] px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Action List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Không tìm thấy lệnh nào phù hợp với &quot;{query}&quot;
            </div>
          ) : (
            filteredCategories.map((cat, idx) => (
              <div key={idx} className="mb-3 last:mb-0">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">
                  {cat.category}
                </div>
                <div className="space-y-1">
                  {cat.items.map((item, itemIdx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={itemIdx}
                        type="button"
                        onClick={() => handleAction(item)}
                        className="group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all hover:bg-[#121A45] hover:border hover:border-[#00FF88]/30 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#080B21] border border-slate-800 text-slate-300 group-hover:border-[#00FF88]/40 group-hover:text-[#00FF88] transition-colors">
                            <IconComp className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white group-hover:text-[#00FF88] transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-[#00FF88] transition-all group-hover:translate-x-0.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-[#0A0E2A]/70 px-4 py-2 text-[11px] text-slate-500">
          <span>Dùng phím mũi tên hoặc chuột để chọn</span>
          <div className="flex items-center gap-2">
            <span>Printway AI Copilot</span>
            <span className="h-1 w-1 rounded-full bg-[#00FF88]" />
            <span className="text-[#00FF88]">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};
