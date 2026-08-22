"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Mail,
  Search,
  CheckCircle2,
  Sparkles,
  Calendar,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Loader2,
  X,
} from "lucide-react";
import { useUserSchedules, ScheduledPromptItem, ScheduleFrequency } from "@/app/hooks/useUserSchedules";
import { useAuth } from "@/providers/AuthProvider";

const FREQUENCY_LABELS: Record<ScheduleFrequency, { label: string; badge: string }> = {
  daily: { label: "Hàng ngày (08:00 AM)", badge: "bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/30" },
  weekly: { label: "Hàng tuần (Thứ Hai)", badge: "bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/30" },
  every_6h: { label: "Mỗi 6 tiếng", badge: "bg-[#B026FF]/10 text-[#B026FF] border-[#B026FF]/30" },
  hourly: { label: "Hàng giờ (Realtime)", badge: "bg-[#FF0055]/10 text-[#FF0055] border-[#FF0055]/30" },
};

const SUGGESTED_TEMPLATES = [
  {
    keyword: "Baby First Christmas Ornament 2026 Custom Acrylic",
    productType: "Mica Trong Suốt 3mm",
  },
  {
    keyword: "Personalized Grandpa Gift Acrylic Desk Plaque Wood Base LED",
    productType: "Mica Đèn LED Đế Gỗ",
  },
  {
    keyword: "Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve",
    productType: "Áo Nỉ Thêu Tay",
  },
  {
    keyword: "Custom Stainless Steel Tumbler 40oz with Handle Teacher Gift",
    productType: "Ly Inox 304 40oz",
  },
  {
    keyword: "Personalized Dog Photo Acrylic Car Hanging Ornament",
    productType: "Mica Cắt CNC Treo Xe",
  },
];

