// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { TeamDashboard } from "./components/TeamDashboard";
import { CloudArchive } from "./components/CloudArchive";
import { AdminPanel } from "./components/AdminPanel";
import { Footer } from "./components/Footer";
import { AddTaskModal } from "./components/AddTaskModal";
import { FolderModal } from "./components/FolderModal";
import { LoginModal } from "./components/LoginModal";
import { CompletionNoteModal } from "./components/CompletionNoteModal";
import { RequestModal } from "./components/RequestModal";
import { EditProfileModal } from "./components/EditProfileModal";
import {
  ToastNotification,
  ToastMessage,
} from "./components/ToastNotification";
import { createClient } from "./utils/supabase/client";
import { authService as unifiedAuthService } from "../services/authService";
import {
  loadLocalUsers,
  saveLocalUsers,
  pushUserToSupabase,
  loadLocalTasks,
  saveLocalTasks,
  pushTaskToSupabase,
  deleteTaskFromSupabase,
  bulkDeleteTasksFromSupabase,
  loadLocalDepartments,
  saveLocalDepartments,
  pushDepartmentToSupabase,
  deleteDepartmentFromSupabase,
  loadLocalCloudFolders,
  saveLocalCloudFolders,
  pushCloudFolderToSupabase,
  deleteCloudFolderFromSupabase,
  loadLocalActivityLogs,
  saveLocalActivityLogs,
  pushActivityLogToSupabase,
  loadLocalAnnouncement,
  saveLocalAnnouncement,
  pushAnnouncementToSupabase,
  loadLocalRequests,
  saveLocalRequests,
  pushRequestsToSupabase,
  syncFromSupabase,
  normalizeDateForInput,
} from "./lib/storageService";
import {
  TeamTask,
  TaskStatus,
  CloudFolder,
  UserSession,
  UserPermissions,
  ActivityLog,
  DepartmentInfo,
  UserSubmitRequest,
} from "./types";

