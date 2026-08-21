"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useQueryState } from "nuqs";
import { getConfig, StandaloneConfig } from "@/lib/config";
import { Assistant } from "@langchain/langgraph-sdk";
import { ClientProvider, useClient } from "@/providers/ClientProvider";
import { ChatProvider } from "@/providers/ChatProvider";
import { ChatInterface } from "@/app/components/ChatInterface";
import { AppSidebar } from "@/app/components/AppSidebar";
import { AuthButton } from "@/app/components/AuthButton";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AuthScreen } from "@/app/components/AuthScreen";
import { PanelLeft, SquarePen, Search, Loader2 } from "lucide-react";

// Lazy-loaded interactive modals with zero initial bundle overhead
const CommandPalette = dynamic(
  () => import("@/app/components/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false }
);

const ImageLightboxModal = dynamic(
  () => import("@/app/components/ImageLightboxModal").then((m) => m.ImageLightboxModal),
  { ssr: false }
);

interface HomePageInnerProps {
  config: StandaloneConfig;
}

function HomePageInner({ config }: HomePageInnerProps) {
  const client = useClient();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      {/* Command Palette (Cmd + K) - Lazily Loaded */}
      {commandPaletteOpen && (
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectPrompt={handleSelectPalettePrompt}
          onNewResearch={() => setThreadId(null)}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Image Lightbox & Spec Inspector Modal - Lazily Loaded */}
      {lightboxData.isOpen && (
        <ImageLightboxModal
          isOpen={lightboxData.isOpen}
          imageUrl={lightboxData.imageUrl}
          alt={lightboxData.alt}
          caption={lightboxData.caption}
          onClose={() => setLightboxData((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      <div className="flex h-screen w-screen overflow-hidden bg-[#080B21] text-white">
        {/* ChatGPT-Style Left Sidebar (Unified Navigation & History, Drawer on Mobile) */}
        <AppSidebar
          currentThreadId={threadId}
          onThreadSelect={(id) => setThreadId(id)}
          onNewResearch={() => setThreadId(null)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          interruptCount={interruptCount}
          onMutateReady={(fn) => setMutateThreads(() => fn)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Main Full-Height Workspace Area */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-[#080B21]">
          {/* Mobile Top Navigation Header (< md) */}
          <header className="flex h-13 w-full shrink-0 items-center justify-between border-b border-[#00FF88]/15 bg-[#0E1538]/90 px-3 backdrop-blur-md md:hidden z-20">
            <div className="flex items-center gap-2">
              {/* Hamburger Menu Button */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-[#080B21] text-slate-300 hover:text-[#00FF88] hover:border-[#00FF88]/40 transition-colors cursor-pointer"
                aria-label="Mở danh mục & lịch sử nghiên cứu"
              >
                <PanelLeft className="h-4.5 w-4.5" />
              </button>

              {/* Logo & Brand Badge */}
              <div className="flex items-center gap-1.5">
                <div className="flex h-7 px-2 items-center justify-center rounded-md bg-white shadow-sm">
                  <img
                    src="/logo_header.png"
                    alt="Printway"
                    className="h-3.5 w-auto object-contain"
                  />
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#00FF88] bg-[#00FF88]/15 px-1.5 py-0.5 rounded border border-[#00FF88]/30">
                  Nexus 2.0
                </span>
              </div>
            </div>

            {/* Right Action Icons (Search Cmd+K, Auth, New Research) */}
            <div className="flex items-center gap-2">
              <AuthButton />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-[#121A45] hover:text-[#00D2FF] transition-colors cursor-pointer"
                title="Tìm kiếm lệnh & gợi ý (Cmd+K)"
                aria-label="Tìm kiếm lệnh & gợi ý"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setThreadId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88] hover:text-[#080B21] transition-colors cursor-pointer"
                title="Tạo phiên nghiên cứu mới"
                aria-label="Tạo phiên nghiên cứu mới"
              >
                <SquarePen className="h-4 w-4" />
              </button>
            </div>
          </header>

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

function HomePageContentInner() {
  const { user, loading } = useAuth();
  const [config] = useState<StandaloneConfig>(() => getConfig());
  const [assistantId, setAssistantId] = useQueryState("assistantId");

  useEffect(() => {
    if (config && !assistantId) {
      setAssistantId(config.assistantId);
    }
  }, [config, assistantId, setAssistantId]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#080B21] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00FF88] border-t-transparent" />
          <p className="text-xs font-semibold text-slate-400">Đang đồng bộ phiên xác thực Printway Supabase...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const langsmithApiKey =
    config.langsmithApiKey || process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || "";

  return (
    <ClientProvider
      deploymentUrl={config.deploymentUrl}
      apiKey={langsmithApiKey}
    >
      <HomePageInner config={config} />
    </ClientProvider>
  );
}

const HomePageContent = dynamic(() => Promise.resolve(HomePageContentInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#080B21] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00FF88] border-t-transparent" />
        <p className="text-xs font-semibold text-slate-400">Đang khởi tạo giao diện Printway Opportunity Hub...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-[#080B21]">
            <p className="text-[#00FF88] font-mono animate-pulse">Đang khởi tạo giao diện Printway Opportunity Hub...</p>
          </div>
        }
      >
        <HomePageContent />
      </Suspense>
    </AuthProvider>
  );
}
