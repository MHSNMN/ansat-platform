// @ts-nocheck
export type Country =
  | "العراق"
  | "مصر"
  | "سوريا"
  | "فلسطين"
  | "لبنان"
  | "الأردن"
  | "السعودية"
  | "الإمارات"
  | "قطر"
  | "الكويت"
  | "عمان"
  | "اليمن"
  | "المغرب"
  | "الجزائر"
  | "تونس"
  | "ليبيا"
  | "السودان"
  | "الوطن العربي كامل"
  | string;

export const ALL_ARAB_COUNTRIES: string[] = [
  "الوطن العربي كامل",
  "العراق",
  "مصر",
  "سوريا",
  "فلسطين",
  "لبنان",
  "الأردن",
  "السعودية",
  "الإمارات",
  "قطر",
  "الكويت",
  "عمان",
  "اليمن",
  "المغرب",
  "الجزائر",
  "تونس",
  "ليبيا",
  "السودان",
];

export type DepartmentId =
  "content" | "audio" | "design" | "tech" | "activity" | string;

export interface DepartmentInfo {
  id: DepartmentId;
  name: string;
  iconName: string;
  description: string;
  memberCount: number;
  leader: string;
  color: string;
}

export interface UserPermissions {
  [permission: string]: boolean | undefined;
  // 1. General Access & Tasks Permissions
  canAccessAdminPanel?: boolean; // السماح بدخول لوحة التحكم الإدارية العامة
  canViewAllTasks?: boolean; // رؤية واستعراض مهام كافة الأعضاء (كافة النظام)
  canManageTasks?: boolean; // إضافة وتعديل وإسناد مهام الأعضاء
  canDeleteTasks?: boolean; // حذف وإزالة المهام من الجدول
  canAddTaskForDept?: boolean; // إضافة مهام جديدة لأعضاء قسمه المباشر
  canBulkUpdateTasks?: boolean; // استخدام شريط الإجراءات والتحديث السريع الجماعي
  canAccessDrive?: boolean; // استعراض وفتح أرشيف Google Drive السحابي

  // 2. Admin Panel Individual Tabs Access (الوصول المنفرد لكل تبويب)
  canViewMembersTab?: boolean; // قسم إضافة ورؤية الأعضاء
  canCreateMember?: boolean; // إمكانية إضافة عضو جديد للنظام
  canEditMemberProfile?: boolean; // تعديل بيانات ورتبة ودولة الأعضاء
  canDeleteMember?: boolean; // حذف وطرد العضو من النظام

  canViewPermissionsTab?: boolean; // قسم الصلاحيات المخصصة
  canManagePermissions?: boolean; // تعديل وتعيين الصلاحيات المخصصة للأعضاء

  canViewCodesTab?: boolean; // قسم أكواد الوصول
  canManageCodes?: boolean; // توليد ونسخ وتغيير أكواد الدخول المخصصة

  canViewDepartmentsTab?: boolean; // قسم الأقسام واللجان
  canManageDepartments?: boolean; // إضافة وتشكيل وحذف الأقسام واللجان

  canViewDriveTab?: boolean; // قسم مجلدات Google Drive الإدارية
  canManageDrive?: boolean; // إضافة وحذف وتعديل روابط Drive السحابية

  canViewEfficiencyTab?: boolean; // قسم التقييم الذكي وتقارير الأداء

  canViewLogsTab?: boolean; // قسم سجل الأنشطة والعمليات الإدارية
  canClearLogs?: boolean; // تفريغ ومسح سجل الأنشطة الإدارية

  canViewAnnouncementTab?: boolean; // قسم الشريط الإداري الإعلاني
  canManageAnnouncement?: boolean; // تعديل ونشر نص الشريط الإداري العام

  canViewSupabaseTab?: boolean; // قسم مزامنة وإدارة قاعدة بيانات Supabase
  canManageSupabase?: boolean; // إمكانية تنفيذ المزامنة والرفع لـ Supabase

  canViewRequestsTab?: boolean; // قسم الطلبات والاعتراضات والابلاغات
  canManageRequests?: boolean; // ادارة الطلبات والاعتراضات

  // 3. Ext Permissions
  canAccessRecordingSite?: boolean; // السماح بالوصول لموقع التسجيل الخاص
}

export interface UserSession {
  status?: "active" | "disabled" | "pending";
  id: string;
  canonicalRole?: string;
  actionAccess?: Record<string, "INHERIT" | "ALLOW" | "DENY">;
  custom_permissions?: Record<string, boolean>;
  name: string;
  whatsapp: string;
  phone?: string;
  bio?: string;
  roleName: string;
  departmentName: string;
  country: Country;
  isAdmin: boolean;
  code: string;
  permissions?: UserPermissions;
  migratedPermissions?: boolean;
}

export type TaskStatus =
  "قيد التنفيذ" | "بانتظار التسجيل" | "مكتمل" | "مكتملة" | "متأخر";
export type TaskPriority = "عالية" | "متوسطة" | "منخفضة" | "عادية";

export interface TeamMember {
  id: string;
  name: string;
  country: Country;
  departmentId: DepartmentId;
  departmentName: string;
  role: string;
  avatar: string;
  whatsapp: string;
}

export interface TeamTask {
  id: string;
  memberId: string;
  memberName: string;
  country: Country;
  departmentId: DepartmentId;
  departmentName: string;
  title: string;
  description: string;
  deadline: string;
  status: TaskStatus;
  progress: number; // 0-100
  priority: TaskPriority;
  completionNote?: string;
  completedAt?: string;
  isArchived?: boolean;
}

export interface ActivityLog {
  id: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  timestamp: string; // e.g. "2026-07-25 14:32:05"
  type:
    | "status_change"
    | "folder_access"
    | "task_added"
    | "task_deleted"
    | "announcement";
}

export type RequestType = "طلب" | "اعتراض" | "إبلاغ";
export type RequestStatus = "قيد المراجعة" | "تم القبول" | "تم الرفض";

export interface UserSubmitRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  departmentName: string;
  type: RequestType;
  title: string;
  details: string;
  status: RequestStatus;
  createdAt: string;
  adminReply?: string;
}

export interface MemberEfficiency {
  userId: string;
  tasksData: TeamTask[];
  memberName: string;
  whatsapp: string;
  roleName: string;
  departmentName: string;
  completedTasks: number;
  totalTasks: number;
  highPriorityCompleted: number;
  onTimeCount: number;
  overduePenalty: number;
  scorePercentage: number;
  statusLabel: string;
  badgeColor: string;
}

export interface BookSentence {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  highlightWordIndex?: number;
}

export interface BookChapter {
  id: string;
  title: string;
  duration: string;
  audioSrc: string;
  sentences: BookSentence[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  translator?: string;
  narrator: string;
  category: string;
  duration: string;
  chaptersCount: number;
  coverImage: string;
  description: string;
  featured?: boolean;
  chapters: BookChapter[];
}

export interface CloudFolder {
  id: string;
  title: string;
  departmentName: string;
  departmentId: DepartmentId;
  iconName: string;
  fileCount: number;
  size: string;
  lastUpdated: string;
  url: string;
  description: string;
  files: {
    name: string;
    type: "audio" | "document" | "image" | "zip";
    size: string;
    updated: string;
  }[];
}
