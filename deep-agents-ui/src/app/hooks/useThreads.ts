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

const DEFAULT_PAGE_SIZE = 25;

export function useThreads(props?: {
  status?: Thread["status"];
  limit?: number;
  filterMode?: "all" | "mine" | "shared";
}) {
  const { user, profile } = useAuth();
  const pageSize = props?.limit || DEFAULT_PAGE_SIZE;
  const filterMode = props?.filterMode || "all";
  const userKey = user ? (user.id || user.email) : "anonymous";

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
    }) => {
      const client = new Client({
        apiUrl: deploymentUrl,
        defaultHeaders: apiKey ? { "X-Api-Key": apiKey } : {},
      });

      // 1. Fetch User's private threads & shared threads from Supabase
      let ownedThreadIds: string[] = [];
      const sharedThreadIds: string[] = [];
      const sharedMetaMap = new Map<string, { shareToken?: string; ownerName?: string; ownerRole?: string }>();

      if (isSupabaseConfigured && supabase) {
        try {
          // A. Fetch Owned Sessions
          if (userId && (filterMode === "mine" || filterMode === "all")) {
            const { data: ownData } = await supabase
              .from("user_sessions")
              .select("thread_id, title, last_active")
              .eq("user_id", userId)
              .order("last_active", { ascending: false })
              .limit(pageSize);

            if (ownData && ownData.length > 0) {
              ownedThreadIds = ownData.map((d: any) => d.thread_id);
            }
          }

          // B. Fetch Shared Sessions (Org-level or direct collaborator)
          if (filterMode === "shared" || filterMode === "all") {
            const { data: sharedData } = await supabase
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

            if (sharedData && sharedData.length > 0) {
              sharedData.forEach((s: any) => {
                sharedThreadIds.push(s.thread_id);
                sharedMetaMap.set(s.thread_id, {
                  shareToken: s.share_token,
                  ownerName: s.profiles?.full_name || s.profiles?.email?.split("@")[0] || "Đồng nghiệp R&D",
                  ownerRole: s.profiles?.role || "analyst",
                });
              });
            }
          }
        } catch (err) {
          console.warn("Failed to fetch sessions from Supabase:", err);
        }
      }

      // Local storage fallback for user-scoped thread isolation
      if (ownedThreadIds.length === 0 && typeof window !== "undefined" && (filterMode === "mine" || filterMode === "all")) {
        const localKey = `printway_threads_${userKey}`;
        const saved = localStorage.getItem(localKey);
        if (saved) {
          try {
            ownedThreadIds = JSON.parse(saved);
          } catch (e) {
            console.debug("Error parsing localStorage threads:", e);
          }
        }
      }

      const combinedAllowedIds = Array.from(new Set([...ownedThreadIds, ...sharedThreadIds]));

      // 2. Fetch threads from LangGraph
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          assistantId
        );

      let threads: any[] = [];
      try {
        threads = await client.threads.search({
          limit: pageSize,
          offset: pageIndex * pageSize,
          sortBy: "updated_at" as const,
          sortOrder: "desc" as const,
          status,
          ...(isUUID ? { metadata: { assistant_id: assistantId } } : {}),
        });
      } catch {
        // Fallback: If LangGraph backend is waking up, map IDs directly
        return combinedAllowedIds.map((tid) => {
          const sharedMeta = sharedMetaMap.get(tid);
          return {
            id: tid,
            updatedAt: new Date(),
            status: "idle" as const,
            title: "Phiên nghiên cứu",
            description: "",
            assistantId,
            userId,
            isShared: !!sharedMeta,
            shareToken: sharedMeta?.shareToken,
            ownerName: sharedMeta?.ownerName,
            ownerRole: sharedMeta?.ownerRole,
          };
        });
      }

      // 3. Filter visible threads
      let visibleThreads = threads;
      if (combinedAllowedIds.length > 0) {
        visibleThreads = threads.filter((t) => combinedAllowedIds.includes(t.thread_id));
      } else if (userId && filterMode === "mine") {
        visibleThreads = [];
      }

      return visibleThreads.map((thread): ThreadItem => {
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

        return {
          id: thread.thread_id,
          updatedAt: new Date(thread.updated_at),
          status: thread.status,
          title,
          description,
          assistantId,
          userId,
          isShared: !!sharedMeta,
          shareToken: sharedMeta?.shareToken,
          ownerName: sharedMeta?.ownerName,
          ownerRole: sharedMeta?.ownerRole,
        };
      });
    },
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    }
  );
}

export async function recordUserThread(
  threadId: string,
  title: string,
  userId?: string,
  orgId?: string
) {
  if (!threadId || !userId) return;

  // 1. Sync to Supabase user_sessions
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("user_sessions").upsert({
        thread_id: threadId,
        user_id: userId,
        org_id: orgId || "printway_internal",
        title: title || "Phiên nghiên cứu mới",
        last_active: new Date().toISOString(),
      });
    } catch (e) {
      console.debug("Failed to record thread in Supabase:", e);
    }
  }

  // 2. Sync to localStorage
  if (typeof window !== "undefined") {
    const localKey = `printway_threads_${userId}`;
    const existing = localStorage.getItem(localKey);
    let ids: string[] = [];
    if (existing) {
      try {
        ids = JSON.parse(existing);
      } catch (e) {
        console.debug("Failed to parse local storage thread ids:", e);
      }
    }
    if (!ids.includes(threadId)) {
      ids.unshift(threadId);
      localStorage.setItem(localKey, JSON.stringify(ids));
    }
  }
}
