import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { Client } from "@langchain/langgraph-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sourceThreadId,
      shareToken,
      targetUserId,
      targetUserEmail,
      orgId = "printway_internal",
      customTitle,
    } = body;

    if (!targetUserId && !targetUserEmail) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để nhân bản phiên nghiên cứu." },
        { status: 401 }
      );
    }

    let snapshotData: any = null;
    let originalTitle = "Phiên nghiên cứu";

    // 1. Fetch source snapshot from Supabase or share API
    if (shareToken && isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from("thread_shares")
        .select("snapshot_data, thread_id")
        .eq("share_token", shareToken)
        .single();

      if (data?.snapshot_data) {
        snapshotData = data.snapshot_data;
        originalTitle = snapshotData.title || originalTitle;
      }
    }

    // 2. Generate a new thread ID
    const newThreadId = uuidv4();
    const forkedTitle = customTitle || `Bản sao: ${originalTitle}`;

    // 3. Try to initialize state on LangGraph API Server if available
    const deploymentUrl =
      process.env.LANGGRAPH_API_URL ||
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
      "http://localhost:2024";

    const apiKey =
      process.env.LANGSMITH_API_KEY ||
      process.env.NEXT_PUBLIC_LANGSMITH_API_KEY ||
      "";

    try {
      const client = new Client({
        apiUrl: deploymentUrl,
        defaultHeaders: apiKey ? { "X-Api-Key": apiKey } : {},
      });

      // Create new thread on LangGraph
      await client.threads.create({
        threadId: newThreadId,
        metadata: {
          forked_from: sourceThreadId || shareToken,
          forked_by: targetUserId,
          title: forkedTitle,
        },
      });

      // If we have messages from snapshot, seed the new thread state
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
        "[LangGraph Client Notice]: Could not reach LangGraph server during fork. Thread ID registered for client-side connection.",
        lgError
      );
    }

    // 4. Save to Supabase user_sessions
    if (isSupabaseConfigured && supabase && targetUserId) {
      try {
        await supabase.from("user_sessions").insert({
          thread_id: newThreadId,
          user_id: targetUserId,
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
