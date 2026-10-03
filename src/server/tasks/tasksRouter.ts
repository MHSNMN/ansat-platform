/**
 * Tasks Router - منصة المهام (مربوطة بالسوبابيس والأعضاء الموحدين)
 * مسار: /api/tasks/*
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import { getFirebaseAdminFirestore } from "../firebaseAdmin";
import { writeAuditLog } from "../audit/auditService";
import { canAccessPlatform, isActionAllowed } from "../../lib/rbacPolicy";

export const tasksRouter = Router();
async function isAssignedToTask(taskId: string, uid: string): Promise<boolean> {
  if (!uidPattern.test(taskId)) return false;
  const db = getFirebaseAdminFirestore();
  if (db) {
    const snap = await db.collection("tasks").doc(taskId).get();
    if (snap.exists) {
      const task = snap.data() || {};
      if (
        task.memberId === uid ||
        (Array.isArray(task.assigneeUids) && task.assigneeUids.includes(uid))
      )
        return true;
    }
  }
  const sb = getSupabaseAdminClient();
  if (!sb) return false;
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("firebase_uid", uid)
    .maybeSingle();
  if (!profile?.id) return false;
  const { data: assignment } = await sb
    .from("task_assignments")
    .select("task_id")
    .eq("task_id", taskId)
    .eq("profile_id", profile.id)
    .maybeSingle();
  return Boolean(assignment);
}

tasksRouter.use(async (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED" });
  if (!canAccessPlatform(req.user, "tasks"))
    return res
      .status(403)
      .json({ success: false, code: "TASKS_PLATFORM_DENIED" });
  const route = req.path;
  let action: string | null = null;
  if (/^\/members\/[^/]+\/permissions$/.test(route))
    action = "manage_action_permissions";
  else if (/^\/members\/[^/]+\/profile$/.test(route)) action = "edit_members";
  else if (req.method === "GET") action = "access_tasks_platform";
  else if (route === "/" && req.method === "POST") action = "create_tasks";
  else if (route.startsWith("/bulk-") || route === "/bulk-status")
    action = "canBulkUpdateTasks";
  else if (req.method === "DELETE") action = "delete_tasks";
  else if (
    route.endsWith("/status") ||
    route.endsWith("/archive") ||
    route.endsWith("/restore")
  )
    action = "change_task_status";
  else action = "edit_tasks";
  if (!isActionAllowed(req.user, action))
    return res
      .status(403)
      .json({ success: false, code: "TASK_ACTION_DENIED", action });
  if (
    (route.endsWith("/status") ||
      route.endsWith("/archive") ||
      route.endsWith("/restore")) &&
    !isActionAllowed(req.user, "manage_tasks")
  ) {
    const taskId = route.split("/")[1];
    try {
      if (!(await isAssignedToTask(taskId, req.user.uid)))
        return res
          .status(403)
          .json({ success: false, code: "TASK_NOT_ASSIGNED" });
    } catch (error) {
      return next(error);
    }
  }
  next();
});
const uidPattern = /^[A-Za-z0-9_-]{1,128}$/;
const nowIso = () => new Date().toISOString();

// In-Memory cache of known columns for tasks table to prevent PGRST204 schema cache errors
const tasksColumnsCache: Map<string, Set<string>> = new Map();

async function getTasksColumns(supabase: any): Promise<Set<string>> {
  const url = supabase?.supabaseUrl || "default";
  if (
    tasksColumnsCache.has(url) &&
    (tasksColumnsCache.get(url)?.size ?? 0) > 0
  ) {
    return tasksColumnsCache.get(url)!;
  }
  try {
    const { data, error } = await supabase.from("tasks").select("*").limit(1);
    if (!error && data && data.length > 0) {
      const cols = new Set(Object.keys(data[0]));
      tasksColumnsCache.set(url, cols);
      return cols;
    }
  } catch (err) {
    console.warn("[TasksRouter] Failed to introspect tasks columns:", err);
  }
  return new Set();
}

/**
 * Adaptively upserts a task into Supabase tasks table, safely matching the underlying schema
 * without throwing "Could not find the 'book_id' column of 'tasks' in the schema cache" errors.
 */
async function adaptiveUpsertTaskToSupabase(
  supabase: any,
  task: {
    id?: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
    bookId?: string | null;
    pointsReward?: number;
    memberName?: string;
    departmentName?: string;
    memberId?: string;
    country?: string;
  },
): Promise<{ success: boolean; taskId: string; error?: string }> {
  const url = supabase?.supabaseUrl || "default";
  const knownCols = await getTasksColumns(supabase);
  const now = nowIso();

  const isUuid = Boolean(
    task.id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      task.id,
    ),
  );
  const taskId = isUuid ? task.id! : randomUUID();

  const canInclude = (col: string) =>
    knownCols.size === 0 || knownCols.has(col);

  const payload: Record<string, any> = {
    id: taskId,
    title: task.title,
    status: task.status || "OPEN",
    created_at: now,
  };

  if (canInclude("updated_at")) payload.updated_at = now;
  if (task.description && canInclude("description"))
    payload.description = task.description;
  if (task.priority && canInclude("priority")) payload.priority = task.priority;
  if (canInclude("platform")) payload.platform = "tasks";
  if (canInclude("stage")) payload.stage = "TODO";
  if (canInclude("is_archived")) payload.is_archived = false;

  if (task.dueDate) {
    if (canInclude("due_date")) payload.due_date = task.dueDate;
    if (canInclude("deadline")) payload.deadline = task.dueDate;
  }

  // CRITICAL: NEVER include book_id unless explicitly set AND known to exist in the database!
  if (
    task.bookId &&
    typeof task.bookId === "string" &&
    task.bookId.trim() &&
    canInclude("book_id")
  ) {
    payload.book_id = task.bookId.trim();
  }
  if (task.pointsReward && canInclude("points_reward")) {
    payload.points_reward = Number(task.pointsReward);
  }

  // Support both 6-column schema ('assigned_to', 'department') and camelCase schema
  if (task.memberName) {
    if (canInclude("assigned_to")) payload.assigned_to = task.memberName;
    if (canInclude("memberName")) payload.memberName = task.memberName;
  }
  if (task.departmentName) {
    if (canInclude("department")) payload.department = task.departmentName;
    if (canInclude("departmentName"))
      payload.departmentName = task.departmentName;
  }
  if (task.memberId && canInclude("memberId")) payload.memberId = task.memberId;
  if (task.country && canInclude("country")) payload.country = task.country;

  const currentPayload = { ...payload };
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from("tasks")
      .upsert(currentPayload, { onConflict: "id" })
      .select();
    if (!error) {
      if (data && data.length > 0) {
        tasksColumnsCache.set(url, new Set(Object.keys(data[0])));
      }
      return { success: true, taskId };
    }

    // Strip missing column if reported by schema cache error
    const missingColMatch = error.message.match(
      /Could not find the ['"]([^'"]+)['"] column of ['"]tasks['"]/i,
    );
    if (missingColMatch && missingColMatch[1]) {
      const missingCol = missingColMatch[1];
      console.warn(
        `[TasksRouter] Removing unsupported column '${missingCol}' from tasks payload`,
      );
      delete currentPayload[missingCol];
      if (knownCols.has(missingCol)) knownCols.delete(missingCol);
      continue;
    }

    // Strip missing column if reported by Postgres relation error
    const colMatch2 = error.message.match(
      /column "?([^"'\s]+)"? of relation "?tasks"? does not exist/i,
    );
    if (colMatch2 && colMatch2[1]) {
      const col2 = colMatch2[1];
      delete currentPayload[col2];
      if (knownCols.has(col2)) knownCols.delete(col2);
      continue;
    }

    // If UUID format issue on an unexpected ID string, generate a standard UUID
    if (error.message.includes("uuid") && currentPayload.id) {
      currentPayload.id = randomUUID();
      continue;
    }

    // If conflict constraint issue, try simple insert
    if (error.message.includes("conflict") || error.code === "42P10") {
      const { error: insErr } = await supabase
        .from("tasks")
        .insert(currentPayload);
      if (!insErr) return { success: true, taskId };
    }

    return { success: false, taskId, error: error.message };
  }

  return {
    success: false,
    taskId,
    error: "تعذر حفظ المهمة في قاعدة البيانات بعد محاولات متعددة",
  };
}

