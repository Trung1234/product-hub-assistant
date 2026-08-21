"use client";

import React, { useState, useMemo } from "react";
import {
  Calculator,
  Copy,
  Check,
  Sparkles,
  Tag,
  DollarSign,
  Layers,
  ArrowRight,
  Sliders,
  ExternalLink,
  Flame,
  CheckCircle2,
  Clock,
  Truck
} from "lucide-react";
import { toast } from "sonner";

/**
 * Bulletproof numeric parser: safely handles numbers, strings with currency/ranges ("$4.50 - $6.80"), or undefined.
 */
function parseNumeric(val: any, fallback: number): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    // Extract first valid float / integer number from string
    const match = val.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (match) {
      const parsed = parseFloat(match[0]);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return fallback;
}

function safeFormatCurrency(val: any, decimals = 2): string {
  const num = parseNumeric(val, 0);
  return num.toFixed(decimals);
}

// ==========================================
// 1. PROFIT & MARGIN CALCULATOR WIDGET
// ==========================================
export const ProfitCalculatorWidget: React.FC<{ code: string }> = ({ code }) => {
  let parsed: any = {};
  try {
    parsed = JSON.parse(code.trim());
  } catch {
    const lines = code.split("\n");
    lines.forEach((l) => {
      const parts = l.split(":");
      if (parts.length >= 2) {
        const k = parts[0].trim().toLowerCase();
        const v = parts.slice(1).join(":").trim();
        parsed[k] = v;
      }
    });
  }

  const initialPrice = parseNumeric(
    parsed.price || parsed.retail_price || parsed.retail,
    29.99
  );
  const initialBaseCost = parseNumeric(
    parsed.base_cost || parsed.cost || parsed.printway_cost,
    6.5
  );
  const initialShipping = parseNumeric(
    parsed.shipping || parsed.shipping_cost,
    4.99
  );
  const initialAdSpend = parseNumeric(
    parsed.ad_spend || parsed.ads,
    5.0
  );
  const marketplaceFeeRate = parseNumeric(parsed.fee_rate, 0.12);

  const [price, setPrice] = useState<number>(initialPrice);
  const [baseCost, setBaseCost] = useState<number>(initialBaseCost);
  const [shipping, setShipping] = useState<number>(initialShipping);
  const [adSpend, setAdSpend] = useState<number>(initialAdSpend);

  const safePrice = parseNumeric(price, 29.99);
  const safeBaseCost = parseNumeric(baseCost, 6.5);
  const safeShipping = parseNumeric(shipping, 4.99);
  const safeAdSpend = parseNumeric(adSpend, 5.0);

  const marketplaceFee = safePrice * marketplaceFeeRate;
  const totalCost = safeBaseCost + safeShipping + safeAdSpend + marketplaceFee;
  const netProfit = Math.max(-100, safePrice - totalCost);
  const profitMargin = safePrice > 0 ? (netProfit / safePrice) * 100 : 0;
  const breakEvenUnits = netProfit > 0 ? Math.ceil(10000 / netProfit) : 0;

  return (
    <div className="my-5 rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] p-5 shadow-[0_0_25px_rgba(0,255,136,0.15)] backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#00FF88]/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#080B21] border border-[#00FF88]/40 text-[#00FF88]">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Bảng Tính Lợi Nhuận & Điểm Hòa Vốn (Interactive Profit Engine)
            </h4>
            <span className="text-[10px] text-[#94A3B8]">
              Tùy chỉnh giá bán, chi phí xưởng Printway & Ads để tính ROI theo thời gian thực
            </span>
          </div>
        </div>
        <span className="rounded-full bg-[#00FF88]/15 px-2.5 py-1 text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30">
          Printway SKU Pricing
        </span>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Retail Price */}
        <div className="space-y-1.5 bg-[#080B21]/70 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Giá bán lẻ (Retail Price):</span>
            <span className="font-mono font-bold text-[#00FF88]">${safeFormatCurrency(safePrice)}</span>
          </div>
          <input
            type="range"
            min="10"
            max="120"
            step="0.5"
            value={safePrice}
            onChange={(e) => setPrice(parseNumeric(e.target.value, 29.99))}
            className="w-full accent-[#00FF88] cursor-pointer"
          />
        </div>

        {/* Base Cost */}
        <div className="space-y-1.5 bg-[#080B21]/70 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Giá gốc xưởng Printway (Base Cost):</span>
            <span className="font-mono font-bold text-[#00D2FF]">${safeFormatCurrency(safeBaseCost)}</span>
          </div>
          <input
            type="range"
            min="2"
            max="50"
            step="0.25"
            value={safeBaseCost}
            onChange={(e) => setBaseCost(parseNumeric(e.target.value, 6.5))}
            className="w-full accent-[#00D2FF] cursor-pointer"
          />
        </div>

        {/* Shipping Cost */}
        <div className="space-y-1.5 bg-[#080B21]/70 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Phí Ship US (USPS/DHL Line):</span>
            <span className="font-mono font-bold text-amber-400">${safeFormatCurrency(safeShipping)}</span>
          </div>
          <input
            type="range"
            min="2"
            max="20"
            step="0.25"
            value={safeShipping}
            onChange={(e) => setShipping(parseNumeric(e.target.value, 4.99))}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Ad Spend */}
        <div className="space-y-1.5 bg-[#080B21]/70 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Chi phí Quảng cáo / Đơn (CAC Ads):</span>
            <span className="font-mono font-bold text-purple-400">${safeFormatCurrency(safeAdSpend)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="30"
            step="0.5"
            value={safeAdSpend}
            onChange={(e) => setAdSpend(parseNumeric(e.target.value, 5.0))}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Results Matrix Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="flex flex-col rounded-xl bg-[#080B21] border border-slate-800 p-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Tổng chi phí (COGS)
          </span>
          <span className="mt-1 font-mono text-base font-bold text-slate-200">
            ${safeFormatCurrency(totalCost)}
          </span>
          <span className="text-[9px] text-slate-500">Bao gồm ~12% sàn</span>
        </div>

        <div className="flex flex-col rounded-xl bg-[#080B21] border border-[#00FF88]/30 p-3 text-center shadow-[0_0_12px_rgba(0,255,136,0.1)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">
            Lợi nhuận ròng / Item
          </span>
          <span
            className={`mt-1 font-mono text-lg font-extrabold ${
              netProfit >= 0 ? "text-[#00FF88]" : "text-rose-400"
            }`}
          >
            ${safeFormatCurrency(netProfit)}
          </span>
          <span className="text-[9px] text-slate-400">Net Profit</span>
        </div>

        <div className="flex flex-col rounded-xl bg-[#080B21] border border-[#00D2FF]/30 p-3 text-center shadow-[0_0_12px_rgba(0,210,255,0.1)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
            Tỷ suất LN (Margin)
          </span>
          <span
            className={`mt-1 font-mono text-lg font-extrabold ${
              profitMargin >= 30
                ? "text-[#00FF88]"
                : profitMargin >= 15
                ? "text-[#00D2FF]"
                : "text-amber-400"
            }`}
          >
            {safeFormatCurrency(profitMargin, 1)}%
          </span>
          <span className="text-[9px] text-slate-400">Mục tiêu {">"} 35%</span>
        </div>

        <div className="flex flex-col rounded-xl bg-[#080B21] border border-purple-500/30 p-3 text-center shadow-[0_0_12px_rgba(168,85,247,0.1)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
            Số đơn cho $10k Profit
          </span>
          <span className="mt-1 font-mono text-lg font-extrabold text-purple-300">
            {breakEvenUnits > 0 ? `${breakEvenUnits.toLocaleString()} đơn` : "N/A"}
          </span>
          <span className="text-[9px] text-slate-400">Tháng cao điểm Q4</span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. SEO TAGS & 13 ETSY KEYWORDS COPIER WIDGET
// ==========================================
export const SeoTagsWidget: React.FC<{ code: string }> = ({ code }) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const tags: string[] = useMemo(() => {
    try {
      const parsed = JSON.parse(code.trim());
      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed.tags && Array.isArray(parsed.tags)) return parsed.tags.map(String);
    } catch {
      return code
        .split(/[,\n]/)
        .map((t) => t.replace(/^[-*•\d.↳"\[\]\s]+/, "").replace(/[",\]]/g, "").trim())
        .filter((t) => t.length > 2);
    }
    return [];
  }, [code]);

  if (tags.length === 0) return null;

  const handleCopyTag = (tag: string, idx: number) => {
    navigator.clipboard.writeText(tag);
    setCopiedIdx(idx);
    toast.success(`Đã chép: "${tag}"`);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleCopyAll = () => {
    const allStr = tags.join(", ");
    navigator.clipboard.writeText(allStr);
    setCopiedAll(true);
    toast.success(`Đã sao chép toàn bộ ${tags.length} SEO Tags!`);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="my-5 rounded-2xl border border-[#00D2FF]/30 bg-[#0E1538] p-4 shadow-[0_0_20px_rgba(0,210,255,0.12)] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#00D2FF]/20 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[#00D2FF]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Bộ 13 SEO Keywords / Tags Tối Ưu (Etsy & Amazon Listing Ready)
          </h4>
        </div>
        <button
          type="button"
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 rounded-lg border border-[#00FF88]/40 bg-[#00FF88]/15 px-3 py-1 text-[11px] font-bold text-[#00FF88] hover:bg-[#00FF88] hover:text-[#080B21] transition-all cursor-pointer shadow-[0_0_10px_rgba(0,255,136,0.2)]"
        >
          {copiedAll ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Đã chép toàn bộ!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Chép tất cả ({tags.length})</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => {
          const isCopied = copiedIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCopyTag(tag, idx)}
              className={`group flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                isCopied
                  ? "border-[#00FF88] bg-[#00FF88]/20 text-[#00FF88]"
                  : "border-slate-800 bg-[#080B21] text-slate-300 hover:border-[#00D2FF]/50 hover:bg-[#121A45] hover:text-white"
              }`}
              title="Click để sao chép tag này"
            >
              <span className="text-slate-500 font-mono text-[10px] group-hover:text-[#00D2FF]">
                #{idx + 1}
              </span>
              <span>{tag}</span>
              {isCopied ? (
                <Check className="h-3 w-3 text-[#00FF88]" />
              ) : (
                <Copy className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-[#00D2FF] transition-opacity" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 3. PRINTWAY FACTORY SKU PRODUCTION CARD WIDGET
// ==========================================
export const PrintwaySkuCardWidget: React.FC<{ code: string }> = ({ code }) => {
  let data: any = {};
  try {
    data = JSON.parse(code.trim());
  } catch {
    data = { sku_name: code.trim() };
  }

  const {
    sku_name = "Acrylic Suncatcher / Desk Plaque",
    material = "Mica Đài Loan nhập khẩu 3mm & Gỗ Plywood",
    print_tech = "In UV KTS 4 lớp chống bay màu + Cắt Laser CNC",
    base_cost = "$4.50 - $6.80",
    turnaround = "1-3 ngày làm việc (Xưởng Việt Nam)",
    shipping_us = "5-9 ngày (USPS / DHL eCommerce)",
    catalog_url = "https://printway.io/products",
  } = data;

  return (
    <div className="my-5 rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] p-5 shadow-[0_0_20px_rgba(0,255,136,0.15)] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-[#00FF88]/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm p-1">
            <img src="/logo_header.png" alt="Printway" className="h-3 w-auto object-contain" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Thông Số Sản Xuất & Năng Lực Xưởng Printway
            </h4>
            <span className="text-[10px] text-[#94A3B8]">In-house POD Factory Fulfillment Specs</span>
          </div>
        </div>
        <a
          href={catalog_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-bold text-[#00FF88] hover:underline"
        >
          <span>Catalog 500+ SKUs</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-3 border border-slate-800">
          <Layers className="h-4 w-4 text-[#00FF88] shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Chất liệu & Vật liệu</span>
            <span className="font-semibold text-white">{material}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-3 border border-slate-800">
          <Sparkles className="h-4 w-4 text-[#00D2FF] shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Công nghệ in ấn</span>
            <span className="font-semibold text-white">{print_tech}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-3 border border-slate-800">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Thời gian sản xuất (Turnaround)</span>
            <span className="font-semibold text-white">{turnaround}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-3 border border-slate-800">
          <Truck className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase block">Thời gian vận chuyển US</span>
            <span className="font-semibold text-white">{shipping_us}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
