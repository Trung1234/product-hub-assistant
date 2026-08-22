"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { supabase, isSupabaseConfigured, UserProfile } from "@/lib/supabase";

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string, role: string, orgId: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithClerk: () => void;
  signUpWithClerk: () => void;
  signOut: () => Promise<void>;
  signInDemo: (email: string, role: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signInWithGoogle: async () => ({}),
  signInWithClerk: () => {},
  signUpWithClerk: () => {},
  signOut: async () => {},
  signInDemo: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser();

  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Clerk Session
  useEffect(() => {
    if (isClerkSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || "";
      const fullName = clerkUser.fullName || clerkUser.firstName || email.split("@")[0] || "Printway User";
      const role = (clerkUser.publicMetadata?.role as string) || "lead_rd";
      const orgId = (clerkUser.publicMetadata?.org_id as string) || "printway_internal";

      const mappedUser = {
        id: clerkUser.id,
        email,
        user_metadata: {
          full_name: fullName,
          role,
          org_id: orgId,
          avatar_url: clerkUser.imageUrl
        }
      };

      const mappedProfile: UserProfile = {
        id: clerkUser.id,
        email,
        full_name: fullName,
        role: role as any,
        org_id: orgId,
        avatar_url: clerkUser.imageUrl,
        created_at: clerkUser.createdAt ? new Date(clerkUser.createdAt).toISOString() : new Date().toISOString()
      };

      setUser(mappedUser);
      setProfile(mappedProfile);
      setLoading(false);
    }
  }, [isClerkSignedIn, clerkUser]);

  useEffect(() => {
    // If Clerk is not signed in, check local demo or Supabase session
    if (isClerkSignedIn) return;

    const savedDemo = localStorage.getItem("printway_demo_user");
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo);
        setUser(parsed.user);
        setProfile(parsed.profile);
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem("printway_demo_user");
      }
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // 1. Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user);
      } else if (!savedDemo) {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // 2. Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user);
      } else {
        if (!localStorage.getItem("printway_demo_user")) {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isClerkSignedIn]);

  const fetchProfile = async (authUser: any) => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (data) {
        setProfile(data as UserProfile);
      } else {
        setProfile({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0],
          role: authUser.user_metadata?.role || "designer",
          org_id: authUser.user_metadata?.org_id || "printway_internal"
        });
      }
    } catch {
      setProfile({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.email?.split("@")[0],
        role: "designer",
        org_id: "printway_internal"
      });
    }
  };

  const signInWithClerk = () => {
    try {
      clerk.openSignIn({
        fallbackRedirectUrl: "/",
        signUpFallbackRedirectUrl: "/",
      });
    } catch {
      signInDemo("designer@printway.io", "designer");
    }
  };

  const signUpWithClerk = () => {
    try {
      clerk.openSignUp({
        fallbackRedirectUrl: "/",
        signInFallbackRedirectUrl: "/",
      });
    } catch {
      signInDemo("new_designer@printway.io", "designer");
    }
  };

  const signInWithGoogle = async () => {
    try {
      clerk.openSignIn({
        fallbackRedirectUrl: "/",
        signUpFallbackRedirectUrl: "/",
      });
      return {};
    } catch (err: any) {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/`,
          },
        });
        if (error) return { error: error.message };
        return {};
      }
      signInDemo("google_user@printway.io", "designer");
      return {};
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      signInDemo(email, "designer");
      return {};
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user);
    }
    return {};
  };

  const signUp = async (email: string, password: string, fullName: string, role: string, orgId: string) => {
    if (!supabase) {
      signInDemo(email, role);
      return {};
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          org_id: orgId
        }
      }
    });
    if (error) return { error: error.message };
    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user);
    }
    return {};
  };

  const signOut = async () => {
    localStorage.removeItem("printway_demo_user");
    if (supabase) {
      await supabase.auth.signOut();
    }
    try {
      await clerk.signOut();
    } catch {}
    setUser(null);
    setProfile(null);
  };

  const signInDemo = (email: string, role: string) => {
    const demoUser = {
      id: "usr_" + btoa(email).replace(/=/g, "").slice(0, 16),
      email: email,
      user_metadata: { full_name: email.split("@")[0], role, org_id: "printway_internal" }
    };
    const demoProfile: UserProfile = {
      id: demoUser.id,
      email: email,
      full_name: email.split("@")[0].toUpperCase(),
      role: role as any,
      org_id: "printway_internal"
    };
    setUser(demoUser);
    setProfile(demoProfile);
    localStorage.setItem("printway_demo_user", JSON.stringify({ user: demoUser, profile: demoProfile }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithClerk,
        signUpWithClerk,
        signOut,
        signInDemo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
