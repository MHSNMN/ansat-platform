import {
  getSupabaseAdminClient,
  invalidateProfileCache,
} from "../supabaseAdmin";
import type { User } from "../../types";
import {
  normalizeRole,
  getRecommendedPlatformAccess,
} from "../../lib/rbacPolicy";

export interface MemberProfileRecord {
  id: string;
  firebase_uid: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  phone_normalized?: string;
  country?: string;
  nationality?: string;
  show_nationality_public?: boolean;
  role_id: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | "REVIEW";
  is_super_admin: boolean;
  token_version: number;
  is_archived: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  created_at: string;
  updated_at: string;
}

export class MemberRepository {
  /**
   * Find profile by Firebase UID
   */
  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !firebaseUid) return null;

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("firebase_uid", firebaseUid)
        .eq("is_archived", false)
        .maybeSingle();

      if (error || !profile) return null;

      return this.mapProfileToUser(profile, supabase);
    } catch (err: any) {
      console.warn(
        "[MemberRepository] findByFirebaseUid error:",
        err?.message || err,
      );
      return null;
    }
  }

  /**
   * Find profile by email or identifier
   */
  async findByIdentifier(identifier: string): Promise<User | null> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !identifier) return null;

    const clean = identifier.trim().toLowerCase();
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`email.ilike.${clean},username.ilike.${clean},id.eq.${identifier}`)
        .eq("is_archived", false)
        .maybeSingle();

      if (error || !profile) return null;

      return this.mapProfileToUser(profile, supabase);
    } catch (err: any) {
      console.warn(
        "[MemberRepository] findByIdentifier error:",
        err?.message || err,
      );
      return null;
    }
  }

  /**
   * List active/non-archived profiles with pagination
   */
  async listMembers(options?: {
    limit?: number;
    offset?: number;
    role?: string;
    status?: string;
  }): Promise<{ users: User[]; total: number }> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { users: [], total: 0 };

    const limit = Math.min(options?.limit || 50, 100);
    const offset = options?.offset || 0;

    try {
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .eq("is_archived", false);

      if (options?.role) {
        query = query.eq("role_id", options.role.toLowerCase());
      }
      if (options?.status) {
        query = query.eq("status", options.status.toUpperCase());
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error || !data) return { users: [], total: 0 };

      // Map profiles
      const users = data.map((p) => this.mapProfileBasic(p));
      return { users, total: count || data.length };
    } catch (err: any) {
      console.warn(
        "[MemberRepository] listMembers error:",
        err?.message || err,
      );
      return { users: [], total: 0 };
    }
  }

  /**
   * Upsert a profile into Supabase
   */
  async upsertMember(profile: Partial<MemberProfileRecord>): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !profile.firebase_uid) return false;

    try {
      const payload: any = {
        firebase_uid: profile.firebase_uid,
        email: (profile.email || "").trim().toLowerCase(),
        username: profile.username || profile.email?.split("@")[0] || "member",
        full_name: profile.full_name || "عضو إنصات",
        phone: profile.phone || null,
        phone_normalized: profile.phone_normalized || null,
        country: profile.country || null,
        nationality: profile.nationality || null,
        role_id: (profile.role_id || "member").toLowerCase(),
        status: (profile.status || "ACTIVE").toUpperCase(),
        is_super_admin: Boolean(profile.is_super_admin),
        token_version: profile.token_version || 1,
        is_archived: Boolean(profile.is_archived),
        updated_at: new Date().toISOString(),
      };

      if (profile.id) {
        payload.id = profile.id;
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "firebase_uid" });

      if (error) {
        console.warn("[MemberRepository] upsertMember error:", error.message);
        return false;
      }

      invalidateProfileCache(profile.firebase_uid);
      return true;
    } catch (err: any) {
      console.error(
        "[MemberRepository] upsertMember exception:",
        err?.message || err,
      );
      return false;
    }
  }

  /**
   * Soft archive member (preventing hard deletion)
   */
  async archiveMember(profileId: string, archivedBy: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !profileId) return false;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
          status: "SUSPENDED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);

      if (error) return false;
      invalidateProfileCache(profileId);
      return true;
    } catch {
      return false;
    }
  }

  private async mapProfileToUser(profile: any, supabase: any): Promise<User> {
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
    const platformAccess: any = { ...recommended };
    if (platformsRes.data && platformsRes.data.length > 0) {
      for (const row of platformsRes.data) {
        platformAccess[row.platform_id] = Boolean(row.is_allowed);
      }
    }

    const isSuperAdmin = Boolean(profile.is_super_admin);

    return {
      id: profile.id,
      uid: profile.firebase_uid || profile.id,
      fullName: profile.full_name,
      name: profile.full_name,
      username: profile.username,
      normalizedUsername: (profile.username || "").toLowerCase(),
      email: profile.email,
      normalizedEmail: (profile.email || "").toLowerCase(),
      phone: profile.phone || "",
      normalizedPhone: profile.phone_normalized || "",
      country: profile.country || "",
      canonicalRole,
      role: canonicalRole,
      accountStatus:
        profile.status?.toLowerCase() === "active" ? "active" : "suspended",
      status:
        profile.status?.toLowerCase() === "active" ? "active" : "disabled",
      is_super_admin: isSuperAdmin,
      platformAccess,
      actionAccess,
      publicProfileConsent: Boolean(profile.show_nationality_public),
      createdAt: profile.created_at || new Date().toISOString(),
    };
  }

  private mapProfileBasic(profile: any): User {
    const canonicalRole = normalizeRole(profile.role_id || profile.role);
    return {
      id: profile.id,
      uid: profile.firebase_uid || profile.id,
      fullName: profile.full_name,
      name: profile.full_name,
      username: profile.username,
      normalizedUsername: (profile.username || "").toLowerCase(),
      email: profile.email,
      normalizedEmail: (profile.email || "").toLowerCase(),
      phone: profile.phone || "",
      normalizedPhone: profile.phone_normalized || "",
      country: profile.country || "",
      canonicalRole,
      role: canonicalRole,
      accountStatus:
        profile.status?.toLowerCase() === "active" ? "active" : "suspended",
      status:
        profile.status?.toLowerCase() === "active" ? "active" : "disabled",
      is_super_admin: Boolean(profile.is_super_admin),
      platformAccess: {
        recording: false,
        tasks: false,
        rewards: false,
        admin: false,
        public: true,
      },
      actionAccess: {},
      publicProfileConsent: Boolean(profile.show_nationality_public),
      createdAt: profile.created_at || new Date().toISOString(),
    };
  }
}

export const memberRepository = new MemberRepository();
