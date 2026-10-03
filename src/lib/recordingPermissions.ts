import { User } from "../types";

export type PermissionDecision = "INHERIT" | "ALLOW" | "DENY";

export type PermissionScope = "OWN" | "ASSIGNED" | "TEAM" | "ALL";

export interface PermissionEvaluationResult {
  allowed: boolean;
  reasonCode:
    | "UNAUTHENTICATED"
    | "ACCOUNT_PENDING"
    | "ACCOUNT_SUSPENDED"
    | "PLATFORM_DENIED"
    | "EXPLICIT_DENY"
    | "EXPLICIT_ALLOW"
    | "ROLE_ALLOW"
    | "OUT_OF_SCOPE"
    | "DEFAULT_DENY";
  effectiveScope?: PermissionScope;
  source: "ROLE" | "OVERRIDE" | "SYSTEM" | "RESOURCE";
}

export const RECORDING_PERMISSIONS_REGISTRY = {
  // Access
  "recording.access": "دخول منصة التسجيل",
  "recording.dashboard.view": "مشاهدة لوحة الاستوديو",
  "recording.control_panel.access": "دخول لوحة التحكم",
  "recording.admin.access": "دخول الإدارة الخاصة بالتسجيل",
  "recording.statistics.view": "مشاهدة إحصاءات منصة التسجيل",

  // Recording & Upload
  "recording.audio.record": "التسجيل من المتصفح",
  "recording.raw.upload": "رفع التسجيل الخام",
  "recording.raw.replace_own":
    "استبدال الملف الخام الخاص بالمستخدم قبل المراجعة",
  "recording.raw.download_own": "تنزيل الملف الخام الخاص بالمستخدم",
  "recording.raw.download_assigned": "تنزيل الملفات المسندة",
  "recording.raw.download_all": "تنزيل جميع الملفات الخام",
  "recording.recordings.view_own": "مشاهدة تسجيلات المستخدم",
  "recording.recordings.view_assigned": "مشاهدة التسجيلات المسندة",
  "recording.recordings.view_team": "مشاهدة تسجيلات الفريق",
  "recording.recordings.view_all": "مشاهدة جميع التسجيلات",
  "recording.metadata.edit_own": "تعديل بيانات تسجيله قبل المراجعة",
  "recording.metadata.edit_assigned": "تعديل بيانات الملفات المسندة",
  "recording.metadata.edit_all": "تعديل بيانات جميع التسجيلات",
  "recording.submit_for_review": "إرسال التسجيل للمراجعة",
  "recording.withdraw_before_review": "سحب التسجيل قبل بدء المراجعة",

  // Linguistic Review
  "recording.linguistic_queue.access": "وصول قائمة المراجعة اللغوية",
  "recording.linguistic_review.assigned": "المراجعة اللغوية للملفات المسندة",
  "recording.linguistic_review.all": "المراجعة اللغوية لجميع الملفات",
  "recording.linguistic_feedback.add": "إضافة ملاحظات لغوية",
  "recording.linguistic_feedback.edit_own": "تعديل ملاحظاته اللغوية",
  "recording.linguistic_review.approve": "قبول لغوي",
  "recording.linguistic_review.reject": "رفض لغوي",
  "recording.linguistic_review.request_revision": "طلب تعديل لغوي",

  // QA Review
  "recording.qa_queue.access": "وصول قائمة الجودة الصوتية",
  "recording.qa_review.assigned": "مراجعة الجودة للملفات المسندة",
  "recording.qa_review.all": "مراجعة الجودة لجميع الملفات",
  "recording.qa_feedback.add": "إضافة ملاحظات جودة",
  "recording.qa_feedback.timecoded": "إضافة ملاحظات جودة بوقت زمني",
  "recording.qa_feedback.edit_own": "تعديل ملاحظاته",
  "recording.qa.approve": "قبول الجودة",
  "recording.qa.reject": "رفض الجودة",
  "recording.qa.request_revision": "طلب تعديل جودة",
  "recording.qa.score": "تقييم التسجيل",

  // Audio Engineering
  "recording.engineering_queue.access": "وصول قائمة الهندسة",
  "recording.engineering.download_raw": "تنزيل الخام للهندسة",
  "recording.engineering.upload_processed": "رفع الملف المعالج",
  "recording.engineering.replace_processed": "استبدال الملف المعالج",
  "recording.engineering.edit_metadata": "تعديل بيانات الملف الهندسي",
  "recording.master.create": "إنشاء ماستر نهائي",
  "recording.master.replace": "استبدال ماستر",
  "recording.master.mark_final": "اعتماد كنهائي",
  "recording.master.return_for_revision": "إعادة للمراجعة",

  // Publishing
  "recording.final.view": "عرض الملفات النهائية",
  "recording.final.download": "تنزيل النهائي",
  "recording.final.publish": "نشر",
  "recording.final.unpublish": "إلغاء النشر",
  "recording.final.edit_public_metadata": "تعديل البيانات العامة",
  "recording.final.feature_on_homepage": "تمييز بالرئيسية",
  "recording.final.remove_from_homepage": "إزالة التمييز",

  // Books and Projects
  "recording.books.view": "عرض الكتب",
  "recording.books.create": "إنشاء كتاب",
  "recording.books.edit": "تعديل كتاب",
  "recording.books.archive": "أرشفة كتاب",
  "recording.books.restore": "استعادة كتاب",
  "recording.books.manage_pdf": "إدارة الـ PDF",
  "recording.chapters.create": "إنشاء فصول",
  "recording.chapters.edit": "تعديل فصول",
  "recording.chapters.archive": "أرشفة فصول",
  "recording.projects.manage_workflow": "إدارة سير العمل",

  // Assignments
  "recording.assignments.view": "عرض التعيينات",
  "recording.assignments.assign_narrator": "تعيين راوي",
  "recording.assignments.assign_linguistic_reviewer": "تعيين مراجع لغوي",
  "recording.assignments.assign_qa_reviewer": "تعيين مراجع جودة",
  "recording.assignments.assign_audio_engineer": "تعيين مهندس",
  "recording.assignments.reassign": "إعادة تعيين",
  "recording.assignments.cancel": "إلغاء تعيين",

  // Members
  "recording.members.view": "عرض الأعضاء",
  "recording.members.view_private_fields": "عرض الحقول الخاصة",
  "recording.members.edit_recording_profile": "تعديل ملف التسجيل",
  "recording.members.manage_recording_access": "إدارة وصول منصة التسجيل",
  "recording.members.manage_recording_permissions": "إدارة صلاحيات التسجيل",

  // Drive & Storage
  "recording.drive.view_status": "حالة التخزين السحابي",
  "recording.drive.browse_allowed_folders": "تصفح المجلدات المسموحة",
  "recording.drive.upload": "الرفع السحابي",
  "recording.drive.move_between_stages": "نقل بين المراحل",
  "recording.drive.archive": "أرشفة سحابية",
  "recording.drive.retry_failed_operations": "إعادة محاولة الفشل",

  // AI Evaluation
  "recording.ai_evaluation.access": "وصول الذكاء الاصطناعي",
  "recording.ai_evaluation.run": "تشغيل التقييم",
  "recording.ai_evaluation.view_own": "عرض التقييمات الخاصة",
  "recording.ai_evaluation.view_all": "عرض جميع التقييمات",
  "recording.ai_evaluation.manage_settings": "إعدادات التقييم",

  // Design and Settings
  "recording.banner.manage": "إدارة الشريط والإعلانات",
  "recording.settings.view": "إعدادات المنصة",
  "recording.settings.manage_workflow": "إدارة سير العمل المركزي",
  "recording.settings.manage_limits": "إدارة حدود التسجيل",
  "recording.settings.manage_notifications": "إدارة التنبيهات",

  // Activity Logs
  "recording.audit.view_own": "سجل نشاطي",
  "recording.audit.view_team": "سجل نشاط فريقي",
  "recording.audit.view_all": "جميع سجلات النشاط",
  "recording.audit.export": "تصدير السجلات",

  // Archive and Restore
  "recording.archive_own_draft": "أرشفة مسودة شخصية",
  "recording.archive_assigned": "أرشفة مسندة",
  "recording.archive_any": "أرشفة أي تسجيل",
  "recording.restore_archived": "استعادة المؤرشفة",
} as const;

