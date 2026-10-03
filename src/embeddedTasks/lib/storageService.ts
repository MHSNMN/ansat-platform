// @ts-nocheck
import { createClient } from "../utils/supabase/client";
import {
  UserSession,
  TeamTask,
  DepartmentInfo,
  CloudFolder,
  ActivityLog,
  UserSubmitRequest,
} from "../types";
import {
  AUTHORIZED_USERS,
  DEPARTMENTS,
  CLOUD_FOLDERS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_ANNOUNCEMENT,
} from "../data/mockData";

const KEYS = {
  USERS: "insat_db_users_v2",
  TASKS: "insat_db_tasks_v2",
  DEPARTMENTS: "insat_db_departments_v2",
  CLOUD_FOLDERS: "insat_db_cloud_folders_v2",
  LOGS: "insat_db_logs_v2",
  ANNOUNCEMENT: "insat_db_announcement_v2",
  REQUESTS: "insat_db_requests_v2",
};

/**
 * Normalizes any date string or ISO date to YYYY-MM-DD format for HTML5 date inputs
 * Handles ISO, YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, and DD/MM formats.
 */
export function normalizeDateForInput(val: string | null | undefined): string {
  if (!val || typeof val !== "string") return "";
  const trimmed = val.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes("T")) {
    const datePart = trimmed.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  }
  // YYYY/MM/DD or YYYY-M-D
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, "0")}-${String(ymdMatch[3]).padStart(2, "0")}`;
  }
  // DD/MM/YYYY or MM/DD/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    if (day > 12 && month <= 12) {
      // Confirmed DD/MM/YYYY
    } else if (month > 12 && day <= 12) {
      // Confirmed MM/DD/YYYY
      const tmp = day;
      day = month;
      month = tmp;
    }
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  // DD/MM or MM/DD
  const dmMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dmMatch) {
    let day = parseInt(dmMatch[1], 10);
    let month = parseInt(dmMatch[2], 10);
    const y = new Date().getFullYear();
    if (day > 12 && month <= 12) {
      // Day/Month
    } else if (month > 12 && day <= 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

// 1. Initializers with Local Storage Fallback
export function loadLocalUsers(): UserSession[] {
  try {
    const saved = localStorage.getItem(KEYS.USERS);
    if (saved) {
      const parsed: UserSession[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Map of canonical user specs by lowercase whatsapp
        const authMap = new Map(
          AUTHORIZED_USERS.map((u) => [(u.whatsapp || "").toLowerCase(), u]),
        );

        // Update parsed users with updated names, roles, and passcodes from AUTHORIZED_USERS if matched by whatsapp
        const synced = parsed.map((u) => {
          const auth = u.whatsapp
            ? authMap.get(String(u.whatsapp).toLowerCase())
            : undefined;
          if (auth) {
            return {
              ...u,
              name: auth.name,
              roleName: auth.roleName,
              code: auth.code || u.code,
            };
          }
          return u;
        });

        // Also add any missing defaults from AUTHORIZED_USERS
        const existingWhatsapps = new Set(
          synced.map((u) =>
            u.whatsapp ? String(u.whatsapp).toLowerCase() : "",
          ),
        );
        const missingDefaults = AUTHORIZED_USERS.filter(
          (au) => !existingWhatsapps.has((au.whatsapp || "").toLowerCase()),
        );

        const result = [...synced, ...missingDefaults].map((u) => {
          if (!u.isAdmin && !u.migratedPermissions) {
            return { ...u, permissions: {}, migratedPermissions: true };
          }
          return u;
        });

        localStorage.setItem(KEYS.USERS, JSON.stringify(result));
        return result;
      }
    }
  } catch (e) {
    console.warn("Failed reading users from storage", e);
  }

  const defaultUsers = AUTHORIZED_USERS.map((u) => {
    if (!u.isAdmin) {
      return { ...u, permissions: {}, migratedPermissions: true };
    }
    return { ...u, migratedPermissions: true };
  });

  localStorage.setItem(KEYS.USERS, JSON.stringify(defaultUsers));
  return defaultUsers;
}

export function loadLocalTasks(): TeamTask[] {
  try {
    const saved = localStorage.getItem(KEYS.TASKS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Filter out legacy dummy tasks
        return parsed.filter(
          (t) =>
            t &&
            typeof t.id === "string" &&
            !t.id.startsWith("task-login-") &&
            !t.id.startsWith("task-drive-") &&
            !t.id.startsWith("task-1") &&
            !t.id.startsWith("task-2") &&
            !t.id.startsWith("task-3"),
        );
      }
    }
  } catch (e) {
    console.warn("Failed reading tasks from storage", e);
  }
  return [];
}

export function loadLocalDepartments(): DepartmentInfo[] {
  try {
    const saved = localStorage.getItem(KEYS.DEPARTMENTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed reading departments from storage", e);
  }
  localStorage.setItem(KEYS.DEPARTMENTS, JSON.stringify(DEPARTMENTS));
  return DEPARTMENTS;
}

export function loadLocalCloudFolders(): CloudFolder[] {
  try {
    const saved = localStorage.getItem(KEYS.CLOUD_FOLDERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed reading cloud folders from storage", e);
  }
  localStorage.setItem(KEYS.CLOUD_FOLDERS, JSON.stringify(CLOUD_FOLDERS));
  return CLOUD_FOLDERS;
}

export function loadLocalActivityLogs(): ActivityLog[] {
  try {
    const saved = localStorage.getItem(KEYS.LOGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed reading logs from storage", e);
  }
  localStorage.setItem(KEYS.LOGS, JSON.stringify(INITIAL_ACTIVITY_LOGS));
  return INITIAL_ACTIVITY_LOGS;
}

export function loadLocalAnnouncement(): string {
  try {
    const saved = localStorage.getItem(KEYS.ANNOUNCEMENT);
    if (saved) return saved;
  } catch (e) {
    console.warn("Failed reading announcement from storage", e);
  }
  localStorage.setItem(KEYS.ANNOUNCEMENT, INITIAL_ANNOUNCEMENT);
  return INITIAL_ANNOUNCEMENT;
}

export function loadLocalRequests(): UserSubmitRequest[] {
  try {
    const saved = localStorage.getItem(KEYS.REQUESTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Failed reading requests from storage", e);
  }
  localStorage.setItem(KEYS.REQUESTS, JSON.stringify([]));
  return [];
}

// 2. Local Writers with Event Broadcasting
export function saveLocalUsers(users: UserSession[]) {
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  window.dispatchEvent(new CustomEvent("insat_sync_users", { detail: users }));
}

export function saveLocalTasks(tasks: TeamTask[]) {
  localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
  window.dispatchEvent(new CustomEvent("insat_sync_tasks", { detail: tasks }));
}

export function saveLocalDepartments(depts: DepartmentInfo[]) {
  localStorage.setItem(KEYS.DEPARTMENTS, JSON.stringify(depts));
  window.dispatchEvent(
    new CustomEvent("insat_sync_departments", { detail: depts }),
  );
}

export function saveLocalCloudFolders(folders: CloudFolder[]) {
  localStorage.setItem(KEYS.CLOUD_FOLDERS, JSON.stringify(folders));
  window.dispatchEvent(
    new CustomEvent("insat_sync_folders", { detail: folders }),
  );
}

export function saveLocalActivityLogs(logs: ActivityLog[]) {
  localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  window.dispatchEvent(new CustomEvent("insat_sync_logs", { detail: logs }));
}

export function saveLocalAnnouncement(announcement: string) {
  localStorage.setItem(KEYS.ANNOUNCEMENT, announcement);
  window.dispatchEvent(
    new CustomEvent("insat_sync_announcement", { detail: announcement }),
  );
}

export function saveLocalRequests(requests: UserSubmitRequest[]) {
  localStorage.setItem(KEYS.REQUESTS, JSON.stringify(requests));
  window.dispatchEvent(
    new CustomEvent("insat_sync_requests", { detail: requests }),
  );
}

// Helper to push full state slice to Supabase app_state table
async function pushStateSlice(key: string, value: unknown) {
  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("app_state").upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn(`Failed pushing app_state slice ${key}:`, e);
  }
}

// 3. Supabase Integration Layer
export async function syncFromSupabase() {
  let synced = false;

  // 1. Always fetch unified members from server API (/api/tasks/members)
  try {
    const memRes = await fetch("/api/tasks/members?forceRefresh=true");
    if (memRes.ok) {
      const memData = await memRes.json().catch(() => null);
      if (
        memData?.success &&
        Array.isArray(memData.members) &&
        memData.members.length > 0
      ) {
        const existingUsers = loadLocalUsers();
        const merged = memData.members.map((remote: any) => {
          const remoteId = remote.id || remote.uid;
          const remotePhoneOrEmail =
            remote.whatsapp || remote.phone || remote.email || "";
          const local = existingUsers.find(
            (u) =>
              u.id === remoteId ||
              (remotePhoneOrEmail &&
                (u.whatsapp || "").toLowerCase() ===
                  remotePhoneOrEmail.toLowerCase()),
          );
          const hasRemoteCustom =
            remote.permissions && Object.keys(remote.permissions).length > 0;
          const hasLocalCustom =
            local?.permissions && Object.keys(local.permissions).length > 0;
          return {
            id: remoteId,
            canonicalRole:
              remote.canonicalRole ||
              remote.role ||
              local?.canonicalRole ||
              "MEMBER",
            name:
              remote.name ||
              remote.displayName ||
              remote.fullName ||
              local?.name ||
              "عضو إنصات",
            whatsapp: remotePhoneOrEmail || local?.whatsapp || "",
            roleName:
              remote.roleName ||
              remote.roleDisplayAr ||
              remote.roleDisplay ||
              remote.role ||
              local?.roleName ||
              "عضو",
            departmentName:
              remote.departmentName ||
              remote.department ||
              local?.departmentName ||
              "إنصات",
            country:
              remote.country ||
              remote.nationality ||
              local?.country ||
              "الوطن العربي كامل",
            isAdmin: Boolean(
              remote.isAdmin ||
              remote.role === "SUPER_ADMIN" ||
              remote.role === "ADMIN" ||
              local?.isAdmin,
            ),
            code: remote.code || local?.code || "",
            status: remote.status || local?.status || "active",
            actionAccess: remote.actionAccess || local?.actionAccess || {},
            permissions: hasRemoteCustom
              ? remote.permissions
              : hasLocalCustom
                ? local.permissions
                : remote.permissions || {},
            migratedPermissions: true,
          };
        });
        saveLocalUsers(merged);
        synced = true;
      }
    }
  } catch (e) {
    console.warn("Failed to fetch /api/tasks/members:", e);
  }

  // 2. Always fetch tasks from server API (/api/tasks?includeArchived=true)
  try {
    const taskRes = await fetch("/api/tasks?includeArchived=true");
    if (taskRes.ok) {
      const taskData = await taskRes.json().catch(() => null);
      if (taskData?.success && Array.isArray(taskData.tasks)) {
        if (taskData.tasks.length === 0) {
          saveLocalTasks([]);
          synced = true;
        } else {
          const existingTasks = loadLocalTasks();
          const existingMap = new Map(existingTasks.map((t) => [t.id, t]));

          const mapped: TeamTask[] = taskData.tasks.map((t: any) => {
            const rawDeadline = t.deadline || t.dueDate || t.due_date || "";
            const localDeadline = existingMap.get(t.id)?.deadline || "";
            const cleanDeadline =
              normalizeDateForInput(rawDeadline) ||
              normalizeDateForInput(localDeadline) ||
              rawDeadline ||
              localDeadline ||
              "";
            const isArchived = Boolean(
              t.isArchived ??
              t.is_archived ??
              t.status === "ARCHIVED" ??
              t.status === "مؤرشف",
            );
            return {
              id: t.id,
              memberId: t.memberId || t.assigneeUids?.[0] || "",
              memberName: t.memberName || "عضو إنصات",
              country: t.country || "العراق",
              departmentId: t.departmentId || "general",
              departmentName: t.departmentName || "فريق إنصات التطوعي",
              title: t.title,
              description: t.description || "",
              deadline: cleanDeadline,
              status: isArchived
                ? "ARCHIVED"
                : t.status === "COMPLETED"
                  ? "مكتمل"
                  : t.status === "IN_PROGRESS"
                    ? "قيد التنفيذ"
                    : t.status || "قيد التنفيذ",
              isArchived,
              progress: t.progress || (t.status === "COMPLETED" ? 100 : 30),
              priority:
                t.priority === "HIGH"
                  ? "عالية"
                  : t.priority === "URGENT"
                    ? "حرجة"
                    : t.priority === "LOW"
                      ? "منخفضة"
                      : "متوسطة",
            };
          });
          saveLocalTasks(mapped);
          synced = true;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to fetch /api/tasks:", e);
  }

  // 3. Sync other slices (departments, folders, logs, announcement, requests) via app_state
  const supabase = createClient();
  if (supabase) {
    try {
      const { data: stateRows, error: stateErr } = await supabase
        .from("app_state")
        .select("*");
      if (!stateErr && stateRows && stateRows.length > 0) {
        stateRows.forEach((row: { key: string; value: unknown }) => {
          if (
            row.key === "departments" &&
            Array.isArray(row.value) &&
            row.value.length > 0
          ) {
            saveLocalDepartments(row.value as DepartmentInfo[]);
            synced = true;
          } else if (
            row.key === "cloud_folders" &&
            Array.isArray(row.value) &&
            row.value.length > 0
          ) {
            saveLocalCloudFolders(row.value as CloudFolder[]);
            synced = true;
          } else if (
            row.key === "activity_logs" &&
            Array.isArray(row.value) &&
            row.value.length > 0
          ) {
            saveLocalActivityLogs(row.value as ActivityLog[]);
            synced = true;
          } else if (
            row.key === "announcement" &&
            typeof row.value === "string" &&
            row.value.trim().length > 0
          ) {
            saveLocalAnnouncement(row.value);
            synced = true;
          } else if (row.key === "requests" && Array.isArray(row.value)) {
            saveLocalRequests(row.value as UserSubmitRequest[]);
            synced = true;
          }
        });
      }
    } catch (e) {
      console.warn("app_state sync error:", e);
    }
  }

  return synced;
}

// Push to Supabase helpers
export async function pushUserToSupabase(user: UserSession) {
  const currentUsers = loadLocalUsers();
  await pushStateSlice("users", currentUsers);

  // 1. Send to server backend to sync Firestore and Supabase authoritative profiles
  try {
    await fetch(
      `/api/tasks/members/${encodeURIComponent(user.id)}/permissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissions: user.permissions || {},
          custom_permissions: user.permissions || {},
          user,
        }),
      },
    );
  } catch (e) {
    // Ignore network fallback error
  }

  try {
    await fetch(`/api/tasks/members/${encodeURIComponent(user.id)}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member: user,
      }),
    });
  } catch (e) {
    // Ignore network fallback error
  }

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("users").upsert(user);
  } catch (e) {
    // Ignore relational fallback error
  }
  try {
    const permPayload = {
      permissions: user.permissions || {},
      custom_permissions: user.permissions || {},
      full_name: user.name,
      country: user.country,
    };
    await supabase
      .from("profiles")
      .update(permPayload)
      .or(`id.eq.${user.id},firebase_uid.eq.${user.id}`);

    if (user.whatsapp && user.whatsapp.includes("@")) {
      await supabase
        .from("profiles")
        .update(permPayload)
        .ilike("email", user.whatsapp);
    } else if (user.whatsapp) {
      await supabase
        .from("profiles")
        .update(permPayload)
        .eq("phone", user.whatsapp);
    }
    if (user.name) {
      await supabase
        .from("profiles")
        .update(permPayload)
        .ilike("full_name", user.name);
    }
  } catch (e) {
    // Ignore fallback error
  }
  try {
    await supabase.from("members").upsert({
      name: user.name,
      whatsapp: user.whatsapp,
      code: user.code,
      department: user.departmentName,
      role: user.isAdmin ? "admin" : user.roleName,
    });
  } catch (e) {
    // Ignore fallback error
  }
}

export async function deleteUserFromSupabase(userId: string) {
  const currentUsers = loadLocalUsers();
  await pushStateSlice("users", currentUsers);

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("users").delete().eq("id", userId);
    await supabase.from("members").delete().eq("id", userId);
  } catch (e) {
    // Ignore fallback error
  }
}

export async function pushTaskToSupabase(task: TeamTask) {
  const currentTasks = loadLocalTasks();
  await pushStateSlice("tasks", currentTasks);

  try {
    const priorityMap: Record<string, string> = {
      عالية: "HIGH",
      حرجة: "URGENT",
      منخفضة: "LOW",
      متوسطة: "MEDIUM",
    };
    const statusMap: Record<string, string> = {
      مكتمل: "COMPLETED",
      مكتملة: "COMPLETED",
      "قيد التنفيذ": "IN_PROGRESS",
      معلقة: "OPEN",
      جديدة: "OPEN",
    };

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        title: task.title,
        description: task.description || "",
        memberId: task.memberId,
        memberName: task.memberName,
        departmentName: task.departmentName,
        country: task.country,
        assigneeUids: task.memberId ? [task.memberId] : [],
        deadline: task.deadline,
        dueDate: task.deadline,
        priority: priorityMap[task.priority] || task.priority || "MEDIUM",
        status: statusMap[task.status] || task.status || "OPEN",
      }),
    });
  } catch (e) {
    console.warn("Failed pushing task to API:", e);
  }
}

export async function deleteTaskFromSupabase(taskId: string) {
  // 1. Remove from local storage immediately so no stale reload brings it back
  const currentTasks = loadLocalTasks().filter((t) => t.id !== taskId);
  saveLocalTasks(currentTasks);
  await pushStateSlice("tasks", currentTasks);

  // 2. Call backend DELETE endpoint
  try {
    await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.warn("Failed deleting task from API:", e);
  }
}

export async function bulkDeleteTasksFromSupabase(taskIds: string[]) {
  if (!taskIds || taskIds.length === 0) return;
  const idSet = new Set(taskIds);
  // 1. Remove from local storage immediately
  const currentTasks = loadLocalTasks().filter((t) => !idSet.has(t.id));
  saveLocalTasks(currentTasks);
  await pushStateSlice("tasks", currentTasks);

  // 2. Call backend bulk-delete endpoint
  try {
    await fetch("/api/tasks/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds }),
    });
  } catch (e) {
    console.warn("Failed bulk deleting tasks from API:", e);
  }
}

export async function pushDepartmentToSupabase(dept: DepartmentInfo) {
  const currentDepts = loadLocalDepartments();
  await pushStateSlice("departments", currentDepts);

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("departments").upsert(dept);
  } catch (e) {
    // Ignore fallback error
  }
}

export async function deleteDepartmentFromSupabase(deptId: string) {
  const currentDepts = loadLocalDepartments();
  await pushStateSlice("departments", currentDepts);

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("departments").delete().eq("id", deptId);
  } catch (e) {
    // Ignore fallback error
  }
}

export async function pushCloudFolderToSupabase(folder: CloudFolder) {
  const currentFolders = loadLocalCloudFolders();
  await pushStateSlice("cloud_folders", currentFolders);

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("cloud_folders").upsert(folder);
  } catch (e) {
    // Ignore fallback error
  }
}

export async function deleteCloudFolderFromSupabase(folderId: string) {
  const currentFolders = loadLocalCloudFolders();
  await pushStateSlice("cloud_folders", currentFolders);

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("cloud_folders").delete().eq("id", folderId);
  } catch (e) {
    // Ignore fallback error
  }
}

export async function pushActivityLogToSupabase(log: ActivityLog) {
  const currentLogs = loadLocalActivityLogs();
  await pushStateSlice("activity_logs", currentLogs);

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.from("activity_logs").upsert(log);
    await supabase.from("notifications").upsert({
      title: log.action,
      message: `${log.userName}: ${log.details}`,
      type: log.type || "info",
    });
  } catch (e) {
    // Ignore fallback error
  }
}

export async function pushAnnouncementToSupabase(announcement: string) {
  await pushStateSlice("announcement", announcement);

  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase
      .from("settings")
      .upsert({ key: "announcement", value: announcement });
  } catch (e) {
    // Ignore fallback error
  }
}

export async function pushRequestsToSupabase() {
  const currentRequests = loadLocalRequests();
  await pushStateSlice("requests", currentRequests);
}
