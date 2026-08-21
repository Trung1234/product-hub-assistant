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
    category: "Gợi Ý R&D Theo Danh Mục Xưởng Printway (500+ SKUs)",
    items: [
      {
        icon: Sparkles,
        title: "Acrylic #1: Suncatcher & 2-Layer Ornament",
        subtitle: "Mica Đài Loan 3mm kết hợp gỗ cắt CNC Laser & In UV 4 lớp",
        prompt: "Phân tích tiềm năng và xu hướng ngách 'Suncatcher Acrylic Ornament Personalized Family Keepsake' theo năng lực xưởng Printway trên Etsy và Amazon."
      },
      {
        icon: Sparkles,
        title: "Wood Decor: Layered Desk Plaque With LED Base",
        subtitle: "Gỗ Plywood thân thiện môi trường, khắc tên và đế đèn LED",
        prompt: "Đánh giá cơ hội sản phẩm 'Personalized Grandpa Gift Custom Shape Acrylic Plaque With Wood Light Base' cho thị trường US."
      },
      {
        icon: Sparkles,
        title: "Apparel: Custom Embroidered Mama Sweatshirt",
        subtitle: "Áo nỉ thêu tên con trên cổ tay, DTG in sắc nét",
        prompt: "Nghiên cứu thị trường 'Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve'. Phân tích nhu cầu tìm kiếm, cạnh tranh và gu thẩm mỹ Pinterest."
      },
      {
        icon: Sparkles,
        title: "Drinkware: Stainless Steel 40oz Handle Tumbler",
        subtitle: "Bình giữ nhiệt 40oz có quai cầm & ống hút, in UV 360 độ",
        prompt: "Kiểm tra tiềm năng sản phẩm 'Custom 40oz Tumbler with Handle Nurse Appreciation Gift'. Đánh giá vận tốc bán hàng Amazon BSR và biên lợi nhuận xưởng Printway."
      },
      {
        icon: Sparkles,
        title: "Auto Decor: Acrylic Car Rearview Mirror Charm",
        subtitle: "Mặt dây chuyền mica treo gương xe ô tô cá nhân hóa",
        prompt: "Phân tích cơ hội ngách 'Personalized Dog Photo Acrylic Car Hanging Ornament' trên Etsy và TikTok Shop US."
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#080B21]/80 pt-[4vh] sm:pt-[12vh] px-2 sm:px-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] shadow-[0_0_50px_rgba(0,255,136,0.2)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex items-center gap-2.5 sm:gap-3 border-b border-slate-800 bg-[#0A0E2A] px-3 sm:px-4 py-3 sm:py-3.5">
          <Search className="h-4 w-4 text-[#00FF88] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm mẫu prompt, thao tác..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-700 bg-[#121A45] px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action List */}
        <div className="flex-1 overflow-y-auto max-h-[65vh] p-2">
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
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#080B21] border border-slate-800 text-slate-300 group-hover:border-[#00FF88]/40 group-hover:text-[#00FF88] transition-colors shrink-0">
                            <IconComp className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-white group-hover:text-[#00FF88] transition-colors truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-[#00FF88] transition-all group-hover:translate-x-0.5 shrink-0 ml-1" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-[#0A0E2A]/70 px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] text-slate-500">
          <span>Chọn lệnh để kích hoạt</span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span>Printway AI</span>
            <span className="h-1 w-1 rounded-full bg-[#00FF88]" />
            <span className="text-[#00FF88]">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};
