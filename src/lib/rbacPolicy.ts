import { User, UserRole, PlatformId } from "../types";

export const CANONICAL_ROLES = [
  "super_admin",
  "admin",
  "audio_engineer",
  "reviewer",
  "narrator",
  "member",
  "pending",
  "suspended",
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number] | UserRole;

export const ROLE_DISPLAY_NAMES_AR: Record<string, string> = {
  super_admin: "إدارة عليا",
  admin: "مدير عام",
  audio_engineer: "مهندس صوت",
  reviewer: "مراجع جودة ولغة",
  narrator: "راوي / قارئ",
  member: "عضو فاعل",
  pending: "بانتظار التفعيل",
  suspended: "موقوف",
  // Aliases for uppercase compatibility
  SUPER_ADMIN: "إدارة عليا",
  ADMIN: "مدير عام",
  CONTENT_MANAGER: "مدير المحتوى والواجهة",
  MEMBERS_MANAGER: "مسؤول شؤون الأعضاء",
  OPERATIONS_MANAGER: "مدير العمليات والمهام",
  AUDIO_ENGINEER: "مهندس صوت",
  QA_REVIEWER: "مراجع جودة ولغة",
  NARRATOR: "راوي / قارئ",
  REWARDS_MANAGER: "مدير النقاط والمكافآت",
  CERTIFICATE_MANAGER: "مدير الشهادات",
  MEMBER: "عضو فاعل",
  PENDING: "بانتظار التفعيل",
  SUSPENDED: "موقوف",
};

export type SensitiveAction = string;

