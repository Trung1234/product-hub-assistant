"use client";

import useSWRInfinite from "swr/infinite";
import type { Thread } from "@langchain/langgraph-sdk";
import { Client } from "@langchain/langgraph-sdk";
import { getConfig } from "@/lib/config";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export interface ThreadItem {
  id: string;
  updatedAt: Date;
  status: Thread["status"];
  title: string;
  description: string;
  assistantId?: string;
  userId?: string;
  isShared?: boolean;
  shareToken?: string;
  ownerName?: string;
  ownerRole?: string;
}

const DEFAULT_PAGE_SIZE = 35;

function getCachedThreads(userKey: string): ThreadItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`printway_thread_cache_v2_${userKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item: any) => ({
      ...item,
      updatedAt: new Date(item.updatedAt || Date.now()),
    }));
  } catch {
    return null;
  }
}

function setCachedThreads(userKey: string, items: ThreadItem[]) {
  if (typeof window === "undefined" || !items) return;
  try {
    localStorage.setItem(
      `printway_thread_cache_v2_${userKey}`,
      JSON.stringify(items)
    );
  } catch {}
}

export function useThreads(props?: {
  status?: Thread["status"];
  limit?: number;
  filterMode?: "all" | "mine" | "shared";
}) {
  const { user, profile } = useAuth();
  const pageSize = props?.limit || DEFAULT_PAGE_SIZE;
  const filterMode = props?.filterMode || "all";
  const userKey = user ? (user.id || user.email) : "anonymous";
  const cachedInitial = pageIndexZeroCache(userKey);

  return useSWRInfinite(
    (pageIndex: number, previousPageData: ThreadItem[] | null) => {
      const config = getConfig();
      const apiKey =
        config?.langsmithApiKey ||
        process.env.NEXT_PUBLIC_LANGSMITH_API_KEY ||
        "";

      if (!config) {
        return null;
      }

      if (previousPageData && previousPageData.length === 0) {
        return null;
      }

      return {
        kind: "threads" as const,
        userKey,
        userId: user?.id,
        orgId: profile?.org_id || "printway_internal",
        filterMode,
        pageIndex,
        pageSize,
        deploymentUrl: config.deploymentUrl,
        assistantId: config.assistantId,
        apiKey,
        status: props?.status,
      };
    },
    async ({
      deploymentUrl,
      assistantId,
      apiKey,
      status,
      userId,
      orgId,
      filterMode,
      userKey,
      pageIndex,
      pageSize,
    }: {
      kind: "threads";
      userKey: string;
      userId?: string;
      orgId?: string;
      filterMode: "all" | "mine" | "shared";
      pageIndex: number;
      pageSize: number;
      deploymentUrl: string;
      assistantId: string;
      apiKey: string;
      status?: Thread["status"];
    }): Promise<ThreadItem[]> => {
      const client = new Client({
        apiUrl: deploymentUrl,
        defaultHeaders: apiKey ? { "X-Api-Key": apiKey } : {},
      });

      // 1. FAST PATH (<50ms): Query Supabase & Local Storage in parallel
      let sessionItems: { id: string; title: string; updatedAt: Date; description?: string }[] = [];
      const sharedMetaMap = new Map<string, { shareToken?: string; ownerName?: string; ownerRole?: string }>();
      const sharedThreadIds: string[] = [];

      if (isSupabaseConfigured && supabase) {
        const sb = supabase;
        try {
          const fetchOwn = async () => {
            if (!userId || (filterMode !== "mine" && filterMode !== "all") || !sb) return [];
            const { data } = await sb
              .from("user_sessions")
              .select("thread_id, title, last_active")
              .eq("user_id", userId)
              .order("last_active", { ascending: false })
              .limit(pageSize);
            return data || [];
          };

          const fetchShared = async () => {
            if ((filterMode !== "shared" && filterMode !== "all") || !sb) return [];
            const { data } = await sb
              .from("thread_shares")
              .select(`
                thread_id,
                share_token,
                owner_id,
                profiles:owner_id (full_name, email, role)
              `)
              .eq("is_active", true)
              .or(`org_id.eq.${orgId || "printway_internal"},share_mode.eq.public_link`)
              .neq("owner_id", userId || "")
              .limit(pageSize);
            return data || [];
          };

          const [ownRes, sharedRes] = await Promise.allSettled([fetchOwn(), fetchShared()]);

          if (ownRes.status === "fulfilled" && ownRes.value) {
            sessionItems = ownRes.value.map((d: any) => ({
              id: d.thread_id,
              title: d.title || "Phiên nghiên cứu",
              updatedAt: new Date(d.last_active || Date.now()),
              description: "",
            }));
          }

          if (sharedRes.status === "fulfilled" && sharedRes.value) {
            sharedRes.value.forEach((s: any) => {
              sharedThreadIds.push(s.thread_id);
              sharedMetaMap.set(s.thread_id, {
                shareToken: s.share_token,
                ownerName: s.profiles?.full_name || s.profiles?.email?.split("@")[0] || "Đồng nghiệp R&D",
                ownerRole: s.profiles?.role || "analyst",
              });
            });
          }
        } catch (err) {
          console.debug("Supabase session fetch bypassed:", err);
        }
      }

      // Local storage fallback for instant offline/demo load
      if (sessionItems.length === 0 && typeof window !== "undefined" && (filterMode === "mine" || filterMode === "all")) {
        const localKey = `printway_threads_${userKey}`;
        const saved = localStorage.getItem(localKey);
        if (saved) {
          try {
            const ids: string[] = JSON.parse(saved);
            sessionItems = ids.slice(0, pageSize).map((id, index) => ({
              id,
              title: `Phiên nghiên cứu ${id.slice(0, 8)}`,
              updatedAt: new Date(Date.now() - index * 60000),
              description: "",
            }));
          } catch {}
        }
      }

      // Map fast items immediately
      const allowedIdSet = new Set([
        ...sessionItems.map((s) => s.id),
        ...sharedThreadIds,
      ]);

      const baseItemsMap = new Map<string, ThreadItem>();
      sessionItems.forEach((s) => {
        baseItemsMap.set(s.id, {
          id: s.id,
          updatedAt: s.updatedAt,
          status: "idle",
          title: s.title,
          description: s.description || "",
          assistantId,
          userId,
          isShared: false,
        });
      });

      sharedThreadIds.forEach((tid) => {
        const meta = sharedMetaMap.get(tid);
        if (!baseItemsMap.has(tid)) {
          baseItemsMap.set(tid, {
            id: tid,
            updatedAt: new Date(),
            status: "idle",
            title: "Phiên được chia sẻ",
            description: "",
            assistantId,
            userId,
            isShared: true,
            shareToken: meta?.shareToken,
            ownerName: meta?.ownerName,
            ownerRole: meta?.ownerRole,
          });
        }
      });

      // 2. BACKGROUND ENRICHMENT: Fast 1200ms Timeout to LangGraph Backend
      // This prevents Render cold sleep from stalling the UI!
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          assistantId
        );

      let langGraphThreads: any[] = [];
      try {
        const fetchPromise = client.threads.search({
          limit: pageSize,
          offset: pageIndex * pageSize,
          sortBy: "updated_at" as const,
          sortOrder: "desc" as const,
          status,
          ...(isUUID ? { metadata: { assistant_id: assistantId } } : {}),
        });

        // 1200ms maximum wait for LangGraph
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 1200)
        );

        const raceRes = await Promise.race([fetchPromise, timeoutPromise]);
        if (raceRes && Array.isArray(raceRes)) {
          langGraphThreads = raceRes;
        }
      } catch {}

      // 3. Merge LangGraph messages & titles if available
      if (langGraphThreads.length > 0) {
        langGraphThreads.forEach((thread: any) => {
          let title = "Untitled Thread";
          let description = "";

          try {
            if (thread.values && typeof thread.values === "object") {
              const values = thread.values as any;
              const firstHumanMessage = values.messages?.find(
                (m: any) => m.type === "human"
              );
              if (firstHumanMessage?.content) {
                const content =
                  typeof firstHumanMessage.content === "string"
                    ? firstHumanMessage.content
                    : firstHumanMessage.content[0]?.text || "";
                title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
              }
              const firstAiMessage = values.messages?.find(
                (m: any) => m.type === "ai"
              );
              if (firstAiMessage?.content) {
                const content =
                  typeof firstAiMessage.content === "string"
                    ? firstAiMessage.content
                    : firstAiMessage.content[0]?.text || "";
                description = content.slice(0, 100);
              }
            }
          } catch {
            title = `Thread ${thread.thread_id.slice(0, 8)}`;
          }

          const sharedMeta = sharedMetaMap.get(thread.thread_id);
          const existing = baseItemsMap.get(thread.thread_id);

          baseItemsMap.set(thread.thread_id, {
            id: thread.thread_id,
            updatedAt: new Date(thread.updated_at),
            status: thread.status,
            title: (existing?.title && existing.title !== "Phiên nghiên cứu" && existing.title !== "Phiên được chia sẻ") ? existing.title : title,
            description: description || existing?.description || "",
            assistantId,
            userId,
            isShared: !!sharedMeta,
            shareToken: sharedMeta?.shareToken,
            ownerName: sharedMeta?.ownerName,
            ownerRole: sharedMeta?.ownerRole,
          });
        });
      }

      let finalItems = Array.from(baseItemsMap.values());

      // If user has specific filter
      if (allowedIdSet.size > 0) {
        finalItems = finalItems.filter((t) => allowedIdSet.has(t.id));
      } else if (userId && filterMode === "mine") {
        finalItems = [];
      }

      // Sort by updatedAt descending
      finalItems.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Cache for instant 0ms next load
      if (pageIndex === 0 && finalItems.length > 0) {
        setCachedThreads(userKey, finalItems);
      }

      return finalItems;
    },
    {
      fallbackData: cachedInitial ? [cachedInitial] : undefined,
      revalidateFirstPage: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3000,
    }
  );
}

function pageIndexZeroCache(userKey: string): ThreadItem[] | undefined {
  const cached = getCachedThreads(userKey);
  return cached && cached.length > 0 ? cached : undefined;
}

export async function recordUserThread(
  threadId: string,
  title: string,
  userId?: string,
  orgId?: string
) {
  if (!threadId) return;

  const now = new Date();
  const safeTitle = title?.trim() ? title.slice(0, 60) : "Phiên nghiên cứu mới";

  // 1. Instant local cache update (0ms UI reactivity)
  if (typeof window !== "undefined") {
    const userKey = userId || "anonymous";
    const cacheKey = `printway_thread_cache_v2_${userKey}`;
    try {
      const existing = localStorage.getItem(cacheKey);
      let items: ThreadItem[] = existing ? JSON.parse(existing) : [];
      const itemIndex = items.findIndex((i) => i.id === threadId);
      if (itemIndex >= 0) {
        items[itemIndex].title = safeTitle;
        items[itemIndex].updatedAt = now;
      } else {
        items.unshift({
          id: threadId,
          title: safeTitle,
          updatedAt: now,
          status: "idle",
          description: "",
          userId,
          isShared: false,
        });
      }
      localStorage.setItem(cacheKey, JSON.stringify(items.slice(0, 50)));
    } catch {}

    const localKey = `printway_threads_${userKey}`;
    try {
      const existingIds = localStorage.getItem(localKey);
      let ids: string[] = existingIds ? JSON.parse(existingIds) : [];
      if (!ids.includes(threadId)) {
        ids.unshift(threadId);
        localStorage.setItem(localKey, JSON.stringify(ids.slice(0, 50)));
      }
    } catch {}
  }

  // 2. Background Sync to Supabase
  if (isSupabaseConfigured && supabase && userId) {
    try {
      await supabase.from("user_sessions").upsert({
        thread_id: threadId,
        user_id: userId,
        org_id: orgId || "printway_internal",
        title: safeTitle,
        last_active: now.toISOString(),
      });
    } catch (e) {
      console.debug("Failed to record thread in Supabase:", e);
    }
  }
}
