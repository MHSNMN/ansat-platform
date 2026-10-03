// @ts-nocheck
/**
 * Centralized Role-Based Access Control (RBAC) Policy
 * Ensat Central Hub & Audio Platform - Phase 4 (A)
 *
 * Defines canonical roles, sensitive action policies, least-privilege matrix,
 * and security sanitization helpers.
 */

import { User } from "../types";

// 1. Four Canonical Typed Roles
export const CANONICAL_ROLES = [
  "admin",
  "audio_engineer",
  "reviewer",
  "narrator",
  "member",
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

// Display names for UI representation
export const ROLE_DISPLAY_NAMES_AR: Record<CanonicalRole, string> = {
  admin: "مدير النظام (Admin)",
  audio_engineer: "مهندس صوت (Audio Engineer)",
  reviewer: "مدقق جودة (Reviewer)",
  narrator: "قارئ / معلق صوتي (Narrator)",
  member: "عضو (مهام فقط)",
};

// 2. Sensitive Actions across the platform
export type SensitiveAction =
  | "create_book"
  | "edit_book"
  | "delete_book_folder"
  | "upload_raw"
  | "upload_master"
  | "review_recording"
  | "update_stage"
  | "delete_recording"
  | "manage_members"
  | "view_activity_logs"
  | "manage_drive"
  | "access_control_panel";

// 3. Strict Least-Privilege Permissions Matrix
export const ROLE_PERMISSIONS: Record<
  CanonicalRole,
  readonly SensitiveAction[]
> = {
  admin: [
    "create_book",
    "edit_book",
    "delete_book_folder",
    "upload_raw",
    "upload_master",
    "review_recording",
    "update_stage",
    "delete_recording",
    "manage_members",
    "view_activity_logs",
    "manage_drive",
    "access_control_panel",
  ],
  audio_engineer: ["upload_master", "update_stage", "view_activity_logs"],
  reviewer: ["review_recording", "update_stage", "view_activity_logs"],
  narrator: ["upload_raw"],
  member: [],
};

/**
 * Normalizes any legacy or untyped role string to a canonical role.
 * Defaults to "member" (no studio permissions) if unrecognized.
 */
export function normalizeRole(rawRole: unknown): CanonicalRole {
  if (typeof rawRole !== "string") return "member";

  const normalized = rawRole.trim().toLowerCase().replace(/-/g, "_");

  switch (normalized) {
    case "super_admin":
    case "superadmin":
    case "admin":
      return "admin";
    case "hr":
      return "member";
    case "audio_engineer":
    case "audioengineer":
    case "sound_engineer":
    case "engineer":
      return "audio_engineer";
    case "qa_reviewer":
    case "qareviewer":
    case "reviewer":
    case "qa":
      return "reviewer";
    case "narrator":
      return "narrator";
    case "member":
      return "member";
    default:
      return "member";
  }
}

/**
 * Evaluates whether a role is authorized for a specific sensitive action.
 */
export function isActionAllowed(
  role: unknown,
  action: SensitiveAction,
): boolean {
  const canonical = normalizeRole(role);
  const allowedActions = ROLE_PERMISSIONS[canonical];
  return allowedActions.includes(action);
}

/**
 * Sanitizes and validates a user object from untrusted storage (e.g. localStorage).
 * Ensures client-side state cannot artificially escalate role or privileges.
 */
export function sanitizeUserFromStorage(
  untrustedUser: Partial<User> | null | undefined,
  trustedRegistry: User[],
): User | null {
  if (!untrustedUser || !untrustedUser.id) return null;

  // Verify against trusted registry by ID
  const trusted = trustedRegistry.find((u) => u.id === untrustedUser.id);
  if (!trusted) {
    // If user is not recognized in trusted registry, do NOT trust any elevated flags
    return {
      id: String(untrustedUser.id),
      name: String(untrustedUser.name || "مستخدم"),
      email: String(untrustedUser.email || ""),
      // Never keep PIN in untrusted state
      role: "MEMBER",
      role_display_ar: ROLE_DISPLAY_NAMES_AR.member,
      is_super_admin: false,
      can_access_studio: false,
      can_upload_raw: false,
      can_qa_review: false,
      can_master_audio: false,
      can_manage_books: false,
      can_manage_members: false,
      can_view_activity_logs: false,
      can_manage_drive: false,
      can_access_ai_eval: false,
      can_manage_banner: false,
      can_manage_settings: false,
      can_wipe_database: false,
      can_edit_db_urls: false,
      can_access_control_panel: false,
    };
  }

  // Determine canonical role from trusted database record only
  const canonicalRole = normalizeRole(trusted.role);
  const isAdmin = canonicalRole === "admin" || Boolean(trusted.is_super_admin);

  return {
    ...trusted,
    role: trusted.role,
    is_super_admin: isAdmin && Boolean(trusted.is_super_admin),
    can_access_studio:
      isActionAllowed(canonicalRole, "upload_raw") ||
      isActionAllowed(canonicalRole, "upload_master") ||
      isActionAllowed(canonicalRole, "review_recording") ||
      isAdmin,
    can_upload_raw: isActionAllowed(canonicalRole, "upload_raw") || isAdmin,
    can_master_audio: isActionAllowed(canonicalRole, "upload_master"),
    can_qa_review: isActionAllowed(canonicalRole, "review_recording"),
    can_manage_books: isActionAllowed(canonicalRole, "create_book"),
    can_manage_members: isActionAllowed(canonicalRole, "manage_members"),
    can_view_activity_logs: isActionAllowed(
      canonicalRole,
      "view_activity_logs",
    ),
    can_manage_drive: isActionAllowed(canonicalRole, "manage_drive"),
    can_access_control_panel: isActionAllowed(
      canonicalRole,
      "access_control_panel",
    ),
  };
}