// Define default inherited permissions per role
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  super_admin: [
    // 6 granular groups
    "canViewAllTasks",
    "canManageTasks",
    "canDeleteTasks",
    "canAddTaskForDept",
    "canBulkUpdateTasks",
    "canAccessDrive",
    "canAccessRecordingSite",
    "canAccessAdminPanel",
    "canViewMembersTab",
    "canCreateMember",
    "canEditMemberProfile",
    "canDeleteMember",
    "canViewPermissionsTab",
    "canManagePermissions",
    "canViewCodesTab",
    "canManageCodes",
    "canViewDepartmentsTab",
    "canManageDepartments",
    "canViewDriveTab",
    "canManageDrive",
    "canViewEfficiencyTab",
    "canViewLogsTab",
    "canManageAnnouncement",
    "canManageSupabase",
    // accounts
    "manage_members",
    "create_members",
    "edit_members",
    "suspend_members",
    "reset_member_credentials",
    "review_volunteer_applications",
    "manage_roles",
    "manage_platform_access",
    "manage_action_permissions",
    // production & studio
    "access_recording",
    "access_recording_platform",
    "upload_raw",
    "upload_recording",
    "record_audio",
    "qa_review",
    "review_recording",
    "approve_audio",
    "reject_audio",
    "master_audio",
    "upload_master",
    "publish_final_audio",
    "manage_books",
    "create_book",
    "manage_drive",
    "view_internal_recordings",
    "access_studio",
    // tasks
    "access_tasks",
    "access_tasks_platform",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "delete_tasks",
    "change_task_status",
    "view_all_tasks",
    "manage_task_settings",
    // rewards
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
    "grant_points",
    "deduct_points",
    "reverse_points_transaction",
    "manage_rewards",
    "manage_rewards_store",
    "manage_gem_prices",
    "manage_purchase_limits",
    "manage_leaderboard",
    "view_all_rewards_transactions",
    "export_rewards_reports",
    "issue_certificates",
    "revoke_certificates",
    "manage_certificate_templates",
    "view_certificate_audit_log",
    "view_rewards_audit_log",
    "manage_rewards_settings",
    // public & CMS
    "edit_public_homepage",
    "use_inline_editor",
    "create_public_sections",
    "reorder_public_sections",
    "hide_public_sections",
    "review_public_changes",
    "publish_public_changes",
    "restore_content_versions",
    "manage_public_content",
    "manage_public_library",
    "library.approve_manual_duration",
    "manage_public_activities",
    "manage_upcoming_events",
    "manage_public_metrics",
    "publish_public_content",
    "manage_terms_and_privacy",
    // admin & control panel & db
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
    "manage_database",
    "view_database",
    "view_audit_logs",
    "view_activity_logs",
    "manage_system_settings",
    "manage_integrations",
  ],
  admin: [
    // 6 granular groups
    "canViewAllTasks",
    "canManageTasks",
    "canDeleteTasks",
    "canAddTaskForDept",
    "canBulkUpdateTasks",
    "canAccessDrive",
    "canAccessRecordingSite",
    "canAccessAdminPanel",
    "canViewMembersTab",
    "canCreateMember",
    "canEditMemberProfile",
    "canDeleteMember",
    "canViewPermissionsTab",
    "canManagePermissions",
    "canViewCodesTab",
    "canManageCodes",
    "canViewDepartmentsTab",
    "canManageDepartments",
    "canViewDriveTab",
    "canManageDrive",
    "canViewEfficiencyTab",
    "canViewLogsTab",
    "canManageAnnouncement",
    "canManageSupabase",
    "manage_members",
    "create_members",
    "edit_members",
    "suspend_members",
    "review_volunteer_applications",
    "reset_member_credentials",
    "manage_roles",
    "access_recording",
    "access_recording_platform",
    "upload_raw",
    "upload_recording",
    "record_audio",
    "manage_books",
    "create_book",
    "view_internal_recordings",
    "qa_review",
    "review_recording",
    "master_audio",
    "upload_master",
    "manage_drive",
    "access_studio",
    "access_tasks",
    "access_tasks_platform",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "change_task_status",
    "view_all_tasks",
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
    "grant_points",
    "deduct_points",
    "reverse_points_transaction",
    "manage_rewards",
    "manage_rewards_store",
    "manage_leaderboard",
    "view_all_rewards_transactions",
    "issue_certificates",
    "revoke_certificates",
    "edit_public_homepage",
    "use_inline_editor",
    "create_public_sections",
    "reorder_public_sections",
    "hide_public_sections",
    "publish_public_changes",
    "manage_public_content",
    "manage_public_library",
    "library.approve_manual_duration",
    "manage_public_activities",
    "manage_upcoming_events",
    "publish_public_content",
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
    "view_audit_logs",
    "view_activity_logs",
    "manage_database",
  ],
  audio_engineer: [
    "access_recording",
    "access_recording_platform",
    "master_audio",
    "upload_master",
    "publish_final_audio",
    "view_internal_recordings",
    "access_studio",
    "library.approve_manual_duration",
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
  ],
  reviewer: [
    "access_recording",
    "access_recording_platform",
    "qa_review",
    "review_recording",
    "approve_audio",
    "reject_audio",
    "view_internal_recordings",
    "access_studio",
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
  ],
  narrator: [
    "access_recording",
    "access_recording_platform",
    "upload_raw",
    "upload_recording",
    "record_audio",
    "view_internal_recordings",
    "access_studio",
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
  ],
  member: [
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
  ],
  pending: [],
  suspended: [],
  SUPER_ADMIN: [
    // 6 granular groups
    "canViewAllTasks",
    "canManageTasks",
    "canDeleteTasks",
    "canAddTaskForDept",
    "canBulkUpdateTasks",
    "canAccessDrive",
    "canAccessRecordingSite",
    "canAccessAdminPanel",
    "canViewMembersTab",
    "canCreateMember",
    "canEditMemberProfile",
    "canDeleteMember",
    "canViewPermissionsTab",
    "canManagePermissions",
    "canViewCodesTab",
    "canManageCodes",
    "canViewDepartmentsTab",
    "canManageDepartments",
    "canViewDriveTab",
    "canManageDrive",
    "canViewEfficiencyTab",
    "canViewLogsTab",
    "canManageAnnouncement",
    "canManageSupabase",
    // accounts
    "manage_members",
    "create_members",
    "edit_members",
    "suspend_members",
    "reset_member_credentials",
    "review_volunteer_applications",
    "manage_roles",
    "manage_platform_access",
    "manage_action_permissions",
    // production & studio
    "access_recording",
    "access_recording_platform",
    "upload_raw",
    "upload_recording",
    "record_audio",
    "qa_review",
    "review_recording",
    "approve_audio",
    "reject_audio",
    "master_audio",
    "upload_master",
    "publish_final_audio",
    "manage_books",
    "create_book",
    "manage_drive",
    "view_internal_recordings",
    "access_studio",
    // tasks
    "access_tasks",
    "access_tasks_platform",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "delete_tasks",
    "change_task_status",
    "view_all_tasks",
    "manage_task_settings",
    // rewards
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
    "grant_points",
    "deduct_points",
    "reverse_points_transaction",
    "manage_rewards",
    "manage_rewards_store",
    "manage_gem_prices",
    "manage_purchase_limits",
    "manage_leaderboard",
    "view_all_rewards_transactions",
    "export_rewards_reports",
    "issue_certificates",
    "revoke_certificates",
    "manage_certificate_templates",
    "view_certificate_audit_log",
    "view_rewards_audit_log",
    "manage_rewards_settings",
    // public & CMS
    "edit_public_homepage",
    "use_inline_editor",
    "create_public_sections",
    "reorder_public_sections",
    "hide_public_sections",
    "review_public_changes",
    "publish_public_changes",
    "restore_content_versions",
    "manage_public_content",
    "manage_public_library",
    "library.approve_manual_duration",
    "manage_public_activities",
    "manage_upcoming_events",
    "manage_public_metrics",
    "publish_public_content",
    "manage_terms_and_privacy",
    // admin & control panel & db
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
    "manage_database",
    "view_database",
    "view_audit_logs",
    "view_activity_logs",
    "manage_system_settings",
    "manage_integrations",
  ],
  ADMIN: [
    // 6 granular groups
    "canViewAllTasks",
    "canManageTasks",
    "canDeleteTasks",
    "canAddTaskForDept",
    "canBulkUpdateTasks",
    "canAccessDrive",
    "canAccessRecordingSite",
    "canAccessAdminPanel",
    "canViewMembersTab",
    "canCreateMember",
    "canEditMemberProfile",
    "canDeleteMember",
    "canViewPermissionsTab",
    "canManagePermissions",
    "canViewCodesTab",
    "canManageCodes",
    "canViewDepartmentsTab",
    "canManageDepartments",
    "canViewDriveTab",
    "canManageDrive",
    "canViewEfficiencyTab",
    "canViewLogsTab",
    "canManageAnnouncement",
    "canManageSupabase",
    "manage_members",
    "create_members",
    "edit_members",
    "suspend_members",
    "review_volunteer_applications",
    "reset_member_credentials",
    "manage_roles",
    "access_recording",
    "access_recording_platform",
    "upload_raw",
    "upload_recording",
    "record_audio",
    "manage_books",
    "create_book",
    "view_internal_recordings",
    "qa_review",
    "review_recording",
    "master_audio",
    "upload_master",
    "manage_drive",
    "access_studio",
    "access_tasks",
    "access_tasks_platform",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "change_task_status",
    "view_all_tasks",
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
    "grant_points",
    "deduct_points",
    "reverse_points_transaction",
    "manage_rewards",
    "manage_rewards_store",
    "manage_leaderboard",
    "view_all_rewards_transactions",
    "issue_certificates",
    "revoke_certificates",
    "edit_public_homepage",
    "use_inline_editor",
    "create_public_sections",
    "reorder_public_sections",
    "hide_public_sections",
    "publish_public_changes",
    "manage_public_content",
    "manage_public_library",
    "library.approve_manual_duration",
    "manage_public_activities",
    "manage_upcoming_events",
    "publish_public_content",
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
    "view_audit_logs",
    "view_activity_logs",
    "manage_database",
  ],
  CONTENT_MANAGER: [
    "edit_public_homepage",
    "use_inline_editor",
    "create_public_sections",
    "reorder_public_sections",
    "hide_public_sections",
    "review_public_changes",
    "publish_public_changes",
    "restore_content_versions",
    "manage_public_content",
    "manage_public_library",
    "manage_public_activities",
    "manage_upcoming_events",
    "manage_public_metrics",
    "publish_public_content",
    "manage_terms_and_privacy",
    "access_admin",
    "access_admin_platform",
  ],
  MEMBERS_MANAGER: [
    "manage_members",
    "create_members",
    "edit_members",
    "suspend_members",
    "review_volunteer_applications",
    "reset_member_credentials",
    "manage_roles",
    "access_admin",
    "access_admin_platform",
  ],
  OPERATIONS_MANAGER: [
    "access_tasks",
    "access_tasks_platform",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "delete_tasks",
    "change_task_status",
    "view_all_tasks",
    "manage_task_settings",
    "access_recording",
    "access_recording_platform",
    "manage_books",
    "create_book",
    "access_admin",
    "access_admin_platform",
  ],
  AUDIO_ENGINEER: [
    "access_recording",
    "access_recording_platform",
    "master_audio",
    "upload_master",
    "publish_final_audio",
    "view_internal_recordings",
    "access_studio",
    "library.approve_manual_duration",
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
  ],
  QA_REVIEWER: [
    "access_recording",
    "access_recording_platform",
    "qa_review",
    "review_recording",
    "approve_audio",
    "reject_audio",
    "view_internal_recordings",
    "access_studio",
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
  ],
  NARRATOR: [
    "access_recording",
    "access_recording_platform",
    "upload_raw",
    "upload_recording",
    "record_audio",
    "view_internal_recordings",
    "access_studio",
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
  ],
  REWARDS_MANAGER: [
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "grant_points",
    "deduct_points",
    "reverse_points_transaction",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
    "manage_rewards",
    "manage_rewards_store",
    "manage_gem_prices",
    "manage_purchase_limits",
    "manage_leaderboard",
    "view_all_rewards_transactions",
    "export_rewards_reports",
    "view_rewards_audit_log",
    "manage_rewards_settings",
    "access_admin",
    "access_admin_platform",
  ],
  CERTIFICATE_MANAGER: [
    "access_rewards",
    "access_rewards_platform",
    "issue_certificates",
    "revoke_certificates",
    "manage_certificate_templates",
    "view_certificate_audit_log",
    "access_admin",
    "access_admin_platform",
  ],
  MEMBER: [
    "access_tasks",
    "access_tasks_platform",
    "change_task_status",
    "access_rewards",
    "access_rewards_platform",
    "view_own_points",
    "view_public_leaderboard",
    "view_own_transactions",
    "purchase_gems",
    "gift_gems",
    "purchase_rest_day",
  ],
  PENDING: [],
  SUSPENDED: [],
};

