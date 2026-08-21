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
}

const DEFAULT_PAGE_SIZE = 20;

export function useThreads(props: {
  status?: Thread["status"];
  limit?: number;
}) {
  const { user } = useAuth();
  const pageSize = props.limit || DEFAULT_PAGE_SIZE;
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
      userKey,
      pageIndex,
      pageSize,
    }: {
      kind: "threads";
      userKey: string;
      userId?: string;
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

      // 1. First, check User's private threads in Supabase / LocalStorage
      let userThreadIds: string[] = [];
      
      if (isSupabaseConfigured && supabase && userId) {
        try {
          const { data } = await supabase
            .from("user_sessions")
            .select("thread_id, title, last_active")
            .eq("user_id", userId)
            .order("last_active", { ascending: false })
            .limit(pageSize);

          if (data && data.length > 0) {
            userThreadIds = data.map((d: any) => d.thread_id);
          }
        } catch {
          // fallback to localStorage
        }
      }

      // Local storage fallback for user-scoped thread isolation
      if (userThreadIds.length === 0 && typeof window !== "undefined") {
        const localKey = `printway_threads_${userKey}`;
        const saved = localStorage.getItem(localKey);
        if (saved) {
          try {
            userThreadIds = JSON.parse(saved);
          } catch {}
        }
      }

      // 2. Fetch threads from LangGraph
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          assistantId
        );

      const threads = await client.threads.search({
        limit: pageSize,
        offset: pageIndex * pageSize,
        sortBy: "updated_at" as const,
        sortOrder: "desc" as const,
        status,
        ...(isUUID ? { metadata: { assistant_id: assistantId } } : {}),
      });

      // 3. Filter strictly for this user if user-scoped threads are recorded
      const visibleThreads = userThreadIds.length > 0
        ? threads.filter((t) => userThreadIds.includes(t.thread_id))
        : (userId ? [] : threads); // If brand new user with no threads, start clean!

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

        return {
          id: thread.thread_id,
          updatedAt: new Date(thread.updated_at),
          status: thread.status,
          title,
          description,
          assistantId,
          userId,
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

export async function recordUserThread(threadId: string, title: string, userId?: string, orgId?: string) {
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
    } catch {}
  }

  // 2. Sync to localStorage
  if (typeof window !== "undefined") {
    const localKey = `printway_threads_${userId}`;
    const existing = localStorage.getItem(localKey);
    let ids: string[] = [];
    if (existing) {
      try {
        ids = JSON.parse(existing);
      } catch {}
    }
    if (!ids.includes(threadId)) {
      ids.unshift(threadId);
      localStorage.setItem(localKey, JSON.stringify(ids));
    }
  }
}