export default function App({
  initialUser,
  onUnifiedLogout,
}: {
  initialUser?: UserSession | null;
  onUnifiedLogout?: () => void | Promise<void>;
} = {}) {
  const integratedMode = initialUser !== undefined;
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Persistent States
  const [users, setUsers] = useState<UserSession[]>(() =>
    integratedMode ? [] : loadLocalUsers(),
  );
  const [tasks, setTasks] = useState<TeamTask[]>(() =>
    integratedMode ? [] : loadLocalTasks(),
  );
  const [departments, setDepartments] = useState<DepartmentInfo[]>(() =>
    loadLocalDepartments(),
  );
  const [cloudFolders, setCloudFolders] = useState<CloudFolder[]>(() =>
    integratedMode ? [] : loadLocalCloudFolders(),
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() =>
    integratedMode ? [] : loadLocalActivityLogs(),
  );
  const [announcement, setAnnouncement] = useState<string>(() =>
    loadLocalAnnouncement(),
  );
  const [requests, setRequests] = useState<UserSubmitRequest[]>(() =>
    loadLocalRequests(),
  );

  const reloadAllFromLocal = useCallback(() => {
    setUsers(loadLocalUsers());
    setTasks(loadLocalTasks());
    setDepartments(loadLocalDepartments());
    setCloudFolders(loadLocalCloudFolders());
    setActivityLogs(loadLocalActivityLogs());
    setAnnouncement(loadLocalAnnouncement());
    setRequests(loadLocalRequests());
  }, []);

  // 1. Initial Supabase sync & Realtime Channel Setup
  useEffect(() => {
    if (integratedMode) return;
    let channel: ReturnType<
      NonNullable<ReturnType<typeof createClient>>["channel"]
    > | null = null;

    async function initSupabase() {
      await syncFromSupabase();
      reloadAllFromLocal();

      const supabase = createClient();
      if (supabase) {
        try {
          supabase.removeAllChannels();
        } catch (err) {
          console.warn("Error removing previous channels:", err);
        }

        const channelName = `insat-realtime-${Date.now()}`;
        channel = supabase.channel(channelName);
        channel
          .on(
            "postgres_changes",
            { event: "*", schema: "public" },
            async () => {
              try {
                await syncFromSupabase();
                reloadAllFromLocal();
              } catch (err) {
                console.warn("Sync on postgres change failed:", err);
              }
            },
          )
          .subscribe();
      }
    }

    initSupabase();

    // Cross-tab and window event listeners
    const handleSyncUsers = () => setUsers(loadLocalUsers());
    const handleSyncTasks = () => setTasks(loadLocalTasks());
    const handleSyncDepts = () => setDepartments(loadLocalDepartments());
    const handleSyncFolders = () => setCloudFolders(loadLocalCloudFolders());
    const handleSyncLogs = () => setActivityLogs(loadLocalActivityLogs());
    const handleSyncAnn = () => setAnnouncement(loadLocalAnnouncement());
    const handleSyncReq = () => setRequests(loadLocalRequests());

    window.addEventListener("insat_sync_users", handleSyncUsers);
    window.addEventListener("insat_sync_tasks", handleSyncTasks);
    window.addEventListener("insat_sync_departments", handleSyncDepts);
    window.addEventListener("insat_sync_folders", handleSyncFolders);
    window.addEventListener("insat_sync_logs", handleSyncLogs);
    window.addEventListener("insat_sync_announcement", handleSyncAnn);
    window.addEventListener("insat_sync_requests", handleSyncReq);

    return () => {
      const supabase = createClient();
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener("insat_sync_users", handleSyncUsers);
      window.removeEventListener("insat_sync_tasks", handleSyncTasks);
      window.removeEventListener("insat_sync_departments", handleSyncDepts);
      window.removeEventListener("insat_sync_folders", handleSyncFolders);
      window.removeEventListener("insat_sync_logs", handleSyncLogs);
      window.removeEventListener("insat_sync_announcement", handleSyncAnn);
      window.removeEventListener("insat_sync_requests", handleSyncReq);
    };
  }, [reloadAllFromLocal, integratedMode]);

  // Toast System
  const addToast = (
    title: string,
    message: string,
    type: "info" | "success" | "warning" | "alert" = "info",
  ) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // User Auth Session
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    if (initialUser !== undefined) return initialUser;
    const saved = localStorage.getItem("insat_user_session");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // In the integrated platform Firebase is the only trusted session source.
  // Keep the legacy task UI synchronized without trusting its old local session.
  useEffect(() => {
    if (initialUser !== undefined) {
      setCurrentUser(initialUser);
      localStorage.removeItem("insat_user_session");
    }
  }, [initialUser]);

  useEffect(() => {
    if (!integratedMode || !currentUser) return;
    let cancelled = false;
    const statusToArabic = (status: string): TaskStatus =>
      status === "COMPLETED"
        ? "مكتمل"
        : status === "IN_REVIEW"
          ? "بانتظار التسجيل"
          : status === "BLOCKED"
            ? "متأخر"
            : "قيد التنفيذ";
    const priorityToArabic = (priority: string): TaskPriority =>
      priority === "HIGH" || priority === "URGENT"
        ? "عالية"
        : priority === "LOW"
          ? "منخفضة"
          : priority === "NORMAL"
            ? "عادية"
            : "متوسطة";

    void (async () => {
      try {
        const token = await unifiedAuthService.token();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const taskRequest = fetch("/api/tasks?includeArchived=true", {
          headers,
        });

        // Always fetch the complete directory of members so tasks, filters, and admin panels display all members
        const fetchAllMembers = async (): Promise<any[]> => {
          const canTryAdmin = Boolean(
            currentUser?.isAdmin ||
            currentUser?.permissions?.canAccessAdminPanel ||
            currentUser?.permissions?.canViewMembersTab ||
            currentUser?.actionAccess?.canManageMembers === "ALLOW",
          );

          if (canTryAdmin) {
            try {
              const res = await fetch("/api/admin/users", { headers });
              if (res.ok) {
                const data = await res.json().catch(() => null);
                if (
                  data?.success &&
                  Array.isArray(data.users) &&
                  data.users.length > 0
                ) {
                  return data.users;
                }
              }
            } catch (err) {
              console.warn(
                "[Tasks] /api/admin/users fetch error, will fallback to /api/tasks/members",
                err,
              );
            }
          }

          // Fallback or standard fetch: /api/tasks/members serves all authenticated members
          try {
            const res = await fetch("/api/tasks/members?forceRefresh=true", {
              headers,
            });
            if (res.ok) {
              const data = await res.json().catch(() => null);
              if (
                data?.success &&
                Array.isArray(data.members) &&
                data.members.length > 0
              ) {
                return data.members;
              }
            }
          } catch (err) {
            console.warn("[Tasks] /api/tasks/members fetch error:", err);
          }
          return [];
        };

        const [taskResponse, rawMembers] = await Promise.all([
          taskRequest,
          fetchAllMembers(),
        ]);
        const taskPayload = await taskResponse.json().catch(() => null);
        if (cancelled) return;

        let directory: UserSession[] = [];
        if (Array.isArray(rawMembers) && rawMembers.length > 0) {
          directory = rawMembers.map((member: any) => {
            const memberId = member.uid || member.id;
            const isAdmin = Boolean(
              member.isAdmin ||
              member.role === "SUPER_ADMIN" ||
              member.role === "ADMIN",
            );
            const rawPerms = member.permissions || member.custom_permissions;
            return {
              id: memberId,
              canonicalRole: member.canonicalRole || member.role || "MEMBER",
              name:
                member.name ||
                member.displayName ||
                member.fullName ||
                "عضو إنصات",
              whatsapp: member.whatsapp || member.phone || member.email || "",
              roleName:
                member.roleName ||
                member.roleDisplayAr ||
                member.roleDisplay ||
                member.role ||
                "عضو",
              departmentName:
                member.departmentName || member.department || "إنصات",
              country: member.country || member.nationality || "",
              isAdmin,
              code: "",
              status: member.status || member.accountStatus || "active",
              actionAccess: member.actionAccess || {},
              permissions:
                rawPerms ||
                (isAdmin
                  ? {
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
                    }
                  : {}),
              migratedPermissions: true,
            };
          });
          setUsers(directory);
        }

        if (
          taskResponse.ok &&
          taskPayload?.success &&
          Array.isArray(taskPayload.tasks)
        ) {
          const existingTasks: TeamTask[] = [];
          const existingMap = new Map(existingTasks.map((t) => [t.id, t]));
          const mapped = taskPayload.tasks.map((task: any) => {
            const assigneeId = task.assigneeUids?.[0] || currentUser.id;
            const assignee =
              directory.find((member) => member.id === assigneeId) ||
              currentUser;
            const isArchived =
              Boolean(task.isArchived) || task.status === "ARCHIVED";
            const serverDeadline =
              task.deadline || task.dueDate || task.due_date || "";
            const localDeadline = existingMap.get(task.id)?.deadline || "";
            const cleanDeadline =
              normalizeDateForInput(serverDeadline) ||
              normalizeDateForInput(localDeadline) ||
              serverDeadline ||
              localDeadline ||
              "";
            return {
              id: task.id,
              memberId: assigneeId,
              memberName: assignee.name,
              country: assignee.country || "",
              departmentId: "general",
              departmentName: assignee.departmentName || "إنصات",
              title: task.title,
              description: task.description,
              deadline: cleanDeadline,
              status: isArchived ? "ARCHIVED" : statusToArabic(task.status),
              isArchived,
              progress:
                task.status === "COMPLETED" ? 100 : task.completionPct || 25,
              priority: priorityToArabic(task.priority),
            } as TeamTask;
          });
          setTasks(mapped);
        }
      } catch (error) {
        console.warn("[Tasks] Unified sync unavailable.", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, integratedMode]);

  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState<boolean>(false);
  const [selectedCloudFolder, setSelectedCloudFolder] =
    useState<CloudFolder | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const [completionModalState, setCompletionModalState] = useState<{
    isOpen: boolean;
    task: TeamTask | null;
    pendingStatus: TaskStatus | null;
  }>({
    isOpen: false,
    task: null,
    pendingStatus: null,
  });

  const handleSubmitRequest = (
    requestData: Omit<
      UserSubmitRequest,
      "id" | "createdAt" | "status" | "adminReply"
    >,
  ) => {
    const newRequest: UserSubmitRequest = {
      ...requestData,
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      status: "قيد المراجعة",
    };
    const updated = [newRequest, ...requests];
    setRequests(updated);
    saveLocalRequests(updated);
    pushRequestsToSupabase();

    addLogEntry(
      "تقديم طلب",
      `قدم العضو (${newRequest.userName}) ${newRequest.type}: ${newRequest.title}`,
    );
    addToast("تم إرسال الطلب", "تم إرسال طلبك للإدارة بنجاح", "success");
    setIsRequestModalOpen(false);
  };

  // Logging Entry Helper
  const addLogEntry = (
    action: string,
    details: string,
    type: ActivityLog["type"] = "status_change",
  ) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userName: currentUser?.name || "مستخدم النظام",
      userRole: currentUser?.roleName || "عضو",
      action,
      details,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      type,
    };
    const updated = [newLog, ...activityLogs];
    setActivityLogs(updated);
    saveLocalActivityLogs(updated);
    pushActivityLogToSupabase(newLog);
  };

  // User Management Actions
  const handleAddUser = (newUser: UserSession) => {
    const updated = [newUser, ...users];
    setUsers(updated);
    saveLocalUsers(updated);
    if (!integratedMode) pushUserToSupabase(newUser);

    addLogEntry(
      "إضافة عضو جديد",
      `تمت إضافة العضو (${newUser.name}) برتبة (${newUser.roleName}) وكود (${newUser.code})`,
    );
    addToast(
      "عضو جديد 👤",
      `تمت إضافة العضو (${newUser.name}) وتوليد رمز الوصول الخاص به بنجاح`,
      "success",
    );
  };

  const handleUpdateUser = async (updatedUser: UserSession) => {
    // 1. Immediately update local state
    const updated = users.map((u) =>
      u.id === updatedUser.id ? updatedUser : u,
    );
    setUsers(updated);
    saveLocalUsers(updated);

    // 2. Always persist to Supabase & localStorage
    pushUserToSupabase(updatedUser);

    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem("insat_user_session", JSON.stringify(updatedUser));
      } catch (e) {
        // ignore
      }
    }

    // 3. Sync via dedicated tasks profile endpoint (open to all roles)
    try {
      await fetch(
        `/api/tasks/members/${encodeURIComponent(updatedUser.id)}/profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updatedUser.name,
            phone: updatedUser.whatsapp,
            whatsapp: updatedUser.whatsapp,
            country: updatedUser.country,
            departmentName: updatedUser.departmentName,
            roleName: updatedUser.roleName,
            code: updatedUser.code,
            bio: updatedUser.bio,
            user: updatedUser,
          }),
        },
      );
    } catch (e) {
      console.warn("Tasks member profile sync warning:", e);
    }

    // 4. If integrated mode, sync to admin API as well
    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        await fetch(`/api/admin/users/${encodeURIComponent(updatedUser.id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: updatedUser.name,
            phone: updatedUser.whatsapp,
            country: updatedUser.country,
            department: updatedUser.departmentName,
            role: updatedUser.canonicalRole || updatedUser.roleName,
            code: updatedUser.code,
            bio: updatedUser.bio,
          }),
        });
      } catch (error) {
        console.warn("Admin user sync warning:", error);
      }
    }

    const updatedTasks = tasks.map((t) => {
      if (t.memberId === updatedUser.id) {
        return {
          ...t,
          memberName: updatedUser.name,
          country: updatedUser.country,
          departmentName: updatedUser.departmentName || t.departmentName,
        };
      }
      return t;
    });
    setTasks(updatedTasks);
    saveLocalTasks(updatedTasks);

    addLogEntry(
      "تحديث الملف الشخصي",
      `تم تعديل بيانات وملف العضو (${updatedUser.name}) بنجاح`,
    );
    addToast(
      "تعديل الملف الشخصي ✏️",
      `تم حفظ وتحديث بيانات العضو (${updatedUser.name}) بنجاح`,
      "success",
    );
  };

  const handleUpdateUserCode = (userId: string, newCode: string) => {
    const updated = users.map((u) =>
      u.id === userId ? { ...u, code: newCode } : u,
    );
    setUsers(updated);
    saveLocalUsers(updated);

    const userObj = updated.find((u) => u.id === userId);
    if (userObj) pushUserToSupabase(userObj);

    addLogEntry(
      "تحديث كود الوصول",
      `تم تعديل رمز الوصول الخاص بـ (${userObj?.name || userId}) إلى (${newCode})`,
    );
    addToast(
      "تعديل كود الوصول 🔑",
      `تم تحديث كود الوصول للعضو (${userObj?.name || ""}) بنجاح`,
      "info",
    );
  };

  const handleUpdateUserPermissions = async (
    userId: string,
    permissions: UserPermissions,
  ) => {
    const updated = users.map((u) =>
      u.id === userId ? { ...u, permissions } : u,
    );
    setUsers(updated);
    saveLocalUsers(updated);

    const userObj = updated.find((u) => u.id === userId);
    if (userObj) {
      pushUserToSupabase(userObj);
      if (currentUser && currentUser.id === userId) {
        const updatedCurrent = { ...currentUser, permissions };
        setCurrentUser(updatedCurrent);
        try {
          localStorage.setItem(
            "insat_user_session",
            JSON.stringify(updatedCurrent),
          );
        } catch (e) {
          // ignore
        }
      }
    }

    // Call dedicated tasks member permissions endpoint (authoritative)
    try {
      await fetch(
        `/api/tasks/members/${encodeURIComponent(userId)}/permissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            permissions,
            custom_permissions: permissions,
            user: userObj,
          }),
        },
      );
    } catch (e) {
      console.warn("Tasks member permissions sync warning:", e);
    }

    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const platformAccess = {
          recording: Boolean(permissions.canAccessRecordingSite),
          admin: Boolean(permissions.canAccessAdminPanel),
          tasks: true,
          rewards: true,
        };
        const response = await fetch(
          `/api/admin/users/${encodeURIComponent(userId)}/platform-access`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              platformAccess,
              permissions,
              custom_permissions: permissions,
            }),
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          console.warn("Platform access backend warning:", payload?.error);
        }
      } catch (error) {
        console.warn("Platform access sync error:", error);
      }
    }

    addLogEntry(
      "تحديث صلاحيات عضو",
      `تم تعديل الصلاحيات المخصصة لـ (${userObj?.name || userId})`,
    );
    addToast(
      "تحديث الصلاحيات 🛡️",
      `تم الحفظ بنجاح لعضو (${userObj?.name || ""})`,
      "success",
    );
  };

  const handleBulkUpdateUserPermissions = async (
    userIds: string[],
    permissions: UserPermissions,
  ) => {
    const updated = users.map((u) => {
      if (userIds.includes(u.id)) {
        return { ...u, permissions };
      }
      return u;
    });
    setUsers(updated);
    saveLocalUsers(updated);

    updated
      .filter((u) => userIds.includes(u.id))
      .forEach((u) => {
        pushUserToSupabase(u);
        if (currentUser && currentUser.id === u.id) {
          const updatedCurrent = { ...currentUser, permissions };
          setCurrentUser(updatedCurrent);
          try {
            localStorage.setItem(
              "insat_user_session",
              JSON.stringify(updatedCurrent),
            );
          } catch (e) {
            // ignore
          }
        }
      });

    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const platformAccess = {
          recording: Boolean(permissions.canAccessRecordingSite),
          admin: Boolean(permissions.canAccessAdminPanel),
          tasks: true,
          rewards: true,
        };
        await Promise.all(
          userIds.map(async (userId) => {
            const response = await fetch(
              `/api/admin/users/${encodeURIComponent(userId)}/platform-access`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  platformAccess,
                  permissions,
                  custom_permissions: permissions,
                }),
              },
            );
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
              console.warn(
                `Bulk update user ${userId} warning:`,
                payload?.error,
              );
            }
          }),
        );
      } catch (error) {
        console.warn("Bulk platform access sync error:", error);
      }
    }

    addLogEntry(
      "تحديث صلاحيات جماعي",
      `تم تحديث الصلاحيات المخصصة لعدد (${userIds.length}) أعضاء بنجاح`,
    );
    addToast(
      "تحديث جماعي للصلاحيات ⚡",
      `تم تطبيق الصلاحيات الجديدة على (${userIds.length}) عضو بنجاح`,
      "success",
    );
  };

  const handleResetNonAdminUsers = () => {
    const updated = users.map((u) => {
      if (!u.isAdmin) {
        return {
          ...u,
          permissions: {},
        };
      }
      return u;
    });
    setUsers(updated);
    saveLocalUsers(updated);

    updated.forEach((u) => pushUserToSupabase(u));

    addLogEntry(
      "إعادة تعيين رتب الأعضاء",
      "تم سحب كافة الصلاحيات من الأعضاء غير الإداريين",
    );
    addToast(
      "تحديث الصلاحيات 🔄",
      "تم سحب كافة الصلاحيات من الأعضاء غير الإداريين",
      "info",
    );
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) return;

    const newStatus =
      userToDelete.status === "disabled" ? "active" : "disabled";

    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const response = await fetch(
          `/api/admin/users/${encodeURIComponent(userId)}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(payload?.error || "تعذر تغيير حالة الحساب");
      } catch (error) {
        addToast(
          "تعذر تغيير حالة الحساب",
          error instanceof Error ? error.message : "فشل الاتصال بالخادم",
          "alert",
        );
        return;
      }
    }
    const updated = users.map((u) =>
      u.id === userId ? { ...u, status: newStatus } : u,
    );
    setUsers(updated);
    saveLocalUsers(updated);
    if (!integratedMode)
      pushUserToSupabase({ ...userToDelete, status: newStatus });

    addLogEntry(
      newStatus === "disabled" ? "تعطيل عضو" : "تفعيل عضو",
      `تم ${newStatus === "disabled" ? "تعطيل" : "تفعيل"} حساب العضو (${userToDelete.name}) مع حفظ سجلاته`,
    );
    addToast(
      newStatus === "disabled" ? "تعطيل حساب عضو" : "تفعيل حساب عضو",
      `تم ${newStatus === "disabled" ? "تعطيل" : "تفعيل"} حساب (${userToDelete.name})`,
      newStatus === "disabled" ? "warning" : "success",
    );
  };

  // Department Management Actions
  const handleAddDepartment = (newDept: DepartmentInfo) => {
    const updated = [...departments, newDept];
    setDepartments(updated);
    saveLocalDepartments(updated);
    pushDepartmentToSupabase(newDept);

    addLogEntry(
      "إضافة قسم جديد",
      `تم إنشاء القسم الجديد (${newDept.name}) بقيادة (${newDept.leader})`,
    );
    addToast(
      "قسم جديد 🏢",
      `تمت إضافة قسم (${newDept.name}) بنجاح لتشكيلات المبادرة`,
      "success",
    );
  };

  const handleDeleteDepartment = (deptId: string) => {
    const deptToDelete = departments.find((d) => d.id === deptId);
    const updated = departments.filter((d) => d.id !== deptId);
    setDepartments(updated);
    saveLocalDepartments(updated);
    deleteDepartmentFromSupabase(deptId);

    if (deptToDelete) {
      addLogEntry(
        "حذف قسم",
        `تم حذف القسم (${deptToDelete.name}) من قائمة الأقسام`,
      );
      addToast(
        "حذف قسم 🗑️",
        `تم إزالة قسم (${deptToDelete.name}) من النظام`,
        "warning",
      );
    }
  };

  // Drive Folder Management Actions
  const handleAddCloudFolder = (newFolder: CloudFolder) => {
    const updated = [newFolder, ...cloudFolders];
    setCloudFolders(updated);
    saveLocalCloudFolders(updated);
    pushCloudFolderToSupabase(newFolder);

    addLogEntry(
      "إضافة مجلد درايف",
      `تم إضافة المجلد السحابي الجديد "${newFolder.title}" (${newFolder.departmentName})`,
    );
    addToast(
      "مجلد Google Drive جديد 📁",
      `تم ربط المجلد السحابي "${newFolder.title}" بالأرشيف`,
      "success",
    );
  };

  const handleUpdateFolderUrl = (folderId: string, newUrl: string) => {
    const updated = cloudFolders.map((f) =>
      f.id === folderId ? { ...f, url: newUrl } : f,
    );
    setCloudFolders(updated);
    saveLocalCloudFolders(updated);

    const folderObj = updated.find((f) => f.id === folderId);
    if (folderObj) pushCloudFolderToSupabase(folderObj);

    addLogEntry(
      "تحديث رابط درايف",
      `تم تحديث رابط Google Drive للمجلد "${folderObj?.title || folderId}"`,
    );
    addToast(
      "تحديث رابط Google Drive 🔗",
      `تم حفظ الرابط السحابي الجديد بنجاح`,
      "info",
    );
  };

  const handleDeleteCloudFolder = (folderId: string) => {
    const folderToDelete = cloudFolders.find((f) => f.id === folderId);
    const updated = cloudFolders.filter((f) => f.id !== folderId);
    setCloudFolders(updated);
    saveLocalCloudFolders(updated);
    deleteCloudFolderFromSupabase(folderId);

    if (folderToDelete) {
      addLogEntry(
        "حذف مجلد درايف",
        `تم إزالة المجلد السحابي "${folderToDelete.title}" من الأرشيف`,
      );
      addToast(
        "حذف مجلد درايف 🗑️",
        `تم حذف المجلد السحابي "${folderToDelete.title}"`,
        "warning",
      );
    }
  };

  const handleLoginSuccess = (user: UserSession) => {
    setCurrentUser(user);
    localStorage.setItem("insat_user_session", JSON.stringify(user));
    setIsLoginModalOpen(false);
    addLogEntry(
      "تسجيل دخول",
      `تم تسجيل الدخول بواسطة رمز الوصول الخاص بـ (${user.name})`,
    );
    addToast(
      "تسجيل الدخول ناجح 🔑",
      `مرحباً بك (${user.name}) في لوحة تحكم منصة إنصات`,
      "info",
    );
  };

  const handleLogout = async () => {
    if (currentUser) {
      addLogEntry(
        "تسجيل خروج",
        `تم تسجيل الخروج للمستخدم (${currentUser.name})`,
      );
    }
    setCurrentUser(null);
    localStorage.removeItem("insat_user_session");
    if (onUnifiedLogout) {
      await onUnifiedLogout();
      window.location.assign("/login");
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleAddTask = async (newTask: TeamTask) => {
    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const priority =
          newTask.priority === "عالية"
            ? "HIGH"
            : newTask.priority === "منخفضة"
              ? "LOW"
              : "NORMAL";
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: newTask.title,
            description: newTask.description,
            assigneeUids: [newTask.memberId],
            memberId: newTask.memberId,
            memberName: newTask.memberName,
            departmentName: newTask.departmentName,
            country: newTask.country,
            priority,
            dueDate: newTask.deadline,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(payload?.error || "تعذر إنشاء المهمة");
        newTask = {
          ...newTask,
          id: payload.task?.id || newTask.id,
          status: "قيد التنفيذ",
          progress: 25,
        };
      } catch (error) {
        addToast(
          "تعذر إنشاء المهمة",
          error instanceof Error ? error.message : "فشل الاتصال بالخادم",
          "alert",
        );
        return;
      }
    }
    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveLocalTasks(updated);
    if (!integratedMode) pushTaskToSupabase(newTask);

    addLogEntry(
      "إسناد مهمة جديدة",
      `تم إسناد مهمة "${newTask.title}" للعضو (${newTask.memberName})`,
    );
    addToast(
      "تنبيه مهمة جديدة 🔔",
      `تم إسناد مهمة جديدة: "${newTask.title}" للعضو (${newTask.memberName})`,
      "info",
    );
  };

  const archivingRef = useRef<Set<string>>(new Set());

  const handleDeleteTask = async (taskId: string) => {
    if (archivingRef.current.has(taskId)) return;
    archivingRef.current.add(taskId);
    try {
      if (integratedMode) {
        const token = await unifiedAuthService.token();
        const response = await fetch(
          `/api/tasks/${encodeURIComponent(taskId)}/archive`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          if (response.status === 404) {
            setTasks((prev) => prev.filter((t) => t.id !== taskId));
            addToast(
              "المهمة غير متوفرة",
              "هذه المهمة غير موجودة على الخادم",
              "warning",
            );
            return;
          }
          throw new Error(payload?.error || "تعذر أرشفة المهمة");
        }
      } else {
        deleteTaskFromSupabase(taskId);
      }

      const taskToDelete = tasks.find((task) => task.id === taskId);
      setTasks((prev) => {
        const updated = prev.map((task) =>
          task.id === taskId
            ? { ...task, isArchived: true, status: "ARCHIVED" as TaskStatus }
            : task,
        );
        if (!integratedMode) saveLocalTasks(updated);
        return updated;
      });
      if (taskToDelete) {
        addLogEntry(
          "أرشفة مهمة",
          `تمت أرشفة المهمة "${taskToDelete.title}" الموكلة لـ (${taskToDelete.memberName})`,
        );
        addToast(
          "أرشفة مهمة 📦",
          `تمت أرشفة مهمة "${taskToDelete.title}" بنجاح`,
          "success",
        );
      }
    } catch (error: any) {
      console.warn("[handleDeleteTask] archive error:", error);
      addToast(
        "تعذر أرشفة المهمة",
        error?.message || "تحقق من اتصال الخادم وصلاحياتك ثم أعد المحاولة",
        "alert",
      );
    } finally {
      archivingRef.current.delete(taskId);
    }
  };

  const handleBulkDeleteTasks = async (taskIds: string[]) => {
    if (!taskIds || taskIds.length === 0) return;
    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const response = await fetch("/api/tasks/bulk-archive", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ taskIds }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(payload?.error || "تعذر أرشفة المهام");
      } catch (error: any) {
        addToast(
          "تعذر أرشفة المهام",
          error?.message || "تحقق من الصلاحيات والاتصال",
          "alert",
        );
        return;
      }
    }
    const count = taskIds.length;
    const idSet = new Set(taskIds);

    // Atomic update of state & local storage
    setTasks((prev) => {
      const updated = prev.map((t) =>
        idSet.has(t.id)
          ? { ...t, isArchived: true, status: "ARCHIVED" as TaskStatus }
          : t,
      );
      if (!integratedMode) saveLocalTasks(updated);
      return updated;
    });

    addLogEntry(
      "أرشفة مجمعة للمهام",
      `تمت أرشفة (${count}) مهام بنجاح من الجدول`,
    );
    addToast("أرشفة مجمعة 📦", `تمت أرشفة ${count} مهام بنجاح`, "success");

    if (!integratedMode) {
      taskIds.forEach((id) => deleteTaskFromSupabase(id));
    }
  };

  const handleBulkRestoreTasks = async (taskIds: string[]) => {
    if (!taskIds || taskIds.length === 0) return;
    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const response = await fetch("/api/tasks/bulk-restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ taskIds }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(payload?.error || "تعذر استعادة المهام");
      } catch (error: any) {
        addToast(
          "تعذر استعادة المهام",
          error?.message || "تحقق من الصلاحيات والاتصال",
          "alert",
        );
        return;
      }
    }
    const count = taskIds.length;
    const idSet = new Set(taskIds);

    setTasks((prev) => {
      const updated = prev.map((t) =>
        idSet.has(t.id)
          ? { ...t, isArchived: false, status: "قيد التنفيذ" as TaskStatus }
          : t,
      );
      if (!integratedMode) saveLocalTasks(updated);
      return updated;
    });

    addLogEntry(
      "استعادة مجمعة للمهام",
      `تمت استعادة (${count}) مهام من الأرشيف`,
    );
    addToast(
      "استعادة مهام 🔄",
      `تمت استعادة ${count} مهام من الأرشيف بنجاح`,
      "success",
    );
  };

  const handlePermanentDeleteTask = async (taskId: string) => {
    let deletedTask: TeamTask | undefined;
    setTasks((prev) => {
      deletedTask = prev.find((t) => t.id === taskId);
      const updated = prev.filter((t) => t.id !== taskId);
      saveLocalTasks(updated);
      return updated;
    });

    if (deletedTask) {
      addLogEntry(
        "حذف نهائي لمهمة",
        `تم حذف المهمة "${deletedTask.title}" نهائياً من قاعدة البيانات`,
      );
      addToast(
        "حذف نهائي 🗑️",
        `تم حذف مهمة "${deletedTask.title}" نهائياً بنجاح`,
        "info",
      );
    }

    deleteTaskFromSupabase(taskId);
    try {
      const token = await unifiedAuthService.token();
      await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.warn("[handlePermanentDeleteTask] delete error:", err);
    }
  };

  const handleBulkPermanentDeleteTasks = async (taskIds: string[]) => {
    if (!taskIds || taskIds.length === 0) return;
    const count = taskIds.length;
    const idSet = new Set(taskIds);

    setTasks((prev) => {
      const updated = prev.filter((t) => !idSet.has(t.id));
      saveLocalTasks(updated);
      return updated;
    });

    addLogEntry(
      "حذف نهائي مجمع للمهام",
      `تم حذف (${count}) مهام نهائياً من قاعدة البيانات`,
    );
    addToast("حذف نهائي 🗑️", `تم حذف ${count} مهام نهائياً بنجاح`, "info");

    bulkDeleteTasksFromSupabase(taskIds);
    try {
      const token = await unifiedAuthService.token();
      await fetch("/api/tasks/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ taskIds }),
      });
    } catch (err) {
      console.warn("[Tasks] Bulk permanent delete notice:", err);
    }
  };

  const handleBulkUpdateStatus = async (
    taskIds: string[],
    newStatus: TaskStatus,
  ) => {
    if (!taskIds || taskIds.length === 0) return;
    const count = taskIds.length;
    const idSet = new Set(taskIds);
    const isCompleted = newStatus === "مكتمل" || newStatus === "مكتملة";

    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (idSet.has(t.id)) {
          return {
            ...t,
            status: newStatus,
            progress: isCompleted
              ? 100
              : newStatus === "قيد التنفيذ"
                ? 60
                : t.progress,
            completedAt: isCompleted ? new Date().toISOString() : t.completedAt,
          };
        }
        return t;
      });
      saveLocalTasks(updated);
      return updated;
    });

    addLogEntry(
      "تحديث جماعي لحالة المهام",
      `تم تحديث حالة (${count}) مهام إلى (${newStatus})`,
    );
    addToast(
      "تحديث حالة المهام 📝",
      `تم تحديث حالة ${count} مهام إلى (${newStatus})`,
      "info",
    );

    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const response = await fetch("/api/tasks/bulk-status", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ taskIds, status: newStatus }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          const status = isCompleted
            ? "COMPLETED"
            : newStatus === "متأخر"
              ? "BLOCKED"
              : "IN_PROGRESS";
          await Promise.allSettled(
            taskIds.map((id) =>
              fetch(`/api/tasks/${encodeURIComponent(id)}/status`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status }),
              }),
            ),
          );
        }
      } catch (err) {
        console.warn("[Tasks] Bulk status update notice:", err);
      }
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    let taskToRestore: TeamTask | undefined;
    setTasks((prev) => {
      taskToRestore = prev.find((t) => t.id === taskId);
      const updated = prev.map((t) =>
        t.id === taskId
          ? { ...t, isArchived: false, status: "قيد التنفيذ" as TaskStatus }
          : t,
      );
      saveLocalTasks(updated);
      return updated;
    });

    if (taskToRestore) {
      addLogEntry(
        "استعادة مهمة",
        `تمت استعادة المهمة "${taskToRestore.title}" من الأرشيف`,
      );
      addToast(
        "استعادة مهمة 🔄",
        `تمت استعادة مهمة "${taskToRestore.title}" بنجاح`,
        "success",
      );
    }

    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const response = await fetch(
          `/api/tasks/${encodeURIComponent(taskId)}/restore`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "تعذر استعادة المهمة");
        }
      } catch (error) {
        console.warn("[handleRestoreTask] notice:", error);
      }
    }
  };

  const handleEditTaskDeadline = async (
    taskId: string,
    newDeadline: string,
  ) => {
    const cleanDate = normalizeDateForInput(newDeadline) || newDeadline;
    let taskToUpdate: TeamTask | undefined;
    setTasks((prev) => {
      taskToUpdate = prev.find((t) => t.id === taskId);
      if (!taskToUpdate) return prev;
      const updatedTask = { ...taskToUpdate, deadline: cleanDate };
      const updated = prev.map((t) => (t.id === taskId ? updatedTask : t));
      saveLocalTasks(updated);
      pushTaskToSupabase(updatedTask);
      return updated;
    });

    if (taskToUpdate) {
      addLogEntry(
        "تعديل الديدلاين",
        `تم تعديل ديدلاين مهمة "${taskToUpdate.title}" إلى ${cleanDate}`,
      );
      addToast(
        "تعديل الديدلاين 📅",
        `تم تعديل الموعد النهائي للمهمة بنجاح`,
        "success",
      );
    }

    try {
      const token = await unifiedAuthService.token();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ dueDate: cleanDate, deadline: cleanDate }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        if (response.status === 404) {
          setTasks((prev) => {
            const updated = prev.filter((t) => t.id !== taskId);
            saveLocalTasks(updated);
            return updated;
          });
          addToast(
            "المهمة غير متوفرة",
            "تمت إزالة المهمة لأنها لم تعد موجودة على الخادم",
            "info",
          );
          return;
        }
        throw new Error(payload?.error || "تعذر تعديل الموعد");
      }
    } catch (error) {
      console.warn("[handleEditTaskDeadline] notice:", error);
    }
  };

  const handleStatusChangeRequest = (task: TeamTask, newStatus: TaskStatus) => {
    if (newStatus === "مكتمل" || newStatus === "مكتملة") {
      setCompletionModalState({
        isOpen: true,
        task,
        pendingStatus: newStatus,
      });
    } else {
      executeStatusUpdate(task.id, newStatus);
    }
  };

  const executeStatusUpdate = async (
    taskId: string,
    newStatus: TaskStatus,
    note?: string,
  ) => {
    let targetTaskToPush: TeamTask | null = null;
    const isCompleted = newStatus === "مكتمل" || newStatus === "مكتملة";

    setTasks((prev) => {
      const updatedTasks = prev.map((task) => {
        if (task.id === taskId) {
          const updated = {
            ...task,
            status: newStatus,
            progress: isCompleted
              ? 100
              : newStatus === "قيد التنفيذ"
                ? 60
                : task.progress,
            completionNote: note || task.completionNote,
            completedAt: isCompleted
              ? new Date().toISOString()
              : task.completedAt,
          };
          targetTaskToPush = updated;

          addLogEntry(
            "تحديث حالة المهمة",
            `تغيير حالة مهمة "${task.title}" إلى (${newStatus})${note ? ` مع ملاحظة: "${note}"` : ""}`,
          );

          if (isCompleted) {
            addToast(
              "🎉 إنجاز مهمة مكتملة",
              `قام العضو (${task.memberName}) بتسليم وإكمال مهمة "${task.title}" بنجاح!`,
              "success",
            );
          } else {
            addToast(
              "تحديث حالة المهمة 📝",
              `تغيرت حالة "${task.title}" إلى (${newStatus})`,
              "info",
            );
          }

          return updated;
        }
        return task;
      });
      saveLocalTasks(updatedTasks);
      return updatedTasks;
    });

    if (integratedMode) {
      try {
        const token = await unifiedAuthService.token();
        const status = isCompleted
          ? "COMPLETED"
          : newStatus === "بانتظار التسجيل"
            ? "IN_REVIEW"
            : newStatus === "متأخر"
              ? "BLOCKED"
              : "IN_PROGRESS";
        const response = await fetch(
          `/api/tasks/${encodeURIComponent(taskId)}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status, note }),
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          if (response.status === 404) {
            setTasks((prev) => {
              const updated = prev.filter((t) => t.id !== taskId);
              saveLocalTasks(updated);
              return updated;
            });
            addToast(
              "المهمة غير متوفرة",
              "تمت إزالة المهمة لأنها لم تعد موجودة على الخادم",
              "info",
            );
            return;
          }
          throw new Error(payload?.error || "تعذر تحديث الحالة");
        }
      } catch (error) {
        console.warn("[executeStatusUpdate] notice:", error);
      }
    } else if (targetTaskToPush) {
      pushTaskToSupabase(targetTaskToPush);
    }
  };

  const handleConfirmCompletionNote = (note: string) => {
    if (completionModalState.task && completionModalState.pendingStatus) {
      executeStatusUpdate(
        completionModalState.task.id,
        completionModalState.pendingStatus,
        note,
      );
    }
    setCompletionModalState({ isOpen: false, task: null, pendingStatus: null });
  };

  const handleOpenFolder = (folder: CloudFolder) => {
    setSelectedCloudFolder(folder);
    addLogEntry(
      "استعراض الأرشيف السحابي",
      `تم فتح المجلد السحابي "${folder.title}" (${folder.departmentName})`,
      "folder_access",
    );
  };

  const handleUpdateAnnouncement = (newAnnouncement: string) => {
    setAnnouncement(newAnnouncement);
    saveLocalAnnouncement(newAnnouncement);
    pushAnnouncementToSupabase(newAnnouncement);
    addLogEntry("تحديث الشريط الإداري", `تم تحديث نص التوجه الإداري العام`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Tajawal','Cairo',sans-serif] selection:bg-amber-500/30 selection:text-amber-200">
      {/* Fixed Header Navigation */}
      <Navbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Main Internal Member/Admin Dashboard */}
      <main className="space-y-0">
        {/* 1. Administrative Banner */}
        <HeroSection
          currentUser={currentUser}
          tasks={tasks}
          announcement={announcement}
          onAddTaskClick={() => setIsAddTaskModalOpen(true)}
        />

        {/* 2. Admin Control Panel (Admins or users with specific permissions) */}
        {(currentUser?.isAdmin ||
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
          currentUser?.permissions?.canManageSupabase) && (
          <AdminPanel
            currentUser={currentUser}
            tasks={tasks}
            activityLogs={activityLogs}
            announcement={announcement}
            users={users}
            departments={departments}
            cloudFolders={cloudFolders}
            requests={requests}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onUpdateUserCode={handleUpdateUserCode}
            onUpdateUserPermissions={handleUpdateUserPermissions}
            onBulkUpdatePermissions={handleBulkUpdateUserPermissions}
            onResetNonAdminUsers={handleResetNonAdminUsers}
            onDeleteUser={handleDeleteUser}
            onAddDepartment={handleAddDepartment}
            onDeleteDepartment={handleDeleteDepartment}
            onAddCloudFolder={handleAddCloudFolder}
            onUpdateFolderUrl={handleUpdateFolderUrl}
            onDeleteCloudFolder={handleDeleteCloudFolder}
            onUpdateRequestStatus={(requestId, newStatus, reply) => {
              const updated = requests.map((r) =>
                r.id === requestId
                  ? { ...r, status: newStatus, adminReply: reply }
                  : r,
              );
              setRequests(updated);
              saveLocalRequests(updated);
              pushRequestsToSupabase();

              const req = requests.find((r) => r.id === requestId);
              if (req) {
                addLogEntry(
                  "تحديث حالة طلب",
                  `تم ${newStatus} لطلب العضو (${req.userName})`,
                );
              }
            }}
            onSyncRefresh={reloadAllFromLocal}
          />
        )}

        {/* 3. Tasks Tracker Dashboard */}
        <TeamDashboard
          tasks={tasks}
          currentUser={currentUser}
          onAddTaskClick={() => setIsAddTaskModalOpen(true)}
          onUpdateTaskStatus={(taskId, newStatus) => {
            const task = tasks.find((t) => t.id === taskId);
            if (task) handleStatusChangeRequest(task, newStatus);
          }}
          onDeleteTask={handleDeleteTask}
          onRestoreTask={handleRestoreTask}
          onBulkDeleteTasks={handleBulkDeleteTasks}
          onBulkRestoreTasks={handleBulkRestoreTasks}
          onBulkUpdateStatus={handleBulkUpdateStatus}
          onPermanentDeleteTask={handlePermanentDeleteTask}
          onBulkPermanentDeleteTasks={handleBulkPermanentDeleteTasks}
          onEditTaskDeadline={handleEditTaskDeadline}
          onStatusChangeRequest={handleStatusChangeRequest}
          onRequestClick={() => setIsRequestModalOpen(true)}
        />

        {/* 4. Recording Platform Access (for Narrators & Members) */}
        {currentUser?.permissions?.canAccessRecordingSite !== false &&
          currentUser?.actionAccess?.canAccessRecordingSite !== "DENY" &&
          currentUser?.actionAccess?.recording !== "DENY" && (
            <section
              id="recording-platform"
              className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto font-['Cairo']"
              dir="rtl"
            >
              <div className="bg-slate-900/60 border border-amber-500/30 rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                <div className="relative z-10 space-y-4">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                    <span className="text-3xl">🎙️</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    منصة التسجيل الخاصة بالرواة
                  </h2>
                  <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
                    هذه المساحة مخصصة للرواة وأعضاء قسم الهندسة الصوتية. يمكنك
                    الدخول لمنصة التسجيل الخاصة لتسجيل ورفع الحلقات والأعمال
                    الصوتية مباشرة.
                  </p>
                  <div className="pt-4">
                    <a
                      href="/recording"
                      className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:-translate-y-0.5"
                    >
                      <span>الدخول لمنصة التسجيل</span>
                      <span className="text-lg">↗️</span>
                    </a>
                  </div>
                </div>
              </div>
            </section>
          )}

        {/* 5. Cloud Archive Folders (Google Drive Quick Access) */}
        {(currentUser?.isAdmin ||
          (currentUser?.permissions?.canAccessDrive !== false &&
            currentUser?.actionAccess?.canAccessDrive !== "DENY")) && (
          <CloudArchive
            currentUser={currentUser}
            folders={cloudFolders}
            onOpenFolderModal={handleOpenFolder}
            onUpdateFolderUrl={handleUpdateFolderUrl}
          />
        )}
      </main>

      {/* Footer */}
      <Footer setActiveSection={setActiveSection} />

      {/* Login / Access Code Modal */}
      {!integratedMode && (isLoginModalOpen || !currentUser) && (
        <LoginModal
          announcement={announcement}
          users={users}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        users={users}
        currentUser={currentUser}
        onClose={() => setIsAddTaskModalOpen(false)}
        onAddTask={handleAddTask}
      />

      {/* Folder Inspection Modal */}
      <FolderModal
        folder={selectedCloudFolder}
        onClose={() => setSelectedCloudFolder(null)}
      />

      {/* Completion Note Modal */}
      <CompletionNoteModal
        isOpen={completionModalState.isOpen}
        taskTitle={completionModalState.task?.title || ""}
        onClose={() =>
          setCompletionModalState({
            isOpen: false,
            task: null,
            pendingStatus: null,
          })
        }
        onConfirm={handleConfirmCompletionNote}
      />

      {/* User Request Modal */}
      <RequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        currentUser={currentUser}
        onSubmit={handleSubmitRequest}
      />

      {/* Global User Profile Modal (Open for all members & roles) */}
      {currentUser && (
        <EditProfileModal
          currentUser={currentUser}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={handleUpdateUser}
        />
      )}

      {/* Global Toast Notifications */}
      <ToastNotification toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
