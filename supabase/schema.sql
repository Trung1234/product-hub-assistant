-- =========================================================================
-- SUPABASE POSTGRESQL MULTI-TENANT SCHEMA & ROW LEVEL SECURITY (RLS)
-- Project: Printway Product Opportunity Hub (AI R&D Copilot)
-- =========================================================================

-- Enable UUID & pgvector extensions if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked directly to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'designer' CHECK (role IN ('admin', 'lead_rd', 'designer', 'seller')),
    org_id TEXT DEFAULT 'printway_internal',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PRODUCT OPPORTUNITIES MATRIX TABLE
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing for high-speed queries
CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON public.product_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_id ON public.product_opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_keyword ON public.product_opportunities(keyword);
CREATE INDEX IF NOT EXISTS idx_opportunities_score ON public.product_opportunities(opportunity_score DESC);

-- 3. USER SESSIONS & THREAD CHECKPOINTS TABLE
CREATE TABLE IF NOT EXISTS public.user_sessions (
    thread_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id TEXT DEFAULT 'printway_internal',
    title TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view their own profile and teammates in same org
CREATE POLICY "Users can view profile in same org"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Product Opportunities: User can read/write their own and view team workspace
CREATE POLICY "Users can select their opportunities or team opportunities"
    ON public.product_opportunities FOR SELECT
    USING (auth.uid() = user_id OR org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Authenticated users can insert opportunities"
    ON public.product_opportunities FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Trigger: Automatically create public.profiles row when user signs up via Supabase Auth
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
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