/**
 * Adaptively updates a task in Supabase, only sending columns that exist in the schema.
 */
async function safeUpdateTaskInSupabase(
  supabase: any,
  taskId: string,
  updates: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
  const knownCols = await getTasksColumns(supabase);
  const filtered: Record<string, any> = {};

  for (const [key, val] of Object.entries(updates)) {
    if (knownCols.size === 0 || knownCols.has(key)) {
      filtered[key] = val;
    }
  }

  if (Object.keys(filtered).length === 0) {
    return { success: true };
  }

  const currentPayload = { ...filtered };
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from("tasks")
      .update(currentPayload)
      .eq("id", taskId);
    if (!error) return { success: true };

    const missingColMatch = error.message.match(
      /Could not find the ['"]([^'"]+)['"] column of ['"]tasks['"]/i,
    );
    if (missingColMatch && missingColMatch[1]) {
      const col = missingColMatch[1];
      delete currentPayload[col];
      if (knownCols.has(col)) knownCols.delete(col);
      continue;
    }

    return { success: false, error: error.message };
  }
  return { success: false, error: "تعذر تعديل المهمة" };
}

/**
 * Adaptively updates multiple tasks in Supabase in bulk, only sending columns that exist in the schema.
 */
async function safeBulkUpdateTasksInSupabase(
  supabase: any,
  taskIds: string[],
  updates: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
  const knownCols = await getTasksColumns(supabase);
  const filtered: Record<string, any> = {};

  for (const [key, val] of Object.entries(updates)) {
    if (knownCols.size === 0 || knownCols.has(key)) {
      filtered[key] = val;
    }
  }

  if (Object.keys(filtered).length === 0) {
    return { success: true };
  }

  const currentPayload = { ...filtered };
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from("tasks")
      .update(currentPayload)
      .in("id", taskIds);
    if (!error) return { success: true };

    const missingColMatch = error.message.match(
      /Could not find the ['"]([^'"]+)['"] column of ['"]tasks['"]/i,
    );
    if (missingColMatch && missingColMatch[1]) {
      const col = missingColMatch[1];
      delete currentPayload[col];
      if (knownCols.has(col)) knownCols.delete(col);
      continue;
    }

    return { success: false, error: error.message };
  }
  return { success: false, error: "تعذر تعديل المهام في سوبابيس" };
}

function mapProfileRoleAndDept(roleId?: string, customDept?: string) {
  const r = (roleId || "member").toLowerCase();
  let departmentName = customDept || "فريق إنصات التطوعي";
  let roleDisplay = "عضو متطوع";

  if (r === "super_admin") {
    departmentName = "الإدارة العامة";
    roleDisplay = "المدير الرئيسي والمسؤول التقني";
  } else if (r === "admin") {
    departmentName = "الإدارة والعمليات";
    roleDisplay = "إدارة المبادرة";
  } else if (r === "narrator") {
    departmentName = "قسم التسجيل الصوتي";
    roleDisplay = "راوٍ صوتي";
  } else if (r === "audio_engineer") {
    departmentName = "قسم المونتاج والهندسة الصوتية";
    roleDisplay = "مهندس صوتي";
  } else if (r === "qa_reviewer") {
    departmentName = "قسم التدقيق والجودة";
    roleDisplay = "مراقب جودة";
  } else if (r === "members_manager") {
    departmentName = "قسم الموارد والتطوع";
    roleDisplay = "إدارة الأعضاء";
  } else if (r === "content_manager") {
    departmentName = "قسم المحتوى والحقوق";
    roleDisplay = "إدارة المحتوى";
  }

  return { roleDisplay, departmentName };
}

// In-Memory Cache for Tasks Members to eliminate Firestore Read Spikes
let tasksMembersCache: { data: any[]; timestamp: number } | null = null;
const TASKS_MEMBERS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function invalidateTasksMembersCache() {
  tasksMembersCache = null;
}