export type RecordingPermissionKey =
  keyof typeof RECORDING_PERMISSIONS_REGISTRY;

export const RECORDING_ROLE_PERMISSION_MATRIX: Record<
  string,
  RecordingPermissionKey[]
> = {
  NARRATOR: [
    "recording.access",
    "recording.dashboard.view",
    "recording.books.view",
    "recording.audio.record",
    "recording.raw.upload",
    "recording.raw.replace_own",
    "recording.raw.download_own",
    "recording.recordings.view_own",
    "recording.metadata.edit_own",
    "recording.submit_for_review",
    "recording.withdraw_before_review",
    "recording.audit.view_own",
    "recording.archive_own_draft",
  ],
  QA_REVIEWER: [
    "recording.access",
    "recording.dashboard.view",
    "recording.books.view",
    "recording.audit.view_own",
    "recording.qa_queue.access",
    "recording.qa_review.assigned",
    "recording.qa_feedback.add",
    "recording.qa_feedback.timecoded",
    "recording.qa_feedback.edit_own",
    "recording.qa.approve",
    "recording.qa.reject",
    "recording.qa.request_revision",
    "recording.qa.score",
    "recording.recordings.view_assigned",
  ],
  LINGUISTIC_REVIEWER: [
    "recording.access",
    "recording.dashboard.view",
    "recording.linguistic_queue.access",
    "recording.linguistic_review.assigned",
    "recording.linguistic_feedback.add",
    "recording.linguistic_feedback.edit_own",
    "recording.linguistic_review.approve",
    "recording.linguistic_review.reject",
    "recording.linguistic_review.request_revision",
    "recording.recordings.view_assigned",
  ],
  AUDIO_ENGINEER: [
    "recording.access",
    "recording.dashboard.view",
    "recording.books.view",
    "recording.audit.view_own",
    "recording.engineering_queue.access",
    "recording.engineering.download_raw",
    "recording.engineering.upload_processed",
    "recording.engineering.replace_processed",
    "recording.master.create",
    "recording.master.replace",
    "recording.master.mark_final",
    "recording.master.return_for_revision",
    "recording.recordings.view_assigned",
    "recording.drive.upload",
    "recording.drive.move_between_stages",
  ],
  RECORDING_MANAGER: [
    "recording.access",
    "recording.dashboard.view",
    "recording.control_panel.access",
    "recording.statistics.view",
    "recording.raw.download_all",
    "recording.recordings.view_all",
    "recording.metadata.edit_all",
    "recording.qa_queue.access",
    "recording.qa_review.all",
    "recording.linguistic_queue.access",
    "recording.linguistic_review.all",
    "recording.engineering_queue.access",
    "recording.final.view",
    "recording.final.publish",
    "recording.final.unpublish",
    "recording.final.edit_public_metadata",
    "recording.final.feature_on_homepage",
    "recording.final.remove_from_homepage",
    "recording.books.view",
    "recording.books.create",
    "recording.books.edit",
    "recording.books.archive",
    "recording.books.restore",
    "recording.books.manage_pdf",
    "recording.chapters.create",
    "recording.chapters.edit",
    "recording.chapters.archive",
    "recording.projects.manage_workflow",
    "recording.assignments.view",
    "recording.assignments.assign_narrator",
    "recording.assignments.assign_linguistic_reviewer",
    "recording.assignments.assign_qa_reviewer",
    "recording.assignments.assign_audio_engineer",
    "recording.assignments.reassign",
    "recording.assignments.cancel",
    "recording.members.view",
    "recording.members.manage_recording_access",
    "recording.drive.view_status",
    "recording.drive.browse_allowed_folders",
    "recording.ai_evaluation.access",
    "recording.ai_evaluation.run",
    "recording.ai_evaluation.view_all",
    "recording.banner.manage",
    "recording.settings.view",
    "recording.settings.manage_workflow",
    "recording.audit.view_all",
    "recording.archive_any",
    "recording.restore_archived",
  ],
  MEMBER: [
    "recording.access",
    "recording.dashboard.view",
    "recording.books.view",
    "recording.recordings.view_own",
    "recording.audit.view_own",
  ],
  member: [
    "recording.access",
    "recording.dashboard.view",
    "recording.books.view",
    "recording.recordings.view_own",
    "recording.audit.view_own",
  ],
  PENDING: [],
  SUSPENDED: [],
  ADMIN: [
    // Standard ops minus super destructive ones
    "recording.access",
    "recording.dashboard.view",
    "recording.control_panel.access",
    "recording.admin.access",
    "recording.statistics.view",
    "recording.members.view",
    "recording.members.view_private_fields",
    "recording.members.edit_recording_profile",
    "recording.members.manage_recording_access",
    "recording.members.manage_recording_permissions",
  ],
  SUPER_ADMIN: Object.keys(
    RECORDING_PERMISSIONS_REGISTRY,
  ) as RecordingPermissionKey[],
};

