import { User, UserRole } from "../types";
import {
  evaluatePermission,
  RecordingPermissionKey,
  RECORDING_PERMISSIONS_REGISTRY,
} from "../../lib/recordingPermissions";

export type PermissionKey =
  | RecordingPermissionKey
  | "can_access_studio"
  | "can_upload_raw"
  | "can_qa_review"
  | "can_master_audio"
  | "can_manage_books"
  | "can_manage_members"
  | "can_view_activity_logs"
  | "can_manage_drive"
  | "can_access_ai_eval"
  | "can_manage_banner"
  | "can_manage_settings"
  | "can_wipe_database"
  | "can_edit_db_urls"
  | "can_access_control_panel";

export function normalizeUserPermissions(user: User): User {
  // We keep the object structure to avoid breaking UI that expects these booleans,
  // but we derive them using the new robust engine.
  const canonicalRole = user.role || "MEMBER";

  const check = (perm: RecordingPermissionKey) => {
    return evaluatePermission({
      authenticatedUser: user as any,
      accountStatus: (user as any).accountStatus || user.status,
      canonicalRole,
      platformDecision: (user as any).platformAccess?.recording ?? "INHERIT",
      actionAccessOverrides: (user as any).actionAccess || {},
      requestedPermission: perm,
    }).allowed;
  };

  return {
    ...user,
    is_super_admin: canonicalRole === "SUPER_ADMIN",
    role: canonicalRole as UserRole,
    can_access_studio: check("recording.access"),
    can_upload_raw: check("recording.raw.upload"),
    can_qa_review: check("recording.qa_queue.access"),
    can_master_audio: check("recording.engineering_queue.access"),
    can_manage_books: check("recording.books.create"),
    can_manage_members: check("recording.members.manage_recording_access"),
    can_view_activity_logs: check("recording.audit.view_own"),
    can_manage_drive: check("recording.drive.view_status"),
    can_access_ai_eval: check("recording.ai_evaluation.access"),
    can_manage_banner: check("recording.banner.manage"),
    can_manage_settings: check("recording.settings.view"),
    can_wipe_database: false, // EXPLICITLY DISABLED FOREVER
    can_edit_db_urls: false, // EXPLICITLY DISABLED FOREVER
    can_access_control_panel: check("recording.control_panel.access"),
  };
}

export function hasPermission(
  user: User | null | undefined,
  permission: PermissionKey,
): boolean {
  if (!user) return false;

  // Backwards compatibility mapping for the UI
  let mappedPerm: RecordingPermissionKey | null = null;
  switch (permission) {
    case "can_access_studio":
      mappedPerm = "recording.access";
      break;
    case "can_upload_raw":
      mappedPerm = "recording.raw.upload";
      break;
    case "can_qa_review":
      mappedPerm = "recording.qa_queue.access";
      break;
    case "can_master_audio":
      mappedPerm = "recording.engineering_queue.access";
      break;
    case "can_manage_books":
      mappedPerm = "recording.books.create";
      break;
    case "can_manage_members":
      mappedPerm = "recording.members.manage_recording_access";
      break;
    case "can_view_activity_logs":
      mappedPerm = "recording.audit.view_own";
      break;
    case "can_manage_drive":
      mappedPerm = "recording.drive.view_status";
      break;
    case "can_access_ai_eval":
      mappedPerm = "recording.ai_evaluation.access";
      break;
    case "can_manage_banner":
      mappedPerm = "recording.banner.manage";
      break;
    case "can_manage_settings":
      mappedPerm = "recording.settings.view";
      break;
    case "can_access_control_panel":
      mappedPerm = "recording.control_panel.access";
      break;
    case "can_wipe_database":
      return false;
    case "can_edit_db_urls":
      return false;
    default:
      // If it's already a new permission key
      if (
        Object.keys(RECORDING_PERMISSIONS_REGISTRY).includes(
          permission as string,
        )
      ) {
        mappedPerm = permission as RecordingPermissionKey;
      }
      break;
  }

  if (!mappedPerm) return false;

  const canonicalRole = user.role || "MEMBER";

  return evaluatePermission({
    authenticatedUser: user as any,
    accountStatus: (user as any).accountStatus || user.status,
    canonicalRole,
    platformDecision: (user as any).platformAccess?.recording ?? "INHERIT",
    actionAccessOverrides: (user as any).actionAccess || {},
    requestedPermission: mappedPerm,
  }).allowed;
}

export function checkPermissionGuard(
  user: User | null | undefined,
  permission: PermissionKey,
): { allowed: boolean; message: string } {
  const allowed = hasPermission(user, permission);
  if (!allowed) {
    return {
      allowed: false,
      message: `عذراً، تحتاج صلاحية مخصصة لتنفيذ هذا الإجراء.`,
    };
  }
  return { allowed: true, message: "" };
}