// -------------------------------------------------------------
// 1. GET /api/tasks/members — يعيد قائمة الأعضاء الموحدين من Firestore و Supabase
// -------------------------------------------------------------
tasksRouter.get("/members", async (req, res) => {
  const canManageMembers = isActionAllowed(req.user, "manage_members");
  const visibleMembers = (items: any[]) =>
    items.map((member: any) => {
      const { code: _code, pin: _pin, passwordHash: _hash, ...safe } = member;
      if (!canManageMembers) {
        delete safe.email;
        delete safe.phone;
        delete safe.whatsapp;
        delete safe.permissions;
        delete safe.actionAccess;
      }
      return safe;
    });
  const forceRefresh = req.query.forceRefresh === "true";
  const now = Date.now();
  if (
    !forceRefresh &&
    tasksMembersCache &&
    now - tasksMembersCache.timestamp < TASKS_MEMBERS_CACHE_TTL_MS
  ) {
    return res.json({
      success: true,
      members: visibleMembers(tasksMembersCache.data),
      count: tasksMembersCache.data.length,
      source: "cache",
    });
  }

  const db = getFirebaseAdminFirestore();
  const supabase = getSupabaseAdminClient();

  try {
    // 1. Fetch authoritative member profiles from Firestore
    let firestoreDocs: any[] = [];
    if (db) {
      try {
        const snap = await db.collection("users").get();
        firestoreDocs = snap.docs;
      } catch (dbErr) {
        console.warn("[TasksRouter] Firestore users fetch warning:", dbErr);
      }
    }

    // 2. Fetch Supabase profiles for platform_access and permission overrides
    let supabaseProfiles: any[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            `
            id,
            firebase_uid,
            full_name,
            email,
            phone,
            role_id,
            country,
            nationality,
            is_super_admin,
            is_archived,
            platform_access (
              platform_id,
              is_allowed
            ),
            user_permission_overrides (
              permission_id,
              state
            )
          `,
          )
          .eq("is_archived", false)
          .order("full_name", { ascending: true });

        if (error) {
          console.warn(
            "[TasksRouter] get members from Supabase warning:",
            error.message,
          );
        } else if (data) {
          supabaseProfiles = data;
        }
      } catch (sbErr) {
        console.warn("[TasksRouter] Supabase query exception:", sbErr);
      }
    }

    // Build lookup maps for Supabase profiles
    const supaMapByUid = new Map<string, any>();
    const supaMapByEmail = new Map<string, any>();
    const supaMapByPhone = new Map<string, any>();

    for (const p of supabaseProfiles) {
      if (p.firebase_uid) supaMapByUid.set(p.firebase_uid, p);
      if (p.id) supaMapByUid.set(p.id, p);
      if (p.email) supaMapByEmail.set(p.email.toLowerCase().trim(), p);
      if (p.phone) supaMapByPhone.set(p.phone.trim(), p);
    }

    const seenUids = new Set<string>();
    const seenEmails = new Set<string>();
    const members: any[] = [];

    const normalizeRole = (r?: string) => {
      const upper = (r || "MEMBER").toUpperCase();
      if (upper === "SUPERADMIN") return "SUPER_ADMIN";
      return upper;
    };

    // 3. Process Firestore documents (Authoritative)
    for (const doc of firestoreDocs) {
      const data = doc.data() || {};
      const uid = data.uid || doc.id;
      if (!uid || uid === "undefined" || uid === "null") continue;

      seenUids.add(uid);
      const emailLower = (data.email || "").toLowerCase().trim();
      if (emailLower) seenEmails.add(emailLower);

      const supaProfile =
        supaMapByUid.get(uid) ||
        supaMapByUid.get(doc.id) ||
        (emailLower ? supaMapByEmail.get(emailLower) : null) ||
        (data.phone ? supaMapByPhone.get(data.phone) : null);

      const effectiveRole = normalizeRole(
        data.role ||
          data.canonicalRole ||
          (supaProfile?.role_id ? supaProfile.role_id.toUpperCase() : "MEMBER"),
      );
      const isAdm = Boolean(
        data.isAdmin ||
        data.is_super_admin ||
        effectiveRole === "SUPER_ADMIN" ||
        effectiveRole === "ADMIN" ||
        supaProfile?.is_super_admin,
      );

      const customDept =
        data.department ||
        data.departmentName ||
        (supaProfile as any)?.department;
      const { roleDisplay, departmentName } = mapProfileRoleAndDept(
        effectiveRole,
        customDept,
      );

      const permissionsMap: Record<string, boolean> = {
        ...(data.permissions || data.custom_permissions || {}),
      };

      if (supaProfile && Array.isArray(supaProfile.user_permission_overrides)) {
        supaProfile.user_permission_overrides.forEach((po: any) => {
          permissionsMap[po.permission_id] = po.state === "ALLOW";
        });
      }

      const platAccess: Record<string, boolean> = {
        tasks: true,
        rewards: true,
        recording: true,
        ...(data.platformAccess || {}),
      };
      if (supaProfile && Array.isArray(supaProfile.platform_access)) {
        supaProfile.platform_access.forEach((pa: any) => {
          platAccess[pa.platform_id] = Boolean(pa.is_allowed);
        });
      }

      const resolvedName = (
        data.name ||
        data.displayName ||
        data.fullName ||
        supaProfile?.full_name ||
        (emailLower ? emailLower.split("@")[0] : "") ||
        "عضو إنصات"
      ).trim();

      const phone =
        data.phone ||
        data.phoneNumber ||
        data.whatsapp ||
        supaProfile?.phone ||
        "";
      const email = data.email || supaProfile?.email || "";

      members.push({
        id: uid,
        uid: uid,
        name: resolvedName,
        displayName: resolvedName,
        fullName: resolvedName,
        email: email,
        phone: phone,
        whatsapp: phone || email,
        role: effectiveRole,
        canonicalRole: effectiveRole,
        roleName: data.roleDisplayAr || data.roleDisplay || roleDisplay,
        roleDisplay: data.roleDisplayAr || data.roleDisplay || roleDisplay,
        roleDisplayAr: data.roleDisplayAr || data.roleDisplay || roleDisplay,
        department: departmentName,
        departmentName: departmentName,
        country: data.country || data.nationality || supaProfile?.country || "",
        nationality:
          data.nationality || data.country || supaProfile?.nationality || "",
        isAdmin: isAdm,
        status:
          data.status || data.accountStatus || supaProfile?.status || "active",
        permissions: permissionsMap,
        platformAccess: platAccess,
        actionAccess: data.actionAccess || {},
      });
    }

    // 4. Process any Supabase-only profiles
    for (const p of supabaseProfiles) {
      const pUid = p.firebase_uid || p.id;
      const pEmail = (p.email || "").toLowerCase().trim();
      if (!pUid || seenUids.has(pUid) || (pEmail && seenEmails.has(pEmail))) {
        continue;
      }
      seenUids.add(pUid);
      if (pEmail) seenEmails.add(pEmail);

      const effectiveRole = normalizeRole(p.role_id || "MEMBER");
      const isAdm =
        Boolean(p.is_super_admin) ||
        effectiveRole === "SUPER_ADMIN" ||
        effectiveRole === "ADMIN";
      const { roleDisplay, departmentName } =
        mapProfileRoleAndDept(effectiveRole);

      const permissionsMap: Record<string, boolean> = {};
      if (Array.isArray(p.user_permission_overrides)) {
        p.user_permission_overrides.forEach((po: any) => {
          permissionsMap[po.permission_id] = po.state === "ALLOW";
        });
      }

      const platAccess: Record<string, boolean> = {
        tasks: true,
        rewards: true,
        recording: true,
      };
      if (Array.isArray(p.platform_access)) {
        p.platform_access.forEach((pa: any) => {
          platAccess[pa.platform_id] = Boolean(pa.is_allowed);
        });
      }

      const resolvedName = (
        p.full_name ||
        (pEmail ? pEmail.split("@")[0] : "") ||
        "عضو إنصات"
      ).trim();
      const phone = p.phone || "";

      members.push({
        id: pUid,
        uid: pUid,
        name: resolvedName,
        displayName: resolvedName,
        fullName: resolvedName,
        email: p.email || "",
        phone: phone,
        whatsapp: phone || p.email || "",
        role: effectiveRole,
        canonicalRole: effectiveRole,
        roleName: roleDisplay,
        roleDisplay: roleDisplay,
        roleDisplayAr: roleDisplay,
        department: departmentName,
        departmentName: departmentName,
        country: p.country || "",
        nationality: p.nationality || "",
        isAdmin: isAdm,
        status: p.status || "active",
        permissions: permissionsMap,
        platformAccess: platAccess,
        actionAccess: {},
      });
    }

    // Sort by Arabic name
    members.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));

    tasksMembersCache = { data: members, timestamp: now };
    return res.json({
      success: true,
      members: visibleMembers(members),
      count: members.length,
    });
  } catch (err: any) {
    console.error("[TasksRouter] Members fetch error:", err);
    if (tasksMembersCache) {
      return res.json({
        success: true,
        members: visibleMembers(tasksMembersCache.data),
        count: tasksMembersCache.data.length,
        fallback: true,
      });
    }
    return res
      .status(500)
      .json({ success: false, error: "تعذر جلب قائمة الأعضاء" });
  }
});