// Push full set to ADMIN too, but keep it explicit
RECORDING_ROLE_PERMISSION_MATRIX.ADMIN = Array.from(
  new Set([
    ...RECORDING_ROLE_PERMISSION_MATRIX.ADMIN,
    ...RECORDING_ROLE_PERMISSION_MATRIX.RECORDING_MANAGER,
  ]),
) as RecordingPermissionKey[];

// Role aliases for managerial positions
RECORDING_ROLE_PERMISSION_MATRIX.CONTENT_MANAGER =
  RECORDING_ROLE_PERMISSION_MATRIX.RECORDING_MANAGER;
RECORDING_ROLE_PERMISSION_MATRIX.REVIEWER =
  RECORDING_ROLE_PERMISSION_MATRIX.QA_REVIEWER;
RECORDING_ROLE_PERMISSION_MATRIX.OPERATIONS_MANAGER =
  RECORDING_ROLE_PERMISSION_MATRIX.RECORDING_MANAGER;
RECORDING_ROLE_PERMISSION_MATRIX.PROJECT_MANAGER =
  RECORDING_ROLE_PERMISSION_MATRIX.RECORDING_MANAGER;
RECORDING_ROLE_PERMISSION_MATRIX.COORDINATOR =
  RECORDING_ROLE_PERMISSION_MATRIX.RECORDING_MANAGER;

