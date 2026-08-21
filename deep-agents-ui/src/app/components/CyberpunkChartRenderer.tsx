"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  BarChart3,
  Radar,
  Gauge,
  Sparkles,
  PieChart,
  ShieldCheck
} from "lucide-react";

interface ChartItem {
  label: string;
  value: number;
  max?: number;
  color?: string;
  subtext?: string;
}

interface ChartPayload {
  title?: string;
  subtitle?: string;
  type?: "bar" | "radar" | "gauge" | "metrics" | "quadrant";
  score?: number;
  recommendation?: string;
  items?: ChartItem[];
  axes?: { axis: string; value: number }[];
  dimensions?: Record<string, number>;
}

const DEFAULT_COLORS = [
  "#00FF88", // Neon Green
  "#00D2FF", // Electric Cyan
  "#A855F7", // Neon Purple
  "#F59E0B", // Amber Gold
  "#EC4899", // Pink
  "#3B82F6", // Blue
];

export const CyberpunkChartRenderer = React.memo<{ code: string }>(({ code }) => {
  let parsed: ChartPayload = {};
  try {
    parsed = JSON.parse(code.trim());
  } catch {
    // If not JSON, try to extract items from key-value lines
    const lines = code.split("\n").filter((l) => l.includes(":") || l.includes("="));
    const items: ChartItem[] = [];
    lines.forEach((line) => {
      const parts = line.includes("=") ? line.split("=") : line.split(":");
      if (parts.length >= 2) {
        const label = parts[0].replace(/[-*_#]/g, "").trim();
        const numMatch = parts[1].match(/\d+(\.\d+)?/);
        if (numMatch) {
          items.push({
            label,
            value: parseFloat(numMatch[0]),
            max: 100,
          });
        }
      }
    });
    parsed = {
      title: "Marketplace Opportunity Breakdown",
      type: "bar",
      items,
    };
  }

  const {
    title = "Marketplace Signal Analysis",
    subtitle,
    type = "bar",
    score,
    recommendation,
    items = [],
    axes = [],
    dimensions = {},
  } = parsed;

  // Normalize items from dimensions object if present
  const displayItems: ChartItem[] =
    items.length > 0
      ? items
      : Object.entries(dimensions).map(([k, v], idx) => ({
          label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          value: Number(v),
          max: 100,
          color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        }));

  // RADIAL / GAUGE CHART
  if (type === "gauge" || (score !== undefined && displayItems.length === 0)) {
    const finalScore = score !== undefined ? score : 75;
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (finalScore / 100) * circumference;
    const scoreColor =
      finalScore >= 70 ? "#00FF88" : finalScore >= 50 ? "#F59E0B" : "#EF4444";

    return (
      <div className="my-5 flex flex-col items-center justify-center rounded-2xl border border-[#00FF88]/25 bg-[#0E1538]/90 p-5 shadow-[0_0_20px_rgba(0,255,136,0.15)] backdrop-blur-md">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-4 w-4 text-[#00D2FF]" />
          <h4 className="text-sm font-bold tracking-wider text-white uppercase">{title}</h4>
        </div>
        <div className="relative flex items-center justify-center">
          <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#121A45"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke={scoreColor}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold text-white">{finalScore}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Score</span>
          </div>
        </div>
        {recommendation && (
          <span
            className="mt-3 inline-flex items-center rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider"
            style={{
              backgroundColor: `${scoreColor}20`,
              color: scoreColor,
              border: `1px solid ${scoreColor}50`,
            }}
          >
            {recommendation}
          </span>
        )}
      </div>
    );
  }

  // RADAR / SPIDER CHART (5-Axis SVG)
  if (type === "radar" || (axes.length >= 3 && type !== "bar")) {
    const radarData = axes.length > 0 ? axes : displayItems.map(d => ({ axis: d.label, value: d.value }));
    const totalAxes = radarData.length;
    const center = 100;
    const radius = 70;
    const angleSlice = (Math.PI * 2) / totalAxes;

    const points = radarData.map((d, i) => {
      const r = (d.value / 100) * radius;
      const x = center + r * Math.sin(i * angleSlice);
      const y = center - r * Math.cos(i * angleSlice);
      return `${x},${y}`;
    }).join(" ");

    return (
      <div className="my-5 rounded-2xl border border-[#00D2FF]/30 bg-[#0E1538]/90 p-5 shadow-[0_0_20px_rgba(0,210,255,0.15)] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-[#00D2FF]/20 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-[#00D2FF]" />
            <h4 className="text-sm font-bold tracking-wider text-white uppercase">{title}</h4>
          </div>
          <span className="text-[10px] font-semibold text-[#00FF88] bg-[#00FF88]/15 px-2 py-0.5 rounded-full border border-[#00FF88]/30">
            5D Opportunity Radar
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
          <div className="relative">
            <svg width="200" height="200" className="overflow-visible">
              {/* Concentric Polygons */}
              {[0.25, 0.5, 0.75, 1.0].map((level, idx) => {
                const gridPoints = Array.from({ length: totalAxes }).map((_, i) => {
                  const x = center + radius * level * Math.sin(i * angleSlice);
                  const y = center - radius * level * Math.cos(i * angleSlice);
                  return `${x},${y}`;
                }).join(" ");
                return (
                  <polygon
                    key={idx}
                    points={gridPoints}
                    fill="none"
                    stroke="#1A2660"
                    strokeWidth="1"
                  />
                );
              })}
              {/* Axes lines */}
              {Array.from({ length: totalAxes }).map((_, i) => {
                const x = center + radius * Math.sin(i * angleSlice);
                const y = center - radius * Math.cos(i * angleSlice);
                return (
                  <line
                    key={i}
                    x1={center}
                    y1={center}
                    x2={x}
                    y2={y}
                    stroke="#1A2660"
                    strokeWidth="1"
                  />
                );
              })}
              {/* Radar Fill Area */}
              <polygon
                points={points}
                fill="rgba(0, 255, 136, 0.25)"
                stroke="#00FF88"
                strokeWidth="2"
                className="transition-all duration-700"
              />
              {/* Data points */}
              {radarData.map((d, i) => {
                const r = (d.value / 100) * radius;
                const x = center + r * Math.sin(i * angleSlice);
                const y = center - r * Math.cos(i * angleSlice);
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="4"
                    fill="#00D2FF"
                    stroke="#080B21"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </div>
          {/* Legend Table */}
          <div className="flex flex-col gap-2 min-w-[200px] text-xs">
            {radarData.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                <span className="text-slate-300">{d.axis}</span>
                <span className="font-mono font-bold text-[#00FF88]">{d.value}/100</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT: CYBERPUNK ANIMATED HORIZONTAL BAR CHART
  return (
    <div className="my-5 rounded-2xl border border-[#00FF88]/25 bg-[#0E1538]/90 p-5 shadow-[0_0_20px_rgba(0,255,136,0.15)] backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#00FF88]/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#00FF88]" />
          <h4 className="text-sm font-bold tracking-wider text-white uppercase">{title}</h4>
        </div>
        {subtitle && (
          <span className="text-xs text-[#94A3B8]">{subtitle}</span>
        )}
      </div>

      {/* Progress Bars */}
      <div className="space-y-3.5">
        {displayItems.map((item, idx) => {
          const maxVal = item.max || 100;
          const pct = Math.min(100, Math.max(0, (item.value / maxVal) * 100));
          const barColor = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{item.label}</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  <span style={{ color: barColor }}>{item.value}</span>
                  <span className="text-[10px] text-slate-400">/ {maxVal}</span>
                </div>
              </div>
              {/* Progress track */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#080B21] border border-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_currentColor]"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: barColor,
                    color: barColor,
                  }}
                />
              </div>
              {item.subtext && (
                <p className="text-[10px] text-slate-400 italic">{item.subtext}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

CyberpunkChartRenderer.displayName = "CyberpunkChartRenderer";