// -------------------------------------------------------------
// 1.1 PATCH/POST /api/tasks/members/:id/permissions — حفظ وتحديث الصلاحيات المخصصة
// -------------------------------------------------------------
tasksRouter.all("/members/:id/permissions", async (req, res) => {
  const { id } = req.params;
  const rawPerms =
    req.body?.permissions || req.body?.custom_permissions || req.body;
  const userPayload = req.body?.user || req.body?.member || {};
  const email = (userPayload.email || req.body?.email || "")
    .trim()
    .toLowerCase();
  const phone = (
    userPayload.phone ||
    userPayload.whatsapp ||
    req.body?.phone ||
    req.body?.whatsapp ||
    ""
  ).trim();
  const name = (userPayload.name || req.body?.name || "").trim();

  const permissions = rawPerms && typeof rawPerms === "object" ? rawPerms : {};

  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();

  let updatedInSupabase = false;
  let updatedInFirestore = false;

  // 1. Update in Supabase platform_access table
  if (supabase) {
    try {
      let { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .or(`id.eq.${id},firebase_uid.eq.${id}`)
        .maybeSingle();

      if (!prof && email) {
        const r = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (r.data) prof = r.data;
      }
      if (!prof && phone) {
        const r = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();
        if (r.data) prof = r.data;
      }

      if (prof) {
        const nowIso = new Date().toISOString();
        const platformRows = [
          {
            profile_id: prof.id,
            platform_id: "tasks",
            is_allowed: true,
            updated_at: nowIso,
          },
          {
            profile_id: prof.id,
            platform_id: "rewards",
            is_allowed: true,
            updated_at: nowIso,
          },
          {
            profile_id: prof.id,
            platform_id: "recording",
            is_allowed: Boolean(permissions.canAccessRecordingSite),
            updated_at: nowIso,
          },
          {
            profile_id: prof.id,
            platform_id: "admin",
            is_allowed: Boolean(permissions.canAccessAdminPanel),
            updated_at: nowIso,
          },
        ];
        await supabase
          .from("platform_access")
          .upsert(platformRows, { onConflict: "profile_id,platform_id" });
        await supabase
          .from("profiles")
          .update({ updated_at: nowIso })
          .eq("id", prof.id);
        updatedInSupabase = true;
      }
    } catch (e) {
      console.warn("[TasksRouter] Supabase update permissions error:", e);
    }
  }

  // 2. Update in Firestore users collection
  if (db) {
    try {
      let docRef = db.collection("users").doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        let found = false;
        // Search by uid field
        const uidSnap = await db
          .collection("users")
          .where("uid", "==", id)
          .limit(1)
          .get();
        if (!uidSnap.empty) {
          docRef = uidSnap.docs[0].ref;
          found = true;
        }

        // Search by email
        if (!found && email) {
          const emailSnap = await db
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get();
          if (!emailSnap.empty) {
            docRef = emailSnap.docs[0].ref;
            found = true;
          }
        }
        // Search by phone
        if (!found && phone) {
          const phoneSnap = await db
            .collection("users")
            .where("phone", "==", phone)
            .limit(1)
            .get();
          if (!phoneSnap.empty) {
            docRef = phoneSnap.docs[0].ref;
            found = true;
          }
        }
        // Search by name
        if (!found && name) {
          const nameSnap = await db
            .collection("users")
            .where("name", "==", name)
            .limit(1)
            .get();
          if (!nameSnap.empty) {
            docRef = nameSnap.docs[0].ref;
            found = true;
          }
        }
      }

      const platformAccess = {
        tasks: true,
        rewards: true,
        recording: Boolean(permissions.canAccessRecordingSite),
        admin: Boolean(permissions.canAccessAdminPanel),
      };

      await docRef.set(
        {
          permissions,
          custom_permissions: permissions,
          platformAccess,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      updatedInFirestore = true;
    } catch (e) {
      console.warn("[TasksRouter] Firestore update permissions error:", e);
    }
  }

  invalidateTasksMembersCache();
  return res.json({
    success: true,
    message: "تم حفظ الصلاحيات المخصصة للعضو بنجاح",
    memberId: id,
    permissions,
    updatedInSupabase,
    updatedInFirestore,
  });
});

// -------------------------------------------------------------
// 1.2 PATCH/POST /api/tasks/members/:id/profile — تعديل وحفظ الملف الشخصي لجميع الأعضاء بدون شروط
// -------------------------------------------------------------
tasksRouter.all("/members/:id/profile", async (req, res) => {
  const { id } = req.params;
  const body = req.body?.member || req.body?.user || req.body || {};
  const name = (body.name || body.fullName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || body.whatsapp || "").trim();
  const country = typeof body.country === "string" ? body.country.trim() : "";
  const departmentName = (body.departmentName || body.department || "").trim();
  const roleName = (body.roleName || body.role || "عضو").trim();
  const code = (body.code || "").trim();
  const bio = (body.bio || "").trim();

  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();

  // 1. Update in Supabase
  if (supabase) {
    try {
      const profilePatch: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (name) profilePatch.full_name = name;
      if (email) profilePatch.email = email;
      if (phone) profilePatch.phone = phone;
      if (country) profilePatch.country = country;

      await supabase
        .from("profiles")
        .update(profilePatch)
        .or(`id.eq.${id},firebase_uid.eq.${id}`);

      if (email) {
        await supabase
          .from("profiles")
          .update(profilePatch)
          .ilike("email", email);
      }
      if (phone) {
        await supabase.from("profiles").update(profilePatch).eq("phone", phone);
      }

      // Also upsert to members table
      await supabase.from("members").upsert({
        name: name || id,
        whatsapp: phone || email,
        code,
        department: departmentName,
        role: roleName,
      });
    } catch (e) {
      console.warn("[TasksRouter] Supabase profile update error:", e);
    }
  }

  // 2. Update in Firestore
  if (db) {
    try {
      const docRef = db.collection("users").doc(id);
      const fsPatch: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (name) {
        fsPatch.name = name;
        fsPatch.displayName = name;
        fsPatch.fullName = name;
      }
      if (email) fsPatch.email = email;
      if (phone) {
        fsPatch.phone = phone;
        fsPatch.whatsapp = phone;
      }
      if (country) fsPatch.country = country;
      if (departmentName) fsPatch.department = departmentName;
      if (roleName) fsPatch.role = roleName;
      if (code) fsPatch.code = code;
      if (bio) fsPatch.bio = bio;

      await docRef.set(fsPatch, { merge: true });

      if (email) {
        const snap = await db
          .collection("users")
          .where("email", "==", email)
          .limit(1)
          .get();
        if (!snap.empty) await snap.docs[0].ref.set(fsPatch, { merge: true });
      }
    } catch (e) {
      console.warn("[TasksRouter] Firestore profile update error:", e);
    }
  }

  invalidateTasksMembersCache();
  return res.json({
    success: true,
    message: "تم تحديث بيانات الملف الشخصي بنجاح",
    member: {
      id,
      name,
      email,
      phone,
      whatsapp: phone,
      country,
      departmentName,
      roleName,
      code,
      bio,
    },
  });
});

// -------------------------------------------------------------
// 2. GET /api/tasks — يعيد كافة المهام من Supabase و Firestore
// -------------------------------------------------------------
tasksRouter.get("/", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db) {
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
  }

  try {
    const includeArchived =
      req.query.includeArchived === "true" || req.query.status === "ARCHIVED";
    const tasksMap = new Map<string, any>();

    // 1. Fetch from Supabase
    if (supabase) {
      try {
        let rows: any[] = [];
        // First try relationship select with task_assignments and profiles
        const relQuery = await supabase
          .from("tasks")
          .select(
            `
            *,
            task_assignments (
              profile_id,
              profiles (
                id,
                full_name,
                email,
                phone,
                country,
                role_id
              )
            )
          `,
          )
          .order("created_at", { ascending: false });

        if (!relQuery.error && Array.isArray(relQuery.data)) {
          rows = relQuery.data;
        } else {
          // If relationship query fails (e.g. no task_assignments table in schema), fallback to flat select
          const flatQuery = await supabase
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: false });
          if (!flatQuery.error && Array.isArray(flatQuery.data)) {
            rows = flatQuery.data;
          } else if (flatQuery.error) {
            console.warn(
              "[TasksRouter] Supabase flat select warning:",
              flatQuery.error.message,
            );
          }
        }

        for (const t of rows) {
          const assignments = t.task_assignments || [];
          const assigneeUids = assignments.map((a: any) => a.profile_id);
          const firstAssignee = assignments[0]?.profiles;

          // Support 6-column schema ('assigned_to', 'department'), camelCase ('memberName'), and profiles relation
          const memberName =
            firstAssignee?.full_name ||
            t.assigned_to ||
            t.memberName ||
            "عضو إنصات";
          const memberCountry = firstAssignee?.country || t.country || "العراق";
          const deptFromRole = firstAssignee
            ? mapProfileRoleAndDept(firstAssignee.role_id).departmentName
            : "";
          const departmentName =
            t.department ||
            t.departmentName ||
            deptFromRole ||
            "فريق إنصات التطوعي";

          const resolvedAssigneeUids =
            assigneeUids.length > 0
              ? assigneeUids
              : t.memberId
                ? [t.memberId]
                : t.assigned_to
                  ? [t.assigned_to]
                  : [];
          const isArchived = Boolean(
            t.is_archived || t.status === "ARCHIVED" || t.status === "مؤرشف",
          );

          // Normalize status
          let status = t.status || "OPEN";
          if (status === "قيد التنفيذ" || status === "IN_PROGRESS")
            status = "IN_PROGRESS";
          else if (
            status === "مكتمل" ||
            status === "مكتملة" ||
            status === "COMPLETED"
          )
            status = "COMPLETED";
          else if (status === "مؤرشف" || status === "ARCHIVED")
            status = "ARCHIVED";

          const resolvedDueDate = t.due_date || t.deadline || t.dueDate || null;
          const mapped = {
            id: t.id,
            title: t.title,
            description: t.description || "",
            platform: t.platform || "tasks",
            priority: t.priority || "MEDIUM",
            stage:
              t.stage ||
              (status === "COMPLETED"
                ? "DONE"
                : status === "IN_PROGRESS"
                  ? "IN_PROGRESS"
                  : "TODO"),
            status,
            dueDate: resolvedDueDate,
            deadline: resolvedDueDate,
            pointsReward: Number(t.points_reward || 0),
            bookId: t.book_id || null,
            isArchived,
            assigneeUids: resolvedAssigneeUids,
            memberId: resolvedAssigneeUids[0] || null,
            memberName,
            country: memberCountry,
            departmentName,
            departmentId: t.departmentId || "general",
            progress:
              status === "COMPLETED" ? 100 : status === "IN_PROGRESS" ? 50 : 0,
            createdAt: t.created_at || nowIso(),
            updatedAt: t.updated_at || t.created_at || nowIso(),
          };

          tasksMap.set(String(t.id), mapped);
        }
      } catch (sbErr: any) {
        console.warn("[TasksRouter] Supabase fetch error:", sbErr?.message);
      }
    }

    // 2. Fetch from Firestore (merge or supplement)
    if (db) {
      try {
        const snap = await db.collection("tasks").limit(200).get();
        if (snap && snap.docs && snap.docs.length > 0) {
          for (const doc of snap.docs) {
            const d = doc.data() || {};
            const docId = doc.id;
            const isArchived = Boolean(d.isArchived ?? d.is_archived);

            let status = d.status || "OPEN";
            if (status === "قيد التنفيذ" || status === "IN_PROGRESS")
              status = "IN_PROGRESS";
            else if (
              status === "مكتمل" ||
              status === "مكتملة" ||
              status === "COMPLETED"
            )
              status = "COMPLETED";
            else if (status === "مؤرشف" || status === "ARCHIVED")
              status = "ARCHIVED";

            const resolvedDueDate =
              d.dueDate || d.due_date || d.deadline || null;

            const mapped = {
              id: docId,
              title: d.title || "",
              description: d.description || "",
              platform: d.platform || "tasks",
              priority: d.priority || "MEDIUM",
              stage: d.stage || "TODO",
              status,
              dueDate: resolvedDueDate,
              deadline: resolvedDueDate,
              pointsReward: Number(d.pointsReward || d.points_reward || 0),
              bookId: d.bookId || d.book_id || null,
              isArchived,
              assigneeUids: d.assigneeUids || (d.memberId ? [d.memberId] : []),
              memberId:
                (d.assigneeUids && d.assigneeUids[0]) || d.memberId || null,
              memberName: d.memberName || "عضو إنصات",
              country: d.country || "العراق",
              departmentName: d.departmentName || "فريق إنصات التطوعي",
              departmentId: d.departmentId || "general",
              progress:
                status === "COMPLETED"
                  ? 100
                  : status === "IN_PROGRESS"
                    ? 50
                    : 0,
              createdAt: d.createdAt || d.created_at || nowIso(),
              updatedAt: d.updatedAt || d.updated_at || nowIso(),
            };

            // If not in map yet or newer update, insert/merge
            if (!tasksMap.has(docId)) {
              tasksMap.set(docId, mapped);
            } else {
              const existing = tasksMap.get(docId)!;
              const fsUpdated = new Date(mapped.updatedAt).getTime() || 0;
              const sbUpdated = new Date(existing.updatedAt).getTime() || 0;
              const isFsNewer = fsUpdated >= sbUpdated;
              const mergedDueDate = isFsNewer
                ? mapped.dueDate || existing.dueDate || null
                : existing.dueDate || mapped.dueDate || null;
              const mergedIsArchived = isFsNewer
                ? Boolean(mapped.isArchived)
                : Boolean(existing.isArchived);

              tasksMap.set(docId, {
                ...existing,
                ...(isFsNewer ? mapped : {}),
                dueDate: mergedDueDate,
                deadline: mergedDueDate,
                isArchived: mergedIsArchived,
              });
            }
          }
        }
      } catch (fsErr: any) {
        console.warn(
          "[TasksRouter] Firestore list tasks notice:",
          fsErr?.message,
        );
      }
    }

    const allTasks = Array.from(tasksMap.values());
    const filtered = includeArchived
      ? allTasks
      : allTasks.filter((t: any) => !t.isArchived);
    const visible = isActionAllowed(req.user, "view_all_tasks")
      ? filtered
      : filtered.filter(
          (t: any) =>
            Array.isArray(t.assigneeUids) &&
            t.assigneeUids.includes(req.user?.uid),
        );
    return res.json({ success: true, tasks: visible, count: visible.length });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "تعذر تحميل المهام" });
  }
});

