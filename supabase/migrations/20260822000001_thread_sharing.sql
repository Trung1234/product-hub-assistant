-- =========================================================================
-- SUPABASE POSTGRESQL MULTI-TENANT SCHEMA
-- Project: Printway Product Opportunity Hub (AI R&D Copilot)
-- Migration: 20260822000001_thread_sharing.sql
-- =========================================================================

-- 1. Create THREAD SHARES Table (Public Link & Snapshot Caching)
CREATE TABLE IF NOT EXISTS public.thread_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id TEXT NOT NULL REFERENCES public.user_sessions(thread_id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL DEFAULT 'printway_internal',
    share_token TEXT UNIQUE NOT NULL,
    share_mode TEXT NOT NULL DEFAULT 'public_link', -- 'private' | 'public_link' | 'org_only' | 'restricted'
    permission TEXT NOT NULL DEFAULT 'view',        -- 'view' | 'fork' | 'edit'
    snapshot_data JSONB,                           -- Cached messages, summary & state for instant render
    is_active BOOLEAN DEFAULT TRUE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(thread_id)
);

-- 2. Create THREAD COLLABORATORS Table (Direct User-to-User Sharing)
CREATE TABLE IF NOT EXISTS public.thread_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id TEXT NOT NULL REFERENCES public.user_sessions(thread_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES auth.users(id),
    role TEXT NOT NULL DEFAULT 'viewer',           -- 'viewer' | 'editor'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(thread_id, user_id)
);

-- Indexes for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_thread_shares_token ON public.thread_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_thread_shares_thread_id ON public.thread_shares(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_shares_org_id ON public.thread_shares(org_id);
CREATE INDEX IF NOT EXISTS idx_thread_collab_user ON public.thread_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_collab_thread ON public.thread_collaborators(thread_id);

-- Enable RLS
ALTER TABLE public.thread_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_collaborators ENABLE ROW LEVEL SECURITY;

-- Clean Non-recursive RLS policies
DROP POLICY IF EXISTS "Allow select active public shares" ON public.thread_shares;
DROP POLICY IF EXISTS "Allow all for thread owners on shares" ON public.thread_shares;
DROP POLICY IF EXISTS "Allow all for thread shares" ON public.thread_shares;
DROP POLICY IF EXISTS "Allow all for collaborators" ON public.thread_collaborators;

CREATE POLICY "Allow all for thread shares"
    ON public.thread_shares FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for collaborators"
    ON public.thread_collaborators FOR ALL
    USING (true)
    WITH CHECK (true);
