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

    // 1. Resolve source thread ID & snapshot data from Supabase if not provided
    if (shareToken && isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from("thread_shares")
          .select("snapshot_data, thread_id")
          .eq("share_token", shareToken)
          .single();

        if (data) {
          if (!sourceThreadId && data.thread_id) sourceThreadId = data.thread_id;
          if (!snapshotData && data.snapshot_data) snapshotData = data.snapshot_data;
          if (snapshotData?.title) originalTitle = snapshotData.title;
        }
      } catch {}

      if (!sourceThreadId || !snapshotData) {
        try {
          const { data: sessionData } = await supabase
            .from("user_sessions")
            .select("title")
            .eq("thread_id", `share:${shareToken}`)
            .single();

          if (sessionData?.title) {
            try {
              const parsed = JSON.parse(sessionData.title);
              if (!snapshotData) snapshotData = parsed;
              if (parsed?.title) originalTitle = parsed.title;
              if (!sourceThreadId && parsed?.threadId) sourceThreadId = parsed.threadId;
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

    const cleanOrig = originalTitle.replace(/^Bản sao:\s*/, "");
    const forkedTitle = customTitle || `Bản sao: ${cleanOrig}`;

    let newThreadId = uuidv4();

    // 3. Clone thread state on LangGraph Server using official client.threads.copy
    let copySuccessful = false;
    if (sourceThreadId) {
      try {
        const copiedThread = await client.threads.copy(sourceThreadId);
        if (copiedThread?.thread_id) {
          newThreadId = copiedThread.thread_id;
          copySuccessful = true;
        }
      } catch (copyErr) {
        console.warn("[Fork Route]: client.threads.copy fallback to manual create:", copyErr);
      }
    }

    // 4. Fallback: If copy was not possible, create new thread and update metadata
    if (!copySuccessful) {
      try {
        const createdThread = await client.threads.create({
          metadata: {
            graph_id: "product_opportunity_hub",
            forked_from: sourceThreadId || shareToken,
            forked_by: targetUserId,
            title: forkedTitle,
          },
        });
        if (createdThread?.thread_id) {
          newThreadId = createdThread.thread_id;
        }
      } catch (createErr) {
        console.warn("[Fork Route]: client.threads.create note:", createErr);
      }
    }

    // 5. Save to Supabase user_sessions so it shows up in user's sidebar
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
