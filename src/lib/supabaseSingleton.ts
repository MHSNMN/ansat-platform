import {
  createClient as createSupabaseClient,
  SupabaseClient,
} from "@supabase/supabase-js";

/* eslint-disable no-var */
declare global {
  var __ENSAT_SUPABASE_SINGLETON__: SupabaseClient | null | undefined;
}
/* eslint-enable no-var */

export function getSupabaseCredentials() {
  const metaEnv =
    (import.meta as unknown as { env?: Record<string, string> }).env || {};

  let url = (
    metaEnv.VITE_SUPABASE_URL ||
    metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();

  if (url.startsWith("//")) {
    url = `https:${url}`;
  } else if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");

  const key = (
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  return { url, key };
}

export function getSharedSupabaseClient(): SupabaseClient | null {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.__ENSAT_SUPABASE_SINGLETON__
  ) {
    return globalThis.__ENSAT_SUPABASE_SINGLETON__;
  }

  const { url, key } = getSupabaseCredentials();
  if (!url || !key || url.includes("your-project")) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const client = createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    if (typeof globalThis !== "undefined") {
      globalThis.__ENSAT_SUPABASE_SINGLETON__ = client;
    }
    return client;
  } catch (err) {
    console.warn("Failed to initialize shared Supabase client:", err);
    return null;
  }
}

export function resetSharedSupabaseClient(): void {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.__ENSAT_SUPABASE_SINGLETON__
  ) {
    try {
      globalThis.__ENSAT_SUPABASE_SINGLETON__.removeAllChannels();
    } catch (err) {
      console.warn("Failed removing channels during reset:", err);
    }
    globalThis.__ENSAT_SUPABASE_SINGLETON__ = null;
  }
}

export const sharedSupabase = getSharedSupabaseClient();
