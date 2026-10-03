// @ts-nocheck
import React, { useState } from "react";
import {
  ActivityLog,
  TeamTask,
  UserSession,
  MemberEfficiency,
  DepartmentInfo,
  CloudFolder,
  Country,
  UserPermissions,
  ALL_ARAB_COUNTRIES,
  UserSubmitRequest,
} from "../types";
import { normalizeDateForInput } from "../lib/storageService";
import { SupabaseConfigTab } from "./SupabaseConfigTab";
import { authService } from "../../services/authService";
import {
  ShieldCheck,
  Activity,
  Award,
  Bell,
  Search,
  CheckCircle2,
  UserCheck,
  Send,
  Zap,
  UserPlus,
  Key,
  FolderPlus,
  Building2,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Lock,
  Edit3,
  Sliders,
  Database,
  Eye,
  CheckSquare,
  RotateCcw,
  MessageSquare,
  PowerOff,
} from "lucide-react";

interface AdminPanelProps {
  currentUser: UserSession | null;
  tasks: TeamTask[];
  activityLogs: ActivityLog[];
  announcement: string;
  users: UserSession[];
  departments: DepartmentInfo[];
  cloudFolders: CloudFolder[];
  requests: UserSubmitRequest[];
  onUpdateAnnouncement: (newAnnouncement: string) => void;
  onAddUser: (newUser: UserSession) => void;
  onUpdateUser?: (updatedUser: UserSession) => void;
  onUpdateUserCode: (userId: string, newCode: string) => void;
  onUpdateUserPermissions?: (
    userId: string,
    permissions: UserPermissions,
  ) => void;
  onBulkUpdatePermissions?: (
    userIds: string[],
    permissions: UserPermissions,
  ) => void;
  onResetNonAdminUsers?: () => void;
  onDeleteUser: (userId: string) => void;
  onAddDepartment: (newDept: DepartmentInfo) => void;
  onDeleteDepartment: (deptId: string) => void;
  onAddCloudFolder: (newFolder: CloudFolder) => void;
  onUpdateFolderUrl: (folderId: string, newUrl: string) => void;
  onDeleteCloudFolder: (folderId: string) => void;
  onUpdateRequestStatus?: (
    requestId: string,
    newStatus: "تم القبول" | "تم الرفض",
    reply: string,
  ) => void;
  onSyncRefresh?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  tasks,
  activityLogs,
  announcement,
  users,
  departments,
  cloudFolders,
  requests,
  onUpdateAnnouncement,
  onAddUser,
  onUpdateUser,
  onUpdateUserCode,
  onUpdateUserPermissions,
  onBulkUpdatePermissions,
  onResetNonAdminUsers,
  onDeleteUser,
  onAddDepartment,
  onDeleteDepartment,
  onAddCloudFolder,
  onUpdateFolderUrl,
  onDeleteCloudFolder,
  onUpdateRequestStatus,
  onSyncRefresh = () => {},
}) => {
  const [activeTab, setActiveTab] = useState<
    | "members"
    | "permissions"
    | "codes"
    | "departments"
    | "drive"
    | "efficiency"
    | "logs"
    | "announcement"
    | "supabase"
    | "requests"
  >("members");

  // Logs filters & announcement
  const [logSearch, setLogSearch] = useState("");
  const [selectedLogMember, setSelectedLogMember] = useState<string>("all");
  const [selectedLogAction, setSelectedLogAction] = useState<string>("all");
  const [newAnnouncementInput, setNewAnnouncementInput] =
    useState(announcement);
  const [isSavedBanner, setIsSavedBanner] = useState(false);

  // Profile Edit Modal State
  const [editingProfileUser, setEditingProfileUser] =
    useState<UserSession | null>(null);

  // 1. New Member Form State
  const generateRandom6Digit = () =>
    Math.floor(100000 + Math.random() * 900000).toString();
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberWhatsapp, setNewMemberWhatsapp] = useState("");
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("عضو جديد");
  const [newMemberDept, setNewMemberDept] = useState(
    departments[0]?.name || "قسم المحتوى والحقوق",
  );
  const [newMemberCountry, setNewMemberCountry] = useState<Country>("العراق");
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const [newMemberAccountRole, setNewMemberAccountRole] = useState("MEMBER");
  const [newMemberCode, setNewMemberCode] = useState(generateRandom6Digit());
  const [memberSuccessMsg, setMemberSuccessMsg] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberCountryFilter, setMemberCountryFilter] = useState<string>("all");

  // Initial custom permissions for new user
  const [newPerms, setNewPerms] = useState<UserPermissions>({});

  // Permissions Modal / Drawer State
  const [editingPermissionsUser, setEditingPermissionsUser] =
    useState<UserSession | null>(null);
  const [tempPermissions, setTempPermissions] = useState<UserPermissions>({});

  // Bulk Permission Selection & Modal State
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkPermissionsOpen, setIsBulkPermissionsOpen] = useState(false);
  const [bulkPreset, setBulkPreset] = useState<
    "member" | "supervisor" | "full" | "custom"
  >("member");
  const [bulkPermissions, setBulkPermissions] = useState<UserPermissions>({});

  const resolveUserEffectivePermissions = (
    user: UserSession,
  ): UserPermissions => {
    if (user.permissions && Object.keys(user.permissions).length > 0) {
      return { ...user.permissions };
    }
    if (user.isAdmin) {
      return {
        canViewAllTasks: true,
        canManageTasks: true,
        canDeleteTasks: true,
        canAddTaskForDept: true,
        canBulkUpdateTasks: true,
        canAccessDrive: true,
        canAccessRecordingSite: true,
        canAccessAdminPanel: true,
        canViewMembersTab: true,
        canCreateMember: true,
        canEditMemberProfile: true,
        canDeleteMember: true,
        canViewPermissionsTab: true,
        canManagePermissions: true,
        canViewCodesTab: true,
        canManageCodes: true,
        canViewDepartmentsTab: true,
        canManageDepartments: true,
        canViewDriveTab: true,
        canManageDrive: true,
        canViewEfficiencyTab: true,
        canViewEfficiency: true,
        canViewLogsTab: true,
        canViewLogs: true,
        canViewAnnouncementTab: true,
        canManageAnnouncement: true,
        canViewSupabaseTab: true,
        canManageSupabase: true,
        canViewRequestsTab: true,
        canManageRequests: true,
        canManageUsers: true,
      };
    }
    return {
      canViewAllTasks: false,
      canManageTasks: false,
      canDeleteTasks: false,
      canAddTaskForDept: false,
      canBulkUpdateTasks: false,
      canAccessDrive: false,
      canAccessRecordingSite: false,
      canAccessAdminPanel: false,
      canViewMembersTab: false,
      canCreateMember: false,
      canEditMemberProfile: false,
      canDeleteMember: false,
      canViewPermissionsTab: false,
      canManagePermissions: false,
      canViewCodesTab: false,
      canManageCodes: false,
      canViewDepartmentsTab: false,
      canManageDepartments: false,
      canViewDriveTab: false,
      canManageDrive: false,
      canViewEfficiencyTab: false,
      canViewEfficiency: false,
      canViewLogsTab: false,
      canViewLogs: false,
      canViewAnnouncementTab: false,
      canManageAnnouncement: false,
      canViewSupabaseTab: false,
      canManageSupabase: false,
      canViewRequestsTab: false,
      canManageRequests: false,
      canManageUsers: false,
    };
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const selectAllNonAdminUsers = () => {
    const nonAdminIds = users.filter((u) => !u.isAdmin).map((u) => u.id);
    setSelectedUserIds(nonAdminIds);
  };

  const clearUserSelection = () => {
    setSelectedUserIds([]);
  };

  // 2. Access Codes Manager State
  const [codeSearch, setCodeSearch] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserCodeInput, setEditingUserCodeInput] = useState("");
  const [copiedCodeUserId, setCopiedCodeUserId] = useState<string | null>(null);

  // 3. New Department Form State
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptLeader, setNewDeptLeader] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [newDeptIcon, setNewDeptIcon] = useState("BookOpen");
  const [newDeptColor, setNewDeptColor] = useState(
    "from-amber-500 to-orange-600",
  );
  const [deptSuccessMsg, setDeptSuccessMsg] = useState("");

  // 4. New Drive Folder Form State
  const [newDriveTitle, setNewDriveTitle] = useState("");
  const [newDriveUrl, setNewDriveUrl] = useState("");
  const [newDriveDeptName, setNewDriveDeptName] = useState(
    departments[0]?.name || "قسم المحتوى والحقوق",
  );
  const [newDriveDeptId, setNewDriveDeptId] = useState("content");
  const [newDriveIcon, setNewDriveIcon] = useState("FolderKanban");
  const [newDriveDesc, setNewDriveDesc] = useState("");
  const [driveSuccessMsg, setDriveSuccessMsg] = useState("");

  // AI Evaluation State
  const [aiEvaluations, setAiEvaluations] = useState<
    Record<string, { summary: string; recommendation: string; score: number }>
  >({});
  const [isEvaluating, setIsEvaluating] = useState<Record<string, boolean>>({});

  const handleEvaluateMember = async (
    userId: string,
    tasksData: TeamTask[],
    memberName: string,
  ) => {
    setIsEvaluating((prev) => ({ ...prev, [userId]: true }));
    try {
      const response = await fetch("/api/evaluate-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: userId,
          memberName,
          tasks: tasksData,
        }),
      });
      if (!response.ok) throw new Error("فشل التقييم");
      const data = await response.json();
      setAiEvaluations((prev) => ({ ...prev, [userId]: data }));
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
    } finally {
      setIsEvaluating((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const canAccessAdmin =
    currentUser?.isAdmin ||
    currentUser?.permissions?.canAccessAdminPanel ||
    currentUser?.permissions?.canViewMembersTab ||
    currentUser?.permissions?.canViewPermissionsTab ||
    currentUser?.permissions?.canViewCodesTab ||
    currentUser?.permissions?.canViewDepartmentsTab ||
    currentUser?.permissions?.canViewDriveTab ||
    currentUser?.permissions?.canViewEfficiencyTab ||
    currentUser?.permissions?.canViewLogsTab ||
    currentUser?.permissions?.canViewAnnouncementTab ||
    currentUser?.permissions?.canViewSupabaseTab ||
    currentUser?.permissions?.canManageUsers ||
    currentUser?.permissions?.canManagePermissions ||
    currentUser?.permissions?.canManageCodes ||
    currentUser?.permissions?.canManageDepartments ||
    currentUser?.permissions?.canManageDrive ||
    currentUser?.permissions?.canManageAnnouncement ||
    currentUser?.permissions?.canManageSupabase;

  if (!canAccessAdmin) {
    return null;
  }

  // Smart Performance & Efficiency Algorithm Evaluation
  const memberEfficiencies: MemberEfficiency[] = users
    .filter((u) => !u.isAdmin)
    .map((user) => {
      const uName = (user.name || "").toLowerCase();
      const userTasks = tasks.filter(
        (t) =>
          (uName && (t.memberName || "").toLowerCase().includes(uName)) ||
          t.memberId === user.id,
      );
      const total = userTasks.length;
      const completedTasks = userTasks.filter(
        (t) => t.status === "مكتمل" || t.status === "مكتملة",
      );
      const completed = completedTasks.length;

      // High priority tasks completed count
      const highPriorityCompleted = completedTasks.filter(
        (t) => t.priority === "عالية",
      ).length;

      const overdue = userTasks.filter((t) => {
        if (t.status === "متأخر") return true;
        if (t.status === "مكتمل" || t.status === "مكتملة") return false;
        const norm = normalizeDateForInput(t.deadline);
        if (!norm) return false;
        const d = new Date(norm + "T23:59:59").getTime();
        return !isNaN(d) && d < Date.now();
      }).length;
      const inProgress = userTasks.filter(
        (t) => t.status === "قيد التنفيذ" || t.status === "بانتظار التسجيل",
      ).length;

      // Smart Weighted Score Formula:
      // Base: 100
      // Completion Weight: + (completed / total) * 70
      // High Priority Bonus: + (highPriorityCompleted * 10)
      // Progress weight: + (inProgress / total) * 20
      // Overdue Penalty: - (overdue * 25)
      let score = 100;
      if (total > 0) {
        const rawScore = Math.round(
          ((completed * 80 +
            highPriorityCompleted * 15 +
            inProgress * 25 -
            overdue * 35) /
            (total * 80)) *
            100,
        );
        score = Math.max(0, Math.min(100, rawScore));
      }

      let statusLabel = "💎 أداء ماسي استثنائي";
      let badgeColor =
        "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

      if (overdue > 0 || score < 50) {
        statusLabel = "⚠️ يحتاج متابعة وتنبيه";
        badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
      } else if (score >= 85) {
        statusLabel = "🥇 أداء ذهبي متقدم";
        badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      } else if (score >= 65) {
        statusLabel = "🥈 أداء فضي منجز";
        badgeColor = "bg-blue-500/20 text-blue-300 border-blue-500/40";
      }

      return {
        userId: user.id,
        tasksData: userTasks,
        memberName: user.name,
        whatsapp: user.whatsapp,
        roleName: user.roleName,
        departmentName: user.departmentName,
        completedTasks: completed,
        totalTasks: total,
        highPriorityCompleted,
        onTimeCount: completed,
        overduePenalty: overdue,
        scorePercentage: score,
        statusLabel,
        badgeColor,
      };
    });

  const filteredLogs = activityLogs.filter((log) => {
    const q = (logSearch || "").toLowerCase();
    const matchesSearch =
      !q ||
      (log.userName || "").toLowerCase().includes(q) ||
      (log.details || "").toLowerCase().includes(q) ||
      (log.action || "").toLowerCase().includes(q);

    const matchesMember =
      selectedLogMember === "all" || log.userName === selectedLogMember;
    const matchesAction =
      selectedLogAction === "all" || log.action === selectedLogAction;

    return matchesSearch && matchesMember && matchesAction;
  });

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newMemberName.trim() ||
      !newMemberWhatsapp.trim() ||
      !newMemberUsername.trim() ||
      !newMemberEmail.trim() ||
      newMemberPassword.length < 8 ||
      !/[A-Za-z]/.test(newMemberPassword) ||
      !/\d/.test(newMemberPassword)
    ) {
      setMemberSuccessMsg(
        "أدخل جميع البيانات، وكلمة مرور من 8 رموز تحتوي حرفاً ورقماً.",
      );
      return;
    }

    let uid = `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    try {
      const token = await authService.token();
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": `tasks-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          name: newMemberName.trim(),
          username: newMemberUsername.trim(),
          email: newMemberEmail.trim().toLowerCase(),
          password: newMemberPassword,
          phone: newMemberWhatsapp.trim(),
          role: newMemberAccountRole,
          department: newMemberDept.trim(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(payload?.error || "تعذر إنشاء الحساب الموحد");
      uid = payload.user?.uid || payload.uid || uid;
    } catch (error) {
      setMemberSuccessMsg(
        error instanceof Error ? error.message : "تعذر إنشاء الحساب الموحد",
      );
      return;
    }

    const newUser: UserSession = {
      id: uid,
      name: newMemberName.trim(),
      whatsapp: newMemberWhatsapp.trim(),
      roleName: newMemberRole.trim() || "عضو",
      departmentName: newMemberDept,
      country: newMemberCountry,
      isAdmin: newMemberIsAdmin,
      code: newMemberCode.trim() || generateRandom6Digit(),
      permissions: newMemberIsAdmin
        ? {
            canManageUsers: true,
            canManageTasks: true,
            canManageDepartments: true,
            canManageDrive: true,
            canManageAnnouncement: true,
            canViewLogs: true,
            canViewEfficiency: true,
          }
        : newPerms,
    };

    onAddUser(newUser);
    setMemberSuccessMsg(
      `تمت إضافة الحساب الموحد (${newUser.name}) بنجاح؛ يمكنه الدخول باليوزر أو الإيميل أو الرقم.`,
    );
    setTimeout(() => setMemberSuccessMsg(""), 4000);

    setNewMemberName("");
    setNewMemberWhatsapp("");
    setNewMemberUsername("");
    setNewMemberEmail("");
    setNewMemberPassword("");
    setNewMemberRole("عضو جديد");
    setNewMemberAccountRole("MEMBER");
    setNewMemberIsAdmin(false);
    setNewMemberCode(generateRandom6Digit());
  };

  const handleSaveUserPermissions = () => {
    if (!editingPermissionsUser || !onUpdateUserPermissions) return;
    onUpdateUserPermissions(editingPermissionsUser.id, tempPermissions);
    setEditingPermissionsUser(null);
  };

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    const generatedId = `dept-${Date.now()}`;
    const newDept: DepartmentInfo = {
      id: generatedId,
      name: newDeptName.trim(),
      leader: newDeptLeader.trim() || "مدير قسم",
      description: newDeptDesc.trim() || "قسم جديد مضاف لمبادرة إنصات.",
      iconName: newDeptIcon,
      color: newDeptColor,
      memberCount: 1,
    };

    onAddDepartment(newDept);
    setDeptSuccessMsg(`تمت إضافة القسم الجديد (${newDept.name}) بنجاح!`);
    setTimeout(() => setDeptSuccessMsg(""), 4000);

    setNewDeptName("");
    setNewDeptLeader("");
    setNewDeptDesc("");
  };

  const handleCreateDriveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriveTitle.trim() || !newDriveUrl.trim()) return;

    const newFolder: CloudFolder = {
      id: `folder-${Date.now()}`,
      title: newDriveTitle.trim(),
      departmentName: newDriveDeptName,
      departmentId: newDriveDeptId,
      iconName: newDriveIcon,
      fileCount: 5,
      size: "السحابة الرقمية",
      lastUpdated: new Date().toISOString().split("T")[0],
      url: newDriveUrl.trim(),
      description: newDriveDesc.trim() || "مجلد Google Drive رسمي.",
      files: [
        {
          name: "المستندات والملفات المرفقة.pdf",
          type: "document",
          size: "12 MB",
          updated: "الآن",
        },
      ],
    };

    onAddCloudFolder(newFolder);
    setDriveSuccessMsg(
      `تمت إضافة مجلد Google Drive (${newFolder.title}) بنجاح!`,
    );
    setTimeout(() => setDriveSuccessMsg(""), 4000);

    setNewDriveTitle("");
    setNewDriveUrl("");
    setNewDriveDesc("");
  };

  const handleSaveEditedCode = (userId: string) => {
    if (!editingUserCodeInput.trim()) return;
    onUpdateUserCode(userId, editingUserCodeInput.trim());
    setEditingUserId(null);
    setEditingUserCodeInput("");
  };

  // Tab access permissions for non-admin users (supports granular canView*Tab flags & actionAccess)
  const canTabMembers = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewMembersTab ||
    currentUser?.actionAccess?.canViewMembersTab === "ALLOW" ||
    currentUser?.permissions?.canManageUsers,
  );

  const canTabPermissions = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewPermissionsTab ||
    currentUser?.actionAccess?.canViewPermissionsTab === "ALLOW" ||
    currentUser?.permissions?.canManagePermissions,
  );

  const canTabCodes = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewCodesTab ||
    currentUser?.actionAccess?.canViewCodesTab === "ALLOW" ||
    currentUser?.permissions?.canManageCodes,
  );

  const canTabDepartments = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewDepartmentsTab ||
    currentUser?.actionAccess?.canViewDepartmentsTab === "ALLOW" ||
    currentUser?.permissions?.canManageDepartments,
  );

  const canTabDrive = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewDriveTab ||
    currentUser?.actionAccess?.canViewDriveTab === "ALLOW" ||
    currentUser?.permissions?.canManageDrive,
  );

  const canTabEfficiency = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewEfficiencyTab ||
    currentUser?.actionAccess?.canViewEfficiencyTab === "ALLOW" ||
    currentUser?.permissions?.canViewEfficiency,
  );

  const canTabLogs = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewLogsTab ||
    currentUser?.actionAccess?.canViewLogsTab === "ALLOW" ||
    currentUser?.permissions?.canViewLogs,
  );

  const canTabAnnouncement = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewAnnouncementTab ||
    currentUser?.actionAccess?.canViewAnnouncementTab === "ALLOW" ||
    currentUser?.permissions?.canManageAnnouncement,
  );

  const canTabSupabase = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewSupabaseTab ||
    currentUser?.actionAccess?.canViewSupabaseTab === "ALLOW" ||
    currentUser?.permissions?.canManageSupabase,
  );

  const canTabRequests = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewRequestsTab ||
    currentUser?.actionAccess?.canViewRequestsTab === "ALLOW" ||
    currentUser?.permissions?.canManageRequests,
  );

  // Granular action permissions within tabs
  const canCreateMember = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canCreateMember ||
    currentUser?.actionAccess?.canCreateMember === "ALLOW" ||
    currentUser?.permissions?.canManageUsers,
  );

  const canEditMemberProfile = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canEditMemberProfile ||
    currentUser?.actionAccess?.canEditMemberProfile === "ALLOW" ||
    currentUser?.permissions?.canManageUsers,
  );

  const canDeleteMember = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canDeleteMember ||
    currentUser?.actionAccess?.canDeleteMember === "ALLOW" ||
    currentUser?.permissions?.canManageUsers,
  );

  const canManagePermissionsAction = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManagePermissions ||
    currentUser?.actionAccess?.canManagePermissions === "ALLOW",
  );

  const canManageCodesAction = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManageCodes ||
    currentUser?.actionAccess?.canManageCodes === "ALLOW",
  );

  const canManageDepartmentsAction = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManageDepartments ||
    currentUser?.actionAccess?.canManageDepartments === "ALLOW",
  );

  const canManageDriveAction = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManageDrive ||
    currentUser?.actionAccess?.canManageDrive === "ALLOW",
  );

  const canManageAnnouncementAction = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManageAnnouncement ||
    currentUser?.actionAccess?.canManageAnnouncement === "ALLOW",
  );

  const canManageSupabaseAction = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManageSupabase ||
    currentUser?.actionAccess?.canManageSupabase === "ALLOW",
  );

  const allowedTabs = [
    canTabMembers && "members",
    canTabPermissions && "permissions",
    canTabCodes && "codes",
    canTabDepartments && "departments",
    canTabDrive && "drive",
    canTabEfficiency && "efficiency",
    canTabLogs && "logs",
    canTabAnnouncement && "announcement",
    canTabSupabase && "supabase",
    canTabRequests && "requests",
  ].filter(Boolean) as Array<typeof activeTab>;

  const visibleTab = allowedTabs.includes(activeTab)
    ? activeTab
    : allowedTabs[0];

  const handleCopyCode = (code: string, userId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeUserId(userId);
    setTimeout(() => setCopiedCodeUserId(null), 2000);
  };

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAnnouncement(newAnnouncementInput);
    setIsSavedBanner(true);
    setTimeout(() => setIsSavedBanner(false), 2500);
  };

  const filteredMembers = users.filter((u) => {
    const q = (memberSearch || "").toLowerCase();
    const matchesSearch =
      !q ||
      (u.name || "").toLowerCase().includes(q) ||
      (u.whatsapp || "").toLowerCase().includes(q) ||
      (u.roleName || "").toLowerCase().includes(q) ||
      (u.departmentName || "").toLowerCase().includes(q);
    const matchesCountry =
      memberCountryFilter === "all" ||
      memberCountryFilter === "الوطن العربي كامل" ||
      u.country === memberCountryFilter;
    return matchesSearch && matchesCountry;
  });

  const filteredCodeUsers = users.filter((u) => {
    const q = (codeSearch || "").toLowerCase();
    return (
      !q ||
      (u.name || "").toLowerCase().includes(q) ||
      (u.code && u.code.includes(codeSearch)) ||
      (u.roleName || "").toLowerCase().includes(q)
    );
  });

  return (
    <section
      id="admin"
      className="py-12 bg-slate-950 font-['Cairo'] relative border-t border-slate-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Main Banner Header */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>منظومة الإدارة العليا والتحكم الشامل</span>
              </div>
              <h2 className="text-2xl font-black text-white">
                لوحة التحكم الإداري والصلاحيات المخصصة للمسؤولين والأعضاء
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                التحكم التام في إتاحة الصلاحيات لكل مسؤول، إضافة الأعضاء بكافة
                الدول العربية، وإدارة قواعد بيانات Supabase
              </p>
            </div>

            {/* Admin Tabs Navigation */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              {canTabMembers && (
                <button
                  onClick={() => setActiveTab("members")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "members"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إضافة الأعضاء ({users.length})</span>
                </button>
              )}

              {canTabPermissions && (
                <button
                  onClick={() => setActiveTab("permissions")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "permissions"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>الصلاحيات المخصصة ⚡</span>
                </button>
              )}

              {canTabCodes && (
                <button
                  onClick={() => setActiveTab("codes")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "codes"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>أكواد الوصول</span>
                </button>
              )}

              {canTabDepartments && (
                <button
                  onClick={() => setActiveTab("departments")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "departments"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>الأقسام ({departments.length})</span>
                </button>
              )}

              {canTabDrive && (
                <button
                  onClick={() => setActiveTab("drive")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "drive"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>ملفات Drive ({cloudFolders.length})</span>
                </button>
              )}

              {canTabEfficiency && (
                <button
                  onClick={() => setActiveTab("efficiency")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "efficiency"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>التقييم الذكي</span>
                </button>
              )}

              {canTabLogs && (
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "logs"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>سجل الأنشطة</span>
                </button>
              )}

              {canTabAnnouncement && (
                <button
                  onClick={() => setActiveTab("announcement")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "announcement"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  <span>الشريط الإداري</span>
                </button>
              )}

              {canTabSupabase && (
                <button
                  onClick={() => setActiveTab("supabase")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "supabase"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-amber-400 hover:text-amber-300"
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>ربط Supabase</span>
                </button>
              )}

              {canTabRequests && (
                <button
                  onClick={() => setActiveTab("requests")}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    visibleTab === "requests"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>الطلبات ({requests.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TAB 1: ADD & MANAGE MEMBERS */}
        {visibleTab === "members" && canTabMembers && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form */}
            {canCreateMember && (
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="pb-4 border-b border-slate-800">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-400" />
                    <span>إضافة عضو جديد للمبادرة</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    حساب واحد يعمل في المهام والتسجيل؛ الدور الذي تختاره يحدد
                    الوصول تلقائياً.
                  </p>
                </div>

                {memberSuccessMsg && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{memberSuccessMsg}</span>
                  </div>
                )}

                <form
                  onSubmit={handleCreateMember}
                  className="space-y-4 text-xs"
                >
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      اسم العضو الكامل:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد عبد الله..."
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Unified account credentials */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300 block">
                        اسم المستخدم:
                      </label>
                      <input
                        type="text"
                        required
                        minLength={4}
                        value={newMemberUsername}
                        onChange={(e) => setNewMemberUsername(e.target.value)}
                        placeholder="username"
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:border-amber-500 focus:outline-none dir-ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300 block">
                        البريد الإلكتروني:
                      </label>
                      <input
                        type="email"
                        required
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="member@example.com"
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:border-amber-500 focus:outline-none dir-ltr"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      كلمة المرور:
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newMemberPassword}
                      onChange={(e) => setNewMemberPassword(e.target.value)}
                      placeholder="8 رموز على الأقل"
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:border-amber-500 focus:outline-none dir-ltr"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      رقم الواتساب:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+964..."
                      value={newMemberWhatsapp}
                      onChange={(e) => setNewMemberWhatsapp(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono focus:border-amber-500 focus:outline-none dir-ltr text-right"
                    />
                  </div>

                  {/* Role & Department */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300 block">
                        المسمى الوظيفي / الدور:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="راوي / مهندس صوت / مراجع..."
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300 block">
                        القسم (يدوي / اختياري):
                      </label>
                      <input
                        type="text"
                        placeholder="قسم الإنتاج الصوتي / عام..."
                        value={newMemberDept}
                        onChange={(e) => setNewMemberDept(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Country (All Arab Countries) & Admin Flag */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300 block">
                        الدولة العربية:
                      </label>
                      <select
                        value={newMemberCountry}
                        onChange={(e) =>
                          setNewMemberCountry(e.target.value as Country)
                        }
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
                      >
                        {ALL_ARAB_COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-300 block">
                        نوع الحساب والصلاحية:
                      </label>
                      <select
                        value={newMemberAccountRole}
                        onChange={(e) => {
                          setNewMemberAccountRole(e.target.value);
                          setNewMemberIsAdmin(
                            e.target.value === "ADMIN" ||
                              e.target.value === "SUPER_ADMIN",
                          );
                        }}
                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
                      >
                        <option value="MEMBER">عضو — منصة المهام</option>
                        <option value="NARRATOR">
                          راوي — التسجيل الخام والمهام
                        </option>
                        <option value="AUDIO_ENGINEER">
                          مهندس صوت — الماستر والمهام
                        </option>
                        <option value="QA_REVIEWER">
                          مراجع جودة — التدقيق والمهام
                        </option>
                        {currentUser?.canonicalRole === "SUPER_ADMIN" && (
                          <option value="ADMIN">مدير النظام</option>
                        )}
                        {currentUser?.canonicalRole === "SUPER_ADMIN" && (
                          <option value="SUPER_ADMIN">مدير عام</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>تأكيد إضافة العضو الجديد</span>
                  </button>
                </form>
              </div>
            )}

            {/* Directory List */}
            <div
              className={`${canCreateMember ? "lg:col-span-7" : "lg:col-span-12"} bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    <span>دليل الأعضاء المعتمدين بالنظام ({users.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    عرض الأعضاء، تحديد الصلاحيات المخصصة، وتعديل الأكواد
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <select
                    value={memberCountryFilter}
                    onChange={(e) => setMemberCountryFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">كافة الدول العربية</option>
                    {ALL_ARAB_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="بحث عن عضو..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 text-xs custom-scrollbar">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/30 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm">
                          {member.name}
                        </span>
                        {member.isAdmin ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ⚡ مسؤول عام
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
                            عضو
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                          {member.country}
                        </span>
                      </div>
                      <div className="text-slate-300 font-medium text-[11px]">
                        {member.roleName} -{" "}
                        <span className="text-amber-400">
                          {member.departmentName}
                        </span>
                      </div>
                      <div className="text-slate-500 font-mono text-[10px] dir-ltr text-right">
                        {member.whatsapp}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Direct Profile Edit Button */}
                      {canEditMemberProfile && (
                        <button
                          onClick={() => setEditingProfileUser(member)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                          title="تعديل مباشر على بيانات ورتبة الملف الشخصي"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل Profile</span>
                        </button>
                      )}

                      {/* Permission Manager Trigger Button */}
                      {canManagePermissionsAction && (
                        <button
                          onClick={() => {
                            setEditingPermissionsUser(member);
                            setTempPermissions(
                              resolveUserEffectivePermissions(member),
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="تحديد الصلاحيات المخصصة"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>الصلاحيات</span>
                        </button>
                      )}

                      <div className="px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800 font-mono text-amber-400 font-bold flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{member.code}</span>
                      </div>

                      <button
                        onClick={() => handleCopyCode(member.code, member.id)}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                        title="نسخ كود الدخول"
                      >
                        {copiedCodeUserId === member.id ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {!member.isAdmin && canDeleteMember && (
                        <button
                          onClick={() => onDeleteUser(member.id)}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            member.status === "disabled"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                          }`}
                          title={
                            member.status === "disabled"
                              ? "تفعيل الحساب"
                              : "تعطيل الحساب مع حفظ البيانات"
                          }
                        >
                          {member.status === "disabled" ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <PowerOff className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GRANULAR PERMISSIONS MANAGER (إدارة الصلاحيات المخصصة لكل مسؤول) */}
        {visibleTab === "permissions" && canTabPermissions && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="pb-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  <span>
                    تحديد الصلاحيات المخصصة للمسؤولين والأعضاء (Granular
                    Permissions)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  يمكنك التحكم بالضبط بالأجزاء والوظائف التي يستطيع كل مسؤول
                  التعديل عليها دون إعطائه صلاحيات كاملة.
                </p>
              </div>

              {/* Reset Non-Admins Button */}
              {onResetNonAdminUsers && (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "هل أنت متأكد من سحب كافة الصلاحيات من الأعضاء غير الإداريين؟",
                      )
                    ) {
                      onResetNonAdminUsers();
                      setSelectedUserIds([]);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  title="سحب كافة الصلاحيات من الأعضاء غير الإداريين"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>سحب الصلاحيات من الأعضاء (تصفير)</span>
                </button>
              )}
            </div>

            {/* Bulk Actions Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const nonAdminIds = users
                      .filter((u) => !u.isAdmin)
                      .map((u) => u.id);
                    if (
                      selectedUserIds.length === nonAdminIds.length &&
                      nonAdminIds.length > 0
                    ) {
                      setSelectedUserIds([]);
                    } else {
                      setSelectedUserIds(nonAdminIds);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>
                    {selectedUserIds.length ===
                      users.filter((u) => !u.isAdmin).length &&
                    users.filter((u) => !u.isAdmin).length > 0
                      ? "إلغاء تحديد الجميع"
                      : "تحديد كافة الأعضاء غير الإداريين"}
                  </span>
                </button>

                {selectedUserIds.length > 0 && (
                  <span className="text-xs font-bold text-amber-400 px-3 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    تم تحديد ({selectedUserIds.length}) عضو
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedUserIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearUserSelection}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (selectedUserIds.length === 0) {
                      selectAllNonAdminUsers();
                    }
                    setIsBulkPermissionsOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    تعديل الصلاحيات الجماعي{" "}
                    {selectedUserIds.length > 0
                      ? `(${selectedUserIds.length} عضو)`
                      : "(تحديد الأعضاء)"}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user) => {
                const perms = resolveUserEffectivePermissions(user);

                const isSelected = selectedUserIds.includes(user.id);

                return (
                  <div
                    key={user.id}
                    className={`p-5 rounded-2xl bg-slate-950 border space-y-4 transition-all text-xs ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/10"
                        : "border-slate-800 hover:border-amber-500/40"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        {!user.isAdmin && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUser(user.id)}
                            className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                            title="تحديد العضو للتغيير الجماعي للصلاحيات"
                          />
                        )}
                        <div>
                          <span className="font-bold text-white text-sm block">
                            {user.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {user.roleName} ({user.departmentName})
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${
                          user.isAdmin
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {user.isAdmin ? "⚡ مسؤول عام" : "عضو بميزات"}
                      </span>
                    </div>

                    <div className="space-y-2 text-slate-300 font-semibold">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900">
                        <span>👁️ رؤية كافة المهام:</span>
                        <span
                          className={
                            perms.canViewAllTasks
                              ? "text-emerald-400 font-bold"
                              : "text-slate-600"
                          }
                        >
                          {perms.canViewAllTasks ? "مسموح ✅" : "محظور ❌"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900">
                        <span>🛡️ دخول لوحة الإدارة:</span>
                        <span
                          className={
                            perms.canAccessAdminPanel || user.isAdmin
                              ? "text-emerald-400 font-bold"
                              : "text-slate-600"
                          }
                        >
                          {perms.canAccessAdminPanel || user.isAdmin
                            ? "مسموح ✅"
                            : "محظور ❌"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900">
                        <span>👤 إدارة ملفات الأعضاء:</span>
                        <span
                          className={
                            perms.canManageUsers === true
                              ? "text-emerald-400 font-bold"
                              : "text-slate-600"
                          }
                        >
                          {perms.canManageUsers === true
                            ? "مسموح ✅"
                            : "محظور ❌"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900">
                        <span>➕ إسناد وتعديل المهام:</span>
                        <span
                          className={
                            perms.canManageTasks
                              ? "text-emerald-400 font-bold"
                              : "text-slate-600"
                          }
                        >
                          {perms.canManageTasks ? "مسموح ✅" : "محظور ❌"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900">
                        <span>🏢 إدارة الأقسام:</span>
                        <span
                          className={
                            perms.canManageDepartments === true
                              ? "text-emerald-400 font-bold"
                              : "text-slate-600"
                          }
                        >
                          {perms.canManageDepartments === true
                            ? "مسموح ✅"
                            : "محظور ❌"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900">
                        <span>📁 ملفات Drive والسحابة:</span>
                        <span
                          className={
                            perms.canManageDrive === true
                              ? "text-emerald-400 font-bold"
                              : "text-slate-600"
                          }
                        >
                          {perms.canManageDrive === true
                            ? "مسموح ✅"
                            : "محظور ❌"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingPermissionsUser(user);
                        setTempPermissions(perms);
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold hover:bg-amber-500/20 cursor-pointer text-center"
                    >
                      تعديل صلاحيات {user.name}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: ACCESS CODES MANAGER */}
        {visibleTab === "codes" && canTabCodes && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  <span>
                    إدارة وسجل الأكواد ورموز الوصول السرية (Passcodes)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  عرض وتعديل رمز الدخول الخاص بكل عضو، أو تغيير الأكواد وتوزيعها
                  بضغطة زر واحدة.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث برقم الكود أو اسم العضو..."
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">اسم صاحب الكود</th>
                    <th className="py-3.5 px-4">الصفة والمديرية</th>
                    <th className="py-3.5 px-4 text-center">
                      رمز الوصول (Passcode)
                    </th>
                    <th className="py-3.5 px-4 text-center">حالة الحساب</th>
                    <th className="py-3.5 px-4 text-center">
                      الإجراءات والتحكم
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {filteredCodeUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-white text-sm">
                        <div>{user.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono dir-ltr text-right">
                          {user.whatsapp}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <div>{user.roleName}</div>
                        <div className="text-[10px] text-amber-400/80">
                          {user.departmentName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {editingUserId === user.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              value={editingUserCodeInput}
                              onChange={(e) =>
                                setEditingUserCodeInput(e.target.value)
                              }
                              className="w-24 p-1.5 rounded-lg bg-slate-950 border border-amber-500 text-amber-400 font-mono font-bold text-center text-sm focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveEditedCode(user.id)}
                              className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              حفظ
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono font-black text-amber-400 text-base bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 tracking-wider">
                            {user.code}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          🟢 مفعل ونشط
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleCopyCode(user.code, user.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-slate-300 hover:text-amber-400 transition-all font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            {copiedCodeUserId === user.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">
                                  تم النسخ
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>نسخ الكود</span>
                              </>
                            )}
                          </button>

                          {canManageCodesAction && (
                            <>
                              <button
                                onClick={() => {
                                  const randomCode = Math.floor(
                                    100000 + Math.random() * 900000,
                                  ).toString();
                                  onUpdateUserCode(user.id, randomCode);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                                title="توليد كود عشوائي جديد فوراً"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>توليد كود</span>
                              </button>

                              <button
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setEditingUserCodeInput(user.code);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>تعديل الكود</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DEPARTMENTS */}
        {visibleTab === "departments" && canTabDepartments && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {canManageDepartmentsAction && (
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="pb-4 border-b border-slate-800">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-400" />
                    <span>إضافة قسم جديد لمبادرة إنصات</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    إنشاء قسم أو لجان جديدة وإتاحتها للعمل والأرشيف.
                  </p>
                </div>

                {deptSuccessMsg && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{deptSuccessMsg}</span>
                  </div>
                )}

                <form
                  onSubmit={handleCreateDepartment}
                  className="space-y-4 text-xs"
                >
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      اسم القسم الجديد:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: قسم الروايات البصرية، قسم التدقيق واللغات..."
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      مسؤول / مدير القسم:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="اسم المباشر المنسق للقسم..."
                      value={newDeptLeader}
                      onChange={(e) => setNewDeptLeader(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      وصف مهام وأنشطة القسم:
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="اكتب وصفاً موجزاً لنشاط هذا القسم..."
                      value={newDeptDesc}
                      onChange={(e) => setNewDeptDesc(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:border-amber-500 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>اعتماد وإضافة القسم الجديد</span>
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${canManageDepartmentsAction ? "lg:col-span-7" : "lg:col-span-12"} bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4`}
            >
              <div className="pb-4 border-b border-slate-800">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <span>
                    قائمة الأقسام الحالية للمبادرة ({departments.length})
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 relative space-y-3 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
                          {dept.leader}
                        </div>

                        {departments.length > 1 &&
                          canManageDepartmentsAction && (
                            <button
                              onClick={() => onDeleteDepartment(dept.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                              title="حذف القسم"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>

                      <h4 className="font-bold text-white text-base">
                        {dept.name}
                      </h4>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {dept.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                      <span>الأعضاء الملحقون</span>
                      <span className="text-amber-400 font-mono text-xs">
                        {dept.memberCount || 1} عضو
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DRIVE FOLDERS */}
        {visibleTab === "drive" && canTabDrive && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {canManageDriveAction && (
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                <div className="pb-4 border-b border-slate-800">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <FolderPlus className="w-5 h-5 text-amber-400" />
                    <span>إدراج رابط مجلد Google Drive جديد</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    ربط المجلدات السحابية الرسمية لتتيح للأعضاء التصفح.
                  </p>
                </div>

                {driveSuccessMsg && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{driveSuccessMsg}</span>
                  </div>
                )}

                <form
                  onSubmit={handleCreateDriveFolder}
                  className="space-y-4 text-xs"
                >
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      عنوان المجلد السحابي:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: مجلد ملفات الهندسة الصوتية 2026..."
                      value={newDriveTitle}
                      onChange={(e) => setNewDriveTitle(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      رابط Google Drive (URL):
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://drive.google.com/drive/folders/..."
                      value={newDriveUrl}
                      onChange={(e) => setNewDriveUrl(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs focus:border-amber-500 focus:outline-none dir-ltr text-right"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      القسم المستهدف:
                    </label>
                    <select
                      value={newDriveDeptName}
                      onChange={(e) => {
                        setNewDriveDeptName(e.target.value);
                        const dObj = departments.find(
                          (d) => d.name === e.target.value,
                        );
                        if (dObj) setNewDriveDeptId(dObj.id);
                      }}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إدراج المجلد في الأرشيف</span>
                  </button>
                </form>
              </div>
            )}

            <div
              className={`${canManageDriveAction ? "lg:col-span-7" : "lg:col-span-12"} bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4`}
            >
              <div className="pb-4 border-b border-slate-800">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-amber-400" />
                  <span>
                    مجلدات Google Drive المعتمدة بالأرشيف ({cloudFolders.length}
                    )
                  </span>
                </h3>
              </div>

              <div className="space-y-3">
                {cloudFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-amber-500/40 transition-all"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-white text-sm block">
                        {folder.title}
                      </span>
                      <span className="text-[11px] text-amber-400 font-semibold">
                        {folder.departmentName}
                      </span>
                      <a
                        href={folder.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-slate-400 hover:text-amber-300 font-mono block dir-ltr text-right line-clamp-1 underline"
                      >
                        {folder.url}
                      </a>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={folder.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>فتح</span>
                      </a>

                      {canManageDriveAction && (
                        <button
                          onClick={() => onDeleteCloudFolder(folder.id)}
                          className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                          title="حذف المجلد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SMART EFFICIENCY EVALUATION */}
        {visibleTab === "efficiency" && canTabEfficiency && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span>نظام التقييم الذكي ومؤشر الكفاءة والالتزام للفرق</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  خوارزمية تقييم ذكية تشمل وزنية المهام العالية، الالتزام
                  بالموعد، نسبة المنجز، والخصم عند التأخير.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memberEfficiencies.map((eff, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 hover:border-amber-500/40 transition-all"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="font-black text-white text-base">
                        {eff.memberName}
                      </h4>
                      <span className="text-xs text-slate-400">
                        {eff.roleName} - {eff.departmentName}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${eff.badgeColor}`}
                    >
                      {eff.statusLabel}
                    </span>
                  </div>

                  {/* Progress Bar & Score */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-300">
                        معدل التقييم المركب:
                      </span>
                      <span className="text-amber-400 font-mono text-sm">
                        {eff.scorePercentage}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${eff.scorePercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Breakdown Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block">
                        إجمالي المهام
                      </span>
                      <span className="text-white text-xs font-mono">
                        {eff.totalTasks}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <span className="block">المنجزة</span>
                      <span className="text-xs font-mono">
                        {eff.completedTasks}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                      <span className="block">ذات أولوية عالية</span>
                      <span className="text-xs font-mono">
                        {eff.highPriorityCompleted}
                      </span>
                    </div>
                  </div>

                  {/* Smart AI Evaluation */}
                  <div className="pt-3 border-t border-slate-800">
                    {!aiEvaluations[eff.userId] ? (
                      <button
                        onClick={() =>
                          handleEvaluateMember(
                            eff.userId,
                            eff.tasksData,
                            eff.memberName,
                          )
                        }
                        disabled={
                          isEvaluating[eff.userId] || eff.totalTasks === 0
                        }
                        className="w-full py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        {isEvaluating[eff.userId]
                          ? "جاري التحليل..."
                          : "تحليل الأداء بالذكاء الاصطناعي"}
                      </button>
                    ) : (
                      <div className="space-y-3 bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                          <span className="text-indigo-400 font-bold text-xs flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> التقييم الذكي
                          </span>
                          <span className="text-white font-mono font-black text-sm bg-indigo-500/20 px-2 py-0.5 rounded">
                            {aiEvaluations[eff.userId].score}/100
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="block text-[10px] text-slate-500 mb-0.5">
                              التحليل الشامل:
                            </span>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {aiEvaluations[eff.userId].summary}
                            </p>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500 mb-0.5">
                              توصيات مخصصة:
                            </span>
                            <p className="text-xs text-amber-300 leading-relaxed">
                              {aiEvaluations[eff.userId].recommendation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: ACTIVITY LOGS */}
        {visibleTab === "logs" && canTabLogs && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <span>سجل الأنشطة والتدقيق الرقمي للعمليات</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  تتبع كافة الإجراءات والتعديلات اللحظية المنفذة بالنظام.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث بالسجل..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 text-xs custom-scrollbar">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400">
                        {log.userName}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({log.userRole})
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
                        {log.action}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs">{log.details}</p>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: ANNOUNCEMENT BAR */}
        {visibleTab === "announcement" && canTabAnnouncement && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="pb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                <span>إدارة وتحديث الشريط الإعلاني العلوي للمنصة</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تعديل نص التنبيه الإداري المتنسق الذي يظهر لجميع أعضاء المنصة
                مباشرة.
              </p>
            </div>

            {isSavedBanner && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  تم تحديث ونشر الشريط الإعلاني لجميع أعضاء إنصات بنجاح!
                </span>
              </div>
            )}

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <textarea
                rows={4}
                readOnly={!canManageAnnouncementAction}
                value={newAnnouncementInput}
                onChange={(e) => setNewAnnouncementInput(e.target.value)}
                className={`w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 font-bold text-sm leading-relaxed focus:outline-none resize-none ${canManageAnnouncementAction ? "focus:border-amber-500" : "opacity-80 cursor-not-allowed"}`}
              />

              {canManageAnnouncementAction ? (
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>تحديث ونشر الإعلان فوراً</span>
                </button>
              ) : (
                <div className="text-xs text-slate-500 font-medium">
                  عرض وقراءة فقط — لا تملك صلاحية تعديل ونشر الإعلان الإداري
                </div>
              )}
            </form>
          </div>
        )}

        {/* TAB 9: SUPABASE */}
        {visibleTab === "supabase" && canTabSupabase && (
          <SupabaseConfigTab
            onSyncRefresh={onSyncRefresh}
            canManageSupabase={canManageSupabaseAction}
          />
        )}

        {/* TAB 10: REQUESTS & REPORTS */}
        {visibleTab === "requests" && canTabRequests && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
              <MessageSquare className="w-5 h-5 text-amber-500" />
              <h3 className="text-xl font-black text-white">
                إدارة الطلبات والاعتراضات
              </h3>
            </div>
            {requests.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                لا توجد أي طلبات أو اعتراضات حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
                            req.type === "طلب"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : req.type === "اعتراض"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                          } border mb-2`}
                        >
                          {req.type}
                        </span>
                        <h4 className="text-white font-bold text-sm line-clamp-1">
                          {req.title}
                        </h4>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          req.status === "قيد المراجعة"
                            ? "bg-slate-800 text-slate-300"
                            : req.status === "تم القبول"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {req.details}
                    </div>
                    <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-3 flex items-center justify-between">
                      <span>
                        {req.userName} - {req.departmentName}
                      </span>
                      <span>
                        {new Date(req.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                    </div>

                    {req.status === "قيد المراجعة" && onUpdateRequestStatus && (
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => {
                            const reply = window.prompt("سبب القبول / الرد:");
                            if (reply !== null)
                              onUpdateRequestStatus(req.id, "تم القبول", reply);
                          }}
                          className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition-colors"
                        >
                          قبول
                        </button>
                        <button
                          onClick={() => {
                            const reply = window.prompt("سبب الرفض / الرد:");
                            if (reply !== null)
                              onUpdateRequestStatus(req.id, "تم الرفض", reply);
                          }}
                          className="flex-1 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-colors"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                    {req.adminReply && (
                      <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                        <span className="block text-slate-500 mb-1">
                          رد الإدارة:
                        </span>
                        <span className="text-amber-400">{req.adminReply}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PERMISSIONS MODAL DRAWER */}
        {editingPermissionsUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 font-['Cairo'] text-right my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-lg">
                    تخصيص وتعديل الصلاحيات المخصصة:{" "}
                    {editingPermissionsUser.name}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingPermissionsUser(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
                {/* Group 1: Tasks & Board Operations */}
                <div className="space-y-2">
                  <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-800">
                    <Eye className="w-4 h-4" />
                    <span>
                      1. صلاحيات المهام والأرشيف (Tasks & Board Controls)
                    </span>
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        👁️ رؤية واستعراض كافة مهام النظام:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إمكانية التبديل إلى "كافة النظام" ورؤية مهام جميع
                        الأعضاء والأقسام
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!tempPermissions.canViewAllTasks}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewAllTasks: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ➕ إضافة وتعديل وإسناد المهام للأعضاء:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إسناد وتغيير وتعديل حالات المهام لكافة الأعضاء
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!tempPermissions.canManageTasks}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canManageTasks: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🗑️ حذف وإزالة المهام:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        تمكين العضو من حذف وتصفية المهام من الجدول
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!tempPermissions.canDeleteTasks}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canDeleteTasks: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        👥 إضافة مهام جديدة لأعضاء قسمه المباشر:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        تمكين العضو من إضافة وإسناد المهام لزملائه في نفس القسم
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!tempPermissions.canAddTaskForDept}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canAddTaskForDept: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ⚡ شريط الإجراءات السريعة والتحديث الجماعي:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إتاحة شريط الإجراءات السريعة العائم لتحديد وإنجاز المهام
                        دفعة واحدة
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!tempPermissions.canBulkUpdateTasks}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canBulkUpdateTasks: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        📁 فتح واستعراض أرشيف Google Drive:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إمكانية التصفح والوصول للأرشيف السحابي
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempPermissions.canAccessDrive === true}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canAccessDrive: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🎙️ الوصول لموقع التسجيل الخاص بالرواة:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار قسم منصة التسجيل والرفع الصوتية
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!tempPermissions.canAccessRecordingSite}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canAccessRecordingSite: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* Group 2: Main Admin Panel Entry */}
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-800">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      2. دخول لوحة التحكم الإدارية العامة (Admin Access)
                    </span>
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🛡️ إتاحة لوحة التحكم الإدارية (الشريط العلوي):
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار رابط لوحة التحكم في أعلى الشاشة
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!tempPermissions.canAccessAdminPanel}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canAccessAdminPanel: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* Group 3: TAB 1 - Members & Profiles */}
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-800">
                    <UserPlus className="w-4 h-4" />
                    <span>3. تبويب وإجراءات الأعضاء (Members Section)</span>
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        👁️ عرض تبويب "إضافة الأعضاء":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار تبويب قائمة وتحديث الأعضاء
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewMembersTab === true &&
                        tempPermissions.canManageUsers === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewMembersTab: e.target.checked,
                          canManageUsers: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ➕ إضافة عضو جديد للنظام:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار نموذج إضافة حساب عضو جديد
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempPermissions.canCreateMember === true}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canCreateMember: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ✏️ تعديل بيانات الملف الشخصي للعضو:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        تعديل الاسم والرتبة والدولة والقسم
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempPermissions.canEditMemberProfile === true}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canEditMemberProfile: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🗑️ حذف وطرد العضو:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        تعطيل الحساب مع الاحتفاظ بسجلاته وبياناته
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempPermissions.canDeleteMember === true}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canDeleteMember: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* Group 4: TAB 2 - Custom Permissions & TAB 3 - Access Passcodes */}
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-800">
                    <Sliders className="w-4 h-4" />
                    <span>
                      4. تبويب الصلاحيات وأكواد الوصول (Permissions & Codes)
                    </span>
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ⚡ عرض تبويب "الصلاحيات المخصصة":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار قسم إدارة صلاحيات الأعضاء
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewPermissionsTab === true &&
                        tempPermissions.canManagePermissions === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewPermissionsTab: e.target.checked,
                          canManagePermissions: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🔑 عرض تبويب "أكواد الوصول":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار قسم استعراض وتوليد وتعديل أكواد الوصول (Passcodes)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewCodesTab === true &&
                        tempPermissions.canManageCodes === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewCodesTab: e.target.checked,
                          canManageCodes: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🎲 إمكانية توليد ونسخ وتعديل الأكواد السرية:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        توليد كود تلقائي أو نسخ الكود وإجراء التغيير
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempPermissions.canManageCodes === true}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canManageCodes: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* Group 5: TAB 4 - Departments & TAB 5 - Cloud Drive Files */}
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-800">
                    <Building2 className="w-4 h-4" />
                    <span>
                      5. تبويب الأقسام ومجلدات Drive (Depts & Drive Files)
                    </span>
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🏢 عرض تبويب "الأقسام واللجان":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار قسم إدارة الأقسام
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewDepartmentsTab === true &&
                        tempPermissions.canManageDepartments === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewDepartmentsTab: e.target.checked,
                          canManageDepartments: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ➕ إضافة وحذف وتشكيل الأقسام واللجان:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        السماح بتوسيع الأقسام
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempPermissions.canManageDepartments === true}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canManageDepartments: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        📁 عرض تبويب "ملفات Drive السحابية":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار قسم روابط Drive السحابية
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewDriveTab === true &&
                        tempPermissions.canManageDrive === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewDriveTab: e.target.checked,
                          canManageDrive: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ➕ إضافة وتعديل روابط ومجلدات Drive:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        السماح بإضافة مجلدات جديدة للأرشيف
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempPermissions.canManageDrive === true}
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canManageDrive: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {/* Group 6: Analytics, Logs, Announcements & Supabase */}
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-800">
                    <Award className="w-4 h-4" />
                    <span>6. تبويب التقييم السجلات الإعلان وSupabase</span>
                  </h4>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        🏆 عرض تبويب "التقييم الذكي":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إظهار تقارير الإنتاجية والكفاءة للأعضاء
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewEfficiencyTab === true &&
                        tempPermissions.canViewEfficiency === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewEfficiencyTab: e.target.checked,
                          canViewEfficiency: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        📋 عرض تبويب "سجل الأنشطة":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        استعراض سجل الأنشطة والعمليات الإدارية
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewLogsTab === true &&
                        tempPermissions.canViewLogs === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewLogsTab: e.target.checked,
                          canViewLogs: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        📢 عرض وتعديل تبويب "الشريط الإداري":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        تحديث ونشر الإعلان العام العلوي
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewAnnouncementTab === true &&
                        tempPermissions.canManageAnnouncement === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewAnnouncementTab: e.target.checked,
                          canManageAnnouncement: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <div>
                      <span className="font-bold text-slate-200 block">
                        ⚡ عرض وتعديل تبويب "ربط Supabase":
                      </span>
                      <span className="text-[10px] text-slate-400">
                        إدارة ومزامنة قاعدة بيانات Supabase الحية
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        tempPermissions.canViewSupabaseTab === true &&
                        tempPermissions.canManageSupabase === true
                      }
                      onChange={(e) =>
                        setTempPermissions({
                          ...tempPermissions,
                          canViewSupabaseTab: e.target.checked,
                          canManageSupabase: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPermissionsUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveUserPermissions}
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer text-xs"
                >
                  حفظ الصلاحيات المخصصة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DIRECT USER PROFILE EDIT */}
        {editingProfileUser && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  <span>تعديل الملف الشخصي للعضو المباشر</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingProfileUser(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingProfileUser && onUpdateUser) {
                    onUpdateUser(editingProfileUser);
                    setEditingProfileUser(null);
                  }
                }}
                className="space-y-4 text-xs"
              >
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 block">
                    اسم العضو الكامل:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProfileUser.name}
                    onChange={(e) =>
                      setEditingProfileUser({
                        ...editingProfileUser,
                        name: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 block">
                    رقم الواتساب:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProfileUser.whatsapp}
                    onChange={(e) =>
                      setEditingProfileUser({
                        ...editingProfileUser,
                        whatsapp: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono focus:border-amber-500 focus:outline-none dir-ltr text-right"
                  />
                </div>

                {/* Role & Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      المسمى الوظيفي / الوظيفة:
                    </label>
                    <input
                      type="text"
                      required
                      value={editingProfileUser.roleName}
                      onChange={(e) =>
                        setEditingProfileUser({
                          ...editingProfileUser,
                          roleName: e.target.value,
                        })
                      }
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      القسم (يدوي / اختياري):
                    </label>
                    <input
                      type="text"
                      placeholder="قسم الإنتاج الصوتي / عام..."
                      value={editingProfileUser.departmentName}
                      onChange={(e) =>
                        setEditingProfileUser({
                          ...editingProfileUser,
                          departmentName: e.target.value,
                        })
                      }
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Country & Admin Flag */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      الدولة العربية:
                    </label>
                    <select
                      value={editingProfileUser.country}
                      onChange={(e) =>
                        setEditingProfileUser({
                          ...editingProfileUser,
                          country: e.target.value as Country,
                        })
                      }
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      {ALL_ARAB_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">
                      نوع الحساب والصلاحية:
                    </label>
                    <select
                      value={editingProfileUser.isAdmin ? "yes" : "no"}
                      onChange={(e) =>
                        setEditingProfileUser({
                          ...editingProfileUser,
                          isAdmin: e.target.value === "yes",
                        })
                      }
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      <option value="no">عضو (صلاحيات مخصصة)</option>
                      <option value="yes">⚡ مسؤول عام (Full Admin)</option>
                    </select>
                  </div>
                </div>

                {/* Passcode Code */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300 block">
                      كود الدخول المخصص (Passcode):
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingProfileUser({
                          ...editingProfileUser,
                          code: generateRandom6Digit(),
                        })
                      }
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>توليد كود جديد</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={editingProfileUser.code}
                    onChange={(e) =>
                      setEditingProfileUser({
                        ...editingProfileUser,
                        code: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-400 font-mono font-bold text-center text-base tracking-widest focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Buttons */}
                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingProfileUser(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    حفظ التعديلات المباشرة
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: BULK PERMISSIONS UPDATER */}
        {isBulkPermissionsOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 font-['Cairo']">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span>التغيير الجماعي للصلاحيات المخصصة</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    تغيير الصلاحيات المخصصة لـ{" "}
                    <span className="text-amber-400 font-bold">
                      {selectedUserIds.length}
                    </span>{" "}
                    عضو محدد دفعة واحدة
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkPermissionsOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Selected Users Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>الأعضاء المحددين للتعديل:</span>
                  <button
                    type="button"
                    onClick={selectAllNonAdminUsers}
                    className="text-amber-400 hover:underline cursor-pointer text-[11px]"
                  >
                    تحديد جميع غير الإداريين (
                    {users.filter((u) => !u.isAdmin).length})
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                  {selectedUserIds.length === 0 ? (
                    <span className="text-slate-500 text-xs italic">
                      لم يتم تحديد أي عضو. يرجى اختيار الأعضاء أولاً.
                    </span>
                  ) : (
                    selectedUserIds.map((id) => {
                      const u = users.find((item) => item.id === id);
                      if (!u) return null;
                      return (
                        <span
                          key={id}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5"
                        >
                          <span>{u.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleSelectUser(id)}
                            className="text-amber-400 hover:text-rose-400 font-black cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Presets Grid */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 block">
                  اختر نموذج صلاحيات جاهز (Preset):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkPreset("member");
                      setBulkPermissions({});
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-right cursor-pointer ${
                      bulkPreset === "member"
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold">🛡️ عضو عادي افتراضي</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      بدون أي صلاحيات إدارية
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBulkPreset("supervisor");
                      setBulkPermissions({
                        canViewAllTasks: true,
                        canAccessAdminPanel: true,
                        canViewMembersTab: true,
                        canManageUsers: false,
                        canManageTasks: true,
                        canAddDeptTasks: true,
                        canViewEfficiencyTab: true,
                        canViewEfficiency: true,
                        canViewDriveTab: true,
                        canManageDrive: true,
                      });
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-right cursor-pointer ${
                      bulkPreset === "supervisor"
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold">👥 مشرف قسم ومتابعة</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      رؤية المهام وإسنادها وتقييم الأداء
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBulkPreset("full");
                      setBulkPermissions({
                        canViewAllTasks: true,
                        canAccessAdminPanel: true,
                        canViewMembersTab: true,
                        canManageUsers: true,
                        canViewPermissionsTab: true,
                        canManagePermissions: true,
                        canViewCodesTab: true,
                        canManageCodes: true,
                        canViewDepartmentsTab: true,
                        canManageDepartments: true,
                        canViewDriveTab: true,
                        canManageDrive: true,
                        canViewEfficiencyTab: true,
                        canViewEfficiency: true,
                        canViewLogsTab: true,
                        canViewLogs: true,
                        canViewAnnouncementTab: true,
                        canManageAnnouncement: true,
                        canViewSupabaseTab: true,
                        canManageSupabase: true,
                        canManageTasks: true,
                        canDeleteTasks: true,
                      });
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-right cursor-pointer ${
                      bulkPreset === "full"
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold">⚡ منح كافة الصلاحيات</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      تفعيل كامل الوظائف والتبويبات
                    </div>
                  </button>
                </div>
              </div>

              {/* Switches Checkboxes */}
              <div className="space-y-3 pt-3 border-t border-slate-800 text-xs max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                  <Sliders className="w-4 h-4" />
                  <span>تخصيص الصلاحيات المحددة (Custom Toggles):</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      👁️ رؤية كافة المهام
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canViewAllTasks}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canViewAllTasks: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      🛡️ دخول لوحة الإدارة
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canAccessAdminPanel}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canAccessAdminPanel: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      👤 إدارة الأعضاء وتعديلهم
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canManageUsers}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canManageUsers: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      ➕ إسناد وتعديل المهام
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canManageTasks}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canManageTasks: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      🏢 إدارة الأقسام واللجان
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canManageDepartments}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canManageDepartments: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      📁 إدارة ملفات Google Drive
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canManageDrive}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canManageDrive: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      🏆 عرض التقييم والإنتاجية
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canViewEfficiency}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canViewEfficiency: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      📢 تعديل الشريط الإعلاني
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canManageAnnouncement}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canManageAnnouncement: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <span className="font-bold text-slate-200">
                      🎙️ الوصول لموقع التسجيل
                    </span>
                    <input
                      type="checkbox"
                      checked={!!bulkPermissions.canAccessRecordingSite}
                      onChange={(e) => {
                        setBulkPreset("custom");
                        setBulkPermissions({
                          ...bulkPermissions,
                          canAccessRecordingSite: e.target.checked,
                        });
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBulkPermissionsOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer text-xs"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  disabled={selectedUserIds.length === 0}
                  onClick={() => {
                    if (onBulkUpdatePermissions && selectedUserIds.length > 0) {
                      onBulkUpdatePermissions(selectedUserIds, bulkPermissions);
                      setIsBulkPermissionsOpen(false);
                      setSelectedUserIds([]);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black shadow-lg shadow-amber-500/20 cursor-pointer text-xs"
                >
                  تطبيق الصلاحيات الجديدة على ({selectedUserIds.length}) عضو
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