const ACTION_EQUIVALENTS: Record<string, string[]> = {
  // Group 1: Tasks & Board Controls
  canViewAllTasks: ["canViewAllTasks", "can_view_all_tasks", "view_all_tasks"],
  can_view_all_tasks: [
    "canViewAllTasks",
    "can_view_all_tasks",
    "view_all_tasks",
  ],
  view_all_tasks: ["canViewAllTasks", "can_view_all_tasks", "view_all_tasks"],
  canManageTasks: [
    "canManageTasks",
    "can_manage_tasks",
    "manage_tasks",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "change_task_status",
  ],
  can_manage_tasks: [
    "canManageTasks",
    "can_manage_tasks",
    "manage_tasks",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "change_task_status",
  ],
  manage_tasks: [
    "canManageTasks",
    "can_manage_tasks",
    "manage_tasks",
    "create_tasks",
    "assign_tasks",
    "edit_tasks",
    "change_task_status",
  ],
  canDeleteTasks: ["canDeleteTasks", "can_delete_tasks", "delete_tasks"],
  can_delete_tasks: ["canDeleteTasks", "can_delete_tasks", "delete_tasks"],
  delete_tasks: ["canDeleteTasks", "can_delete_tasks", "delete_tasks"],
  canAddTaskForDept: [
    "canAddTaskForDept",
    "can_add_task_dept",
    "add_task_dept",
  ],
  can_add_task_dept: [
    "canAddTaskForDept",
    "can_add_task_dept",
    "add_task_dept",
  ],
  add_task_dept: ["canAddTaskForDept", "can_add_task_dept", "add_task_dept"],
  canBulkUpdateTasks: [
    "canBulkUpdateTasks",
    "can_bulk_update_tasks",
    "bulk_update_tasks",
  ],
  can_bulk_update_tasks: [
    "canBulkUpdateTasks",
    "can_bulk_update_tasks",
    "bulk_update_tasks",
  ],
  bulk_update_tasks: [
    "canBulkUpdateTasks",
    "can_bulk_update_tasks",
    "bulk_update_tasks",
  ],
  canAccessDrive: [
    "canAccessDrive",
    "can_access_drive",
    "manage_drive",
    "view_drive_archive",
  ],
  can_access_drive: [
    "canAccessDrive",
    "can_access_drive",
    "manage_drive",
    "view_drive_archive",
  ],
  view_drive_archive: [
    "canAccessDrive",
    "can_access_drive",
    "manage_drive",
    "view_drive_archive",
  ],
  canAccessRecordingSite: [
    "canAccessRecordingSite",
    "can_access_recording_site",
    "access_recording",
    "access_recording_platform",
  ],
  can_access_recording_site: [
    "canAccessRecordingSite",
    "can_access_recording_site",
    "access_recording",
    "access_recording_platform",
  ],

  // Group 2: Admin Access
  canAccessAdminPanel: [
    "canAccessAdminPanel",
    "can_access_admin_panel",
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
  ],
  can_access_admin_panel: [
    "canAccessAdminPanel",
    "can_access_admin_panel",
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
  ],
  access_admin_platform: [
    "canAccessAdminPanel",
    "can_access_admin_panel",
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
  ],
  access_control_panel: [
    "canAccessAdminPanel",
    "can_access_admin_panel",
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
  ],
  access_admin: [
    "canAccessAdminPanel",
    "can_access_admin_panel",
    "access_admin",
    "access_admin_platform",
    "access_control_panel",
  ],

  // Group 3: Members Section
  canViewMembersTab: [
    "canViewMembersTab",
    "can_view_members_tab",
    "manage_members",
    "view_members_tab",
  ],
  can_view_members_tab: [
    "canViewMembersTab",
    "can_view_members_tab",
    "manage_members",
    "view_members_tab",
  ],
  canCreateMember: [
    "canCreateMember",
    "can_create_member",
    "create_members",
    "manage_members",
  ],
  can_create_member: [
    "canCreateMember",
    "can_create_member",
    "create_members",
    "manage_members",
  ],
  canEditMemberProfile: [
    "canEditMemberProfile",
    "can_edit_member_profile",
    "edit_members",
    "manage_members",
  ],
  can_edit_member_profile: [
    "canEditMemberProfile",
    "can_edit_member_profile",
    "edit_members",
    "manage_members",
  ],
  canDeleteMember: [
    "canDeleteMember",
    "can_delete_member",
    "suspend_members",
    "manage_members",
  ],
  can_delete_member: [
    "canDeleteMember",
    "can_delete_member",
    "suspend_members",
    "manage_members",
  ],
  manage_members: [
    "manage_members",
    "create_members",
    "edit_members",
    "suspend_members",
    "canViewMembersTab",
    "can_view_members_tab",
  ],

  // Group 4: Permissions & Codes
  canViewPermissionsTab: [
    "canViewPermissionsTab",
    "can_view_permissions_tab",
    "manage_action_permissions",
    "can_manage_permissions",
  ],
  can_view_permissions_tab: [
    "canViewPermissionsTab",
    "can_view_permissions_tab",
    "manage_action_permissions",
    "can_manage_permissions",
  ],
  canManagePermissions: [
    "canManagePermissions",
    "can_manage_permissions",
    "manage_action_permissions",
    "canViewPermissionsTab",
  ],
  can_manage_permissions: [
    "canManagePermissions",
    "can_manage_permissions",
    "manage_action_permissions",
    "canViewPermissionsTab",
  ],
  canViewCodesTab: [
    "canViewCodesTab",
    "can_view_codes_tab",
    "view_passcodes",
    "manage_passcodes",
  ],
  can_view_codes_tab: [
    "canViewCodesTab",
    "can_view_codes_tab",
    "view_passcodes",
    "manage_passcodes",
  ],
  canManageCodes: [
    "canManageCodes",
    "can_manage_codes",
    "manage_passcodes",
    "view_passcodes",
  ],
  can_manage_codes: [
    "canManageCodes",
    "can_manage_codes",
    "manage_passcodes",
    "view_passcodes",
  ],

  // Group 5: Depts & Drive Files
  canViewDepartmentsTab: [
    "canViewDepartmentsTab",
    "can_view_departments_tab",
    "view_departments",
    "manage_departments",
  ],
  can_view_departments_tab: [
    "canViewDepartmentsTab",
    "can_view_departments_tab",
    "view_departments",
    "manage_departments",
  ],
  canManageDepartments: [
    "canManageDepartments",
    "can_manage_departments",
    "manage_departments",
  ],
  can_manage_departments: [
    "canManageDepartments",
    "can_manage_departments",
    "manage_departments",
  ],
  canViewDriveTab: [
    "canViewDriveTab",
    "can_view_drive_tab",
    "view_drive_links",
    "manage_drive",
  ],
  can_view_drive_tab: [
    "canViewDriveTab",
    "can_view_drive_tab",
    "view_drive_links",
    "manage_drive",
  ],
  canManageDrive: [
    "canManageDrive",
    "can_manage_drive",
    "manage_drive",
    "manage_drive_links",
  ],
  can_manage_drive: [
    "canManageDrive",
    "can_manage_drive",
    "manage_drive",
    "manage_drive_links",
  ],
  manage_drive: [
    "canManageDrive",
    "can_manage_drive",
    "manage_drive",
    "manage_drive_links",
    "canAccessDrive",
  ],

  // Group 6: Evaluation, Logs, Announcement & Supabase
  canViewEfficiencyTab: [
    "canViewEfficiencyTab",
    "can_view_efficiency_tab",
    "view_efficiency",
    "can_access_ai_eval",
  ],
  can_view_efficiency_tab: [
    "canViewEfficiencyTab",
    "can_view_efficiency_tab",
    "view_efficiency",
    "can_access_ai_eval",
  ],
  view_efficiency: [
    "canViewEfficiencyTab",
    "can_view_efficiency_tab",
    "view_efficiency",
    "can_access_ai_eval",
  ],
  canViewLogsTab: [
    "canViewLogsTab",
    "can_view_logs_tab",
    "view_activity_logs",
    "view_audit_logs",
    "can_view_activity_logs",
  ],
  can_view_logs_tab: [
    "canViewLogsTab",
    "can_view_logs_tab",
    "view_activity_logs",
    "view_audit_logs",
    "can_view_activity_logs",
  ],
  view_activity_logs: [
    "canViewLogsTab",
    "can_view_logs_tab",
    "view_activity_logs",
    "view_audit_logs",
  ],
  view_audit_logs: [
    "canViewLogsTab",
    "can_view_logs_tab",
    "view_activity_logs",
    "view_audit_logs",
  ],
  canManageAnnouncement: [
    "canManageAnnouncement",
    "can_manage_announcement",
    "manage_announcement",
    "can_manage_banner",
  ],
  can_manage_announcement: [
    "canManageAnnouncement",
    "can_manage_announcement",
    "manage_announcement",
    "can_manage_banner",
  ],
  canManageSupabase: [
    "canManageSupabase",
    "can_manage_supabase",
    "manage_database",
    "can_edit_db_urls",
  ],
  can_manage_supabase: [
    "canManageSupabase",
    "can_manage_supabase",
    "manage_database",
    "can_edit_db_urls",
  ],
  manage_database: [
    "manage_database",
    "view_database",
    "manage_system_settings",
    "canManageSupabase",
  ],
  view_database: ["manage_database", "view_database", "manage_system_settings"],

  // Audio & Recording Platform
  access_recording_platform: [
    "access_recording",
    "access_recording_platform",
    "canAccessRecordingSite",
  ],
  access_recording: [
    "access_recording",
    "access_recording_platform",
    "canAccessRecordingSite",
  ],
  access_tasks_platform: ["access_tasks", "access_tasks_platform"],
  access_tasks: ["access_tasks", "access_tasks_platform"],
  access_rewards_platform: ["access_rewards", "access_rewards_platform"],
  access_rewards: ["access_rewards", "access_rewards_platform"],
  manage_rewards: [
    "manage_rewards",
    "grant_points",
    "deduct_points",
    "manage_rewards_store",
  ],
  view_own_points: ["view_own_points", "access_rewards"],
  view_public_leaderboard: ["view_public_leaderboard", "access_rewards"],
  view_own_transactions: ["view_own_transactions", "access_rewards"],
  purchase_rest_day: ["purchase_rest_day", "purchase_gems", "access_rewards"],
  review_recording: ["qa_review", "review_recording"],
  qa_review: ["qa_review", "review_recording"],
  upload_master: ["master_audio", "upload_master"],
  master_audio: ["master_audio", "upload_master"],
  upload_raw: ["upload_raw", "upload_recording", "record_audio"],
  upload_recording: ["upload_raw", "upload_recording", "record_audio"],
  record_audio: ["upload_raw", "upload_recording", "record_audio"],
  create_book: [
    "manage_books",
    "create_book",
    "recording.books.create",
    "recording.books.view",
  ],
  manage_books: [
    "manage_books",
    "create_book",
    "recording.books.create",
    "recording.books.view",
  ],
  "recording.books.create": [
    "manage_books",
    "create_book",
    "recording.books.create",
    "recording.books.view",
  ],
  "recording.books.view": [
    "manage_books",
    "create_book",
    "recording.books.create",
    "recording.books.view",
  ],
  create_tasks: ["manage_tasks", "create_tasks", "canManageTasks"],
  edit_tasks: ["manage_tasks", "edit_tasks", "canManageTasks"],
  manage_public_content: [
    "manage_public_content",
    "edit_public_homepage",
    "publish_public_content",
  ],
};

