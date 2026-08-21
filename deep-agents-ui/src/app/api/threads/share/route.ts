import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

function generateShareToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "pw_sh_";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// In-memory fallback cache when Supabase is not configured or in local demo mode
const memoryShareStore = new Map<string, any>();
const memoryThreadToShare = new Map<string, string>(); // threadId -> shareToken
const memoryCollaborators = new Map<string, any[]>(); // threadId -> collaborators

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const threadId = searchParams.get("threadId");

  try {
    // 1. Query by public share token
    if (token) {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("thread_shares")
          .select(`
            *,
            profiles:owner_id (full_name, email, role, avatar_url)
          `)
          .eq("share_token", token)
          .eq("is_active", true)
          .single();

        if (error || !data) {
          // Fallback to memory
          const memData = memoryShareStore.get(token);
          if (memData && memData.is_active) {
            return NextResponse.json({ success: true, share: memData });
          }
          return NextResponse.json(
            { error: "Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi." },
            { status: 404 }
          );
        }

        // Increment view count asynchronously
        supabase
          .from("thread_shares")
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq("id", data.id)
          .then(() => {});

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

      // Memory fallback
      const memData = memoryShareStore.get(token);
      if (memData && memData.is_active) {
        memData.view_count = (memData.view_count || 0) + 1;
        return NextResponse.json({ success: true, share: memData });
      }

      return NextResponse.json(
        { error: "Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi." },
        { status: 404 }
      );
    }

    // 2. Query by threadId (to populate the Share Modal for owner)
    if (threadId) {
      if (isSupabaseConfigured && supabase) {
        const { data: shareData } = await supabase
          .from("thread_shares")
          .select("*")
          .eq("thread_id", threadId)
          .single();

        const { data: collabData } = await supabase
          .from("thread_collaborators")
          .select(`
            *,
            profiles:user_id (full_name, email)
          `)
          .eq("thread_id", threadId);

        const collaborators = (collabData || []).map((c: any) => ({
          id: c.id,
          thread_id: c.thread_id,
          user_id: c.user_id,
          role: c.role,
          created_at: c.created_at,
          full_name: c.profiles?.full_name || c.profiles?.email?.split("@")[0],
          email: c.profiles?.email,
        }));

        return NextResponse.json({
          success: true,
          share: shareData || null,
          collaborators,
        });
      }

      // Memory fallback
      const memToken = memoryThreadToShare.get(threadId);
      const memShare = memToken ? memoryShareStore.get(memToken) : null;
      const memCollabs = memoryCollaborators.get(threadId) || [];

      return NextResponse.json({
        success: true,
        share: memShare || null,
        collaborators: memCollabs,
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
    const {
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

    let shareToken = body.shareToken;

    if (isSupabaseConfigured && supabase) {
      // 1. Check if an existing share record exists
      const { data: existing } = await supabase
        .from("thread_shares")
        .select("share_token")
        .eq("thread_id", threadId)
        .single();

      if (existing?.share_token) {
        shareToken = existing.share_token;
      } else if (!shareToken) {
        shareToken = generateShareToken();
      }

      // 2. Ensure user_session exists in Supabase so foreign key constraint passes
      if (ownerId) {
        await supabase.from("user_sessions").upsert({
          thread_id: threadId,
          user_id: ownerId,
          org_id: orgId,
          title: snapshotData?.title || "Phiên nghiên cứu được chia sẻ",
          last_active: new Date().toISOString(),
        });
      }

      // 3. Upsert thread_shares
      const { data: shareRecord, error: shareError } = await supabase
        .from("thread_shares")
        .upsert(
          {
            thread_id: threadId,
            owner_id: ownerId || null,
            org_id: orgId,
            share_token: shareToken,
            share_mode: shareMode,
            permission: permission,
            snapshot_data: snapshotData || null,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "thread_id" }
        )
        .select()
        .single();

      if (shareError) {
        console.error("[Supabase Share Upsert Error]:", shareError);
      }

      return NextResponse.json({
        success: true,
        shareToken,
        share: shareRecord || {
          thread_id: threadId,
          share_token: shareToken,
          share_mode: shareMode,
          permission,
          is_active: isActive,
        },
      });
    }

    // Memory Fallback for local demo
    if (!shareToken) {
      shareToken = memoryThreadToShare.get(threadId) || generateShareToken();
    }

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
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_name: snapshotData?.authorName || "Printway R&D",
      owner_email: snapshotData?.authorEmail || "analyst@printway.io",
      owner_role: snapshotData?.authorRole || "lead_rd",
    };

    memoryShareStore.set(shareToken, shareObject);
    memoryThreadToShare.set(threadId, shareToken);
    if (collaborators.length > 0) {
      memoryCollaborators.set(threadId, collaborators);
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
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from("thread_shares")
        .update({ is_active: false })
        .eq("thread_id", threadId);
    }

    const memToken = memoryThreadToShare.get(threadId);
    if (memToken) {
      const existing = memoryShareStore.get(memToken);
      if (existing) {
        existing.is_active = false;
      }
    }

    return NextResponse.json({ success: true, message: "Đã thu hồi liên kết chia sẻ." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
