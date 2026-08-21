"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { User, LogIn, LogOut, ShieldCheck, Building2, ChevronDown, Sparkles } from "lucide-react";

export function AuthButton() {
  const { user, profile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const userRole = profile?.role === "lead_rd" ? "🚀 Lead R&D" : profile?.role === "seller" ? "🛍️ VIP Seller" : "🎨 POD Designer";
  const userInitials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Trigger Button */}
      <button
        type="button"
        data-testid="header-profile-trigger"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[#121A45] border border-[#00FF88]/30 hover:border-[#00FF88] text-white text-xs font-medium transition-all shadow-sm cursor-pointer group"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#080B21] border border-[#00FF88]/50 text-[10px] font-bold text-[#00FF88] group-hover:scale-105 transition-transform">
          {userInitials}
        </div>
        <span className="max-w-[120px] truncate text-slate-200 font-semibold">{displayName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180 text-[#00FF88]" : ""}`} />
      </button>

      {/* Floating Logout / Profile Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0E1538] border border-white/10 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          {/* User Details */}
          <div className="p-2.5 rounded-xl bg-[#080B21]/80 border border-white/5 mb-2">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E293B] border border-[#00FF88]/50 text-xs font-bold text-[#00FF88]">
                {userInitials}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white truncate">{displayName}</span>
                <span className="text-[10px] text-slate-400 truncate">{user?.email}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
              <span className="text-[10px] font-bold text-[#00FF88] bg-[#00FF88]/10 px-2 py-0.5 rounded-full border border-[#00FF88]/30">
                {userRole}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-500" />
                Printway
              </span>
            </div>
          </div>

          {/* Action: Sign Out */}
          <button
            type="button"
            data-testid="header-logout-button"
            onClick={() => {
              setDropdownOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500/20 transition-all cursor-pointer group"
          >
            <LogOut className="w-4 h-4 text-red-400 group-hover:translate-x-0.5 transition-transform" />
            <span>Đăng Xuất (Sign Out)</span>
          </button>
        </div>
      )}
    </div>
  );
}