interface ScheduleManagementViewProps {
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const ScheduleManagementView: React.FC<ScheduleManagementViewProps> = ({
  onOpenChatWithPrompt,
}) => {
  const { user, profile } = useAuth();
  const {
    schedules,
    isLoaded,
    runningId,
    activeCount,
    addSchedule,
    togglePause,
    deleteSchedule,
    runScheduleNow,
  } = useUserSchedules();

  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form State
  const [formKeyword, setFormKeyword] = useState("");
  const [formFrequency, setFormFrequency] = useState<ScheduleFrequency>("daily");
  const [formEmail, setFormEmail] = useState(user?.email || "nhphuong.code@gmail.com");
  const [formProductType, setFormProductType] = useState("Mica Trong Suốt 3mm");

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) return schedules;
    const q = searchQuery.toLowerCase();
    return schedules.filter(
      (s) =>
        s.keyword.toLowerCase().includes(q) ||
        s.recipientEmail.toLowerCase().includes(q) ||
        (s.productType && s.productType.toLowerCase().includes(q))
    );
  }, [schedules, searchQuery]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKeyword.trim() || !formEmail.trim()) {
      showToast("Vui lòng điền đầy đủ từ khóa và email người nhận!", "error");
      return;
    }

    addSchedule({
      keyword: formKeyword.trim(),
      frequency: formFrequency,
      recipientEmail: formEmail.trim(),
      productType: formProductType,
    });

    setModalOpen(false);
    setFormKeyword("");
    showToast(`Đã tạo lịch quét thành công cho ngách "${formKeyword.trim()}"!`);
  };

  const handleRunNow = async (item: ScheduledPromptItem) => {
    showToast(`Đang kích hoạt AI cào dữ liệu và gửi email tới ${item.recipientEmail}...`);
    const res = await runScheduleNow(item);
    if (res.success) {
      showToast(`🎉 Đã gửi email báo cáo thành công! (ID: ${res.emailId})`);
    } else {
      showToast(`❌ Gửi email thất bại: ${res.error}`, "error");
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-y-auto bg-[#080B21] text-white p-4 md:p-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl transition-all border ${
            toastMessage.type === "success"
              ? "bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/40 backdrop-blur-md"
              : "bg-[#FF0055]/10 text-[#FF0055] border-[#FF0055]/40 backdrop-blur-md"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-[#00FF88]" />
          ) : (
            <AlertCircle className="h-5 w-5 text-[#FF0055]" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1E293B]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88]">
              <Clock className="h-4 w-4" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
              Quản Lý Lịch Quét Tự Động & Chuyển Phát Email
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#94A3B8]">
            Không gian làm việc riêng của:{" "}
            <span className="font-semibold text-[#00FF88]">{profile?.full_name || user?.email || "Lead R&D"}</span>{" "}
            ({user?.email || "admin@printway.io"})
          </p>
        </div>

        <button
          onClick={() => {
            setFormEmail(user?.email || "nhphuong.code@gmail.com");
            setModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D4FF] px-4 py-2.5 text-xs md:text-sm font-bold text-[#080B21] transition-all hover:opacity-90 shadow-lg shadow-[#00FF88]/20 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>+ Tạo Lịch Quét Mới</span>
        </button>
      </div>

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-6">
        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1230]/80 p-5 backdrop-blur-sm">
          <div className="text-sm font-bold text-[#94A3B8] mb-1">Lịch Đang Chạy Tự Động</div>
          <div className="text-3xl font-black text-[#00FF88]">{activeCount} / {schedules.length}</div>
          <div className="text-xs text-[#00FF88]/80 mt-1">Gửi định kỳ qua Resend</div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1230]/80 p-5 backdrop-blur-sm">
          <div className="text-sm font-bold text-[#94A3B8] mb-1">Hạ Tầng Giao Vận Email</div>
          <div className="text-2xl sm:text-3xl font-black text-[#00D4FF]">Resend API</div>
          <div className="text-xs text-[#00D4FF]/80 mt-1">Tỷ lệ chuyển phát 100%</div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1230]/80 p-5 backdrop-blur-sm">
          <div className="text-sm font-bold text-[#94A3B8] mb-1">Điểm 5D Trung Bình</div>
          <div className="text-3xl font-black text-[#B026FF]">
            {schedules.filter((s) => s.lastScore).length > 0
              ? `${Math.round(
                  schedules
                    .filter((s) => s.lastScore)
                    .reduce((acc, s) => acc + (s.lastScore || 0), 0) /
                    schedules.filter((s) => s.lastScore).length
                )} / 100`
              : "-- / 100"}
          </div>
          <div className="text-xs text-[#B026FF]/80 mt-1">
            {schedules.filter((s) => s.lastScore).length > 0 ? "Tính theo lịch đã chạy" : "Chưa có dữ liệu"}
          </div>
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0D1230]/80 p-5 backdrop-blur-sm">
          <div className="text-sm font-bold text-[#94A3B8] mb-1">Dữ Liệu Thời Gian Thực</div>
          <div className="text-2xl sm:text-3xl font-black text-white">Etsy + Amazon</div>
          <div className="text-xs text-[#94A3B8] mt-1">Google Trends + Xưởng VN</div>
        </div>
      </div>

      {/* Search & Table Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo từ khóa hoặc email..."
            className="w-full rounded-xl border border-[#1E293B] bg-[#0D1230] pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:border-[#00FF88] focus:outline-none"
          />
        </div>
        <div className="text-sm text-[#94A3B8]">
          Hiển thị <span className="font-bold text-white">{filteredSchedules.length}</span> lịch quét của bạn
        </div>
      </div>

      {/* Schedules Data Table */}
      <div className="flex-1 rounded-2xl border border-[#1E293B] bg-[#0D1230]/60 overflow-hidden backdrop-blur-sm">
        {filteredSchedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00FF88]/10 text-[#00FF88] mb-4 border border-[#00FF88]/30">
              <Calendar className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1.5">Chưa có lịch quét nào phù hợp</h3>
            <p className="text-sm text-[#94A3B8] max-w-md mb-5 leading-relaxed">
              Hãy tạo lịch hẹn đầu tiên để hệ thống tự động cào tín hiệu thị trường và gửi báo cáo phân tích về email của bạn định kỳ.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-xl bg-[#00FF88] px-5 py-2.5 text-sm font-black text-[#080B21] transition-all hover:bg-[#00FF88]/90 cursor-pointer shadow-lg"
            >
              + Tạo Lịch Quét Ngay
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1E293B] bg-[#080B21]/80 text-[#94A3B8] font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-5 py-3.5">Từ Khóa / Prompt POD</th>
                  <th className="px-5 py-3.5">Tần Suất</th>
                  <th className="px-5 py-3.5">Email Nhận Báo Cáo</th>
                  <th className="px-5 py-3.5">Trạng Thái</th>
                  <th className="px-5 py-3.5">Lần Chạy Cuối</th>
                  <th className="px-5 py-3.5 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60">
                {filteredSchedules.map((item) => {
                  const freq = FREQUENCY_LABELS[item.frequency] || FREQUENCY_LABELS.daily;
                  const isRunning = runningId === item.id;

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[#1E293B]/30">
                      {/* Keyword & Product Type */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white text-sm line-clamp-1">{item.keyword}</div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#94A3B8]">
                          <Layers className="h-3 w-3 text-[#00FF88]" />
                          <span>{item.productType || "Mica In UV Xuyên Sáng"}</span>
                        </div>
                      </td>

                      {/* Frequency Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${freq.badge}`}>
                          {freq.label}
                        </span>
                      </td>

                      {/* Recipient Email */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-white">
                          <Mail className="h-3.5 w-3.5 text-[#00D4FF]" />
                          <span className="font-mono">{item.recipientEmail}</span>
                        </div>
                      </td>

                      {/* Status Toggle */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          onClick={() => togglePause(item.id)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                            item.status === "active"
                              ? "bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30 hover:bg-[#00FF88]/20"
                              : "bg-[#94A3B8]/10 text-[#94A3B8] border border-[#94A3B8]/30 hover:bg-[#94A3B8]/20"
                          }`}
                        >
                          {item.status === "active" ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-[#00FF88] animate-pulse" />
                              <span>Đang Chạy</span>
                            </>
                          ) : (
                            <>
                              <Pause className="h-3 w-3" />
                              <span>Tạm Dừng</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Last Run Info */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[#94A3B8]">
                        {item.lastRunAt ? (
                          <div>
                            <div className="text-white font-medium">
                              {new Date(item.lastRunAt).toLocaleDateString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] rounded bg-[#00FF88]/10 text-[#00FF88] px-1 py-0.2 font-bold">
                                Điểm: {item.lastScore || 90}/100
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="italic text-[#64748B]">Chưa chạy</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Run Now Button */}
                          <button
                            onClick={() => handleRunNow(item)}
                            disabled={isRunning}
                            title="Chạy cào dữ liệu & gửi email ngay lập tức"
                            className="flex items-center gap-1 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/30 px-2.5 py-1.5 text-[11px] font-bold text-[#00FF88] transition-all hover:bg-[#00FF88] hover:text-[#080B21] disabled:opacity-50 cursor-pointer"
                          >
                            {isRunning ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Đang Gửi...</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>Chạy Ngay</span>
                              </>
                            )}
                          </button>

                          {/* Open in Chat Button */}
                          {onOpenChatWithPrompt && (
                            <button
                              onClick={() => onOpenChatWithPrompt(`Nghiên cứu cơ hội sản phẩm: ${item.keyword}`)}
                              title="Mở phiên nghiên cứu trực tiếp trên Chat Copilot"
                              className="rounded-lg border border-[#1E293B] bg-[#080B21] p-1.5 text-[#94A3B8] transition-colors hover:text-white hover:border-[#94A3B8] cursor-pointer"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa lịch quét cho ngách "${item.keyword}"?`)) {
                                deleteSchedule(item.id);
                                showToast("Đã xóa lịch quét thành công!");
                              }
                            }}
                            title="Xóa lịch quét này"
                            className="rounded-lg border border-[#1E293B] bg-[#080B21] p-1.5 text-[#FF0055] transition-colors hover:bg-[#FF0055]/10 hover:border-[#FF0055]/40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create New Schedule */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl border border-[#00FF88]/30 bg-[#0D1230] p-6 text-white shadow-2xl shadow-[#00FF88]/10">
            {/* Close Button */}
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#1E293B] hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Tạo Lịch Quét & Giao Vận Email Mới</h3>
                <p className="text-xs text-[#94A3B8]">AI sẽ tự động cào tín hiệu Etsy/Amazon và gửi báo cáo về email</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Keyword / Prompt Input */}
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                  Từ Khóa Sản Phẩm / Prompt POD <span className="text-[#FF0055]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formKeyword}
                  onChange={(e) => setFormKeyword(e.target.value)}
                  placeholder="Ví dụ: Custom Acrylic Night Light for Kids, 40oz Tumbler..."
                  className="w-full rounded-xl border border-[#1E293B] bg-[#080B21] px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#00FF88] focus:outline-none"
                />

                {/* Quick Templates */}
                <div className="mt-2">
                  <div className="text-[11px] text-[#64748B] mb-1">Gợi ý ngách hot Q4:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormKeyword(tmpl.keyword);
                          setFormProductType(tmpl.productType);
                        }}
                        className="rounded-lg border border-[#1E293B] bg-[#080B21] px-2 py-1 text-[10px] text-[#94A3B8] hover:border-[#00FF88] hover:text-[#00FF88] transition-colors cursor-pointer"
                      >
                        {tmpl.keyword.slice(0, 32)}...
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grid: Frequency & Product Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    Tần Suất Quét Tự Động
                  </label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as ScheduleFrequency)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#080B21] px-3.5 py-2.5 text-xs text-white focus:border-[#00FF88] focus:outline-none cursor-pointer"
                  >
                    <option value="daily">Hàng ngày (08:00 AM)</option>
                    <option value="weekly">Hàng tuần (Thứ Hai 08:00 AM)</option>
                    <option value="every_6h">Mỗi 6 tiếng</option>
                    <option value="hourly">Hàng giờ (Realtime Tracker)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                    Chủng Loại Phôi Xưởng Printway
                  </label>
                  <select
                    value={formProductType}
                    onChange={(e) => setFormProductType(e.target.value)}
                    className="w-full rounded-xl border border-[#1E293B] bg-[#080B21] px-3.5 py-2.5 text-xs text-white focus:border-[#00FF88] focus:outline-none cursor-pointer"
                  >
                    <option value="Mica Trong Suốt 3mm">Mica Trong Suốt 3mm In UV</option>
                    <option value="Mica Đèn LED Đế Gỗ">Mica Đèn LED Đế Gỗ Sồi</option>
                    <option value="Áo Nỉ Thêu Tay">Áo Nỉ Thêu Vi Tính (Sweatshirt)</option>
                    <option value="Ly Inox 304 40oz">Ly Giữ Nhiệt 40oz Quai Cầm</option>
                    <option value="Mica Cắt CNC Treo Xe">Mica Cắt CNC Treo Xe Ô Tô</option>
                  </select>
                </div>
              </div>

              {/* Recipient Email Input */}
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1.5">
                  Email Nhận Báo Cáo Định Kỳ <span className="text-[#FF0055]">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="email@domain.com"
                    className="w-full rounded-xl border border-[#1E293B] bg-[#080B21] pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#00FF88] focus:outline-none"
                  />
                </div>
                <div className="mt-1 text-[11px] text-[#64748B]">
                  Báo cáo HTML cao cấp sẽ được chuyển phát trực tiếp qua hạ tầng Resend.
                </div>
              </div>

              {/* Resend Sandbox Notice */}
              <div className="rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 p-2.5 text-[11px] text-[#94A3B8] leading-relaxed">
                <span className="font-bold text-[#00D4FF]">💡 Chế độ Sandbox Resend:</span> Resend mặc định chuyển phát tới email tài khoản chính (<b className="text-white">nhphuong.code@gmail.com</b>). Để gửi tới email tùy ý khác, bạn chỉ cần xác minh tên miền tại <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="text-[#00FF88] underline font-semibold">resend.com/domains</a>.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#1E293B] px-4 py-2 text-xs font-bold text-[#94A3B8] hover:bg-[#1E293B] hover:text-white cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00D4FF] px-5 py-2 text-xs font-bold text-[#080B21] hover:opacity-90 shadow-lg shadow-[#00FF88]/20 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Kích Hoạt Lịch Quét</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
