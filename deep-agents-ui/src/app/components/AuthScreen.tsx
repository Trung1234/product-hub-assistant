"use client";

import React, { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  Zap,
  CheckCircle2,
  Cpu
} from "lucide-react";

export function AuthScreen() {
  const { signIn, signUp, signInDemo } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("designer");
  const [orgId, setOrgId] = useState("printway_internal");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (tab === "signin") {
      const res = await signIn(email, password);
      if (res.error) setErrorMsg(res.error);
    } else {
      const res = await signUp(email, password, fullName, role, orgId);
      if (res.error) setErrorMsg(res.error);
    }
    setLoading(false);
  };

  const handleQuickDemo = async (demoEmail: string, demoRole: string) => {
    setEmail(demoEmail);
    setPassword("Printway@2026");
    setLoading(true);
    setErrorMsg(null);
    const res = await signIn(demoEmail, "Printway@2026");
    if (res.error) {
      // Fallback demo
      signInDemo(demoEmail, demoRole);
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen w-screen flex items-center justify-center bg-[#080B21] text-white overflow-hidden p-4">
      {/* Cyberpunk Background Gradients & Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#080B21] to-[#080B21] pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00D2FF]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#00FF88]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-3 shadow-lg">
            <Sparkles className="w-4 h-4 text-[#00FF88]" />
            <span className="text-xs font-semibold text-slate-300">
              Printway AI R&D Platform 2.0
            </span>
          </div>

          <div className="flex justify-center mb-3">
            <div className="flex h-11 px-4 items-center justify-center rounded-xl bg-white shadow-xl">
              <img
                src="/logo_header.png"
                alt="Printway"
                className="h-6 w-auto object-contain"
              />
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Product Opportunity Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Hệ thống AI Copilot phát hiện cơ hội sản phẩm POD đa sàn thời gian thực
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#0E1538]/80 border border-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex rounded-xl bg-[#080B21] p-1 mb-6 border border-white/5">
            <button
              type="button"
              onClick={() => { setTab("signin"); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "signin"
                  ? "bg-[#00FF88] text-[#080B21] shadow-md shadow-[#00FF88]/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => { setTab("signup"); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "signup"
                  ? "bg-[#00FF88] text-[#080B21] shadow-md shadow-[#00FF88]/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Tạo Tài Khoản Mới
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === "signup" && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Họ và tên
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#080B21]/60 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#00FF88]/50 focus:ring-1 focus:ring-[#00FF88]"
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email công việc
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#080B21]/60 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#00FF88]/50 focus:ring-1 focus:ring-[#00FF88]"
                  placeholder="designer@printway.io"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-white/10 bg-[#080B21]/60 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#00FF88]/50 focus:ring-1 focus:ring-[#00FF88]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {tab === "signup" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Vai trò (Role)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#080B21] text-white text-xs focus:outline-none focus:border-[#00FF88]"
                  >
                    <option value="designer">🎨 POD Designer</option>
                    <option value="lead_rd">🚀 Lead R&D</option>
                    <option value="seller">🛍️ VIP Seller</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Workspace
                  </label>
                  <select
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/10 bg-[#080B21] text-white text-xs focus:outline-none focus:border-[#00FF88]"
                  >
                    <option value="printway_internal">🏢 Printway R&D</option>
                    <option value="org_vip_sellers">👥 VIP Workgroup</option>
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D2FF] text-[#080B21] font-bold text-xs shadow-lg shadow-[#00FF88]/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Đang xử lý xác thực...</span>
              ) : (
                <>
                  <span>{tab === "signin" ? "Đăng Nhập Vào Hệ Thống" : "Đăng Ký & Bắt Đầu Ngay"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Buttons */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Truy Cập Nhanh (Demo Accounts)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("admin@printway.io", "lead_rd")}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00FF88]/50 hover:bg-[#00FF88]/10 text-left transition-all group cursor-pointer"
              >
                <div className="text-[10px] font-bold text-slate-200 group-hover:text-[#00FF88]">Lead R&D</div>
                <div className="text-[9px] text-slate-500">Toàn quyền</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("designer@printway.io", "designer")}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00D2FF]/50 hover:bg-[#00D2FF]/10 text-left transition-all group cursor-pointer"
              >
                <div className="text-[10px] font-bold text-slate-200 group-hover:text-[#00D2FF]">Designer</div>
                <div className="text-[9px] text-slate-500">Mẫu & Trends</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("seller@crossborder.com", "seller")}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-purple-400/50 hover:bg-purple-500/10 text-left transition-all group cursor-pointer"
              >
                <div className="text-[10px] font-bold text-slate-200 group-hover:text-purple-400">VIP Seller</div>
                <div className="text-[9px] text-slate-500">Top Niche</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security & Multi-Tenant Badges */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Supabase PostgreSQL RLS
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Bảo Mật Đa Người Dùng
          </span>
        </div>
      </div>
    </div>
  );
}