export interface PermissionEvaluationParams {
  authenticatedUser: User | null;
  accountStatus?: string;
  canonicalRole: string;
  platformDecision: PermissionDecision | boolean | "INHERIT";
  actionAccessOverrides: Record<string, string>;
  requestedPermission: RecordingPermissionKey;
  requestedResource?: { ownerId?: string; assigneeUids?: string[] };
}

export function evaluatePermission(
  params: PermissionEvaluationParams,
): PermissionEvaluationResult {
  const {
    authenticatedUser,
    accountStatus,
    canonicalRole,
    platformDecision,
    actionAccessOverrides,
    requestedPermission,
    requestedResource,
  } = params;

  if (!authenticatedUser) {
    return { allowed: false, reasonCode: "UNAUTHENTICATED", source: "SYSTEM" };
  }

  const effectiveStatus = String(
    accountStatus ||
      authenticatedUser.accountStatus ||
      authenticatedUser.status ||
      "active",
  ).toLowerCase();
  if (effectiveStatus === "pending")
    return { allowed: false, reasonCode: "ACCOUNT_PENDING", source: "SYSTEM" };
  if (effectiveStatus === "disabled" || effectiveStatus === "suspended")
    return {
      allowed: false,
      reasonCode: "ACCOUNT_SUSPENDED",
      source: "SYSTEM",
    };

  if (
    platformDecision === "DENY" ||
    platformDecision === false ||
    (platformDecision as any) === "false"
  ) {
    return {
      allowed: false,
      reasonCode: "PLATFORM_DENIED",
      source: "OVERRIDE",
    };
  }

  // Action explicitly denied?
  if (actionAccessOverrides[requestedPermission] === "DENY") {
    return { allowed: false, reasonCode: "EXPLICIT_DENY", source: "OVERRIDE" };
  }

  let hasRolePerm = false;
  if (canonicalRole === "SUPER_ADMIN" || canonicalRole === "ADMIN") {
    hasRolePerm = true; // Admins get it all if not explicitly denied
  } else {
    const roleKey = String(canonicalRole || "").trim();
    const rolePerms =
      RECORDING_ROLE_PERMISSION_MATRIX[roleKey] ||
      RECORDING_ROLE_PERMISSION_MATRIX[roleKey.toUpperCase()] ||
      RECORDING_ROLE_PERMISSION_MATRIX[roleKey.toLowerCase()] ||
      [];
    hasRolePerm = rolePerms.includes(requestedPermission);
  }

  if (actionAccessOverrides[requestedPermission] === "ALLOW") {
    hasRolePerm = true;
  }

  // A book-view/create grant must not silently authorize edits and archiving.
  if (requestedPermission.startsWith("recording.books.")) {
    const isBookAllowed =
      actionAccessOverrides["manage_books"] === "ALLOW" ||
      (requestedPermission === "recording.books.create" &&
        actionAccessOverrides["create_book"] === "ALLOW") ||
      actionAccessOverrides[requestedPermission] === "ALLOW" ||
      (authenticatedUser as any)?.can_manage_books === true ||
      (authenticatedUser as any)?.permissions?.can_manage_books === true;
    if (isBookAllowed) {
      hasRolePerm = true;
    }
  }

  if (!hasRolePerm) {
    return { allowed: false, reasonCode: "DEFAULT_DENY", source: "ROLE" };
  }

  // Check Scope
  if (requestedResource) {
    const userId = authenticatedUser.id || authenticatedUser.uid;
    const isOwner = requestedResource.ownerId === userId;
    const isAssignee =
      requestedResource.assigneeUids &&
      requestedResource.assigneeUids.includes(userId);

    if (
      requestedPermission.endsWith("_own") &&
      !isOwner &&
      canonicalRole !== "SUPER_ADMIN" &&
      canonicalRole !== "ADMIN"
    ) {
      return { allowed: false, reasonCode: "OUT_OF_SCOPE", source: "RESOURCE" };
    }
    if (
      requestedPermission.endsWith("_assigned") &&
      !isAssignee &&
      canonicalRole !== "SUPER_ADMIN" &&
      canonicalRole !== "ADMIN"
    ) {
      return { allowed: false, reasonCode: "OUT_OF_SCOPE", source: "RESOURCE" };
    }
  }

  return {
    allowed: true,
    reasonCode:
      actionAccessOverrides[requestedPermission] === "ALLOW"
        ? "EXPLICIT_ALLOW"
        : "ROLE_ALLOW",
    source:
      actionAccessOverrides[requestedPermission] === "ALLOW"
        ? "OVERRIDE"
        : "ROLE",
  };
}
