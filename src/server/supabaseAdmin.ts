import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  CanonicalRole,
  normalizeRole,
  getRecommendedPlatformAccess,
} from "../lib/rbacPolicy";

// Retrieve Supabase credentials strictly on the server side
export function getSupabaseAdminCredentials() {
  let url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();

  // Normalize URL format: handle protocol-relative (//domain) or scheme-less (domain.supabase.co)
  if (url.startsWith("//")) {
    url = `https:${url}`;
  } else if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");

  // Administrative queries must never silently use a browser publishable key.
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  return { url, key };
}

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedAdminClient) return cachedAdminClient;

  const { url, key } = getSupabaseAdminCredentials();
  if (!url || !key || url.includes("your-project")) {
    console.warn("[Supabase Admin] Missing or placeholder URL/Key.");
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.warn(
        "[Supabase Admin] Invalid Supabase URL protocol:",
        parsed.protocol,
      );
      return null;
    }
  } catch (_urlErr) {
    console.warn("[Supabase Admin] Invalid Supabase URL format:", url);
    return null;
  }

  try {
    cachedAdminClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    return cachedAdminClient;
  } catch (err: any) {
    console.warn(
      "[Supabase Admin] Client initialization notice:",
      err?.message || err,
    );
    return null;
  }
}

// Memory cache for user profiles to eliminate N+1 / repeated roundtrips (TTL 30s)
interface CachedUserProfile {
  profile: any;
  permissions: string[];
  platformAccess: Record<string, boolean>;
  actionAccess: Record<string, "INHERIT" | "ALLOW" | "DENY">;
  expiresAt: number;
}
const profileCache = new Map<string, CachedUserProfile>();
const CACHE_TTL_MS = 30000;

export function invalidateProfileCache(profileIdOrUid?: string) {
  if (!profileIdOrUid) {
    profileCache.clear();
    return;
  }
  profileCache.delete(profileIdOrUid);
  for (const [key, val] of profileCache.entries()) {
    if (
      val.profile?.id === profileIdOrUid ||
      val.profile?.firebase_uid === profileIdOrUid ||
      val.profile?.email === profileIdOrUid
    ) {
      profileCache.delete(key);
    }
  }
}

/**
 * Evaluates effective user permissions according to the 5 mandatory rules:
 * 1. Account suspended or under review -> DENY all.
 * 2. Explicit user DENY -> DENY.
 * 3. Explicit user ALLOW -> ALLOW.
 * 4. Role permission -> per role.
 * 5. Default -> DENY.
 */
export function evaluateUserPermission(
  action: string,
  userStatus: string,
  rolePermissions: readonly string[] = [],
  overrides: Record<string, "ALLOW" | "DENY" | "INHERIT"> = {},
  isSuperAdmin: boolean = false,
): boolean {
  const normStatus = (userStatus || "").toUpperCase();
  if (
    normStatus === "SUSPENDED" ||
    normStatus === "REVIEW" ||
    normStatus === "PENDING"
  ) {
    return false;
  }

  const explicitOverride = overrides[action];
  if (explicitOverride === "DENY") return false;
  if (isSuperAdmin) return true;
  if (explicitOverride === "ALLOW") return true;

  if (rolePermissions.includes(action)) {
    return true;
  }

  return false;
}

/**
 * Fetches member profile and permissions by Firebase UID from Supabase
 */
export async function getProfileByFirebaseUid(firebaseUid: string): Promise<{
  profile: any | null;
  canonicalRole: CanonicalRole;
  status: string;
  isSuperAdmin: boolean;
  platformAccess: Record<string, boolean>;
  actionAccess: Record<string, "INHERIT" | "ALLOW" | "DENY">;
} | null> {
  if (!firebaseUid) return null;

  const cached = profileCache.get(firebaseUid);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      profile: cached.profile,
      canonicalRole: normalizeRole(
        cached.profile.role_id || cached.profile.canonicalRole,
      ),
      status: cached.profile.status || "ACTIVE",
      isSuperAdmin: Boolean(cached.profile.is_super_admin),
      platformAccess: cached.platformAccess,
      actionAccess: cached.actionAccess,
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (error) {
      console.warn(
        `[Supabase Admin] getProfileByFirebaseUid error: ${error.message}`,
      );
      return null;
    }

    if (!profile) return null;

    // Fetch overrides and platform access
    const [overridesRes, platformsRes] = await Promise.all([
      supabase
        .from("user_permission_overrides")
        .select("permission_id, state")
        .eq("profile_id", profile.id),
      supabase
        .from("platform_access")
        .select("platform_id, is_allowed")
        .eq("profile_id", profile.id),
    ]);

    const actionAccess: Record<string, "INHERIT" | "ALLOW" | "DENY"> = {};
    if (overridesRes.data) {
      for (const row of overridesRes.data) {
        actionAccess[row.permission_id] = row.state as
          "INHERIT" | "ALLOW" | "DENY";
      }
    }

    const canonicalRole = normalizeRole(profile.role_id || profile.role);
    const recommended = getRecommendedPlatformAccess(canonicalRole);
    const platformAccess: Record<string, boolean> = { ...recommended };
    if (platformsRes.data && platformsRes.data.length > 0) {
      for (const row of platformsRes.data) {
        platformAccess[row.platform_id] = Boolean(row.is_allowed);
      }
    }

    const status = profile.status || "ACTIVE";
    const isSuperAdmin = Boolean(profile.is_super_admin);

    profileCache.set(firebaseUid, {
      profile,
      permissions: [],
      platformAccess,
      actionAccess,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return {
      profile,
      canonicalRole,
      status,
      isSuperAdmin,
      platformAccess,
      actionAccess,
    };
  } catch (err: any) {
    console.error(
      "[Supabase Admin] Exception fetching profile:",
      err?.message || err,
    );
    return null;
  }
}

/**
 * Record an audit log entry in Supabase audit_logs
 */
export async function logSupabaseAudit(params: {
  actorProfileId?: string;
  actorName: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  details?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    await supabase.from("audit_logs").insert({
      actor_profile_id: params.actorProfileId || null,
      actor_name: params.actorName || "النظام",
      action_type: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || null,
      metadata: params.metadata || {},
      ip_address: params.ipAddress || null,
    });
  } catch (err: any) {
    console.warn(
      "[Supabase Admin] logSupabaseAudit error:",
      err?.message || err,
    );
  }
}
