"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";

export type ScheduleFrequency = "daily" | "weekly" | "every_6h" | "hourly";

export interface ScheduledPromptItem {
  id: string;
  userId: string;
  keyword: string;
  frequency: ScheduleFrequency;
  recipientEmail: string;
  status: "active" | "paused";
  productType?: string;
  lastRunAt?: string;
  lastScore?: number;
  lastRecommendation?: string;
  lastEmailId?: string;
  createdAt: string;
}

const STORAGE_PREFIX = "printway_nexus_schedules_";

export function useUserSchedules() {
  const { user } = useAuth();
  const userId = user?.id || "guest_user";
  const userEmail = user?.email || "phuong.nguyen@printway.io";

  const storageKey = `${STORAGE_PREFIX}${userId}`;

  const [schedules, setSchedules] = useState<ScheduledPromptItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Load user schedules on mount / user change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setSchedules(JSON.parse(stored));
      } else {
        // Starter sample schedule tailored to user
        const initialSchedules: ScheduledPromptItem[] = [
          {
            id: `sch_${Date.now()}_1`,
            userId,
            keyword: "Baby First Christmas Ornament 2026 Custom Acrylic",
            frequency: "daily",
            recipientEmail: userEmail,
            status: "active",
            productType: "Mica Trong Suốt 3mm",
            lastRunAt: new Date(Date.now() - 3600000 * 4).toISOString(),
            lastScore: 92,
            lastRecommendation: "RECOMMEND",
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          },
          {
            id: `sch_${Date.now()}_2`,
            userId,
            keyword: "Personalized Grandpa Gift Acrylic Desk Plaque Wood Base LED",
            frequency: "weekly",
            recipientEmail: userEmail,
            status: "active",
            productType: "Mica Đèn LED Đế Gỗ",
            lastRunAt: new Date(Date.now() - 3600000 * 18).toISOString(),
            lastScore: 86,
            lastRecommendation: "RECOMMEND",
            createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          },
        ];
        setSchedules(initialSchedules);
        localStorage.setItem(storageKey, JSON.stringify(initialSchedules));
      }
    } catch (e) {
      console.error("Failed to load user schedules:", e);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey, userId, userEmail]);

  // Persist helper
  const saveSchedules = useCallback(
    (newSchedules: ScheduledPromptItem[]) => {
      setSchedules(newSchedules);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSchedules));
      } catch (e) {
        console.error("Failed to persist schedules:", e);
      }
    },
    [storageKey]
  );

  // Add new schedule
  const addSchedule = useCallback(
    (item: Omit<ScheduledPromptItem, "id" | "userId" | "createdAt" | "status">) => {
      const newEntry: ScheduledPromptItem = {
        ...item,
        id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      const updated = [newEntry, ...schedules];
      saveSchedules(updated);
      return newEntry;
    },
    [userId, schedules, saveSchedules]
  );

  // Toggle pause/active
  const togglePause = useCallback(
    (id: string) => {
      const updated = schedules.map((s) =>
        s.id === id ? { ...s, status: (s.status === "active" ? "paused" : "active") as "active" | "paused" } : s
      );
      saveSchedules(updated);
    },
    [schedules, saveSchedules]
  );

  // Delete schedule
  const deleteSchedule = useCallback(
    (id: string) => {
      const updated = schedules.filter((s) => s.id !== id);
      saveSchedules(updated);
    },
    [schedules, saveSchedules]
  );

  // Run schedule immediately (calls Resend endpoint)
  const runScheduleNow = useCallback(
    async (item: ScheduledPromptItem): Promise<{ success: boolean; error?: string; emailId?: string }> => {
      setRunningId(item.id);
      try {
        const res = await fetch("/api/send-email-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toEmail: item.recipientEmail,
            keyword: item.keyword,
            score: item.lastScore || Math.floor(Math.random() * 15) + 80,
            recommendation: item.lastRecommendation || "RECOMMEND",
            productType: item.productType || "Mica In UV Xuyên Sáng",
            demand: "14,200/tháng",
            competition: "128 listings",
            growth: "+48% YoY",
            margin: "65% - 72%",
            priceRange: "$18.99 - $29.99",
            material: "Mica Đài Loan 3mm & Đế Gỗ Sồi",
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          // Update last run time
          const updated = schedules.map((s) =>
            s.id === item.id
              ? {
                  ...s,
                  lastRunAt: new Date().toISOString(),
                  lastEmailId: data.emailId,
                  lastScore: s.lastScore || 88,
                  lastRecommendation: s.lastRecommendation || "RECOMMEND",
                }
              : s
          );
          saveSchedules(updated);
          return { success: true, emailId: data.emailId };
        } else {
          return { success: false, error: data.error || "Gửi email thất bại" };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Lỗi kết nối mạng";
        return { success: false, error: errorMsg };
      } finally {
        setRunningId(null);
      }
    },
    [schedules, saveSchedules]
  );

  const activeCount = schedules.filter((s) => s.status === "active").length;

  return {
    schedules,
    isLoaded,
    runningId,
    activeCount,
    addSchedule,
    togglePause,
    deleteSchedule,
    runScheduleNow,
  };
}