// -------------------------------------------------------------
// 3. POST /api/tasks — إنشاء مهمة بنظام التكيف الفوري
// -------------------------------------------------------------
tasksRouter.post("/", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db) {
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
  }

  const title =
    typeof req.body?.title === "string"
      ? req.body.title.trim().slice(0, 180)
      : "";
  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim().slice(0, 4000)
      : "";

  // Accept assigneeUids array or single memberId
  let assigneeUids: string[] = [];
  if (Array.isArray(req.body?.assigneeUids)) {
    assigneeUids = req.body.assigneeUids
      .filter(
        (id: unknown): id is string =>
          typeof id === "string" && uidPattern.test(id),
      )
      .slice(0, 50);
  } else if (
    typeof req.body?.memberId === "string" &&
    req.body.memberId.trim()
  ) {
    assigneeUids = [req.body.memberId.trim()];
  }

  const priorityRaw = String(req.body?.priority || "MEDIUM").toUpperCase();
  const priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priorityRaw)
    ? priorityRaw
    : priorityRaw === "عالية" || priorityRaw === "HIGH"
      ? "HIGH"
      : priorityRaw === "حرجة" || priorityRaw === "URGENT"
        ? "URGENT"
        : priorityRaw === "منخفضة" || priorityRaw === "LOW"
          ? "LOW"
          : "MEDIUM";

  const dueDate = req.body?.dueDate || req.body?.deadline || null;
  const statusRaw = String(req.body?.status || "OPEN").toUpperCase();
  const status =
    statusRaw === "مكتمل" || statusRaw === "مكتملة" || statusRaw === "COMPLETED"
      ? "COMPLETED"
      : statusRaw === "قيد التنفيذ" || statusRaw === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : "OPEN";

  if (!title) {
    return res
      .status(400)
      .json({ success: false, error: "عنوان المهمة مطلوب" });
  }

  try {
    // Generate valid UUID for broad database compatibility
    const requestedId = req.body?.id;
    const isRequestedUuid =
      requestedId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestedId,
      );
    const taskId = isRequestedUuid ? requestedId : randomUUID();
    const now = nowIso();

    // Resolve assignee information
    let assignedMemberName = req.body?.memberName || "";
    let assignedDeptName = req.body?.departmentName || "فريق إنصات التطوعي";
    let assignedCountry = req.body?.country || "العراق";

    if (assigneeUids.length > 0) {
      const assignedId = assigneeUids[0];
      const found = tasksMembersCache?.data?.find(
        (m: any) => m.id === assignedId || m.uid === assignedId,
      );
      if (found) {
        assignedMemberName =
          assignedMemberName ||
          found.name ||
          found.displayName ||
          found.fullName ||
          "عضو إنصات";
        assignedDeptName =
          assignedDeptName || found.departmentName || "فريق إنصات التطوعي";
        assignedCountry = assignedCountry || found.country || "العراق";
      }
    }

    let savedToSupabase = false;
    let finalTaskId = taskId;

    // 1. Save to Supabase using adaptive schema insertion (no PGRST204 errors)
    if (supabase) {
      const sbResult = await adaptiveUpsertTaskToSupabase(supabase, {
        id: taskId,
        title,
        description,
        status,
        priority,
        dueDate:
          typeof dueDate === "string" && dueDate.trim() ? dueDate.trim() : null,
        bookId:
          typeof req.body?.bookId === "string" && req.body.bookId.trim()
            ? req.body.bookId.trim()
            : null,
        pointsReward: Number(req.body?.pointsReward || 0),
        memberName: assignedMemberName || "عضو إنصات",
        departmentName: assignedDeptName || "عام",
        memberId: assigneeUids[0] || null,
        country: assignedCountry,
      });

      if (sbResult.success) {
        savedToSupabase = true;
        finalTaskId = sbResult.taskId;

        // If task_assignments exists, insert assignments safely
        if (assigneeUids.length > 0) {
          try {
            const assignments = assigneeUids.map((pid) => ({
              task_id: finalTaskId,
              profile_id: pid,
              assigned_at: now,
            }));
            const { error: asgnErr } = await supabase
              .from("task_assignments")
              .upsert(assignments, { onConflict: "task_id,profile_id" });
            if (
              asgnErr &&
              !asgnErr.message.includes("does not exist") &&
              !asgnErr.message.includes("schema cache")
            ) {
              console.warn(
                "[TasksRouter] task_assignments notice:",
                asgnErr.message,
              );
            }
          } catch (_ex) {
            // Ignore if task_assignments table does not exist
          }
        }
      } else {
        console.warn(
          "[TasksRouter] Supabase task creation notice:",
          sbResult.error,
        );
      }
    }

    // 2. Dual-write to Firestore for high resilience & unified sync
    if (db) {
      try {
        await db
          .collection("tasks")
          .doc(finalTaskId)
          .set(
            {
              id: finalTaskId,
              title,
              description,
              platform: "tasks",
              priority,
              stage: "TODO",
              status,
              dueDate:
                typeof dueDate === "string" && dueDate.trim()
                  ? dueDate.trim()
                  : null,
              deadline:
                typeof dueDate === "string" && dueDate.trim()
                  ? dueDate.trim()
                  : null,
              pointsReward: Number(req.body?.pointsReward || 0),
              bookId:
                typeof req.body?.bookId === "string" && req.body.bookId.trim()
                  ? req.body.bookId.trim()
                  : null,
              assigneeUids,
              memberId: assigneeUids[0] || null,
              memberName: assignedMemberName || "عضو إنصات",
              departmentName: assignedDeptName || "فريق إنصات التطوعي",
              country: assignedCountry,
              isArchived: false,
              createdAt: now,
              updatedAt: now,
              createdBy:
                (req as any).user?.uid || (req as any).user?.id || "system",
            },
            { merge: true },
          );
      } catch (fsErr: any) {
        console.warn(
          "[TasksRouter] Firestore write task notice:",
          fsErr?.message,
        );
      }
    }

    try {
      if (req.user) {
        await writeAuditLog(req, "task.created", "tasks", finalTaskId, {
          assigneeCount: assigneeUids.length,
        });
      }
    } catch (auditErr: any) {
      console.warn("[TasksRouter] audit log write failed:", auditErr?.message);
    }

    return res.status(201).json({
      success: true,
      task: {
        id: finalTaskId,
        title,
        status,
        priority,
        assigneeUids,
        dueDate,
      },
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "تعذر إنشاء المهمة" });
  }
});

