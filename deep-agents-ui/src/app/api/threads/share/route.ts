import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { Client } from "@langchain/langgraph-sdk";

function generateShareToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "pw_sh_";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// In-memory cache for fast local access
const memoryShareStore = new Map<string, any>();
const memoryThreadToShare = new Map<string, string>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const threadId = searchParams.get("threadId");

  try {
    // 1. Query by public share token
    if (token) {
      // A. Check memory cache first
      const memData = memoryShareStore.get(token);
      if (memData && memData.is_active) {
        memData.view_count = (memData.view_count || 0) + 1;
        return NextResponse.json({ success: true, share: memData });
      }

      // B. Query Supabase (thread_shares table or user_sessions fallback)
      if (isSupabaseConfigured && supabase) {
        // Try dedicated thread_shares table
        try {
          const { data, error } = await supabase
            .from("thread_shares")
            .select(`
              *,
              profiles:owner_id (full_name, email, role, avatar_url)
            `)
            .eq("share_token", token)
            .eq("is_active", true)
            .single();

          if (!error && data) {
            return NextResponse.json({
              success: true,
              share: {
                ...data,
                owner_name: (data as any).profiles?.full_name || (data as any).profiles?.email?.split("@")[0] || "Printway R&D",
                owner_email: (data as any).profiles?.email,
                owner_role: (data as any).profiles?.role,
              },
            });
          }
        } catch (e) {
          console.debug("thread_shares query catch:", e);
        }

        // Robust Fallback: Query user_sessions cloud storage
        try {
          const { data: sessionData, error: sessionErr } = await supabase
            .from("user_sessions")
            .select("*")
            .eq("thread_id", `share:${token}`)
            .single();

          if (!sessionErr && sessionData) {
            let parsedSnapshot: any = null;
            try {
              parsedSnapshot = JSON.parse(sessionData.title || "{}");
            } catch {
              parsedSnapshot = { title: sessionData.title };
            }

            const fallbackShare = {
              id: sessionData.thread_id,
              thread_id: parsedSnapshot?.threadId || sessionData.thread_id,
              owner_id: sessionData.user_id,
              org_id: sessionData.org_id || "printway_internal",
              share_token: token,
              share_mode: "public_link",
              permission: "fork",
              snapshot_data: parsedSnapshot,
              is_active: true,
              view_count: 1,
              created_at: sessionData.created_at,
              updated_at: sessionData.last_active,
              owner_name: parsedSnapshot?.authorName || "Printway R&D",
              owner_email: parsedSnapshot?.authorEmail || "analyst@printway.io",
              owner_role: parsedSnapshot?.authorRole || "lead_rd",
            };

            // Cache in memory for subsequent requests
            memoryShareStore.set(token, fallbackShare);

            return NextResponse.json({
              success: true,
              share: fallbackShare,
            });
          }
        } catch (fallbackErr) {
          console.debug("user_sessions fallback error:", fallbackErr);
        }
      }

      return NextResponse.json(
        { error: "Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi." },
        { status: 404 }
      );
    }

    // 2. Query by threadId (to populate the Share Modal for owner)
    if (threadId) {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: shareData } = await supabase
            .from("thread_shares")
            .select("*")
            .eq("thread_id", threadId)
            .single();

          if (shareData) {
            return NextResponse.json({
              success: true,
              share: shareData,
              collaborators: [],
            });
          }
        } catch (dbErr) {
          console.debug("Supabase thread share query fallback:", dbErr);
        }

        // Fallback: check session-backed share token
        try {
          const memToken = memoryThreadToShare.get(threadId);
          if (memToken) {
            const memShare = memoryShareStore.get(memToken);
            if (memShare) {
              return NextResponse.json({
                success: true,
                share: memShare,
                collaborators: [],
              });
            }
          }
        } catch {}
      }

      const memToken = memoryThreadToShare.get(threadId);
      const memShare = memToken ? memoryShareStore.get(memToken) : null;

      return NextResponse.json({
        success: true,
        share: memShare || null,
        collaborators: [],
      });
    }

    return NextResponse.json(
      { error: "Vui lòng cung cấp 'token' hoặc 'threadId'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Share API GET Error]:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi máy chủ khi truy vấn chia sẻ." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      threadId,
      shareMode = "public_link",
      permission = "view",
      isActive = true,
      snapshotData,
      ownerId,
      orgId = "printway_internal",
      collaborators = [],
    } = body;

    if (!threadId) {
      return NextResponse.json(
        { error: "Thiếu threadId bắt buộc." },
        { status: 400 }
      );
    }

    // If snapshotData has no messages, fetch directly from LangGraph server
    if ((!snapshotData?.messages || snapshotData.messages.length === 0) && threadId) {
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

      try {
        const client = new Client({
          apiUrl: deploymentUrl,
          defaultHeaders: apiKey ? { "X-Api-Key": apiKey } : {},
        });
        const state = await client.threads.getState(threadId);
        const vals = state?.values as any;
        if (vals?.messages && Array.isArray(vals.messages) && vals.messages.length > 0) {
          if (!snapshotData) {
            snapshotData = { title: "Phiên nghiên cứu" };
          }
          snapshotData.messages = vals.messages;
          snapshotData.todos = vals.todos || [];
          snapshotData.files = vals.files || {};
          snapshotData.ui = vals.ui || null;
        }
      } catch (lgErr) {
        console.debug("[Share Route]: LangGraph state fetch note:", lgErr);
      }
    }

    const shareToken = body.shareToken || memoryThreadToShare.get(threadId) || generateShareToken();

    // 1. Populate Memory Store
    const shareObject = {
      id: uuidv4(),
      thread_id: threadId,
      owner_id: ownerId,
      org_id: orgId,
      share_token: shareToken,
      share_mode: shareMode,
      permission: permission,
      snapshot_data: snapshotData,
      is_active: isActive,
      view_count: memoryShareStore.get(shareToken)?.view_count || 0,
      created_at: memoryShareStore.get(shareToken)?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: snapshotData?.authorName || "Printway R&D",
      owner_email: snapshotData?.authorEmail || "analyst@printway.io",
      owner_role: snapshotData?.authorRole || "lead_rd",
    };

    memoryShareStore.set(shareToken, shareObject);
    memoryThreadToShare.set(threadId, shareToken);

    // 2. Persist to Cloud Supabase
    if (isSupabaseConfigured && supabase) {
      // A. Save to user_sessions fallback storage (guaranteed to work across all serverless lambdas)
      try {
        await supabase.from("user_sessions").upsert({
          thread_id: `share:${shareToken}`,
          user_id: ownerId && ownerId.length === 36 ? ownerId : null,
          org_id: orgId || "printway_internal",
          title: JSON.stringify(snapshotData || {}),
          last_active: new Date().toISOString(),
        });
      } catch (sessionErr) {
        console.debug("Error upserting share to user_sessions:", sessionErr);
      }

      // B. Try dedicated thread_shares table
      try {
        if (ownerId && ownerId.length === 36) {
          await supabase.from("user_sessions").upsert({
            thread_id: threadId,
            user_id: ownerId,
            org_id: orgId,
            title: snapshotData?.title || "Phiên nghiên cứu được chia sẻ",
            last_active: new Date().toISOString(),
          });
        }

        await supabase
          .from("thread_shares")
          .upsert(
            {
              thread_id: threadId,
              owner_id: ownerId && ownerId.length === 36 ? ownerId : null,
              org_id: orgId,
              share_token: shareToken,
              share_mode: shareMode,
              permission: permission,
              snapshot_data: snapshotData || null,
              is_active: isActive,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "thread_id" }
          );
      } catch (dbErr) {
        console.debug("Supabase thread_shares upsert note:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      shareToken,
      share: shareObject,
    });
  } catch (error: any) {
    console.error("[Share API POST Error]:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi khi lưu cấu hình chia sẻ." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");

  if (!threadId) {
    return NextResponse.json({ error: "Thiếu threadId." }, { status: 400 });
  }

  try {
    const memToken = memoryThreadToShare.get(threadId);
    if (memToken) {
      const existing = memoryShareStore.get(memToken);
      if (existing) {
        existing.is_active = false;
      }
    }

    if (isSupabaseConfigured && supabase) {
      if (memToken) {
        try {
          await supabase
            .from("user_sessions")
            .delete()
            .eq("thread_id", `share:${memToken}`);
        } catch {}
      }

      try {
        await supabase
          .from("thread_shares")
          .update({ is_active: false })
          .eq("thread_id", threadId);
      } catch (dbErr) {
        console.debug("Supabase delete notice:", dbErr);
      }
    }

    return NextResponse.json({ success: true, message: "Đã thu hồi liên kết chia sẻ." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
