import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://cvhjqjttdupchyjwfgyq.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Zp2WvGKQ7KkOmFgNp1WWtg_txy6Aww8";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "lead_rd" | "designer" | "seller";
  org_id: string;
}
