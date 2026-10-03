// @ts-nocheck
/// <reference types="vite/client" />
import { SupabaseClient } from "@supabase/supabase-js";
import {
  getSharedSupabaseClient,
  resetSharedSupabaseClient,
  getSupabaseCredentials as getSingletonCredentials,
} from "../../../lib/supabaseSingleton";

export function getSupabaseCredentials() {
  return getSingletonCredentials();
}

export function createClient(): SupabaseClient | null {
  return getSharedSupabaseClient();
}

export function resetSupabaseClient() {
  resetSharedSupabaseClient();
}
