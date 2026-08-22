"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Zap,
  Cpu,
  Globe,
  Database,
  Mail,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Github,
  Linkedin,
  ExternalLink,
  Layers,
  Bot,
  Users,
  Compass,
  FileSpreadsheet,
  Workflow,
  Server,
  Lock,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface IntroLandingPageProps {
  onEnterApp?: () => void;
}

export function IntroLandingPage({ onEnterApp }: IntroLandingPageProps) {
  const { user, signIn, signUp, signInDemo } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("lead_rd");
  const [orgId, setOrgId] = useState("printway_internal");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (authTab === "signin") {
      const res = await signIn(email, password);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setAuthModalOpen(false);
        onEnterApp?.();
      }
    } else {
      const res = await signUp(email, password, fullName, role, orgId);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setAuthModalOpen(false);
        onEnterApp?.();
      }
    }
    setLoading(false);
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoRole: string) => {
    setLoading(true);
    setErrorMsg(null);
    const res = await signIn(demoEmail, "Printway@2026");
    if (res.error) {
      signInDemo(demoEmail, demoRole);
    }
    setLoading(false);
    setAuthModalOpen(false);
    onEnterApp?.();
  };

  const teamMembers = [
    {
      name: "Nguyễn Hoàng Phương",
      role: "Team Lead & Fullstack AI Architect",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      description: "Chịu trách nhiệm kiến trúc tổng thể hệ thống Agentic AI, tích hợp LangGraph ReAct Orchestrator, Zero-Hallucination Grounding và nền tảng Next.js 16.",
      tags: ["LangGraph", "Python 3.13", "Next.js 16", "Supabase RLS", "System Design"],
      highlight: "AI Architecture & Core Engine",
      color: "#00FF88"
    },
    {
      name: "Trần Minh Đức",
      role: "Senior AI & Data Crawler Engineer",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
      description: "Xây dựng hạ tầng Anti-Blocking Web Scraping đa sàn (Etsy, Amazon, Pinterest), kết nối Browserless Cloud CDP, Crawlee Stealth và thuật toán chấm điểm 5D.",
      tags: ["Browserless CDP", "Crawlee", "Playwright", "5D Scoring Algorithm", "Pytrends"],
      highlight: "Multi-Source Crawler Pool",
      color: "#00D2FF"
    },
    {
      name: "Lê Thanh Tùng",
      role: "Product Strategist & POD Domain Specialist",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
      description: "Định hình mô hình phân tích biên lợi nhuận xưởng Printway, thiết kế Knowledge Base chuyên sâu POD và hệ thống tự động hóa gửi email định kỳ qua Resend.",
      tags: ["POD Manufacturing", "Resend API", "Profit Margin Engine", "Knowledge Base"],
      highlight: "Supply Chain & Profit Optimization",
      color: "#A78BFA"
    },
    {
      name: "Phạm Mai Anh",
      role: "Lead UI/UX Designer & Frontend Engineer",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
      description: "Thiết kế hệ thống Cyberpunk Design System, tương tác Radar Chart 6 chiều, Responsive Sidebar đa cấp độ và Dynamic OpenGraph Social Preview.",
      tags: ["Cyberpunk UI", "Tailwind CSS", "Recharts", "Interactive Widgets", "SEO OG Engine"],
      highlight: "Design System & Interactive UX",
      color: "#F59E0B"
    }
  ];

  return (
    <div className="min-h-screen bg-[#080B21] text-slate-100 font-sans selection:bg-[#00FF88]/30 selection:text-[#00FF88]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-[#00FF88]/15 bg-[#080B21]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 px-3 items-center justify-center rounded-xl bg-white shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <img
                src="/logo_header.png"
                alt="Printway.io"
                className="h-5 w-auto object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-wider text-white">PRINTWAY NEXUS</span>
                <span className="rounded-full bg-[#00FF88]/15 px-2 py-0.5 text-[10px] font-bold text-[#00FF88] border border-[#00FF88]/30">
                  v2.0 PROD
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">AI R&D & MARKET INTELLIGENCE</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-[#00FF88] transition-colors">Tính Năng Cốt Lõi</a>
            <a href="#architecture" className="hover:text-[#00D2FF] transition-colors">Kiến Trúc Kỹ Thuật</a>
            <a href="#team" className="hover:text-[#A78BFA] transition-colors">Đội Ngũ Phát Triển</a>
            <a href="#stats" className="hover:text-white transition-colors">Ma Trận 5D</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <button
                type="button"
                onClick={() => onEnterApp?.()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D2FF] px-4 py-2 text-xs font-bold text-[#080B21] shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:opacity-90 transition-all cursor-pointer"
              >
                <span>Vào Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("signin");
                    setAuthModalOpen(true);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-white hover:border-[#00FF88]/40 hover:bg-white/10 transition-all cursor-pointer"
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("signup");
                    setAuthModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00FF88] px-3.5 py-1.5 text-xs font-bold text-[#080B21] shadow-[0_0_15px_rgba(0,255,136,0.4)] hover:bg-[#00FF88]/90 transition-all cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Trải Nghiệm Ngay</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-24">
        {/* Background Cyberpunk Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00FF88]/15 via-[#00D2FF]/10 to-transparent pointer-events-none" />
        <div className="absolute top-40 -left-20 w-80 h-80 bg-[#00FF88]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-60 -right-20 w-80 h-80 bg-[#00D2FF]/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Competition Summit Banner */}
          <div className="mx-auto mb-8 max-w-4xl overflow-hidden rounded-2xl border border-[#00FF88]/30 bg-[#0E1538]/90 shadow-[0_0_35px_rgba(0,255,136,0.2)]">
            <img
              src="/banner_crossborder.png"
              alt="Cross Border AI Innovation Summit 2026"
              className="h-auto w-full max-h-[160px] sm:max-h-[220px] object-cover object-center"
            />
            <div className="bg-gradient-to-r from-[#0E1538] via-[#121A45] to-[#0E1538] px-4 py-2 border-t border-[#00FF88]/20 flex items-center justify-between text-xs">
              <span className="font-mono text-[#00FF88] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Cross Border AI Innovation Summit 2026
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Track: E-Commerce AI Innovation</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#00FF88]/30 bg-[#0E1538] px-4 py-1.5 text-xs font-semibold text-[#00FF88] shadow-[0_0_20px_rgba(0,255,136,0.15)] mb-6">
            <Bot className="h-4 w-4 text-[#00D2FF]" />
            <span>Thế Hệ AI Copilot R&D Sản Phẩm Print-on-Demand Đa Sàn</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Phát Hiện & Thẩm Định Cơ Hội Sản Phẩm POD Bằng{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF88] via-[#00D2FF] to-[#FFFFFF]">
              Agentic AI Đa Tín Hiệu
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
            <strong className="text-white">Printway Nexus</strong> tự động cào tín hiệu thị trường thời gian thực từ <strong>Etsy, Amazon, Pinterest & Google Trends</strong>, chấm điểm cơ hội theo <strong>Ma trận 5D</strong> và đối soát trực tiếp với danh mục phôi xưởng <strong>Printway Việt Nam</strong>.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (user) onEnterApp?.();
                else {
                  setAuthTab("signin");
                  setAuthModalOpen(true);
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D2FF] px-6 py-3.5 text-sm font-extrabold text-[#080B21] shadow-[0_0_25px_rgba(0,255,136,0.4)] hover:scale-105 transition-all cursor-pointer"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>{user ? "Vào Bàn Làm Việc R&D" : "Bắt Đầu Nghiên Cứu Miễn Phí"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <a
              href="#architecture"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0E1538] px-6 py-3.5 text-sm font-bold text-white hover:border-[#00D2FF]/50 hover:bg-[#121A45] transition-all"
            >
              <Workflow className="h-4 w-4 text-[#00D2FF]" />
              <span>Xem Sơ Đồ Kiến Trúc</span>
            </a>
          </div>

          {/* Key Metrics Strip */}
          <div id="stats" className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-4xl mx-auto text-left">
            <div className="rounded-2xl border border-[#00FF88]/20 bg-[#0E1538]/70 p-4 backdrop-blur-md">
              <div className="text-[11px] font-mono text-slate-400">NGUỒN DỮ LIỆU CÀO THẬT</div>
              <div className="text-xl sm:text-2xl font-black text-[#00FF88] mt-1">5+ Nền Tảng</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Etsy, Amazon, Trends, Pinterest, Shopee</p>
            </div>
            <div className="rounded-2xl border border-[#00D2FF]/20 bg-[#0E1538]/70 p-4 backdrop-blur-md">
              <div className="text-[11px] font-mono text-slate-400">CHẤM ĐIỂM CƠ HỘI</div>
              <div className="text-xl sm:text-2xl font-black text-[#00D2FF] mt-1">Ma Trận 5D</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Demand, Comp, Velocity, Margin, Trend</p>
            </div>
            <div className="rounded-2xl border border-[#A78BFA]/20 bg-[#0E1538]/70 p-4 backdrop-blur-md">
              <div className="text-[11px] font-mono text-slate-400">TỐC ĐỘ SẢN XUẤT</div>
              <div className="text-xl sm:text-2xl font-black text-[#A78BFA] mt-1">1 - 3 Ngày</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Xưởng Printway VN + 5-9 ngày giao US</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0E1538]/70 p-4 backdrop-blur-md">
              <div className="text-[11px] font-mono text-slate-400">ĐỘ CHÍNH XÁC SỐ LIỆU</div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">100% Grounded</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Triệt tiêu ảo giác, trích dẫn URL kiểm chứng</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Features Section */}
      <section id="features" className="py-16 border-t border-white/5 bg-[#0A0E2B]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-[#00FF88] uppercase tracking-widest">TÍNH NĂNG VƯỢT TRỘI</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-black text-white">
              Đột Phá Toàn Diện Quy Trình R&D Sản Phẩm Cross-Border
            </h3>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Từ ý tưởng sơ khai đến báo cáo thẩm định sản xuất xưởng chỉ trong 60 giây.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-[#00FF88]/20 bg-[#0E1538] p-6 hover:border-[#00FF88] transition-all group">
              <div className="h-10 w-10 rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/30 flex items-center justify-center text-[#00FF88] mb-4 group-hover:scale-110 transition-transform">
                <Globe className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2 group-hover:text-[#00FF88] transition-colors">
                Cào Đa Sàn Chống Chặn Thời Gian Thực
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Hệ thống Anti-Blocking kết hợp <strong>Browserless Cloud CDP</strong> (Residential Proxy US) và <strong>Crawlee Stealth</strong>, tự động vượt Cloudflare/PerimeterX để trích xuất giá bán, BSR, lượt review và tốc độ tăng trưởng.
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-[#00FF88]">
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#00FF88]/30">Etsy Scraper</span>
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#00FF88]/30">Amazon US PA-API</span>
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#00FF88]/30">pytrends US</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-[#00D2FF]/20 bg-[#0E1538] p-6 hover:border-[#00D2FF] transition-all group">
              <div className="h-10 w-10 rounded-xl bg-[#00D2FF]/10 border border-[#00D2FF]/30 flex items-center justify-center text-[#00D2FF] mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2 group-hover:text-[#00D2FF] transition-colors">
                Chấm Điểm Ma Trận Cơ Hội 5D & Lợi Nhuận
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Đánh giá tiềm năng sản phẩm theo 5 trục: <em>Search Demand (25%), Competition Saturation (20%), Sales Velocity (25%), Profit Margin (20%) & Trend YoY (10%)</em>. Tự động tính điểm hòa vốn ROAS cho Seller.
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-[#00D2FF]">
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#00D2FF]/30">Radar 6 Chiều</span>
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#00D2FF]/30">Printway Base Cost</span>
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#00D2FF]/30">Ad Spend Simulation</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-[#A78BFA]/20 bg-[#0E1538] p-6 hover:border-[#A78BFA] transition-all group">
              <div className="h-10 w-10 rounded-xl bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-[#A78BFA] mb-4 group-hover:scale-110 transition-transform">
                <Mail className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2 group-hover:text-[#A78BFA] transition-colors">
                Tự Động Hóa Lịch Trình & Email Resend
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Lập lịch quét ngách thị trường hàng ngày/hàng tuần theo từng tài khoản độc lập, tự động tổng hợp báo cáo HTML Responsive gửi về email cá nhân với điểm số và 13 tag SEO Etsy chuẩn.
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-[#A78BFA]">
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#A78BFA]/30">Resend API Delivery</span>
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#A78BFA]/30">Multi-User Isolation</span>
                <span className="px-2 py-0.5 rounded bg-[#080B21] border border-[#A78BFA]/30">Automated Cron</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System Architecture Section */}
      <section id="architecture" className="py-16 bg-[#080B21] border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-[#00D2FF] uppercase tracking-widest">KIẾN TRÚC KỸ THUẬT</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-black text-white">
              Kiến Trúc Agentic AI & Data Pipeline Chuyên Sâu
            </h3>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Phối hợp đa tầng giữa LangGraph ReAct Orchestrator, Crawlers chống chặn, Supabase RLS và Next.js 16 UI.
            </p>
          </div>

          {/* Architecture Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Layer 1: Client & UI */}
            <div className="rounded-2xl border border-white/10 bg-[#0E1538] p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00FF88] mb-3">
                <Layers className="h-4 w-4" />
                <span>1. PRESENTATION LAYER</span>
              </div>
              <h5 className="text-sm font-bold text-white mb-2">Next.js 16 App Router</h5>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF88] shrink-0 mt-0.5" />
                  <span>Turbopack HMR & Fast SSR</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF88] shrink-0 mt-0.5" />
                  <span>LangGraph SDK Stream Protocol</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF88] shrink-0 mt-0.5" />
                  <span>Dynamic OG Image & JSON-LD SEO</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF88] shrink-0 mt-0.5" />
                  <span>Responsive Cyberpunk Theme</span>
                </li>
              </ul>
            </div>

            {/* Layer 2: Agentic Orchestration */}
            <div className="rounded-2xl border border-[#00FF88]/30 bg-[#0E1538] p-5 shadow-[0_0_20px_rgba(0,255,136,0.1)]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00D2FF] mb-3">
                <Cpu className="h-4 w-4" />
                <span>2. AI ORCHESTRATION</span>
              </div>
              <h5 className="text-sm font-bold text-white mb-2">LangGraph ReAct Agent</h5>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00D2FF] shrink-0 mt-0.5" />
                  <span>15 Granular Specialized Tools</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00D2FF] shrink-0 mt-0.5" />
                  <span>Strict Zero-Hallucination Prompt</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00D2FF] shrink-0 mt-0.5" />
                  <span>Human-in-the-Loop Clarification</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00D2FF] shrink-0 mt-0.5" />
                  <span>Context Offloading (&gt;10KB Data)</span>
                </li>
              </ul>
            </div>

            {/* Layer 3: Anti-Blocking Crawlers */}
            <div className="rounded-2xl border border-white/10 bg-[#0E1538] p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#A78BFA] mb-3">
                <Server className="h-4 w-4" />
                <span>3. CRAWLER POOL</span>
              </div>
              <h5 className="text-sm font-bold text-white mb-2">Live Multi-Source Scrapers</h5>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                  <span>Browserless Cloud CDP (US Proxies)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                  <span>Crawlee Anti-Detect Engine</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                  <span>Amazon PA-API v5 + Web Scraper</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                  <span>Live Printway CDN Catalog Sync</span>
                </li>
              </ul>
            </div>

            {/* Layer 4: Storage & Delivery */}
            <div className="rounded-2xl border border-white/10 bg-[#0E1538] p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F59E0B] mb-3">
                <Database className="h-4 w-4" />
                <span>4. STORAGE & DELIVERY</span>
              </div>
              <h5 className="text-sm font-bold text-white mb-2">Supabase & Resend Engine</h5>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                  <span>PostgreSQL Row-Level Security</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                  <span>Supabase S3 Storage (CSV Matrix)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                  <span>Resend Executive HTML Email</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                  <span>Thread Forking & Snapshot Sharing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Team Members Section (4 Thành Viên) */}
      <section id="team" className="py-16 bg-[#0A0E2B] border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-[#A78BFA] uppercase tracking-widest">ĐỘI NGŨ PHÁT TRIỂN</h2>
            <h3 className="mt-2 text-2xl sm:text-4xl font-black text-white">
              Gặp Gỡ Đội Ngũ Sáng Lập Printway Nexus
            </h3>
            <p className="mt-3 text-xs sm:text-sm text-slate-400">
              Các kỹ sư AI, chuyên gia dữ liệu và nhà chiến lược thương mại điện tử xuyên biên giới.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member, index) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-[#0E1538] p-5 flex flex-col justify-between hover:border-[#00FF88]/50 hover:shadow-[0_0_30px_rgba(0,255,136,0.15)] transition-all group"
              >
                <div>
                  {/* Member Photo */}
                  <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 aspect-square bg-[#080B21]">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E1538] via-transparent to-transparent opacity-80" />
                    <span
                      className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border"
                      style={{
                        backgroundColor: `${member.color}15`,
                        borderColor: `${member.color}40`,
                        color: member.color
                      }}
                    >
                      {member.highlight}
                    </span>
                  </div>

                  {/* Name & Role */}
                  <h4 className="text-base font-black text-white group-hover:text-[#00FF88] transition-colors">
                    {member.name}
                  </h4>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 mb-3">
                    {member.role}
                  </p>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {member.description}
                  </p>
                </div>

                {/* Tech Tags */}
                <div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {member.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="rounded bg-[#080B21] px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-white/5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-white/5 text-slate-400 text-xs">
                    <a
                      href="https://github.com/Trung1234/product-hub-assistant"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#00FF88] transition-colors"
                      title="GitHub"
                    >
                      <Github className="h-4 w-4" />
                    </a>
                    <a
                      href="https://printway.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#00D2FF] transition-colors"
                      title="Printway.io"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-[#080B21] border-t border-white/5 text-center relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[#00FF88]/30 bg-gradient-to-b from-[#0E1538] to-[#080B21] p-8 sm:p-12 shadow-[0_0_50px_rgba(0,255,136,0.15)] relative">
            <h3 className="text-2xl sm:text-4xl font-black text-white">
              Sẵn Sàng Bứt Phá Doanh Số POD Toàn Cầu?
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-xs sm:text-sm text-slate-300">
              Trải nghiệm ngay trợ lý AI phát hiện ngách sản phẩm tiềm năng và tối ưu chuỗi cung ứng xưởng Printway trong vòng 60 giây.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (user) onEnterApp?.();
                  else {
                    setAuthTab("signin");
                    setAuthModalOpen(true);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D2FF] px-8 py-4 text-sm font-extrabold text-[#080B21] shadow-[0_0_30px_rgba(0,255,136,0.4)] hover:scale-105 transition-all cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>{user ? "Vào Bàn Làm Việc R&D" : "Trải Nghiệm Đăng Nhập Ngay"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#060818] py-8 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-7 px-2.5 items-center justify-center rounded-lg bg-white">
              <img
                src="/logo_header.png"
                alt="Printway"
                className="h-3.5 w-auto object-contain"
              />
            </div>
            <span>© 2026 Printway Nexus. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <a href="https://printway.io/en" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Printway Official Catalog
            </a>
            <a href="https://github.com/Trung1234/product-hub-assistant" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>

      {/* Quick Auth Modal with Competition Background */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#00FF88]/30 bg-[#0E1538]/90 p-6 sm:p-8 shadow-[0_0_60px_rgba(0,255,136,0.2)] backdrop-blur-2xl">
            {/* Background Competition Watermark */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 pointer-events-none scale-105"
              style={{ backgroundImage: "url('/banner_crossborder.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E1538] via-[#0E1538]/90 to-[#0E1538]/75 pointer-events-none" />

            <div className="relative z-10">
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-0 right-0 text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Đóng
              </button>

              {/* Header */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-3">
                  <div className="flex h-10 px-3.5 items-center justify-center rounded-xl bg-white shadow-xl">
                    <img
                      src="/logo_header.png"
                      alt="Printway"
                      className="h-5 w-auto object-contain"
                    />
                  </div>
                </div>
                <h3 className="text-xl font-black text-white">
                  {authTab === "signin" ? "Đăng Nhập Printway Nexus" : "Tạo Tài Khoản Mới"}
                </h3>
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  Hệ thống AI R&D phát hiện cơ hội sản phẩm Print-on-Demand
                </p>
              </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-[#080B21] p-1 mb-5 border border-white/5 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthTab("signin"); setErrorMsg(null); }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  authTab === "signin"
                    ? "bg-[#00FF88] text-[#080B21] shadow-md shadow-[#00FF88]/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab("signup"); setErrorMsg(null); }}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  authTab === "signup"
                    ? "bg-[#00FF88] text-[#080B21] shadow-md shadow-[#00FF88]/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Tạo Tài Khoản
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authTab === "signup" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Họ và tên</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-[#080B21] border border-white/10 text-white text-xs focus:border-[#00FF88] outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-400">Email công việc</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@printway.io"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[#080B21] border border-white/10 text-white text-xs focus:border-[#00FF88] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400">Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[#080B21] border border-white/10 text-white text-xs focus:border-[#00FF88] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-[#00FF88] text-[#080B21] text-xs font-black hover:bg-[#00FF88]/90 transition-all shadow-[0_0_20px_rgba(0,255,136,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Đang xử lý..." : authTab === "signin" ? "Đăng Nhập Vào Hệ Thống" : "Tạo Tài Khoản Mới"}
              </button>
            </form>

            {/* Quick Demo Access */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                ⚡ TRUY CẬP NHANH (DEMO ACCOUNTS)
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("nhphuong.code@gmail.com", "lead_rd")}
                  className="p-2 rounded-xl bg-[#080B21] border border-white/10 hover:border-[#00FF88] text-center transition-all cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-white">Lead R&D</div>
                  <div className="text-[9px] text-[#00FF88]">Toàn quyền</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("designer@printway.io", "designer")}
                  className="p-2 rounded-xl bg-[#080B21] border border-white/10 hover:border-[#00D2FF] text-center transition-all cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-white">Designer</div>
                  <div className="text-[9px] text-[#00D2FF]">Mẫu & Trends</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin("seller@printway.io", "seller")}
                  className="p-2 rounded-xl bg-[#080B21] border border-white/10 hover:border-[#A78BFA] text-center transition-all cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-white">VIP Seller</div>
                  <div className="text-[9px] text-[#A78BFA]">Top Niche</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
