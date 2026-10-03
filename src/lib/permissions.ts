import { MainTab, User, PlatformId } from "../types";
import {
  canAccessPlatform as canAccessPlatformRbac,
  normalizeRole,
  isActionAllowed,
} from "./rbacPolicy";

export type PermissionKey =
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
  | "can_manage_tasks"
  | "can_edit_public_content"
  | "can_wipe_database"
  | "can_edit_db_urls"
  | "can_access_control_panel";

export function normalizeUserPermissions(user: User): User {
  const r = normalizeRole(user.role);
  const isSuper = r === "super_admin";
  const isActive = !["pending", "disabled", "suspended"].includes(
    String(user.accountStatus || user.status || "active").toLowerCase(),
  );
  const userPayload = {
    ...user,
    canonicalRole: r,
    role: user.role,
    actionAccess: (user as any).actionAccess || {},
    can_manage_books: Boolean(
      user.can_manage_books || (user as any).permissions?.can_manage_books,
    ),
  };

  const canUpload =
    isActive &&
    (isActionAllowed(userPayload as any, "upload_recording") ||
      isActionAllowed(userPayload as any, "upload_raw"));
  const canMaster =
    isActive &&
    (isActionAllowed(userPayload as any, "master_audio") ||
      isActionAllowed(userPayload as any, "upload_master"));
  const canQa =
    isActive &&
    (isActionAllowed(userPayload as any, "qa_review") ||
      isActionAllowed(userPayload as any, "review_recording"));
  const canBooks =
    isActive &&
    (isActionAllowed(userPayload as any, "manage_books") ||
      isActionAllowed(userPayload as any, "create_book") ||
      isActionAllowed(userPayload as any, "recording.books.create"));
  const canMembers =
    isActive && isActionAllowed(userPayload as any, "manage_members");
  const canLogs =
    isActive && isActionAllowed(userPayload as any, "view_activity_logs");
  const canAdmin =
    isActive && isActionAllowed(userPayload as any, "access_admin_platform");
  const canPublic =
    isActive && isActionAllowed(userPayload as any, "manage_public_content");
  const canTasksManage =
    isActive && isActionAllowed(userPayload as any, "create_tasks");
  const canDrive =
    isActive && isActionAllowed(userPayload as any, "manage_drive");

  return {
    ...user,
    is_super_admin: isSuper,
    can_access_studio:
      isActive &&
      isActionAllowed(userPayload as any, "access_recording_platform"),
    can_upload_raw: canUpload,
    can_qa_review: canQa,
    can_master_audio: canMaster,
    can_manage_books: canBooks,
    can_manage_members: canMembers,
    can_view_activity_logs: canLogs,
    can_manage_drive: canDrive,
    can_access_ai_eval: canQa,
    can_manage_banner: canPublic,
    can_manage_settings: canAdmin,
    can_manage_tasks: canTasksManage,
    can_edit_public_content: canPublic,
    can_wipe_database: false,
    can_edit_db_urls: false,
    can_access_control_panel: canAdmin,
    is_active: isActive,
  };
}

export function hasPermission(
  user: User | null | undefined,
  permission: PermissionKey,
): boolean {
  if (!user) return false;
  return Boolean(normalizeUserPermissions(user)[permission]);
}

export function checkPermissionGuard(
  user: User | null | undefined,
  permission: PermissionKey,
): { allowed: boolean; message: string } {
  const allowed = hasPermission(user, permission);
  if (!allowed)
    return {
      allowed: false,
      message: "عذراً، لا تملك الصلاحية المطلوبة لتنفيذ هذا الإجراء.",
    };
  return { allowed: true, message: "" };
}

/** التحقق من صلاحية الوصول لمنصة بعينها — يُفحص قبل تحميل البيانات */
export function canAccessPlatform(
  user: User | null | undefined,
  platform: PlatformId,
): boolean {
  if (!user) return false;
  return canAccessPlatformRbac(user as any, platform);
}

export function canAccessMainTab(
  user: User | null | undefined,
  tab: MainTab,
): boolean {
  if (!user) return false;
  switch (tab) {
    case "platform_hub":
    case "rewards":
      return true;
    case "my_space":
    case "books":
    case "audio_library":
      return true;
    case "dashboard":
      return user.is_super_admin === true;
    case "team":
      return hasPermission(user, "can_manage_members");
    case "activity_log":
      return hasPermission(user, "can_view_activity_logs");
    case "studio":
      return hasPermission(user, "can_access_studio");
    case "settings":
      return hasPermission(user, "can_manage_settings");
    case "control_panel":
    case "system_database":
      return hasPermission(user, "can_access_control_panel");
    case "tasks":
      return true;
    case "content_management":
      return hasPermission(user, "can_edit_public_content");
    default:
      return false;
  }
}

export function firstAllowedMainTab(user: User | null | undefined): MainTab {
  return user?.is_super_admin ? "dashboard" : "platform_hub";
}