// -------------------------------------------------------------
// 3.5. Bulk Task Operations (أرشفة وتحديث واستعادة مجمعة)
// -------------------------------------------------------------
tasksRouter.post("/bulk-archive", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db) {
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
  }

  const { taskIds } = req.body || {};
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "يجب تحديد معرفات المهام" });
  }

  const validIds: string[] = taskIds.filter(
    (id): id is string => typeof id === "string" && Boolean(id.trim()),
  );
  if (validIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "لا توجد معرفات مهام صالحة" });
  }

  const now = nowIso();
  let didUpdate = false;

  // 1. Update in Firestore
  if (db) {
    try {
      const snapshots = await Promise.all(
        validIds.map((id) => db.collection("tasks").doc(id).get()),
      );
      const writes = await Promise.allSettled(
        snapshots
          .filter((snap) => snap.exists)
          .map((snap) =>
            db
              .collection("tasks")
              .doc(snap.id)
              .update({ isArchived: true, status: "ARCHIVED", updatedAt: now }),
          ),
      );
      didUpdate = writes.some((write) => write.status === "fulfilled");
    } catch (fsErr) {
      console.warn("[TasksRouter] Firestore bulk archive error:", fsErr);
    }
  }

  // 2. Update in Supabase
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .in("id", validIds);
      const result = existing?.length
        ? await safeBulkUpdateTasksInSupabase(
            supabase,
            existing.map((item: any) => item.id),
            {
              is_archived: true,
              status: "ARCHIVED",
              updated_at: now,
            },
          )
        : { success: false };
      didUpdate = didUpdate || (Boolean(existing?.length) && result.success);
    } catch (sbErr) {
      console.warn("[TasksRouter] Supabase bulk archive error:", sbErr);
    }
  }

  if (!didUpdate)
    return res
      .status(404)
      .json({ success: false, error: "لم تُعثر على مهام قابلة للأرشفة" });
  try {
    if (req.user) {
      await writeAuditLog(
        req,
        "task.bulk_archived",
        "tasks",
        validIds.join(","),
        { count: validIds.length },
      );
    }
  } catch (_err) {
    // Ignore audit error
  }

  return res.json({ success: true, count: validIds.length });
});

tasksRouter.post("/bulk-restore", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db) {
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
  }

  const { taskIds } = req.body || {};
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "يجب تحديد معرفات المهام" });
  }

  const validIds: string[] = taskIds.filter(
    (id): id is string => typeof id === "string" && Boolean(id.trim()),
  );
  if (validIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "لا توجد معرفات مهام صالحة" });
  }

  const now = nowIso();
  let didUpdate = false;

  // 1. Update in Firestore
  if (db) {
    try {
      const snapshots = await Promise.all(
        validIds.map((id) => db.collection("tasks").doc(id).get()),
      );
      const writes = await Promise.allSettled(
        snapshots
          .filter((snap) => snap.exists)
          .map((snap) =>
            db.collection("tasks").doc(snap.id).update({
              isArchived: false,
              status: "IN_PROGRESS",
              updatedAt: now,
            }),
          ),
      );
      didUpdate = writes.some((write) => write.status === "fulfilled");
    } catch (fsErr) {
      console.warn("[TasksRouter] Firestore bulk restore error:", fsErr);
    }
  }

  // 2. Update in Supabase
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .in("id", validIds);
      const result = existing?.length
        ? await safeBulkUpdateTasksInSupabase(
            supabase,
            existing.map((item: any) => item.id),
            {
              is_archived: false,
              status: "قيد التنفيذ",
              updated_at: now,
            },
          )
        : { success: false };
      didUpdate = didUpdate || (Boolean(existing?.length) && result.success);
    } catch (sbErr) {
      console.warn("[TasksRouter] Supabase bulk restore error:", sbErr);
    }
  }

  if (!didUpdate)
    return res
      .status(404)
      .json({ success: false, error: "لم تُعثر على مهام قابلة للاستعادة" });
  try {
    if (req.user) {
      await writeAuditLog(
        req,
        "task.bulk_restored",
        "tasks",
        validIds.join(","),
        { count: validIds.length },
      );
    }
  } catch (_err) {
    // Ignore audit error
  }

  return res.json({ success: true, count: validIds.length });
});

