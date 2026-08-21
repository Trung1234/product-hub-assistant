import React, { useState, useMemo, useCallback } from "react";
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
  Truck,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldCheck,
  AlertCircle,
  Calendar,
  ShoppingBag,
  Store,
  Globe,
  Award,
  CheckSquare,
  Square
} from "lucide-react";
import { toast } from "sonner";

/**
 * Bulletproof numeric parser: safely handles numbers, strings with currency/ranges ("$4.50 - $6.80"), or undefined.
 */
function parseNumeric(val: any, fallback: number): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
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
export const ProfitCalculatorWidget = React.memo<{ code: string }>(({ code }) => {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(code.trim());
    } catch {
      const obj: any = {};
      const lines = code.split("\n");
      lines.forEach((l) => {
        const parts = l.split(":");
        if (parts.length >= 2) {
          const k = parts[0].trim().toLowerCase();
          const v = parts.slice(1).join(":").trim();
          obj[k] = v;
        }
      });
      return obj;
    }
  }, [code]);

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

  const { totalCost, netProfit, profitMargin, breakEvenUnits } = useMemo(() => {
    const marketplaceFee = safePrice * marketplaceFeeRate;
    const total = safeBaseCost + safeShipping + safeAdSpend + marketplaceFee;
    const profit = Math.max(-100, safePrice - total);
    const margin = safePrice > 0 ? (profit / safePrice) * 100 : 0;
    const breakEven = profit > 0 ? Math.ceil(10000 / profit) : 0;
    return {
      totalCost: total,
      netProfit: profit,
      profitMargin: margin,
      breakEvenUnits: breakEven,
    };
  }, [safePrice, safeBaseCost, safeShipping, safeAdSpend, marketplaceFeeRate]);

  return (
    <div className="my-4 sm:my-5 rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] p-3.5 sm:p-5 shadow-[0_0_25px_rgba(0,255,136,0.15)] backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00FF88]/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#080B21] border border-[#00FF88]/40 text-[#00FF88] shrink-0">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Bảng Tính Lợi Nhuận (Profit Engine)
            </h4>
            <span className="text-[10px] text-[#94A3B8]">
              Tùy chỉnh giá bán, giá xưởng & Ads tính ROI tức thì
            </span>
          </div>
        </div>
        <span className="rounded-full bg-[#00FF88]/15 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30 shrink-0">
          Printway SKU Pricing
        </span>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
        {/* Retail Price */}
        <div className="space-y-1.5 bg-[#080B21]/70 p-2.5 sm:p-3 rounded-xl border border-slate-800">
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
        <div className="space-y-1.5 bg-[#080B21]/70 p-2.5 sm:p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Giá gốc xưởng Printway:</span>
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
        <div className="space-y-1.5 bg-[#080B21]/70 p-2.5 sm:p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Phí Ship US (USPS Line):</span>
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
        <div className="space-y-1.5 bg-[#080B21]/70 p-2.5 sm:p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Chi phí Quảng cáo / Đơn:</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="flex flex-col rounded-xl bg-[#080B21] border border-slate-800 p-2.5 sm:p-3 text-center">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Tổng chi phí (COGS)
          </span>
          <span className="mt-1 font-mono text-sm sm:text-base font-bold text-slate-200">
            ${safeFormatCurrency(totalCost)}
          </span>
          <span className="text-[8px] sm:text-[9px] text-slate-500">~12% sàn</span>
        </div>

        <div className="flex flex-col rounded-xl bg-[#080B21] border border-[#00FF88]/30 p-2.5 sm:p-3 text-center shadow-[0_0_12px_rgba(0,255,136,0.1)]">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">
            LN ròng / Item
          </span>
          <span
            className={`mt-1 font-mono text-base sm:text-lg font-extrabold ${
              netProfit >= 0 ? "text-[#00FF88]" : "text-rose-400"
            }`}
          >
            ${safeFormatCurrency(netProfit)}
          </span>
          <span className="text-[8px] sm:text-[9px] text-slate-400">Net Profit</span>
        </div>

        <div className="flex flex-col rounded-xl bg-[#080B21] border border-[#00D2FF]/30 p-2.5 sm:p-3 text-center shadow-[0_0_12px_rgba(0,210,255,0.1)]">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#00D2FF]">
            Tỷ suất Margin
          </span>
          <span
            className={`mt-1 font-mono text-base sm:text-lg font-extrabold ${
              profitMargin >= 30
                ? "text-[#00FF88]"
                : profitMargin >= 15
                ? "text-[#00D2FF]"
                : "text-amber-400"
            }`}
          >
            {safeFormatCurrency(profitMargin, 1)}%
          </span>
          <span className="text-[8px] sm:text-[9px] text-slate-400">Mục tiêu &gt; 35%</span>
        </div>

        <div className="flex flex-col rounded-xl bg-[#080B21] border border-purple-500/30 p-2.5 sm:p-3 text-center shadow-[0_0_12px_rgba(168,85,247,0.1)]">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-400">
            Số đơn cho $10k
          </span>
          <span className="mt-1 font-mono text-base sm:text-lg font-extrabold text-purple-300">
            {breakEvenUnits > 0 ? `${breakEvenUnits.toLocaleString()}` : "N/A"}
          </span>
          <span className="text-[8px] sm:text-[9px] text-slate-400">Mùa cao điểm</span>
        </div>
      </div>
    </div>
  );
});

