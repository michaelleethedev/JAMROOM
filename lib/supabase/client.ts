"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getSupabasePublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabasePublicKey());
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;

  browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getSupabasePublicKey()!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "jamroom-live-auth"
    },
    realtime: {
      params: {
        eventsPerSecond: 8
      }
    }
  });

  return browserClient;
}

export async function ensureAnonymousUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existingSession } = await supabase.auth.getSession();
  if (existingSession.session?.user) return existingSession.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in did not return a user.");
  return data.user;
}