tasksRouter.patch("/bulk-status", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db) {
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
  }

  const { taskIds, status: rawStatus } = req.body || {};
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "يجب تحديد معرفات المهام" });
  }

  const validIds: string[] = taskIds.filter(
    (id): id is string => typeof id === "string" && Boolean(id.trim()),
  );
  if (validIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "لا توجد معرفات مهام صالحة" });
  }

  const statusStr = String(rawStatus || "OPEN").toUpperCase();
  const newStatus =
    statusStr === "مكتمل" || statusStr === "مكتملة" || statusStr === "COMPLETED"
      ? "COMPLETED"
      : statusStr === "قيد التنفيذ" || statusStr === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : statusStr === "ARCHIVED" || statusStr === "مؤرشف"
          ? "ARCHIVED"
          : statusStr === "متأخر" || statusStr === "BLOCKED"
            ? "BLOCKED"
            : "OPEN";

  const isArchived = newStatus === "ARCHIVED";
  const progress =
    newStatus === "COMPLETED" ? 100 : newStatus === "IN_PROGRESS" ? 50 : 0;
  const now = nowIso();

  // 1. Update in Firestore
  if (db) {
    try {
      await Promise.allSettled(
        validIds.map((id) =>
          db
            .collection("tasks")
            .doc(id)
            .set(
              { status: newStatus, isArchived, progress, updatedAt: now },
              { merge: true },
            ),
        ),
      );
    } catch (fsErr) {
      console.warn("[TasksRouter] Firestore bulk status error:", fsErr);
    }
  }

  // 2. Update in Supabase
  if (supabase) {
    try {
      const arabicStatus =
        newStatus === "COMPLETED"
          ? "مكتمل"
          : newStatus === "IN_PROGRESS"
            ? "قيد التنفيذ"
            : newStatus === "BLOCKED"
              ? "متأخر"
              : "مفتوحة";
      await safeBulkUpdateTasksInSupabase(supabase, validIds, {
        status: arabicStatus,
        updated_at: now,
        is_archived: isArchived,
      });
    } catch (sbErr) {
      console.warn("[TasksRouter] Supabase bulk status error:", sbErr);
    }
  }

  return res.json({ success: true, count: validIds.length });
});

// -------------------------------------------------------------
// 4. PATCH /api/tasks/:id/status — تغيير حالة المهمة
// -------------------------------------------------------------
tasksRouter.patch("/:id/status", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db) {
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
  }

  const taskId = req.params.id;
  const rawStatus = String(req.body?.status || "OPEN").toUpperCase();
  const newStatus =
    rawStatus === "مكتمل" || rawStatus === "مكتملة" || rawStatus === "COMPLETED"
      ? "COMPLETED"
      : rawStatus === "قيد التنفيذ" || rawStatus === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : rawStatus === "ARCHIVED" || rawStatus === "مؤرشف"
          ? "ARCHIVED"
          : "OPEN";

  try {
    const arabicStatus =
      newStatus === "COMPLETED"
        ? "مكتمل"
        : newStatus === "IN_PROGRESS"
          ? "قيد التنفيذ"
          : "مفتوحة";
    const now = nowIso();

    // 1. Update Firestore
    if (db) {
      try {
        await db
          .collection("tasks")
          .doc(taskId)
          .update({
            status: newStatus,
            progress:
              newStatus === "COMPLETED"
                ? 100
                : newStatus === "IN_PROGRESS"
                  ? 50
                  : 0,
            isArchived: newStatus === "ARCHIVED",
            updatedAt: now,
          });
      } catch (fsErr: any) {
        console.warn(
          "[TasksRouter] Firestore status update notice:",
          fsErr?.message,
        );
      }
    }

    // 2. Update Supabase
    if (supabase) {
      // First check existing row to see if it uses Arabic status
      let statusToSet = newStatus;
      try {
        const { data: current } = await supabase
          .from("tasks")
          .select("status")
          .eq("id", taskId)
          .maybeSingle();
        if (
          current &&
          (current.status === "مكتمل" || current.status === "قيد التنفيذ")
        ) {
          statusToSet = arabicStatus;
        }
      } catch {
        // Ignore check error if row cannot be retrieved
      }

      const updates: Record<string, any> = {
        status: statusToSet,
        updated_at: now,
      };
      if (newStatus === "ARCHIVED") {
        updates.is_archived = true;
      } else if (newStatus === "COMPLETED") {
        updates.is_archived = false;
      }

      await safeUpdateTaskInSupabase(supabase, taskId, updates);
    }

    try {
      if (req.user) {
        await writeAuditLog(req, "task.status_changed", "tasks", taskId, {
          status: newStatus,
        });
      }
    } catch (auditErr: any) {
      console.warn("[TasksRouter] audit log write failed:", auditErr?.message);
    }

    return res.json({ success: true, status: newStatus });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "تعذر تحديث المهمة" });
  }
});

// -------------------------------------------------------------
// 5. PATCH /api/tasks/:id — تعديل الحقول
// -------------------------------------------------------------
tasksRouter.patch("/:id", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db) {
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
  }

  const taskId = decodeURIComponent(req.params.id);
  const now = nowIso();
  const updates: Record<string, any> = { updated_at: now };

  if (typeof req.body?.title === "string" && req.body.title.trim()) {
    updates.title = req.body.title.trim().slice(0, 180);
  }
  if (typeof req.body?.description === "string") {
    updates.description = req.body.description.trim().slice(0, 4000);
  }
  if (req.body?.dueDate !== undefined || req.body?.deadline !== undefined) {
    const d = req.body.dueDate || req.body.deadline;
    const formatted = typeof d === "string" && d.trim() ? d.trim() : null;
    updates.due_date = formatted;
    updates.dueDate = formatted;
    updates.deadline = formatted;
  }
  if (req.body?.priority) {
    const p = String(req.body.priority).toUpperCase();
    if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p)) updates.priority = p;
  }

  try {
    // 1. Update Firestore
    if (db) {
      try {
        const fsUpdates: Record<string, any> = { updatedAt: now };
        if (updates.title) fsUpdates.title = updates.title;
        if (updates.description !== undefined)
          fsUpdates.description = updates.description;
        if (updates.due_date !== undefined) {
          fsUpdates.dueDate = updates.due_date;
          fsUpdates.due_date = updates.due_date;
          fsUpdates.deadline = updates.due_date;
        }
        if (updates.priority) fsUpdates.priority = updates.priority;
        if (Array.isArray(req.body?.assigneeUids))
          fsUpdates.assigneeUids = req.body.assigneeUids;
        await db
          .collection("tasks")
          .doc(taskId)
          .set(fsUpdates, { merge: true });
      } catch (fsErr: any) {
        console.warn("[TasksRouter] Firestore patch notice:", fsErr?.message);
      }
    }

    // 2. Update Supabase
    if (supabase) {
      await safeUpdateTaskInSupabase(supabase, taskId, updates);

      // Update assignments if provided
      if (Array.isArray(req.body?.assigneeUids)) {
        try {
          await supabase
            .from("task_assignments")
            .delete()
            .eq("task_id", taskId);
          const newAssignments = req.body.assigneeUids.map((pid: string) => ({
            task_id: taskId,
            profile_id: pid,
            assigned_at: now,
          }));
          if (newAssignments.length > 0) {
            await supabase.from("task_assignments").insert(newAssignments);
          }
        } catch (_asgnErr) {
          // Ignore if task_assignments table does not exist
        }
      }
    }

    return res.json({ success: true, updates });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "تعذر تعديل المهمة" });
  }
});

