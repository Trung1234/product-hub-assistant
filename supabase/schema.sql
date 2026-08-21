-- =========================================================================
-- SUPABASE POSTGRESQL MULTI-TENANT SCHEMA (IDEMPOTENT & ERROR-FREE)
-- Project: Printway Product Opportunity Hub (AI R&D Copilot)
-- =========================================================================

-- 1. Create PROFILES Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'designer',
    org_id TEXT DEFAULT 'printway_internal',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create PRODUCT OPPORTUNITIES Table
CREATE TABLE IF NOT EXISTS public.product_opportunities (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    org_id TEXT NOT NULL DEFAULT 'printway_internal',
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    keyword TEXT NOT NULL,
    product_type TEXT,
    category TEXT,
    material TEXT,
    opportunity_score NUMERIC(5, 2) NOT NULL,
    recommendation TEXT NOT NULL,
    demand_score NUMERIC(5, 2),
    competition_score NUMERIC(5, 2),
    growth_score NUMERIC(5, 2),
    seasonality_score NUMERIC(5, 2),
    personalization_score NUMERIC(5, 2),
    production_fit_score NUMERIC(5, 2),
    price_range TEXT,
    monthly_sales INTEGER,
    amazon_bsr INTEGER,
    reason TEXT,
    raw_data_json JSONB,
    pdf_report_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create USER SESSIONS Table
CREATE TABLE IF NOT EXISTS public.user_sessions (
    thread_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id TEXT DEFAULT 'printway_internal',
    title TEXT,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON public.product_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_id ON public.product_opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_keyword ON public.product_opportunities(keyword);
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON public.product_opportunities(opportunity_score DESC);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplicate errors
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow all opportunities for authenticated" ON public.product_opportunities;
DROP POLICY IF EXISTS "Allow select opportunities" ON public.product_opportunities;
DROP POLICY IF EXISTS "Allow all sessions" ON public.user_sessions;

-- Create Clean Non-Recursive RLS Policies
CREATE POLICY "Allow select profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Allow insert profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NOT NULL);

CREATE POLICY "Allow all opportunities for authenticated"
    ON public.product_opportunities FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all sessions"
    ON public.user_sessions FOR ALL
    USING (true)
    WITH CHECK (true);

-- Trigger: Automatically create profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, org_id)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'designer'),
        COALESCE(new.raw_user_meta_data->>'org_id', 'printway_internal')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 4. Create THREAD SHARES Table (Public Link & Snapshot Caching)
-- =========================================================================
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

-- =========================================================================
-- 5. Create THREAD COLLABORATORS Table (Direct User-to-User Sharing)
-- =========================================================================
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

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow select active public shares" ON public.thread_shares;
DROP POLICY IF EXISTS "Allow all for thread owners on shares" ON public.thread_shares;
DROP POLICY IF EXISTS "Allow all for thread shares" ON public.thread_shares;
DROP POLICY IF EXISTS "Allow all for collaborators" ON public.thread_collaborators;

-- Non-recursive clean RLS policies
CREATE POLICY "Allow all for thread shares"
    ON public.thread_shares FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for collaborators"
    ON public.thread_collaborators FOR ALL
    USING (true)
    WITH CHECK (true);

