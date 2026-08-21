"use client";

import { useCallback, useMemo } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { TodoItem } from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useAuth } from "@/providers/AuthProvider";
import { recordUserThread } from "@/app/hooks/useThreads";
import { useQueryState } from "nuqs";

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
};

export function useChat({
  activeAssistant,
  onHistoryRevalidate,
  thread,
}: {
  activeAssistant: Assistant | null;
  onHistoryRevalidate?: () => void;
  thread?: UseStreamThread<StateType>;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();
  const { user, profile } = useAuth();

  const handleCreated = useCallback((newThread: any) => {
    if (newThread?.thread_id && user?.id) {
      recordUserThread(newThread.thread_id, "Phiên nghiên cứu mới", user.id, profile?.org_id);
    }
    onHistoryRevalidate?.();
  }, [user, profile, onHistoryRevalidate]);

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: (id) => {
      setThreadId(id);
      if (id && user?.id) {
        recordUserThread(id, "Phiên nghiên cứu mới", user.id, profile?.org_id);
      }
    },
    defaultHeaders: { "x-auth-scheme": "langsmith" },
    fetchStateHistory: true,
    onFinish: onHistoryRevalidate,
    onError: onHistoryRevalidate,
    onCreated: handleCreated,
    experimental_thread: thread,
  });

  const sendMessage = useCallback(
    (content: string | any[]) => {
      const newMessage: Message = { id: uuidv4(), type: "human", content };
      const rawText = typeof content === "string" ? content : (content?.[0]?.text || "Phiên nghiên cứu");
      if (threadId && user?.id) {
        recordUserThread(threadId, rawText.slice(0, 50), user.id, profile?.org_id);
      }
      stream.submit(
        { messages: [newMessage] },
        {
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), newMessage],
          }),
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 100 },
        }
      );
      onHistoryRevalidate?.();
    },
    [stream, threadId, user, profile, activeAssistant?.config, onHistoryRevalidate]
  );

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: activeAssistant?.config,
          checkpoint: checkpoint,
          ...(isRerunningSubagent
            ? { interruptAfter: ["tools"] }
            : { interruptBefore: ["tools"] }),
        });
      } else {
        stream.submit(
          { messages },
          { config: activeAssistant?.config, interruptBefore: ["tools"] }
        );
      }
    },
    [stream, activeAssistant?.config]
  );

  const setFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!threadId) return;
      await client?.threads.updateState(threadId, { values: { files } });
    },
    [client, threadId]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...(activeAssistant?.config || {}),
          recursion_limit: 100,
        },
        ...(hasTaskToolCall
          ? { interruptAfter: ["tools"] }
          : { interruptBefore: ["tools"] }),
      });
      // Update thread list when continuing stream
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    // Update thread list when marking thread as resolved
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { command: { resume: value } });
      // Update thread list when resuming from interrupt
      onHistoryRevalidate?.();
    },
    [stream, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  const todos = useMemo(() => stream.values.todos ?? [], [stream.values.todos]);
  const files = useMemo(() => stream.values.files ?? {}, [stream.values.files]);

  return useMemo(
    () => ({
      stream,
      todos,
      files,
      email: stream.values.email,
      ui: stream.values.ui,
      setFiles,
      messages: stream.messages,
      isLoading: stream.isLoading,
      isThreadLoading: stream.isThreadLoading,
      interrupt: stream.interrupt,
      getMessagesMetadata: stream.getMessagesMetadata,
      sendMessage,
      runSingleStep,
      continueStream,
      stopStream,
      markCurrentThreadAsResolved,
      resumeInterrupt,
    }),
    [
      stream,
      todos,
      files,
      stream.values.email,
      stream.values.ui,
      setFiles,
      stream.messages,
      stream.isLoading,
      stream.isThreadLoading,
      stream.interrupt,
      stream.getMessagesMetadata,
      sendMessage,
      runSingleStep,
      continueStream,
      stopStream,
      markCurrentThreadAsResolved,
      resumeInterrupt,
    ]
  );
}