// -------------------------------------------------------------
// 6. POST /api/tasks/:id/archive — أرشفة المهمة
// -------------------------------------------------------------
tasksRouter.post("/:id/archive", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db)
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });

  const taskId = decodeURIComponent(req.params.id);
  const now = nowIso();
  let foundAndUpdated = false;

  // 1. Try Firestore
  if (db) {
    try {
      const docSnap = await db.collection("tasks").doc(taskId).get();
      if (docSnap && docSnap.exists) {
        await db.collection("tasks").doc(taskId).set(
          {
            isArchived: true,
            status: "ARCHIVED",
            updatedAt: now,
          },
          { merge: true },
        );
        foundAndUpdated = true;
      }
    } catch (fsErr) {
      console.warn("[TasksRouter] Firestore archive error:", fsErr);
    }
  }

  // 2. Try Supabase
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("id", taskId)
        .maybeSingle();
      if (existing) {
        const updateRes = await safeUpdateTaskInSupabase(supabase, taskId, {
          is_archived: true,
          status: "ARCHIVED",
          updated_at: now,
        });
        if (updateRes.success) {
          foundAndUpdated = true;
        }
      }
    } catch (sbErr) {
      console.warn("[TasksRouter] Supabase archive error:", sbErr);
    }
  }

  if (!foundAndUpdated) {
    return res.status(404).json({ success: false, error: "المهمة غير موجودة" });
  }

  try {
    if (req.user) {
      await writeAuditLog(req, "task.archived", "tasks", taskId, {});
    }
  } catch (_err) {
    // Ignore audit log write failures
  }

  return res.json({ success: true });
});

// -------------------------------------------------------------
// 7. POST /api/tasks/:id/restore — استعادة المهمة
// -------------------------------------------------------------
tasksRouter.post("/:id/restore", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db)
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });

  const taskId = decodeURIComponent(req.params.id);
  const now = nowIso();
  let foundAndUpdated = false;

  // 1. Try Firestore
  if (db) {
    try {
      const docSnap = await db.collection("tasks").doc(taskId).get();
      if (docSnap && docSnap.exists) {
        await db.collection("tasks").doc(taskId).set(
          {
            isArchived: false,
            status: "OPEN",
            updatedAt: now,
          },
          { merge: true },
        );
        foundAndUpdated = true;
      }
    } catch (fsErr) {
      console.warn("[TasksRouter] Firestore restore error:", fsErr);
    }
  }

  // 2. Try Supabase
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("id", taskId)
        .maybeSingle();
      if (existing) {
        const updateRes = await safeUpdateTaskInSupabase(supabase, taskId, {
          is_archived: false,
          status: "OPEN",
          updated_at: now,
        });
        if (updateRes.success) {
          foundAndUpdated = true;
        }
      }
    } catch (sbErr) {
      console.warn("[TasksRouter] Supabase restore error:", sbErr);
    }
  }

  if (!foundAndUpdated) {
    return res.status(404).json({ success: false, error: "المهمة غير موجودة" });
  }

  try {
    if (req.user) {
      await writeAuditLog(req, "task.restored", "tasks", taskId, {});
    }
  } catch (_err) {
    // Ignore audit log write failures
  }

  return res.json({ success: true });
});

// -------------------------------------------------------------
// 8. DELETE /api/tasks/:id — حذف نهائي للمهمة
// -------------------------------------------------------------
tasksRouter.delete("/:id", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db)
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });

  const taskId = decodeURIComponent(req.params.id);
  try {
    // 1. Delete from Firestore
    if (db) {
      try {
        await db.collection("tasks").doc(taskId).delete();
      } catch (fsErr: any) {
        console.warn(
          "[TasksRouter] Firestore delete task notice:",
          fsErr?.message,
        );
      }
    }

    // 2. Delete from Supabase
    if (supabase) {
      try {
        await supabase.from("task_assignments").delete().eq("task_id", taskId);
      } catch (_asgnErr) {
        // Table or assignment might not exist, proceed
      }
      try {
        await supabase.from("tasks").delete().eq("id", taskId);
      } catch (sbErr: any) {
        console.warn(
          "[TasksRouter] Supabase delete task notice:",
          sbErr?.message,
        );
      }
      try {
        const { data: stRow } = await supabase
          .from("app_state")
          .select("value")
          .eq("key", "tasks")
          .maybeSingle();
        if (stRow && Array.isArray(stRow.value)) {
          const filtered = stRow.value.filter((t: any) => t.id !== taskId);
          await supabase
            .from("app_state")
            .upsert({ key: "tasks", value: filtered, updated_at: nowIso() });
        }
      } catch (_stErr) {
        // Ignore if app_state does not contain tasks
      }
    }

    return res.json({ success: true, taskId });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "تعذر حذف المهمة" });
  }
});

// -------------------------------------------------------------
// 9. POST /api/tasks/bulk-delete — حذف مجمع ونهائي للمهام
// -------------------------------------------------------------
tasksRouter.post("/bulk-delete", async (req, res) => {
  const supabase = getSupabaseAdminClient();
  const db = getFirebaseAdminFirestore();
  if (!supabase && !db)
    return res
      .status(503)
      .json({ success: false, error: "قاعدة البيانات غير مهيأة" });

  const { taskIds } = req.body || {};
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "يجب تحديد معرفات المهام" });
  }

  const validIds: string[] = taskIds.filter(
    (id): id is string => typeof id === "string" && Boolean(id.trim()),
  );
  if (validIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "لا توجد معرفات مهام صالحة" });
  }

  // 1. Delete from Firestore
  if (db) {
    try {
      await Promise.allSettled(
        validIds.map((id) => db.collection("tasks").doc(id).delete()),
      );
    } catch (fsErr) {
      console.warn("[TasksRouter] Firestore bulk delete error:", fsErr);
    }
  }

  // 2. Delete from Supabase
  if (supabase) {
    try {
      await supabase.from("task_assignments").delete().in("task_id", validIds);
    } catch (_asgnErr) {
      // Table or assignments may not exist, proceed
    }
    try {
      await supabase.from("tasks").delete().in("id", validIds);
    } catch (sbErr) {
      console.warn("[TasksRouter] Supabase bulk delete error:", sbErr);
    }
    try {
      const { data: stRow } = await supabase
        .from("app_state")
        .select("value")
        .eq("key", "tasks")
        .maybeSingle();
      if (stRow && Array.isArray(stRow.value)) {
        const idSet = new Set(validIds);
        const filtered = stRow.value.filter((t: any) => !idSet.has(t.id));
        await supabase
          .from("app_state")
          .upsert({ key: "tasks", value: filtered, updated_at: nowIso() });
      }
    } catch (_stErr) {
      // Ignore
    }
  }

  try {
    if (req.user) {
      await writeAuditLog(
        req,
        "task.bulk_deleted",
        "tasks",
        validIds.join(","),
        { count: validIds.length },
      );
    }
  } catch (_err) {
    // Non-critical audit log failure, proceed
  }

  return res.json({ success: true, count: validIds.length, taskIds: validIds });
});