ProfitCalculatorWidget.displayName = "ProfitCalculatorWidget";

// ==========================================
// 2. SEO TAGS & 13 ETSY KEYWORDS COPIER WIDGET
// ==========================================
export const SeoTagsWidget = React.memo<{ code: string }>(({ code }) => {
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

  const handleCopyTag = useCallback((tag: string, idx: number) => {
    navigator.clipboard.writeText(tag);
    setCopiedIdx(idx);
    toast.success(`Đã chép: "${tag}"`);
    setTimeout(() => setCopiedIdx(null), 1500);
  }, []);

  const handleCopyAll = useCallback(() => {
    const allStr = tags.join(", ");
    navigator.clipboard.writeText(allStr);
    setCopiedAll(true);
    toast.success(`Đã sao chép toàn bộ ${tags.length} SEO Tags!`);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [tags]);

  if (tags.length === 0) return null;

  return (
    <div className="my-4 sm:my-5 rounded-2xl border border-[#00D2FF]/30 bg-[#0E1538] p-3.5 sm:p-4 shadow-[0_0_20px_rgba(0,210,255,0.12)] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00D2FF]/20 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[#00D2FF] shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            13 SEO Keywords (Etsy & Amazon Ready)
          </h4>
        </div>
        <button
          type="button"
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 rounded-lg border border-[#00FF88]/40 bg-[#00FF88]/15 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-bold text-[#00FF88] hover:bg-[#00FF88] hover:text-[#080B21] transition-all cursor-pointer shadow-[0_0_10px_rgba(0,255,136,0.2)] shrink-0"
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

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {tags.map((tag, idx) => {
          const isCopied = copiedIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCopyTag(tag, idx)}
              className={`group flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-all duration-200 cursor-pointer ${
                isCopied
                  ? "border-[#00FF88] bg-[#00FF88]/20 text-[#00FF88]"
                  : "border-slate-800 bg-[#080B21] text-slate-300 hover:border-[#00D2FF]/50 hover:bg-[#121A45] hover:text-white"
              }`}
              title="Click để sao chép tag này"
            >
              <span className="text-slate-500 font-mono text-[9px] sm:text-[10px] group-hover:text-[#00D2FF]">
                #{idx + 1}
              </span>
              <span>{tag}</span>
              {isCopied ? (
                <Check className="h-3 w-3 text-[#00FF88] shrink-0" />
              ) : (
                <Copy className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-[#00D2FF] transition-opacity shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

SeoTagsWidget.displayName = "SeoTagsWidget";

// ==========================================
// 3. PRINTWAY FACTORY SKU PRODUCTION CARD WIDGET
// ==========================================
export const PrintwaySkuCardWidget = React.memo<{ code: string }>(({ code }) => {
  const data = useMemo(() => {
    try {
      return JSON.parse(code.trim());
    } catch {
      return { sku_name: code.trim() };
    }
  }, [code]);

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
    <div className="my-4 sm:my-5 rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] p-3.5 sm:p-5 shadow-[0_0_20px_rgba(0,255,136,0.15)] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00FF88]/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm p-1 shrink-0">
            <img src="/logo_header.png" alt="Printway" className="h-3 w-auto object-contain" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Thông Số Xưởng Printway
            </h4>
            <span className="text-[10px] text-[#94A3B8]">In-house POD Factory Specs</span>
          </div>
        </div>
        <a
          href={catalog_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[#00FF88] hover:underline shrink-0"
        >
          <span>500+ SKUs</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs mb-2">
        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-2.5 sm:p-3 border border-slate-800">
          <Layers className="h-4 w-4 text-[#00FF88] shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase block">Chất liệu & Vật liệu</span>
            <span className="font-semibold text-white text-xs">{material}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-2.5 sm:p-3 border border-slate-800">
          <Sparkles className="h-4 w-4 text-[#00D2FF] shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase block">Công nghệ in ấn</span>
            <span className="font-semibold text-white text-xs">{print_tech}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-2.5 sm:p-3 border border-slate-800">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase block">Thời gian sản xuất</span>
            <span className="font-semibold text-white text-xs">{turnaround}</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-[#080B21] p-2.5 sm:p-3 border border-slate-800">
          <Truck className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase block">Vận chuyển US</span>
            <span className="font-semibold text-white text-xs">{shipping_us}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

PrintwaySkuCardWidget.displayName = "PrintwaySkuCardWidget";

// ==========================================
// 4. EXECUTIVE SCORECARD & KPI GRID WIDGET
// ==========================================
export const ExecutiveScorecardWidget = React.memo<{ code: string }>(({ code }) => {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(code.trim());
    } catch {
      return {};
    }
  }, [code]);

  const score = parseNumeric(parsed.score || parsed.opportunity_score, 75);
  const recommendation = parsed.recommendation || (score >= 70 ? "RECOMMEND" : score >= 50 ? "RECOMMEND WITH CAUTION" : "NOT RECOMMEND");
  const demandVol = parsed.demand || parsed.search_volume || "14,500/mo";
  const competition = parsed.competition || parsed.active_listings || "105 listings";
  const growth = parsed.growth || parsed.yoy_growth || "+45% YoY";
  const estMargin = parsed.margin || parsed.profit_margin || "68% - 75%";

  const isPositive = recommendation.toUpperCase().includes("RECOMMEND") && !recommendation.toUpperCase().includes("NOT");
  const isCaution = recommendation.toUpperCase().includes("CAUTION");

  return (
    <div className="my-4 sm:my-5 rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] p-3.5 sm:p-5 shadow-[0_0_25px_rgba(0,255,136,0.15)] backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00FF88]/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] shrink-0">
            <Award className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Bảng Tổng Quan Chỉ Số Cơ Hội (Executive Scorecard)
            </h4>
            <span className="text-[10px] text-[#94A3B8]">Tóm tắt 4 trụ cột R&D quyết định mở bán</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border",
              !isPositive
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                : isCaution
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/50 shadow-[0_0_10px_rgba(0,255,136,0.3)]"
            )}
          >
            {recommendation}
          </span>
        </div>
      </div>

      {/* 4-KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* KPI 1: Score */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase">Opportunity Score</span>
            <Target className="h-3.5 w-3.5 text-[#00FF88]" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] to-[#00D2FF]">
              {score}
            </span>
            <span className="text-[10px] text-slate-400">/100</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#00FF88] to-[#00D2FF] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Demand */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase">Nhu Cầu Tìm Kiếm</span>
            <ShoppingBag className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="my-1">
            <span className="text-base sm:text-lg font-bold text-white block truncate">
              {demandVol}
            </span>
          </div>
          <span className="text-[10px] text-cyan-400 font-medium">Etsy & Amazon US Index</span>
        </div>

        {/* KPI 3: Competition */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase">Mức Cạnh Tranh</span>
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="my-1">
            <span className="text-base sm:text-lg font-bold text-white block truncate">
              {competition}
            </span>
          </div>
          <span className="text-[10px] text-amber-400 font-medium">Mật độ listing active</span>
        </div>

        {/* KPI 4: Margin */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase">Biên Lợi Nhuận</span>
            <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="my-1">
            <span className="text-base sm:text-lg font-bold text-[#00FF88] block truncate">
              {estMargin}
            </span>
          </div>
          <span className="text-[10px] text-purple-400 font-medium">Xưởng Printway VN</span>
        </div>
      </div>
    </div>
  );
});

ExecutiveScorecardWidget.displayName = "ExecutiveScorecardWidget";

// ==========================================
// 5. MARKETPLACE MULTI-CHANNEL MATRIX WIDGET
// ==========================================
export const MarketplaceComparisonWidget = React.memo<{ code: string }>(({ code }) => {
  const data = useMemo(() => {
    try {
      return JSON.parse(code.trim());
    } catch {
      return {
        etsy: { score: 88, note: "Top 1 ngách cá nhân hóa quà tặng, AOV cao, chi phí list thấp" },
        amazon: { score: 62, note: "Cạnh tranh giá mạnh ở tier dưới $15, nên test FBM Printway" },
        tiktok_shop: { score: 78, note: "Viral video visual unboxing rất tốt đón sóng mùa vụ Q4" },
        pinterest: { score: 85, note: "Pin saves tăng mạnh từ T8-T9 cho dòng sản phẩm Mica/Gỗ" },
      };
    }
  }, [code]);

  return (
    <div className="my-4 sm:my-5 rounded-2xl border border-cyan-500/30 bg-[#0E1538] p-3.5 sm:p-5 shadow-[0_0_20px_rgba(0,210,255,0.15)] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shrink-0">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Đánh Giá Độ Phù Hợp Kênh Bán Hàng (Marketplace Matrix)
            </h4>
            <span className="text-[10px] text-[#94A3B8]">Etsy • Amazon • TikTok Shop • Pinterest</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
        {/* Etsy */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-orange-500/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-orange-400 flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" />
              Etsy Marketplace
            </span>
            <span className="font-mono font-bold text-[#00FF88]">{data.etsy?.score || 85}/100</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{data.etsy?.note || "Kênh chủ lực cá nhân hóa quà tặng gia đình."}</p>
        </div>

        {/* Amazon */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-amber-500/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" />
              Amazon Marketplace
            </span>
            <span className="font-mono font-bold text-amber-300">{data.amazon?.score || 65}/100</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{data.amazon?.note || "Tập trung BSR top và tối ưu thời gian ship FBM Printway."}</p>
        </div>

        {/* TikTok Shop */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-rose-500/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-rose-400 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              TikTok Shop US
            </span>
            <span className="font-mono font-bold text-rose-300">{data.tiktok_shop?.score || 80}/100</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{data.tiktok_shop?.note || "Phù hợp chạy video unboxing và kết nối Affiliate Creator."}</p>
        </div>

        {/* Pinterest */}
        <div className="rounded-xl bg-[#080B21] p-3 border border-purple-500/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-purple-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Pinterest Visual Trends
            </span>
            <span className="font-mono font-bold text-purple-300">{data.pinterest?.score || 85}/100</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{data.pinterest?.note || "Tín hiệu lưu Pin sớm từ tệp khách hàng nữ 25-45 tuổi."}</p>
        </div>
      </div>
    </div>
  );
});

MarketplaceComparisonWidget.displayName = "MarketplaceComparisonWidget";

// ==========================================
// 6. INTERACTIVE 30-DAY LAUNCH TIMELINE ROADMAP WIDGET
// ==========================================
export const TimelineActionPlanWidget = React.memo<{ code: string }>(({ code }) => {
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const steps = useMemo(() => {
    try {
      const parsed = JSON.parse(code.trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
    return [
      {
        week: "Tuần 1: R&D & Thiết Kế Sản Phẩm",
        desc: "Chuẩn bị 5 concept thiết kế (Mica 3mm / Gỗ Plywood), xuất file in UV 300 DPI và test render mockup.",
        tag: "R&D Phase"
      },
      {
        week: "Tuần 2: Chuẩn Hóa Listing & 13 SEO Tags",
        desc: "Đăng 3 listing Etsy thử nghiệm, cấu hình bộ 13 SEO tags, giá launch $16.99 và bật personalization.",
        tag: "Listing Launch"
      },
      {
        week: "Tuần 3: Pinterest Pinning & Etsy Ads Thử Nghiệm",
        desc: "Đăng 15 Pin visual assets theo gu thẩm mỹ Stained Glass / Floral, set ngân sách Etsy Ads $5/ngày.",
        tag: "Traffic Drive"
      },
      {
        week: "Tuần 4: Tối Ưu Chiến Dịch & Quy Mô Đơn Hàng",
        desc: "Đo lường CTR/CR, mở rộng bundle combo quà tặng, tăng ngân sách ads đón đỉnh sóng mùa vụ.",
        tag: "Scale Phase"
      },
    ];
  }, [code]);

  return (
    <div className="my-4 sm:my-5 rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] p-3.5 sm:p-5 shadow-[0_0_20px_rgba(0,255,136,0.15)] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00FF88]/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#080B21] border border-[#00FF88]/40 text-[#00FF88] shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Lộ Trình Mở Bán 30 Ngày (Action Roadmap)
            </h4>
            <span className="text-[10px] text-[#94A3B8]">Tích chọn các đầu việc đã hoàn thành để theo dõi tiến độ</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {steps.map((step: any, idx: number) => {
          const isDone = !!completedSteps[idx];
          return (
            <div
              key={idx}
              onClick={() => toggleStep(idx)}
              className={cn(
                "flex items-start gap-3 rounded-xl p-3 border transition-all cursor-pointer select-none",
                isDone
                  ? "bg-[#00FF88]/10 border-[#00FF88]/40 text-slate-300"
                  : "bg-[#080B21] border-slate-800 hover:border-[#00FF88]/30 text-white"
              )}
            >
              <div className="mt-0.5 shrink-0 text-[#00FF88]">
                {isDone ? (
                  <CheckSquare className="h-4 w-4 text-[#00FF88]" />
                ) : (
                  <Square className="h-4 w-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn("text-xs font-bold", isDone && "line-through text-[#00FF88]/80")}>
                    {step.week || `Bước ${idx + 1}`}
                  </span>
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#121A45] text-slate-400 border border-slate-700">
                    {step.tag || "Milestone"}
                  </span>
                </div>
                <p className={cn("text-[11px] text-slate-300 leading-relaxed", isDone && "line-through text-slate-500")}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

TimelineActionPlanWidget.displayName = "TimelineActionPlanWidget";