export interface PermissionItemConfig {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroupConfig {
  id: string;
  title: string;
  description: string;
  iconName: string;
  items: PermissionItemConfig[];
}

export const PLATFORM_PERMISSIONS_CATALOG: PermissionGroupConfig[] = [
  {
    id: "tasks_and_board",
    title: "1. صلاحيات المهام والأرشيف (Tasks & Board Controls)",
    description:
      "التحكم في رؤية المهام، الإسناد، الحذف، مهام القسم، التحديث الجماعي والأرشيف",
    iconName: "CheckSquare",
    items: [
      {
        key: "canViewAllTasks",
        label: "👁️ رؤية واستعراض كافة مهام النظام",
        description:
          "إمكانية التبديل إلى 'كافة النظام' ورؤية مهام جميع الأعضاء والأقسام",
      },
      {
        key: "canManageTasks",
        label: "➕ إضافة وتعديل وإسناد المهام للأعضاء",
        description: "إسناد وتغيير وتعديل حالات المهام لكافة الأعضاء",
      },
      {
        key: "canDeleteTasks",
        label: "🗑️ حذف وإزالة المهام",
        description: "تمكين العضو من حذف وتصفية المهام من الجدول",
      },
      {
        key: "canAddTaskForDept",
        label: "👥 إضافة مهام جديدة لأعضاء قسمه المباشر",
        description: "تمكين العضو من إضافة وإسناد المهام لزملائه في نفس القسم",
      },
      {
        key: "canBulkUpdateTasks",
        label: "⚡ شريط الإجراءات السريعة والتحديث الجماعي",
        description:
          "إتاحة شريط الإجراءات السريعة العائم لتحديد وإنجاز المهام دفعة واحدة",
      },
      {
        key: "canAccessDrive",
        label: "📁 فتح واستعراض أرشيف Google Drive",
        description: "إمكانية التصفح والوصول للأرشيف السحابي",
      },
      {
        key: "canAccessRecordingSite",
        label: "🎙️ الوصول لموقع التسجيل الخاص بالرواة",
        description: "إظهار قسم منصة التسجيل والرفع الصوتية",
      },
    ],
  },
  {
    id: "admin_access",
    title: "2. دخول لوحة التحكم الإدارية العامة (Admin Access)",
    description:
      "التحكم في إتاحة رابط وبوابة لوحة التحكم الإدارية (إدارة إنصات)",
    iconName: "ShieldCheck",
    items: [
      {
        key: "canAccessAdminPanel",
        label: "🛡️ إتاحة لوحة التحكم الإدارية (الشريط العلوي)",
        description: "إظهار رابط لوحة التحكم في أعلى الشاشة والسماح بالدخول",
      },
    ],
  },
  {
    id: "members_section",
    title: "3. تبويب وإجراءات الأعضاء (Members Section)",
    description: "التحكم في استعراض وإضافة وتعديل وحذف حسابات الأعضاء",
    iconName: "Users",
    items: [
      {
        key: "canViewMembersTab",
        label: "👁️ عرض تبويب 'إضافة الأعضاء'",
        description: "إظهار تبويب قائمة وتحديث الأعضاء",
      },
      {
        key: "canCreateMember",
        label: "➕ إضافة عضو جديد للنظام",
        description: "إظهار نموذج إضافة حساب عضو جديد",
      },
      {
        key: "canEditMemberProfile",
        label: "✏️ تعديل بيانات الملف الشخصي للعضو",
        description: "تعديل الاسم والرتبة والدولة والقسم",
      },
      {
        key: "canDeleteMember",
        label: "🗑️ حذف وطرد العضو",
        description: "تعطيل الحساب مع الاحتفاظ بسجلاته وبياناته",
      },
    ],
  },
  {
    id: "permissions_and_codes",
    title: "4. تبويب الصلاحيات وأكواد الوصول (Permissions & Codes)",
    description: "التحكم في قسم الصلاحيات المخصصة وأكواد الدخول السرية",
    iconName: "Key",
    items: [
      {
        key: "canViewPermissionsTab",
        label: "⚡ عرض تبويب 'الصلاحيات المخصصة'",
        description: "إظهار قسم إدارة صلاحيات الأعضاء",
      },
      {
        key: "canViewCodesTab",
        label: "🔑 عرض تبويب 'أكواد الوصول'",
        description: "إظهار قسم استعراض وتوليد وتعديل أكواد الوصول (Passcodes)",
      },
      {
        key: "canManageCodes",
        label: "🎲 إمكانية توليد ونسخ وتعديل الأكواد السرية",
        description: "توليد كود تلقائي أو نسخ الكود وإجراء التغيير",
      },
    ],
  },
  {
    id: "departments_and_drive",
    title: "5. تبويب الأقسام ومجلدات Drive (Depts & Drive Files)",
    description:
      "التحكم في تشكيل الأقسام واللجان وروابط مجلدات الأرشيف السحابي",
    iconName: "FolderKanban",
    items: [
      {
        key: "canViewDepartmentsTab",
        label: "🏢 عرض تبويب 'الأقسام واللجان'",
        description: "إظهار قسم إدارة الأقسام",
      },
      {
        key: "canManageDepartments",
        label: "➕ إضافة وحذف وتشكيل الأقسام واللجان",
        description: "السماح بتوسيع وتعديل الأقسام",
      },
      {
        key: "canViewDriveTab",
        label: "📁 عرض تبويب 'ملفات Drive السحابية'",
        description: "إظهار قسم روابط Drive السحابية",
      },
      {
        key: "canManageDrive",
        label: "➕ إضافة وتعديل روابط ومجلدات Drive",
        description: "السماح بإضافة مجلدات جديدة للأرشيف",
      },
    ],
  },
  {
    id: "evaluation_logs_and_supabase",
    title: "6. تبويب التقييم السجلات الإعلان وSupabase",
    description:
      "التحكم في تقارير الإنتاجية وسجل العمليات والشريط الإعلاني ومزامنة Supabase",
    iconName: "Database",
    items: [
      {
        key: "canViewEfficiencyTab",
        label: "🏆 عرض تبويب 'التقييم الذكي'",
        description: "إظهار تقارير الإنتاجية والكفاءة للأعضاء",
      },
      {
        key: "canViewLogsTab",
        label: "📋 عرض تبويب 'سجل الأنشطة'",
        description: "استعراض سجل الأنشطة والعمليات الإدارية",
      },
      {
        key: "canManageAnnouncement",
        label: "📢 عرض وتعديل تبويب 'الشريط الإداري'",
        description: "تحديث ونشر الإعلان العام العلوي",
      },
      {
        key: "canManageSupabase",
        label: "⚡ عرض وتعديل تبويب 'ربط Supabase'",
        description: "إدارة ومزامنة قاعدة بيانات Supabase الحية",
      },
    ],
  },
  {
    id: "recording_platform",
    title: "منصة التسجيل والاستوديو الصوتي المتقدم",
    description:
      "التحكم المتقدم في هندسة الصوت، الماسترينغ، التدقيق وإدارة الكتب",
    iconName: "Mic",
    items: [
      {
        key: "upload_recording",
        label: "الرفع والتسجيل الصوتي",
        description:
          "السماح بتسجيل الصوت من المتصفح ورفع الملفات الصوتية الخام",
      },
      {
        key: "master_audio",
        label: "الهندسة الصوتية والماسترينغ",
        description:
          "السماح بالوصول لقائمة الهندسة ومعالجة الملفات الصوتية واعتمادها",
      },
      {
        key: "qa_review",
        label: "التدقيق اللغوي ومراجعة الجودة",
        description: "السماح بالوصول لقائمة التدقيق ومراجعة وتقييم التسجيلات",
      },
      {
        key: "manage_books",
        label: "إضافة وإدارة مشروعات الكتب",
        description: "السماح بإنشاء مشروعات الكتب وتقسيم الأجزاء والفصول",
      },
    ],
  },
  {
    id: "rewards_and_certificates",
    title: "منصة النقاط والمكافآت والشهادات",
    description: "إدارة الجواهر، متجر المكافآت، وإصدار الشهادات",
    iconName: "Award",
    items: [
      {
        key: "grant_points",
        label: "منح وخصم النقاط والجواهر",
        description:
          "إضافة أو خصم الجواهر والنقاط التقديرية للأعضاء وإدارة المتجر",
      },
      {
        key: "issue_certificates",
        label: "إصدار وإدارة الشهادات التقديرية",
        description:
          "توليد شهادات الشكر والتقدير المعتمدة وتنزيلها وإرسالها للأعضاء",
      },
    ],
  },
];

export function isAuthorizedAdminIdentity(
  userOrEmailOrUsername?: any,
): boolean {
  // Identity strings are not evidence of authority. Callers must use a verified,
  // persisted role; name, email and phone must never elevate an account.
  if (!userOrEmailOrUsername || typeof userOrEmailOrUsername !== "object")
    return false;
  return (
    normalizeRole(
      userOrEmailOrUsername.canonicalRole || userOrEmailOrUsername.role,
    ) === "super_admin"
  );
}

export const PLATFORM_ACCESS: Record<string, readonly PlatformId[]> = {
  super_admin: ["recording", "tasks", "rewards", "admin", "public"],
  admin: ["recording", "tasks", "rewards", "admin", "public"],
  audio_engineer: ["recording", "tasks", "rewards", "public"],
  reviewer: ["recording", "tasks", "rewards", "public"],
  narrator: ["recording", "tasks", "rewards", "public"],
  member: ["tasks", "rewards", "public"],
  pending: ["public"],
  suspended: ["public"],
  // Aliases for uppercase
  SUPER_ADMIN: ["recording", "tasks", "rewards", "admin", "public"],
  ADMIN: ["recording", "tasks", "rewards", "admin", "public"],
  CONTENT_MANAGER: ["tasks", "rewards", "public"],
  MEMBERS_MANAGER: ["tasks", "rewards", "public"],
  OPERATIONS_MANAGER: ["tasks", "rewards", "public"],
  AUDIO_ENGINEER: ["recording", "tasks", "rewards", "public"],
  QA_REVIEWER: ["recording", "tasks", "rewards", "public"],
  NARRATOR: ["recording", "tasks", "rewards", "public"],
  REWARDS_MANAGER: ["tasks", "rewards", "public"],
  CERTIFICATE_MANAGER: ["tasks", "rewards", "public"],
  MEMBER: ["tasks", "rewards", "public"],
  PENDING: ["public"],
  SUSPENDED: ["public"],
};

export function getRecommendedPlatformAccess(
  role?: string | null,
  userContext?: any,
): Record<PlatformId, boolean> {
  const canonical = normalizeRole(role);
  const isSuspendedOrPending =
    canonical === "suspended" ||
    canonical === "pending" ||
    canonical === "SUSPENDED" ||
    canonical === "PENDING";
  if (isSuspendedOrPending) {
    return {
      recording: false,
      tasks: false,
      rewards: false,
      admin: false,
      public: true,
    };
  }

  // Admin access comes only from a trusted persisted role or explicit server-side grant.
  const hasAdmin =
    isAuthorizedAdminIdentity(userContext) ||
    canonical === "super_admin" ||
    canonical === "admin";

  const allowed = PLATFORM_ACCESS[canonical] || [];
  return {
    recording: allowed.includes("recording"),
    tasks: allowed.includes("tasks"),
    rewards: allowed.includes("rewards"),
    admin: hasAdmin,
    public: true,
  };
}

export function normalizeRole(rawRole?: string | null): CanonicalRole {
  if (!rawRole) return "member";
  const r = String(rawRole).trim().toLowerCase().replace(/-/g, "_");

  // Strict exact matching and canonical mappings
  if (r === "super_admin" || r === "superadmin") return "super_admin";
  if (r === "admin" || r === "hr") return "admin";
  // Preserve specialized manager roles. They are deliberately narrower than
  // ADMIN, but still need their own inherited permission sets.
  if (r === "content_manager") return "CONTENT_MANAGER";
  if (r === "members_manager") return "MEMBERS_MANAGER";
  if (r === "operations_manager") return "OPERATIONS_MANAGER";
  if (r === "rewards_manager") return "REWARDS_MANAGER";
  if (r === "certificate_manager") return "CERTIFICATE_MANAGER";
  if (r === "audio_engineer" || r === "sound_engineer" || r === "engineer")
    return "audio_engineer";
  if (r === "qa_reviewer" || r === "reviewer") return "reviewer";
  if (r === "narrator" || r === "reader") return "narrator";
  if (r === "member") return "member";
  if (r === "pending") return "pending";
  if (r === "suspended") return "suspended";

  // Unknown or malicious strings (e.g. HACKER_SUPER_ADMIN, SYSTEM_OVERRIDE) default to least-privilege narrator
  return "member";
}

export const ACTION_TO_PLATFORM: Record<string, PlatformId> = {
  access_recording: "recording",
  access_recording_platform: "recording",
  upload_raw: "recording",
  upload_recording: "recording",
  record_audio: "recording",
  qa_review: "recording",
  review_recording: "recording",
  upload_master: "recording",
  master_audio: "recording",
  view_internal_recordings: "recording",
  access_studio: "recording",
  approve_audio: "recording",
  reject_audio: "recording",
  manage_books: "recording",
  create_book: "recording",
  access_tasks: "tasks",
  access_tasks_platform: "tasks",
  create_tasks: "tasks",
  edit_tasks: "tasks",
  assign_tasks: "tasks",
  change_task_status: "tasks",
  manage_tasks: "tasks",
  access_rewards: "rewards",
  access_rewards_platform: "rewards",
  grant_points: "rewards",
  deduct_points: "rewards",
  issue_certificates: "rewards",
  revoke_certificates: "rewards",
  access_admin: "admin",
  access_admin_platform: "admin",
  access_control_panel: "admin",
};

export function isActionAllowed(
  user:
    | User
    | {
        canonicalRole?: string;
        role?: string;
        platformAccess?: Record<string, any>;
        actionAccess?: Record<string, "INHERIT" | "ALLOW" | "DENY" | boolean>;
      }
    | string
    | undefined
    | null,
  action: SensitiveAction,
): boolean {
  if (!user) return false;
  const canonical =
    typeof user === "string"
      ? normalizeRole(user)
      : normalizeRole((user as any).canonicalRole || (user as any).role);

  if (
    canonical === "SUSPENDED" ||
    canonical === "PENDING" ||
    canonical === "suspended" ||
    canonical === "pending"
  )
    return false;

  // Platform gating: If the platform that owns this action is explicitly disabled, deny access
  const platform = ACTION_TO_PLATFORM[action];
  if (platform && typeof user === "object") {
    const platformDecision = (user as any).platformAccess?.[platform];
    if (
      platformDecision === false ||
      platformDecision === "DENY" ||
      platformDecision === "false" ||
      platformDecision === 0
    ) {
      return false;
    }
  }

  const overrides =
    typeof user === "object" ? (user as any).actionAccess || {} : {};
  const explicit = overrides[action];
  // Only spelling variants are equivalent. A broad permission such as
  // canManageTasks must not be inherited from change_task_status.
  const key = action.replace(/[_-]/g, "").toLowerCase();
  const equivalents = [
    action,
    ...(ACTION_EQUIVALENTS[action] || []).filter(
      (item) => item.replace(/[_-]/g, "").toLowerCase() === key,
    ),
  ];

  // Any explicit deny wins over role inheritance or a broad alias grant.
  if (
    equivalents.some(
      (eq) => overrides[eq] === "DENY" || overrides[eq] === false,
    )
  )
    return false;
  if (typeof user === "object") {
    const raw =
      (user as any).permissions || (user as any).custom_permissions || {};
    if (equivalents.some((eq) => raw[eq] === false)) return false;
  }
  if (canonical === "super_admin") return true;

  // Deny takes precedence
  if (explicit === "DENY" || explicit === false) return false;

  // Allow takes precedence
  if (explicit === "ALLOW" || explicit === true) return true;

  // Direct user profile flag for book management
  if (
    (action === "manage_books" ||
      action === "create_book" ||
      action === "recording.books.create" ||
      action === "recording.books.view") &&
    typeof user === "object"
  ) {
    if (
      (user as any).can_manage_books === true ||
      (user as any).permissions?.can_manage_books === true
    ) {
      return true;
    }
  }

  // Check user.permissions / user.custom_permissions dictionary
  if (typeof user === "object") {
    const rawP = (user as any).permissions || (user as any).custom_permissions;
    if (rawP && typeof rawP === "object") {
      if (rawP[action] === true) return true;
      if (rawP[action] === false) return false;
      const eqs = equivalents;
      for (const eq of eqs) {
        if (rawP[eq] === true) return true;
        if (rawP[eq] === false) return false;
      }
    }
  }

  for (const eq of equivalents) {
    const eqVal = overrides[eq];
    if (eqVal === "DENY" || eqVal === false) return false;
    if (eqVal === "ALLOW" || eqVal === true) return true;
  }

  const permissions =
    ROLE_PERMISSIONS[canonical] || ROLE_PERMISSIONS[canonical.toUpperCase()];
  if (!permissions) return false;

  return equivalents.some((eq) => permissions.includes(eq));
}

export function canAccessPlatform(
  user:
    | User
    | {
        canonicalRole?: string;
        role?: string;
        platformAccess?: Record<string, any>;
        actionAccess?: Record<string, any>;
        permissions?: Record<string, any>;
        custom_permissions?: Record<string, any>;
        can_access_control_panel?: boolean;
        email?: string;
        username?: string;
      }
    | string
    | undefined
    | null,
  platform: PlatformId,
): boolean {
  if (!user) return false;
  const canonical =
    typeof user === "string"
      ? normalizeRole(user)
      : normalizeRole((user as any).canonicalRole || (user as any).role);

  if (
    canonical === "suspended" ||
    canonical === "pending" ||
    canonical === "SUSPENDED" ||
    canonical === "PENDING"
  ) {
    return platform === "public";
  }

  if (typeof user === "object") {
    const decision = (user as any).platformAccess?.[platform];
    if (
      decision === false ||
      decision === "DENY" ||
      decision === "false" ||
      decision === 0
    )
      return false;
  }

  // Admin platform access: Authorized admins, super_admin, admin, or users with explicit canAccessAdminPanel permission
  if (platform === "admin") {
    if (
      isAuthorizedAdminIdentity(user) ||
      canonical === "super_admin" ||
      canonical === "admin"
    ) {
      return true;
    }
    if (typeof user === "object") {
      const u = user as any;
      if (u.is_super_admin === true) return true;
      const act = u.actionAccess || {};
      if (
        act.canAccessAdminPanel === "ALLOW" ||
        act.can_access_admin_panel === "ALLOW" ||
        act.access_admin === "ALLOW" ||
        act.access_admin_platform === "ALLOW"
      )
        return true;
      if (
        act.canAccessAdminPanel === "DENY" ||
        act.can_access_admin_panel === "DENY" ||
        act.access_admin === "DENY"
      )
        return false;
      const perms = u.permissions || u.custom_permissions;
      if (
        perms?.canAccessAdminPanel === true ||
        perms?.can_access_admin_panel === true ||
        perms?.access_admin === true
      )
        return true;
      if (u.can_access_control_panel === true) return true;
      if (
        u.platformAccess?.admin === true ||
        u.platformAccess?.admin === "ALLOW"
      )
        return true;
    }
    // Specialized managers inherit access only to the administration shell;
    // individual tabs and mutations remain protected by their action grants.
    const inherited =
      ROLE_PERMISSIONS[canonical] || ROLE_PERMISSIONS[canonical.toUpperCase()];
    return Boolean(
      inherited?.includes("access_admin") ||
      inherited?.includes("access_admin_platform"),
    );
  }

  const overrides =
    typeof user === "object" ? (user as any).platformAccess || {} : {};
  const decision = overrides[platform];
  if (
    decision === false ||
    decision === "DENY" ||
    decision === "false" ||
    decision === 0
  ) {
    return false;
  }
  if (
    decision === true ||
    decision === "ALLOW" ||
    decision === "true" ||
    decision === 1
  ) {
    return true;
  }

  const platforms =
    PLATFORM_ACCESS[canonical] || PLATFORM_ACCESS[canonical.toUpperCase()];
  if (!platforms) return false;
  return platforms.includes(platform);
}

export function sanitizeUserFromStorage(
  payload: any,
  trustedRegistry: any[],
): any | null {
  if (!payload || !payload.id) return null;
  const trusted = trustedRegistry.find(
    (u) => u.id === payload.id || u.uid === payload.id,
  );
  if (!trusted) return null;
  return {
    ...trusted,
    is_super_admin: trusted.is_super_admin ?? false,
    can_manage_members: trusted.can_manage_members ?? false,
  };
}
