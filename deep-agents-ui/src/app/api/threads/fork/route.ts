import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { Client } from "@langchain/langgraph-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      sourceThreadId,
      shareToken,
      targetUserId,
      targetUserEmail,
      orgId = "printway_internal",
      customTitle,
      snapshotData: directSnapshot,
    } = body;

    if (!targetUserId && !targetUserEmail) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để nhân bản phiên nghiên cứu." },
        { status: 401 }
      );
    }

    let snapshotData: any = directSnapshot || null;
    let originalTitle = directSnapshot?.title || "Phiên nghiên cứu";

    // 1. Fetch source snapshot from Supabase if not provided directly
    if (!snapshotData && shareToken && isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from("thread_shares")
          .select("snapshot_data, thread_id")
          .eq("share_token", shareToken)
          .single();

        if (data?.snapshot_data) {
          snapshotData = data.snapshot_data;
          originalTitle = snapshotData.title || originalTitle;
          if (!sourceThreadId) sourceThreadId = data.thread_id;
        }
      } catch {}

      if (!snapshotData) {
        try {
          const { data: sessionData } = await supabase
            .from("user_sessions")
            .select("title")
            .eq("thread_id", `share:${shareToken}`)
            .single();

          if (sessionData?.title) {
            try {
              snapshotData = JSON.parse(sessionData.title);
              originalTitle = snapshotData.title || originalTitle;
            } catch {}
          }
        } catch {}
      }
    }

    // 2. Setup LangGraph Client with robust cloud backend URL
    const deploymentUrl =
      process.env.NEXT_PUBLIC_DEPLOYMENT_URL ||
      process.env.DEPLOYMENT_URL ||
      process.env.LANGGRAPH_API_URL ||
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
      "https://printway-product-hub-backend.onrender.com";

    const apiKey =
      process.env.LANGSMITH_API_KEY ||
      process.env.NEXT_PUBLIC_LANGSMITH_API_KEY ||
      "";

    const client = new Client({
      apiUrl: deploymentUrl,
      defaultHeaders: apiKey ? { "X-Api-Key": apiKey } : {},
    });

    // 3. If snapshotData has no messages, try fetching state directly from source thread on LangGraph
    if ((!snapshotData?.messages || snapshotData.messages.length === 0) && sourceThreadId) {
      try {
        const srcState = await client.threads.getState(sourceThreadId);
        const vals = srcState?.values as any;
        if (vals?.messages && Array.isArray(vals.messages) && vals.messages.length > 0) {
          if (!snapshotData) snapshotData = {};
          snapshotData.messages = vals.messages;
          snapshotData.todos = vals.todos || [];
          snapshotData.files = vals.files || {};
          snapshotData.ui = vals.ui || null;
        }
      } catch (srcErr) {
        console.warn("[Fork Route]: Source thread state retrieval note:", srcErr);
      }
    }

    // 4. Generate new thread ID and clean Title
    const newThreadId = uuidv4();
    const cleanOrig = originalTitle.replace(/^Bản sao:\s*/, "");
    const forkedTitle = customTitle || `Bản sao: ${cleanOrig}`;

    // 5. Create new thread and seed state on LangGraph Server
    try {
      await client.threads.create({
        threadId: newThreadId,
        metadata: {
          forked_from: sourceThreadId || shareToken,
          forked_by: targetUserId,
          title: forkedTitle,
        },
      });

      // Seed messages, todos, files, and widgets into the new thread
      if (snapshotData?.messages && snapshotData.messages.length > 0) {
        await client.threads.updateState(newThreadId, {
          values: {
            messages: snapshotData.messages,
            todos: snapshotData.todos || [],
            files: snapshotData.files || {},
            ui: snapshotData.ui || null,
          },
        });
      }
    } catch (lgError) {
      console.warn(
        "[LangGraph Client Notice]: Could not update LangGraph thread state during fork:",
        lgError
      );
    }

    // 6. Save to Supabase user_sessions so it shows up in user's sidebar
    if (isSupabaseConfigured && supabase && targetUserId) {
      try {
        await supabase.from("user_sessions").upsert({
          thread_id: newThreadId,
          user_id: targetUserId.length === 36 ? targetUserId : null,
          org_id: orgId,
          title: forkedTitle,
          last_active: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.error("[Fork DB Insert Error]:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      newThreadId,
      title: forkedTitle,
      messagesCount: snapshotData?.messages?.length || 0,
      message: "Đã nhân bản phiên nghiên cứu thành công vào không gian làm việc của bạn.",
    });
  } catch (error: any) {
    console.error("[Fork API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Không thể nhân bản phiên nghiên cứu." },
      { status: 500 }
    );
  }
}
