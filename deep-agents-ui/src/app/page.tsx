"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useQueryState } from "nuqs";
import { getConfig, saveConfig, StandaloneConfig } from "@/lib/config";
import { ConfigDialog } from "@/app/components/ConfigDialog";
import { Button } from "@/components/ui/button";
import { Assistant } from "@langchain/langgraph-sdk";
import { ClientProvider, useClient } from "@/providers/ClientProvider";
import { ChatProvider } from "@/providers/ChatProvider";
import { ChatInterface } from "@/app/components/ChatInterface";
import { AppSidebar } from "@/app/components/AppSidebar";
import { ImageLightboxModal } from "@/app/components/ImageLightboxModal";
import { CommandPalette } from "@/app/components/CommandPalette";

interface HomePageInnerProps {
  config: StandaloneConfig;
  configDialogOpen: boolean;
  setConfigDialogOpen: (open: boolean) => void;
  handleSaveConfig: (config: StandaloneConfig) => void;
}

function HomePageInner({
  config,
  configDialogOpen,
  setConfigDialogOpen,
  handleSaveConfig,
}: HomePageInnerProps) {
  const client = useClient();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [mutateThreads, setMutateThreads] = useState<(() => void) | null>(null);
  const [interruptCount, setInterruptCount] = useState(0);
  const [assistant, setAssistant] = useState<Assistant | null>(null);

  // Command Palette & Image Lightbox state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState<{
    isOpen: boolean;
    imageUrl: string;
    alt?: string;
    caption?: string;
  }>({
    isOpen: false,
    imageUrl: "",
  });

  // Global Keyboard shortcuts: Cmd+K / Ctrl+K and Cmd+Shift+N and Cmd+B
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd + K or Ctrl + K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Cmd + Shift + N -> New Research
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setThreadId(null);
      }
      // Cmd + B -> Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [setThreadId]);

  // Listen for image lightbox click events
  useEffect(() => {
    const handleOpenLightbox = (e: Event) => {
      const customEvent = e as CustomEvent<{ imageUrl: string; alt?: string; caption?: string }>;
      if (customEvent.detail?.imageUrl) {
        setLightboxData({
          isOpen: true,
          imageUrl: customEvent.detail.imageUrl,
          alt: customEvent.detail.alt,
          caption: customEvent.detail.caption,
        });
      }
    };

    window.addEventListener("open-image-lightbox", handleOpenLightbox);
    return () => window.removeEventListener("open-image-lightbox", handleOpenLightbox);
  }, []);

  const handleSelectPalettePrompt = useCallback((prompt: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("send-chat-prompt", { detail: prompt }));
    }
  }, []);

  const fetchAssistant = useCallback(async () => {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        config.assistantId
      );

    if (isUUID) {
      try {
        const data = await client.assistants.get(config.assistantId);
        setAssistant(data);
      } catch (error) {
        console.error("Failed to fetch assistant:", error);
        setAssistant({
          assistant_id: config.assistantId,
          graph_id: config.assistantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          config: {},
          metadata: {},
          version: 1,
          name: "Assistant",
          context: {},
        });
      }
    } else {
      try {
        const assistants = await client.assistants.search({
          graphId: config.assistantId,
          limit: 100,
        });
        const defaultAssistant = assistants.find(
          (assistant) => assistant.metadata?.["created_by"] === "system"
        );
        if (defaultAssistant === undefined) {
          throw new Error("No default assistant found");
        }
        setAssistant(defaultAssistant);
      } catch (error) {
        console.error(
          "Failed to find default assistant from graph_id:",
          error
        );
        setAssistant({
          assistant_id: config.assistantId,
          graph_id: config.assistantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          config: {},
          metadata: {},
          version: 1,
          name: config.assistantId,
          context: {},
        });
      }
    }
  }, [client, config.assistantId]);

  useEffect(() => {
    fetchAssistant();
  }, [fetchAssistant]);

  return (
    <>
      <ConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onSave={handleSaveConfig}
        initialConfig={config}
      />

      {/* Command Palette (Cmd + K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectPrompt={handleSelectPalettePrompt}
        onNewResearch={() => setThreadId(null)}
        onOpenSettings={() => setConfigDialogOpen(true)}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Image Lightbox & Spec Inspector Modal */}
      <ImageLightboxModal
        isOpen={lightboxData.isOpen}
        imageUrl={lightboxData.imageUrl}
        alt={lightboxData.alt}
        caption={lightboxData.caption}
        onClose={() => setLightboxData((prev) => ({ ...prev, isOpen: false }))}
      />

      <div className="flex h-screen w-screen overflow-hidden bg-[#080B21] text-white">
        {/* ChatGPT-Style Left Sidebar (Unified Navigation & History) */}
        <AppSidebar
          currentThreadId={threadId}
          onThreadSelect={(id) => setThreadId(id)}
          onNewResearch={() => setThreadId(null)}
          onOpenSettings={() => setConfigDialogOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          interruptCount={interruptCount}
          onMutateReady={(fn) => setMutateThreads(() => fn)}
        />

        {/* Main Full-Height Workspace Area */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-[#080B21]">
          <ChatProvider
            activeAssistant={assistant}
            onHistoryRevalidate={() => mutateThreads?.()}
          >
            <ChatInterface assistant={assistant} />
          </ChatProvider>
        </main>
      </div>
    </>
  );
}

function HomePageContent() {
  const [config, setConfig] = useState<StandaloneConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [assistantId, setAssistantId] = useQueryState("assistantId");

  useEffect(() => {
    const savedConfig = getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      if (!assistantId) {
        setAssistantId(savedConfig.assistantId);
      }
    } else {
      setConfigDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    if (config && !assistantId) {
      setAssistantId(config.assistantId);
    }
  }, [config, assistantId, setAssistantId]);

  const handleSaveConfig = useCallback((newConfig: StandaloneConfig) => {
    saveConfig(newConfig);
    setConfig(newConfig);
  }, []);

  const langsmithApiKey =
    config?.langsmithApiKey || process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || "";

  if (!config) {
    return (
      <>
        <ConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          onSave={handleSaveConfig}
        />
        <div className="flex h-screen items-center justify-center bg-[#080B21] text-white">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[#00FF88] drop-shadow-[0_0_10px_rgba(0,255,136,0.5)]">
              Printway Product Opportunity Hub
            </h1>
            <p className="mt-2 text-sm text-[#94A3B8]">
              Cấu hình kết nối hệ thống Printway R&D để bắt đầu
            </p>
            <Button
              onClick={() => setConfigDialogOpen(true)}
              className="mt-4 border border-[#00FF88] bg-[#00FF88] text-[#080B21] font-bold hover:bg-[#00FF88]/80 shadow-[0_0_15px_rgba(0,255,136,0.4)] cursor-pointer"
            >
              Mở bảng cấu hình
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <ClientProvider
      deploymentUrl={config.deploymentUrl}
      apiKey={langsmithApiKey}
    >
      <HomePageInner
        config={config}
        configDialogOpen={configDialogOpen}
        setConfigDialogOpen={setConfigDialogOpen}
        handleSaveConfig={handleSaveConfig}
      />
    </ClientProvider>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#080B21]">
          <p className="text-[#00FF88] font-mono animate-pulse">Đang khởi tạo giao diện Printway Opportunity Hub...</p>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
