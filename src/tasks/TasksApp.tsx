import React from "react";
import { PlatformGuard } from "../auth/PlatformGuard";
import { useAuth } from "../auth/useAuth";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import EmbeddedTasksApp from "../embeddedTasks/App";
import type { UserSession } from "../embeddedTasks/types";
import { canAccessPlatform } from "../lib/rbacPolicy";
import "./styles/tasks.css";

function mapUser(user: ReturnType<typeof useAuth>["user"]): UserSession | null {
  if (!user) return null;
  const isAdmin =
    (user.role === "SUPER_ADMIN" || user.role === "ADMIN") &&
    canAccessPlatform(user, "admin");

  // Combine raw permissions dictionary
  const rawPerms: Record<string, boolean> = {
    ...(user.permissions || {}),
    ...(user.custom_permissions || {}),
  };

  // Fold actionAccess overrides
  if (user.actionAccess && typeof user.actionAccess === "object") {
    for (const [key, state] of Object.entries(user.actionAccess)) {
      if (state === "ALLOW") rawPerms[key] = true;
      if (state === "DENY") rawPerms[key] = false;
    }
  }

  // Fold platformAccess
  if (user.platformAccess?.recording !== undefined) {
    rawPerms.canAccessRecordingSite = Boolean(user.platformAccess.recording);
  }
  if (user.platformAccess?.admin !== undefined) {
    rawPerms.canAccessAdminPanel = Boolean(user.platformAccess.admin);
  }

  const hasRecordingAccess = canAccessPlatform(user, "recording");

  const getBool = (
    key: string,
    snakeKey: string,
    fallback: boolean,
  ): boolean => {
    if (rawPerms[key] !== undefined) return Boolean(rawPerms[key]);
    if (rawPerms[snakeKey] !== undefined) return Boolean(rawPerms[snakeKey]);
    return fallback;
  };

  return {
    id: user.id,
    name: user.name || user.fullName || "مستخدم",
    whatsapp: user.phone || user.email || "",
    roleName: user.role_display_ar || user.role || "عضو",
    departmentName: user.department || "إنصات",
    country: user.country || "",
    isAdmin,
    canonicalRole: user.canonicalRole || user.role,
    code: "",
    actionAccess: user.actionAccess || {},
    custom_permissions: user.custom_permissions || {},
    permissions: {
      // 1. Tasks & Board Controls
      canViewAllTasks: getBool(
        "canViewAllTasks",
        "can_view_all_tasks",
        isAdmin,
      ),
      canManageTasks: getBool("canManageTasks", "can_manage_tasks", isAdmin),
      canDeleteTasks: getBool("canDeleteTasks", "can_delete_tasks", isAdmin),
      canAddTaskForDept: getBool(
        "canAddTaskForDept",
        "can_add_task_for_dept",
        isAdmin,
      ),
      canBulkUpdateTasks: getBool(
        "canBulkUpdateTasks",
        "can_bulk_update_tasks",
        isAdmin,
      ),
      canAccessDrive: getBool(
        "canAccessDrive",
        "can_access_drive",
        isAdmin || hasRecordingAccess,
      ),

      // 2. Admin Access

      // 3. Members Section
      canViewMembersTab: getBool(
        "canViewMembersTab",
        "can_view_members_tab",
        isAdmin || getBool("canManageMembers", "can_manage_members", false),
      ),
      canCreateMember: getBool(
        "canCreateMember",
        "can_add_member",
        isAdmin || getBool("canAddMember", "can_add_member", false),
      ),
      canAddMember: getBool(
        "canAddMember",
        "can_add_member",
        isAdmin || getBool("canCreateMember", "can_create_member", false),
      ),
      canEditMemberProfile: getBool(
        "canEditMemberProfile",
        "can_edit_member_profile",
        isAdmin,
      ),
      canDeleteMember: getBool("canDeleteMember", "can_delete_member", isAdmin),

      // 4. Permissions & Codes
      canViewPermissionsTab: getBool(
        "canViewPermissionsTab",
        "can_view_permissions_tab",
        isAdmin ||
          getBool(
            "canManageCustomPermissions",
            "can_manage_custom_permissions",
            false,
          ),
      ),
      canManagePermissions: getBool(
        "canManagePermissions",
        "can_manage_custom_permissions",
        isAdmin ||
          getBool(
            "canManageCustomPermissions",
            "can_manage_custom_permissions",
            false,
          ),
      ),
      canManageCustomPermissions: getBool(
        "canManageCustomPermissions",
        "can_manage_custom_permissions",
        isAdmin,
      ),
      canViewCodesTab: getBool(
        "canViewCodesTab",
        "can_view_codes_tab",
        isAdmin ||
          getBool("canViewAccessCodes", "can_view_access_codes", false),
      ),
      canViewAccessCodes: getBool(
        "canViewAccessCodes",
        "can_view_access_codes",
        isAdmin,
      ),
      canManageCodes: getBool(
        "canManageCodes",
        "can_manage_access_codes",
        isAdmin ||
          getBool("canManageAccessCodes", "can_manage_access_codes", false),
      ),
      canManageAccessCodes: getBool(
        "canManageAccessCodes",
        "can_manage_access_codes",
        isAdmin,
      ),

      // 5. Depts & Drive
      canViewDepartmentsTab: getBool(
        "canViewDepartmentsTab",
        "can_view_departments_tab",
        isAdmin || getBool("canViewDepartments", "can_view_departments", false),
      ),
      canViewDepartments: getBool(
        "canViewDepartments",
        "can_view_departments",
        isAdmin,
      ),
      canManageDepartments: getBool(
        "canManageDepartments",
        "can_manage_departments",
        isAdmin,
      ),
      canViewDriveTab: getBool(
        "canViewDriveTab",
        "can_view_drive_tab",
        isAdmin ||
          getBool("canViewDriveFolders", "can_view_drive_folders", false),
      ),
      canViewDriveFolders: getBool(
        "canViewDriveFolders",
        "can_view_drive_folders",
        isAdmin,
      ),
      canManageDrive: getBool(
        "canManageDrive",
        "can_manage_drive_folders",
        isAdmin ||
          getBool("canManageDriveFolders", "can_manage_drive_folders", false),
      ),
      canManageDriveFolders: getBool(
        "canManageDriveFolders",
        "can_manage_drive_folders",
        isAdmin,
      ),

      // 6. Evaluation, Logs, Announcement & Supabase
      canViewEfficiencyTab: getBool(
        "canViewEfficiencyTab",
        "can_view_efficiency_tab",
        isAdmin ||
          getBool("canViewSmartEvaluation", "can_view_smart_evaluation", false),
      ),
      canViewSmartEvaluation: getBool(
        "canViewSmartEvaluation",
        "can_view_smart_evaluation",
        isAdmin,
      ),
      canViewEfficiency: getBool(
        "canViewEfficiency",
        "can_view_smart_evaluation",
        isAdmin,
      ),
      canViewLogsTab: getBool(
        "canViewLogsTab",
        "can_view_logs_tab",
        isAdmin || getBool("canViewAuditLogs", "can_view_audit_logs", false),
      ),
      canViewAuditLogs: getBool(
        "canViewAuditLogs",
        "can_view_audit_logs",
        isAdmin,
      ),
      canViewLogs: getBool("canViewLogs", "can_view_audit_logs", isAdmin),
      canViewAnnouncementTab: getBool(
        "canViewAnnouncementTab",
        "can_view_announcement_tab",
        isAdmin ||
          getBool("canManageAdminNotice", "can_manage_admin_notice", false),
      ),
      canManageAnnouncement: getBool(
        "canManageAnnouncement",
        "can_manage_admin_notice",
        isAdmin ||
          getBool("canManageAdminNotice", "can_manage_admin_notice", false),
      ),
      canManageAdminNotice: getBool(
        "canManageAdminNotice",
        "can_manage_admin_notice",
        isAdmin,
      ),
      canViewSupabaseTab: getBool(
        "canViewSupabaseTab",
        "can_view_supabase_tab",
        isAdmin ||
          getBool(
            "canManageSupabaseIntegration",
            "can_manage_supabase_integration",
            false,
          ),
      ),
      canManageSupabase: getBool(
        "canManageSupabase",
        "can_manage_supabase_integration",
        isAdmin ||
          getBool(
            "canManageSupabaseIntegration",
            "can_manage_supabase_integration",
            false,
          ),
      ),
      canManageSupabaseIntegration: getBool(
        "canManageSupabaseIntegration",
        "can_manage_supabase_integration",
        isAdmin,
      ),
      canViewRequestsTab: getBool(
        "canViewRequestsTab",
        "can_view_requests_tab",
        isAdmin,
      ),
      canManageRequests: getBool(
        "canManageRequests",
        "can_manage_requests",
        isAdmin,
      ),
      canManageUsers: getBool("canManageUsers", "can_manage_members", isAdmin),

      ...rawPerms,
      canAccessRecordingSite: hasRecordingAccess,
      canAccessAdminPanel: canAccessPlatform(user, "admin"),
    },
  };
}

function TasksContent() {
  const { user, logout } = useAuth();
  return (
    <div className="tasks-platform">
      <EmbeddedTasksApp initialUser={mapUser(user)} onUnifiedLogout={logout} />
    </div>
  );
}

export function TasksApp() {
  return (
    <ErrorBoundary>
      <PlatformGuard platform="tasks">
        <TasksContent />
      </PlatformGuard>
    </ErrorBoundary>
  );
}
export default TasksApp;
