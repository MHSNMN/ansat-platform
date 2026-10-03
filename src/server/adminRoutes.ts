import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import bcrypt from "bcryptjs";
import { FieldValue } from "firebase-admin/firestore";
import { requireRbacAction } from "./authMiddleware";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage,
  checkFirestoreHealth,
} from "./firebaseAdmin";
import {
  getSupabaseAdminClient,
  invalidateProfileCache,
} from "./supabaseAdmin";
import { invalidatePublicOverviewCache } from "./publicRoutes";
import {
  normalizeRole,
  getRecommendedPlatformAccess,
  isAuthorizedAdminIdentity,
  isActionAllowed,
} from "../lib/rbacPolicy";
import { normalizeToE164 } from "../lib/phoneUtils";
import {
  getAudioDurationSeconds,
  validateAudioSignature,
  validateImageSignature,
  extractAudioMetadataFromBuffer,
} from "./audioMetadata";
import { PRESET_VOLUNTEER_FORMS } from "../volunteer/volunteerPresets";
import { PRESET_ACTIVITIES } from "../activities/presetActivities";
import { invalidateTasksMembersCache } from "./tasks/tasksRouter";

const adminRouter = Router();
const activeRequests = new Set<string>();

adminRouter.use((req, res, next) => {
  if (req.path.startsWith("/content/") || req.path.startsWith("/cms/")) {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400)
        invalidatePublicOverviewCache();
    });
  }
  next();
});

function cleanString(val: any, maxLen = 100): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

const applicationRoleDisplay = (role: string) => {
  const map: Record<string, string> = {
    SUPER_ADMIN: "مدير عام",
    ADMIN: "مدير",
    AUDIO_ENGINEER: "مهندس صوت",
    QA_REVIEWER: "مراجع جودة",
    NARRATOR: "معلق / راوٍ صوتي",
    OPERATIONS_MANAGER: "إدارة العمليات والتنسيق",
    CONTENT_CREATOR: "صانع محتوى وباحث",
    DESIGNER: "مصمم جرافيك وهوية",
    MEMBER: "عضو متطوع",
  };
  return (
    map[role] ||
    (typeof role === "string" && role.trim() ? role.trim() : "عضو متطوع")
  );
};

export function isSuperAdminCaller(user?: any): boolean {
  if (!user) return false;
  const role = String(user.canonicalRole || user.role || "")
    .toUpperCase()
    .trim();
  return (
    role === "SUPER_ADMIN" ||
    role === "SUPERADMIN" ||
    isAuthorizedAdminIdentity(user)
  );
}

export function isAdminCaller(user?: any): boolean {
  if (!user) return false;
  if (isSuperAdminCaller(user)) return true;
  const role = String(user.canonicalRole || user.role || "")
    .toUpperCase()
    .trim();
  return role === "ADMIN" || role === "ADMINISTRATOR";
}

const ASSIGNABLE_MEMBER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "CONTENT_MANAGER",
  "MEMBERS_MANAGER",
  "OPERATIONS_MANAGER",
  "REWARDS_MANAGER",
  "CERTIFICATE_MANAGER",
  "AUDIO_ENGINEER",
  "QA_REVIEWER",
  "NARRATOR",
  "MEMBER",
] as const;

const ROLE_AUTHORITY: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  CONTENT_MANAGER: 50,
  MEMBERS_MANAGER: 50,
  OPERATIONS_MANAGER: 50,
  REWARDS_MANAGER: 50,
  CERTIFICATE_MANAGER: 50,
  AUDIO_ENGINEER: 20,
  QA_REVIEWER: 20,
  NARRATOR: 20,
  MEMBER: 10,
};

function adminRole(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function callerAuthority(user?: any): number {
  const role = adminRole(user?.canonicalRole || user?.role) || "MEMBER";
  if (role === "SUPER_ADMIN") return ROLE_AUTHORITY.SUPER_ADMIN;
  if (role === "ADMIN") return ROLE_AUTHORITY.ADMIN;
  // Reaching a manage_members route proves an explicit grant. Treat any other
  // caller as a members manager, but never let that grant cross management tiers.
  return ROLE_AUTHORITY.MEMBERS_MANAGER;
}

export function isAssignableMemberRole(
  role: unknown,
): role is (typeof ASSIGNABLE_MEMBER_ROLES)[number] {
  return ASSIGNABLE_MEMBER_ROLES.includes(adminRole(role) as any);
}

export function canAssignMemberRole(user: any, role: unknown): boolean {
  const requestedRole = adminRole(role);
  if (!isAssignableMemberRole(requestedRole)) return false;
  const authority = callerAuthority(user);
  return (
    authority === ROLE_AUTHORITY.SUPER_ADMIN ||
    (ROLE_AUTHORITY[requestedRole] || 0) < authority
  );
}

export function canManageMemberRole(user: any, targetRole: unknown): boolean {
  const authority = callerAuthority(user);
  return (
    authority === ROLE_AUTHORITY.SUPER_ADMIN ||
    (ROLE_AUTHORITY[adminRole(targetRole)] || 0) < authority
  );
}

adminRouter.post(
  "/users",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const {
      name,
      username,
      email,
      password,
      role,
      department,
      phone,
      country,
    } = req.body;
    const idempotencyKey = req.headers["idempotency-key"] as string;

    if (!idempotencyKey) {
      return res
        .status(400)
        .json({ success: false, error: "Idempotency-Key header is required" });
    }

    if (activeRequests.has(idempotencyKey)) {
      return res
        .status(409)
        .json({ success: false, error: "Request is already processing" });
    }

    // Basic validation
    if (!name || typeof name !== "string")
      return res.status(400).json({ success: false, error: "الاسم مطلوب" });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res
        .status(400)
        .json({ success: false, error: "بريد إلكتروني غير صالح" });
    if (!username || !/^[a-zA-Z0-9_]{4,32}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error:
          "اسم المستخدم يجب أن يكون بين 4 و 32 رمزاً ويحتوي على حروف وأرقام وشرطة سفلية فقط",
      });
    }
    const validPassword =
      typeof password === "string" &&
      (/^\d{6,12}$/.test(password) ||
        (password.length >= 8 &&
          /\d/.test(password) &&
          /[a-zA-Z]/.test(password)));
    if (!validPassword) {
      return res.status(400).json({
        success: false,
        error:
          "استخدم PIN من 6 إلى 12 رقماً، أو كلمة مرور من 8 رموز تحتوي حرفاً ورقماً",
      });
    }

    const validRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "NARRATOR",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "دور غير صالح" });
    }

    // Super-admin elevation is never inferred from a client role or display name.
    if (
      (role === "SUPER_ADMIN" || role === "ADMIN") &&
      !isSuperAdminCaller(req.user)
    ) {
      return res
        .status(403)
        .json({ success: false, error: "لا يمكنك منح صلاحية الإدارة العليا" });
    }

    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();
    if (!auth || !db)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const usernameNormalized = username.trim().toLowerCase();
    const phoneNormalized = phone ? normalizeToE164(String(phone)) : "";
    if (phone && !phoneNormalized) {
      return res
        .status(400)
        .json({ success: false, error: "صيغة رقم الهاتف غير صالحة" });
    }

    if (phoneNormalized) {
      const existingPhoneSnap = await db
        .collection("users")
        .where("phoneNormalized", "==", phoneNormalized)
        .limit(1)
        .get();
      if (!existingPhoneSnap.empty) {
        return res.status(409).json({
          success: false,
          error:
            "رقم الهاتف مسجل بالفعل لعضو آخر. يرجى استخدام رقم آخر أو التواصل مع الإدارة.",
        });
      }
    }

    activeRequests.add(idempotencyKey);
    let createdUid: string | null = null;
    let transactionFailed = false;

    try {
      // 1. Transaction to reserve username
      const usernameRef = db.collection("usernames").doc(usernameNormalized);

      await db.runTransaction(async (t) => {
        const doc = await t.get(usernameRef);
        if (doc.exists) {
          transactionFailed = true;
          throw new Error("USERNAME_TAKEN");
        }

        // We reserve it with a temporary placeholder, updated later
        t.set(usernameRef, {
          createdAt: new Date().toISOString(),
          createdBy: req.user?.uid || "system",
        });
      });

      if (transactionFailed) {
        activeRequests.delete(idempotencyKey);
        return res
          .status(409)
          .json({ success: false, error: "اسم المستخدم محجوز مسبقاً" });
      }

      // 2. Create User in Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
      createdUid = userRecord.uid;

      // 3. Set Custom Claims
      await auth.setCustomUserClaims(userRecord.uid, {
        role,
        account_status: "active",
      });

      // 4. Create Firestore Document
      const userDocRef = db.collection("users").doc(userRecord.uid);
      const roleDisplayAr =
        role === "SUPER_ADMIN"
          ? "مدير عام"
          : role === "ADMIN"
            ? "مدير"
            : role === "AUDIO_ENGINEER"
              ? "مهندس صوت"
              : role === "QA_REVIEWER"
                ? "مراجع جودة"
                : "راوي";

      await userDocRef.set({
        uid: userRecord.uid,
        name,
        username,
        usernameNormalized,
        email,
        phone: phoneNormalized || null,
        phoneNormalized: phoneNormalized || null,
        country:
          typeof country === "string" && country.trim() ? country.trim() : null,
        role,
        roleDisplayAr,
        department: department || "",
        status: "active",
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: req.user?.uid || "system",
        updatedAt: new Date().toISOString(),
      });

      // Update username reservation with actual UID
      await usernameRef.update({ uid: userRecord.uid });

      // 5. Audit Log (No password)
      await db.collection("audit_logs").add({
        action: "USER_CREATED",
        targetUid: userRecord.uid,
        role,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        user: {
          uid: userRecord.uid,
          name,
          username,
          email,
          role,
          roleDisplayAr,
          department,
          status: "active",
          isActive: true,
        },
      });
    } catch (error: any) {
      if (error.message === "USERNAME_TAKEN") {
        activeRequests.delete(idempotencyKey);
        return res
          .status(409)
          .json({ success: false, error: "اسم المستخدم محجوز مسبقاً" });
      }

      // Rollback
      console.error("User creation failed, rolling back:", error);
      try {
        if (createdUid) {
          await auth.deleteUser(createdUid);
        }
        await db.collection("usernames").doc(usernameNormalized).delete();
      } catch (rbError) {
        console.error("Rollback failed:", rbError);
        activeRequests.delete(idempotencyKey);
        return res.status(500).json({
          success: false,
          error: "partial_failure",
          message: "حدث خطأ أثناء الإنشاء، وفشل التراجع",
        });
      }

      res.status(500).json({ success: false, error: "حدث خطأ أثناء الإنشاء" });
    } finally {
      activeRequests.delete(idempotencyKey);
    }
  },
);

adminRouter.post(
  "/invite-member",
  requireRbacAction("manage_members"),
  async (req: any, res: any) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });

    const name = cleanString(req.body?.name, 120);
    const email = cleanString(req.body?.email, 254).toLowerCase();
    const rawPhone = cleanString(req.body?.phone, 40);
    const role = adminRole(cleanString(req.body?.role, 40) || "MEMBER");
    const department = cleanString(req.body?.department, 120);
    const country = cleanString(req.body?.country, 80) || "العراق";
    let customCode = cleanString(req.body?.code, 20);

    if (!name) {
      return res
        .status(400)
        .json({ success: false, error: "يرجى كتابة اسم العضو" });
    }

    if (!email && !rawPhone) {
      return res.status(400).json({
        success: false,
        error:
          "يجب إدخال البريد الإلكتروني أو رقم الهاتف على الأقل لربط كود الانضمام",
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, error: "البريد الإلكتروني المدخل غير صالح" });
    }

    if (!isAssignableMemberRole(role)) {
      return res.status(400).json({ success: false, error: "دور غير صالح" });
    }
    if (!canAssignMemberRole(req.user, role)) {
      return res
        .status(403)
        .json({ success: false, error: "لا تملك صلاحية منح هذه الرتبة" });
    }

    const phoneNormalized = rawPhone ? normalizeToE164(rawPhone) : "";

    // Check if active user already exists with this email or phone
    if (email) {
      const existingEmail = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!existingEmail.empty) {
        const exDoc = existingEmail.docs[0].data();
        if (exDoc.status === "active" && exDoc.hasPassword) {
          return res.status(409).json({
            success: false,
            error: "يوجد حساب مفعّل مسبقاً بهذا البريد الإلكتروني",
          });
        }
      }
    }

    if (phoneNormalized) {
      const existingPhone = await db
        .collection("users")
        .where("phoneNormalized", "==", phoneNormalized)
        .limit(1)
        .get();
      if (!existingPhone.empty) {
        const exDoc = existingPhone.docs[0].data();
        if (exDoc.status === "active" && exDoc.hasPassword) {
          return res.status(409).json({
            success: false,
            error: "يوجد حساب مفعّل مسبقاً برقم الهاتف هذا",
          });
        }
      }
    }

    // Generate 6-digit code if not provided
    if (!customCode || customCode.length < 4) {
      customCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const pinHash = await bcrypt.hash(customCode, 10);
    const inviteId = `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const identifier = email || rawPhone || inviteId;

    const roleDisplayAr = applicationRoleDisplay(role);

    const inviteData: any = {
      uid: inviteId,
      id: inviteId,
      name,
      email: email || null,
      phone: rawPhone || null,
      phoneNormalized: phoneNormalized || null,
      identifier,
      role,
      roleDisplayAr,
      department: department || "",
      country,
      status: "pending_activation",
      isActive: false,
      isInvite: true,
      pin: customCode,
      pinHash,
      pinUsed: false,
      createdAt: new Date().toISOString(),
      createdBy: req.user?.uid || "admin",
      createdByEmail: req.user?.email || "admin",
      platformAccess: {
        recording: true,
        tasks: true,
        rewards: true,
        library: true,
        workspace: true,
        admin: role === "ADMIN" || role === "SUPER_ADMIN",
      },
    };

    await db.collection("users").doc(inviteId).set(inviteData);

    await db.collection("audit_logs").add({
      action: "MEMBER_INVITATION_CREATED",
      targetUid: inviteId,
      targetName: name,
      role,
      performedBy: req.user?.uid || "system",
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      code: customCode,
      identifier,
      inviteId,
      name,
      role,
      roleDisplayAr,
      message: "تم إنشاء كود الانضمام بنجاح",
    });
  },
);

let cachedAdminUsersResponse: { data: any[]; timestamp: number } | null = null;
const ADMIN_USERS_CACHE_TTL_MS = 60 * 1000; // 60s cache

export function invalidateAdminUsersCache() {
  cachedAdminUsersResponse = null;
  invalidateTasksMembersCache();
}

adminRouter.use("/users", (req, _res, next) => {
  if (req.method !== "GET") {
    invalidateAdminUsersCache();
  }
  next();
});

adminRouter.get(
  "/users",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const forceRefresh = req.query.forceRefresh === "true";
    const now = Date.now();
    if (
      !forceRefresh &&
      cachedAdminUsersResponse &&
      now - cachedAdminUsersResponse.timestamp < ADMIN_USERS_CACHE_TTL_MS
    ) {
      return res.json({
        success: true,
        users: cachedAdminUsersResponse.data,
        count: cachedAdminUsersResponse.data.length,
        source: "cached",
      });
    }

    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    const supabase = getSupabaseAdminClient();

    try {
      // 1. Fetch from Firestore (Authoritative source of truth for all member profiles)
      let snapshotDocs: any[] = [];
      if (db) {
        try {
          const snap = await db.collection("users").get();
          snapshotDocs = snap.docs;
        } catch (dbErr) {
          console.warn("Firestore users fetch warning:", dbErr);
        }
      }

      // 2. Fetch Auth users
      let authUsers: any[] = [];
      if (auth) {
        try {
          const authListing = await auth.listUsers(1000);
          authUsers = authListing.users;
        } catch (authErr) {
          console.warn("Auth listUsers warning:", authErr);
        }
      }
      const authUserMap = new Map(authUsers.map((u) => [u.uid, u]));

      // 3. Fetch Supabase profiles for platform_access and user_permission_overrides
      const supabaseProfileMap = new Map<string, any>();
      if (supabase) {
        try {
          const { data: profiles, error: supaErr } = await supabase
            .from("profiles")
            .select(
              `
            id,
            firebase_uid,
            email,
            username,
            full_name,
            role_id,
            status,
            country,
            nationality,
            field,
            bio,
            birth_date,
            is_super_admin,
            created_at,
            updated_at,
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
            .eq("is_archived", false);

          if (!supaErr && Array.isArray(profiles)) {
            for (const p of profiles) {
              if (p.firebase_uid) supabaseProfileMap.set(p.firebase_uid, p);
              if (p.id) supabaseProfileMap.set(p.id, p);
              if (p.email)
                supabaseProfileMap.set(p.email.toLowerCase().trim(), p);
              if (p.username)
                supabaseProfileMap.set(p.username.toLowerCase().trim(), p);
            }
          }
        } catch (sbErr) {
          console.warn("Supabase profiles query warning in GET /users:", sbErr);
        }
      }

      const firestoreUserUids = new Set<string>();
      const seenEmails = new Set<string>();

      const users = snapshotDocs.map((doc) => {
        const data = doc.data() || {};
        const uid = data.uid || doc.id;
        firestoreUserUids.add(uid);
        if (data.email) seenEmails.add(data.email.toLowerCase().trim());

        const authUser = authUserMap.get(uid);
        const supaProfile =
          supabaseProfileMap.get(uid) ||
          supabaseProfileMap.get(doc.id) ||
          (data.email
            ? supabaseProfileMap.get(data.email.toLowerCase().trim())
            : null) ||
          (data.username
            ? supabaseProfileMap.get(data.username.toLowerCase().trim())
            : null);

        const claims = authUser?.customClaims || {};
        const {
          password: _p,
          passwordHash: _ph,
          pin: _pi,
          refreshToken: _rt,
          idToken: _it,
          ...safeData
        } = data;

        // Authoritative roles and status: Prioritize Firestore document explicitly
        const effectiveRole = normalizeRole(
          data.role || data.canonicalRole || "MEMBER",
        );
        const rawStatus = (
          data.status ||
          data.accountStatus ||
          (supaProfile?.status ? supaProfile.status.toLowerCase() : "") ||
          claims.account_status ||
          "active"
        ).toLowerCase();
        const effectiveStatus = [
          "active",
          "pending",
          "disabled",
          "suspended",
        ].includes(rawStatus)
          ? rawStatus
          : "active";

        const resolvedName = (
          data.name ||
          data.displayName ||
          data.fullName ||
          authUser?.displayName ||
          (claims as any)?.name ||
          supaProfile?.full_name ||
          (data.email ? data.email.split("@")[0] : "") ||
          (authUser?.email ? authUser.email.split("@")[0] : "") ||
          "عضو إنصات"
        ).trim();

        // Platform Access: Combine defaults, Firestore access, and Supabase platform_access overrides
        const recommended = getRecommendedPlatformAccess(effectiveRole);
        const platAccess: Record<string, boolean> = {
          ...recommended,
          ...(data.platformAccess || {}),
        };
        const isActive =
          effectiveStatus !== "disabled" && effectiveStatus !== "suspended";
        platAccess.recording = isActive && platAccess.recording !== false;
        platAccess.tasks = isActive && platAccess.tasks !== false;
        platAccess.rewards = isActive && platAccess.rewards !== false;
        platAccess.admin =
          isActive &&
          (platAccess.admin === true || effectiveRole === "SUPER_ADMIN");
        platAccess.public = true;

        // Action Access Overrides
        const actionAccess: Record<string, string> = {
          ...(data.actionAccess || {}),
        };

        return {
          ...safeData,
          id: uid,
          uid,
          name: resolvedName,
          displayName: resolvedName,
          fullName: resolvedName,
          email: data.email || authUser?.email || supaProfile?.email || "",
          phone:
            data.phone ||
            data.phoneNumber ||
            data.phoneNormalized ||
            authUser?.phoneNumber ||
            supaProfile?.phone ||
            "",
          username:
            data.username ||
            supaProfile?.username ||
            (data.email ? data.email.split("@")[0] : "") ||
            (authUser?.email ? authUser.email.split("@")[0] : "") ||
            uid.slice(0, 8),
          role: effectiveRole,
          canonicalRole: effectiveRole,
          roleDisplayAr:
            data.roleDisplayAr || applicationRoleDisplay(effectiveRole),
          country:
            data.country || data.nationality || supaProfile?.country || "",
          nationality:
            data.nationality || data.country || supaProfile?.nationality || "",
          department: data.department || "",
          field: data.field || supaProfile?.field || "",
          bio: data.bio || supaProfile?.bio || "",
          age: data.age || supaProfile?.birth_date || "",
          status: effectiveStatus,
          accountStatus: effectiveStatus,
          isActive,
          is_super_admin: effectiveRole === "SUPER_ADMIN",
          legacyMigrated: Boolean(data.legacyMigrated),
          migratedViaPin: Boolean(data.migratedViaPin),
          migrationAuditStatus: data.migrationAuditStatus || "",
          migrationAuditNotes: data.migrationAuditNotes || "",
          migrationAuditedAt: data.migrationAuditedAt || "",
          migratedAt: data.migratedAt || "",
          legacyId: data.legacyId || "",
          platformAccess: platAccess,
          actionAccess,
          permissions: data.permissions || data.custom_permissions || {},
          custom_permissions: data.permissions || data.custom_permissions || {},
          createdAt:
            data.createdAt ||
            supaProfile?.created_at ||
            doc.createTime?.toDate?.()?.toISOString?.() ||
            new Date().toISOString(),
          updatedAt:
            data.updatedAt ||
            supaProfile?.updated_at ||
            doc.updateTime?.toDate?.()?.toISOString?.() ||
            new Date().toISOString(),
        };
      });

      // Also include any Supabase-only profiles if any exist
      if (supabase) {
        for (const [key, p] of supabaseProfileMap.entries()) {
          const pUid = p.firebase_uid || p.id;
          const pEmail = (p.email || "").toLowerCase().trim();
          if (
            pUid &&
            !firestoreUserUids.has(pUid) &&
            (!pEmail || !seenEmails.has(pEmail))
          ) {
            firestoreUserUids.add(pUid);
            if (pEmail) seenEmails.add(pEmail);

            const canonicalRole = normalizeRole(p.role_id || "MEMBER");
            const recommended = getRecommendedPlatformAccess(canonicalRole);
            const platAccess: Record<string, boolean> = { ...recommended };
            if (Array.isArray(p.platform_access)) {
              p.platform_access.forEach((pa: any) => {
                platAccess[pa.platform_id] = Boolean(pa.is_allowed);
              });
            }
            const pStatus = (p.status || "ACTIVE").toLowerCase();
            const isActive = pStatus !== "disabled" && pStatus !== "suspended";
            const isAdminAuthorized = isAuthorizedAdminIdentity({
              email: p.email,
              username: p.username,
              role: canonicalRole,
              canonicalRole,
            });

            platAccess.recording = isActive && platAccess.recording !== false;
            platAccess.tasks = isActive && platAccess.tasks !== false;
            platAccess.rewards = isActive && platAccess.rewards !== false;
            platAccess.admin =
              isActive &&
              isAdminAuthorized &&
              (platAccess.admin === true || canonicalRole === "SUPER_ADMIN");
            platAccess.public = true;

            const actionAccess: Record<string, string> = {};
            if (Array.isArray(p.user_permission_overrides)) {
              p.user_permission_overrides.forEach((po: any) => {
                actionAccess[po.permission_id] = po.state;
              });
            }

            users.push({
              id: p.id,
              uid: pUid,
              name: p.full_name || "عضو إنصات",
              displayName: p.full_name || "عضو إنصات",
              fullName: p.full_name || "عضو إنصات",
              email: p.email || "",
              phone: p.phone || "",
              username:
                p.username ||
                (p.email ? p.email.split("@")[0] : pUid.slice(0, 8)),
              role: canonicalRole,
              canonicalRole,
              roleDisplayAr: applicationRoleDisplay(canonicalRole),
              country: p.country || "",
              nationality: p.nationality || p.country || "",
              department: "",
              field: p.field || "",
              bio: p.bio || "",
              age: p.birth_date || "",
              status: pStatus,
              accountStatus: pStatus,
              isActive,
              is_super_admin: Boolean(p.is_super_admin),
              platformAccess: platAccess,
              actionAccess,
              permissions: {},
              custom_permissions: {},
              createdAt: p.created_at || new Date().toISOString(),
              updatedAt: p.updated_at || new Date().toISOString(),
            });
          }
        }
      }

      // Also include any Auth users not in Firestore or Supabase
      for (const authUser of authUsers) {
        const aEmail = (authUser.email || "").toLowerCase().trim();
        if (
          !firestoreUserUids.has(authUser.uid) &&
          (!aEmail || !seenEmails.has(aEmail))
        ) {
          firestoreUserUids.add(authUser.uid);
          if (aEmail) seenEmails.add(aEmail);

          const claims = authUser.customClaims || {};
          const effectiveRole = normalizeRole(claims.role || "MEMBER");
          const resolvedName = (
            authUser.displayName ||
            (claims as any)?.name ||
            (authUser.email ? authUser.email.split("@")[0] : "") ||
            "عضو إنصات"
          ).trim();
          const userStatus =
            typeof claims.account_status === "string"
              ? claims.account_status
              : "active";
          const isActive =
            userStatus !== "disabled" && userStatus !== "suspended";
          const rawAccess =
            claims.platform_access && typeof claims.platform_access === "object"
              ? claims.platform_access
              : {};
          const isAdminAuthorized = isAuthorizedAdminIdentity({
            email: authUser.email,
            role: effectiveRole,
            canonicalRole: effectiveRole,
          });

          users.push({
            id: authUser.uid,
            uid: authUser.uid,
            name: resolvedName,
            displayName: resolvedName,
            fullName: resolvedName,
            email: authUser.email || "",
            phone: authUser.phoneNumber || "",
            username:
              (authUser.email ? authUser.email.split("@")[0] : "") ||
              authUser.uid.slice(0, 8),
            role: effectiveRole,
            canonicalRole: effectiveRole,
            roleDisplayAr: applicationRoleDisplay(effectiveRole),
            country: "",
            nationality: "",
            department: "",
            field: "",
            bio: "",
            age: "",
            status: userStatus,
            accountStatus: userStatus,
            isActive,
            is_super_admin: effectiveRole === "SUPER_ADMIN",
            permissions:
              (claims as any).permissions ||
              (claims as any).custom_permissions ||
              {},
            custom_permissions:
              (claims as any).permissions ||
              (claims as any).custom_permissions ||
              {},
            platformAccess: {
              recording: isActive && rawAccess.recording !== false,
              tasks: isActive && rawAccess.tasks !== false,
              rewards: isActive && rawAccess.rewards !== false,
              admin:
                isActive &&
                isAdminAuthorized &&
                (rawAccess.admin === true || effectiveRole === "SUPER_ADMIN"),
              public: true,
            },
            actionAccess: {},
            createdAt:
              authUser.metadata?.creationTime || new Date().toISOString(),
            updatedAt:
              authUser.metadata?.lastSignInTime || new Date().toISOString(),
          });
        }
      }

      cachedAdminUsersResponse = { data: users, timestamp: now };
      return res.json({
        success: true,
        users,
        count: users.length,
        source: "unified",
      });
    } catch (error: any) {
      console.error("Failed to fetch users in /api/admin/users:", error);
      return res.status(500).json({
        success: false,
        error: "تعذر تحميل قائمة الأعضاء",
        details: error?.message || error,
      });
    }
  },
);

adminRouter.get(
  "/system-status",
  requireRbacAction("manage_members"),
  async (_req, res) => {
    try {
      const health = await checkFirestoreHealth(true);
      res.json({
        success: true,
        firestore: {
          isAvailable: health.isAvailable,
          projectId: health.projectId,
          databaseMode: health.databaseMode,
          databaseId: health.databaseId || "(default)",
          ...(health.errorMessage && { message: health.errorMessage }),
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "تعذر فحص حالة النظام",
        details: err?.message || err,
      });
    }
  },
);

async function safelySyncUserAuth(
  auth: any,
  uid: string,
  options: {
    updatesForAuth?: {
      email?: string;
      password?: string;
      displayName?: string;
      disabled?: boolean;
    };
    claimsUpdate?: {
      role?: string;
      account_status?: string;
      token_version?: number;
      platform_access?: Record<string, boolean>;
    };
    userDataFallback?: { email?: string; name?: string; password?: string };
  },
) {
  if (!auth) return;
  const updatesForAuth = options.updatesForAuth || {};
  const claimsUpdate = options.claimsUpdate;
  const userDataFallback = options.userDataFallback;

  try {
    let authUser: any = null;
    try {
      authUser = await auth.getUser(uid);
    } catch (err: any) {
      if (
        err?.code === "auth/user-not-found" ||
        (typeof err?.message === "string" &&
          err.message.includes("no user record"))
      ) {
        const email = updatesForAuth.email || userDataFallback?.email;
        if (email) {
          try {
            authUser = await auth.getUserByEmail(email);
          } catch {
            try {
              authUser = await auth.createUser({
                uid,
                email,
                displayName:
                  updatesForAuth.displayName ||
                  userDataFallback?.name ||
                  undefined,
                // Never provision accounts with a shared or predictable password.
                // Firestore-only profiles receive an unusable random bootstrap
                // credential until the normal password-reset flow is completed.
                password:
                  updatesForAuth.password ||
                  `${crypto.randomBytes(32).toString("base64url")}Aa1!`,
                disabled: updatesForAuth.disabled || false,
              });
            } catch (createErr) {
              console.warn(
                `Could not provision Auth record for ${uid}:`,
                createErr,
              );
            }
          }
        }
      } else {
        console.warn(`Auth.getUser failed for ${uid}:`, err?.message);
      }
    }

    if (authUser) {
      const targetAuthUid = authUser.uid;
      if (Object.keys(updatesForAuth).length > 0) {
        try {
          await auth.updateUser(targetAuthUid, updatesForAuth);
          if (updatesForAuth.password) {
            await auth.revokeRefreshTokens(targetAuthUid).catch(() => {});
          }
        } catch (updateErr: any) {
          console.warn(
            `Auth.updateUser failed for ${targetAuthUid}:`,
            updateErr?.message,
          );
        }
      }

      if (claimsUpdate) {
        try {
          const currentClaims = authUser.customClaims || {};
          await auth.setCustomUserClaims(targetAuthUid, {
            ...currentClaims,
            ...(claimsUpdate.role
              ? { role: claimsUpdate.role, canonicalRole: claimsUpdate.role }
              : {}),
            ...(claimsUpdate.account_status
              ? { account_status: claimsUpdate.account_status }
              : {}),
            ...(claimsUpdate.token_version !== undefined
              ? { token_version: claimsUpdate.token_version }
              : {}),
            ...(claimsUpdate.platform_access
              ? { platform_access: claimsUpdate.platform_access }
              : {}),
          });
          await auth.revokeRefreshTokens(targetAuthUid).catch(() => {});
        } catch (claimsErr: any) {
          console.warn(
            `Auth.setCustomUserClaims failed for ${targetAuthUid}:`,
            claimsErr?.message,
          );
        }
      }
      return targetAuthUid;
    }
  } catch (outerErr: any) {
    console.warn(`safelySyncUserAuth error for ${uid}:`, outerErr?.message);
  }
}

async function syncUserProfileToSupabase(
  effectiveUid: string,
  uid: string,
  email: string | undefined,
  updates: {
    name?: string;
    fullName?: string;
    role?: string;
    status?: string;
    country?: string;
    nationality?: string;
    phone?: string;
    phoneNormalized?: string;
    username?: string;
    bio?: string;
    field?: string;
    [key: string]: any;
  },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  try {
    const cleanEmail = (email || "").toLowerCase().trim();
    const cleanUid = (effectiveUid || uid || "").trim();

    // Look for existing profile in Supabase
    let query = supabase
      .from("profiles")
      .select("id, firebase_uid, email, role_id, status");
    if (cleanUid && cleanEmail) {
      query = query.or(
        `firebase_uid.eq.${cleanUid},id.eq.${cleanUid},email.eq.${cleanEmail}`,
      );
    } else if (cleanUid) {
      query = query.or(`firebase_uid.eq.${cleanUid},id.eq.${cleanUid}`);
    } else if (cleanEmail) {
      query = query.eq("email", cleanEmail);
    } else {
      return;
    }

    const { data: profs, error: fetchErr } = await query.limit(1);
    const existing = profs && profs[0];

    const profileUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const resolvedName = updates.name || updates.fullName;
    if (resolvedName && typeof resolvedName === "string") {
      profileUpdates.full_name = resolvedName.trim();
      profileUpdates.display_name = resolvedName.trim();
    }
    if (updates.role && typeof updates.role === "string") {
      profileUpdates.role_id = updates.role.toLowerCase();
      profileUpdates.is_super_admin =
        updates.role.toUpperCase() === "SUPER_ADMIN";
    }
    if (updates.status && typeof updates.status === "string") {
      profileUpdates.status = updates.status.toUpperCase();
    }
    if (updates.country !== undefined) {
      profileUpdates.country =
        typeof updates.country === "string" ? updates.country.trim() : null;
    }
    if (updates.nationality !== undefined) {
      profileUpdates.nationality =
        typeof updates.nationality === "string"
          ? updates.nationality.trim()
          : null;
    }
    if (updates.phone !== undefined) {
      profileUpdates.phone =
        typeof updates.phone === "string" ? updates.phone.trim() : null;
    }
    if (updates.phoneNormalized !== undefined) {
      profileUpdates.phone_normalized =
        typeof updates.phoneNormalized === "string"
          ? updates.phoneNormalized.trim()
          : null;
    }
    if (updates.username !== undefined) {
      profileUpdates.username =
        typeof updates.username === "string" ? updates.username.trim() : null;
    }
    if (updates.bio !== undefined) {
      profileUpdates.bio =
        typeof updates.bio === "string" ? updates.bio.trim() : null;
    }
    if (updates.field !== undefined) {
      profileUpdates.field =
        typeof updates.field === "string" ? updates.field.trim() : null;
    }

    if (existing) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", existing.id);

      if (updateErr) {
        console.warn(
          "[AdminRoutes] Supabase profile update error:",
          updateErr.message,
        );
      }
      invalidateProfileCache(existing.id);
    } else if (cleanUid) {
      const insertPayload: Record<string, any> = {
        id: cleanUid,
        firebase_uid: cleanUid,
        email: cleanEmail || `${cleanUid}@ansat.org`,
        username:
          updates.username ||
          (cleanEmail ? cleanEmail.split("@")[0] : cleanUid),
        full_name: resolvedName || "عضو إنصات",
        role_id: (updates.role || "MEMBER").toLowerCase(),
        status: (updates.status || "ACTIVE").toUpperCase(),
        is_super_admin: updates.role?.toUpperCase() === "SUPER_ADMIN",
        created_at: new Date().toISOString(),
        ...profileUpdates,
      };
      const { error: insertErr } = await supabase
        .from("profiles")
        .upsert(insertPayload, { onConflict: "firebase_uid" });

      if (insertErr) {
        console.warn(
          "[AdminRoutes] Supabase profile upsert error:",
          insertErr.message,
        );
      }
    }

    invalidateProfileCache(cleanUid);
    if (uid && uid !== cleanUid) invalidateProfileCache(uid);
  } catch (err: any) {
    console.warn(
      "[AdminRoutes] Supabase profile sync warning:",
      err?.message || err,
    );
  }
}

adminRouter.put(
  "/users/:uid/profile",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const {
      name,
      username,
      email,
      password,
      phone,
      country,
      nationality,
      department,
      role,
      status,
      bio,
      age,
      field,
      publicProfileConsent,
      platformAccess,
      actionAccess,
    } = req.body;

    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();
    if (!auth || !db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    try {
      let userDocRef = db.collection("users").doc(uid);
      let userDocSnap = await userDocRef.get();
      let effectiveUid = uid;

      if (!userDocSnap.exists) {
        const snap = await db
          .collection("users")
          .where("uid", "==", uid)
          .limit(1)
          .get();
        if (!snap.empty) {
          userDocSnap = snap.docs[0];
          userDocRef = userDocSnap.ref;
          effectiveUid = userDocSnap.data().uid || userDocSnap.id;
        } else {
          const cleanUidLower = uid.toLowerCase().trim();
          const emailSnap = await db
            .collection("users")
            .where("email", "==", cleanUidLower)
            .limit(1)
            .get();
          if (!emailSnap.empty) {
            userDocSnap = emailSnap.docs[0];
            userDocRef = userDocSnap.ref;
            effectiveUid = userDocSnap.data().uid || userDocSnap.id;
          } else {
            const usernameSnap = await db
              .collection("users")
              .where("usernameNormalized", "==", cleanUidLower)
              .limit(1)
              .get();
            if (!usernameSnap.empty) {
              userDocSnap = usernameSnap.docs[0];
              userDocRef = userDocSnap.ref;
              effectiveUid = userDocSnap.data().uid || userDocSnap.id;
            } else {
              const phoneSnap = await db
                .collection("users")
                .where("phone", "==", uid)
                .limit(1)
                .get();
              if (!phoneSnap.empty) {
                userDocSnap = phoneSnap.docs[0];
                userDocRef = userDocSnap.ref;
                effectiveUid = userDocSnap.data().uid || userDocSnap.id;
              } else if (email && typeof email === "string" && email.trim()) {
                const bodyEmailSnap = await db
                  .collection("users")
                  .where("email", "==", email.toLowerCase().trim())
                  .limit(1)
                  .get();
                if (!bodyEmailSnap.empty) {
                  userDocSnap = bodyEmailSnap.docs[0];
                  userDocRef = userDocSnap.ref;
                  effectiveUid = userDocSnap.data().uid || userDocSnap.id;
                }
              }
            }
          }
        }
      }

      if (!userDocSnap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "المستخدم غير موجود" });
      }
      const currentData = userDocSnap.data() || {};
      if (!effectiveUid || effectiveUid === uid) {
        effectiveUid = currentData.uid || userDocSnap.id;
      }

      const callerIsSuperAdmin = isSuperAdminCaller(req.user);
      const requestedRole = role !== undefined ? adminRole(role) : undefined;
      if (
        !canManageMemberRole(
          req.user,
          currentData.role || currentData.canonicalRole,
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "لا تملك صلاحية تعديل حساب بهذه الرتبة",
        });
      }
      if (requestedRole && !isAssignableMemberRole(requestedRole)) {
        return res.status(400).json({ success: false, error: "دور غير صالح" });
      }
      if (requestedRole && !canAssignMemberRole(req.user, requestedRole)) {
        return res
          .status(403)
          .json({ success: false, error: "لا تملك صلاحية منح هذه الرتبة" });
      }
      if (
        platformAccess &&
        !isActionAllowed(req.user, "manage_platform_access")
      ) {
        return res
          .status(403)
          .json({ success: false, error: "لا تملك صلاحية تعديل دخول المنصات" });
      }
      if (
        actionAccess &&
        !isActionAllowed(req.user, "manage_action_permissions")
      ) {
        return res.status(403).json({
          success: false,
          error: "لا تملك صلاحية تعديل الصلاحيات الدقيقة",
        });
      }

      // 0. Prevent Self-Privilege Escalation: Nobody except Super Admin can alter their own role/status/permissions
      const isSelf = [uid, effectiveUid, currentData.uid, userDocSnap.id]
        .filter(Boolean)
        .includes(req.user?.uid);
      if (isSelf && !callerIsSuperAdmin) {
        if (role || status || platformAccess || actionAccess) {
          return res.status(403).json({
            success: false,
            error:
              "غير مصرح لك بترقية حسابك أو تعديل رتبتك أو صلاحياتك أو حالة حسابك بنفسك",
          });
        }
      }

      // Members Manager specific restrictions
      if (req.user?.canonicalRole === "MEMBERS_MANAGER") {
        if (
          platformAccess &&
          (platformAccess.admin === true || platformAccess.admin === "ALLOW")
        ) {
          return res.status(403).json({
            success: false,
            error: "لا يمكنك منح صلاحية دخول لوحة الإدارة",
          });
        }
      }

      const updatesForAuth: {
        email?: string;
        password?: string;
        displayName?: string;
        disabled?: boolean;
      } = {};
      let nextTokenVersion = Number(currentData.tokenVersion) || 1;
      const updatesForFirestore: Record<string, any> = {
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.uid || "system",
        // Completely expunge sensitive credentials from Firestore users collection
        passwordHash: FieldValue.delete(),
        pin: FieldValue.delete(),
        pinHash: FieldValue.delete(),
        salt: FieldValue.delete(),
      };

      // 1. Name
      if (typeof name === "string" && name.trim()) {
        updatesForAuth.displayName = name.trim();
        updatesForFirestore.name = name.trim();
      }

      // 2. Email
      if (
        typeof email === "string" &&
        email.trim() &&
        email.trim().toLowerCase() !== (currentData.email || "").toLowerCase()
      ) {
        const cleanEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          return res
            .status(400)
            .json({ success: false, error: "البريد الإلكتروني غير صالح" });
        }
        updatesForAuth.email = cleanEmail;
        updatesForFirestore.email = cleanEmail;
      }

      // 3. Password - unify source of truth & invalidate legacy hashes
      if (typeof password === "string" && password.trim()) {
        const trimmedPass = password.trim();
        if (trimmedPass.length < 6) {
          return res.status(400).json({
            success: false,
            error: "كلمة المرور يجب أن لا تقل عن 6 أحرف/أرقام",
          });
        }
        updatesForAuth.password = trimmedPass;
        // Invalidate legacy passwordHash, pin, pinHash in Firestore to enforce single source of truth in Firebase Auth
        updatesForFirestore.passwordHash = FieldValue.delete();
        updatesForFirestore.pin = FieldValue.delete();
        updatesForFirestore.pinHash = FieldValue.delete();
        updatesForFirestore.salt = FieldValue.delete();
        updatesForFirestore.pinUsed = true;
        nextTokenVersion += 1;
        updatesForFirestore.tokenVersion = nextTokenVersion;
      }

      // 4. Username
      if (typeof username === "string" && username.trim()) {
        const cleanUsername = username.trim();
        const cleanNormalized = cleanUsername.toLowerCase();
        const currentNormalized = (
          currentData.usernameNormalized ||
          currentData.username ||
          ""
        ).toLowerCase();

        if (cleanNormalized !== currentNormalized) {
          if (!/^[a-zA-Z0-9_]{3,32}$/.test(cleanUsername)) {
            return res.status(400).json({
              success: false,
              error: "اسم المستخدم يجب أن يكون بين 3 و 32 رمزاً بدون مسافات",
            });
          }
          const existingUsernameDoc = await db
            .collection("usernames")
            .doc(cleanNormalized)
            .get();
          if (existingUsernameDoc.exists) {
            const ownerUid = existingUsernameDoc.data()?.uid;
            if (
              ownerUid &&
              ownerUid !== uid &&
              ownerUid !== effectiveUid &&
              ownerUid !== currentData.uid
            ) {
              return res.status(409).json({
                success: false,
                error: "اسم المستخدم محجوز مسبقاً لعضو آخر",
              });
            }
          }
          // Release old username reservation if existed
          if (currentNormalized) {
            await db
              .collection("usernames")
              .doc(currentNormalized)
              .delete()
              .catch(() => {});
          }
          // Reserve new username
          await db
            .collection("usernames")
            .doc(cleanNormalized)
            .set({
              uid: effectiveUid || uid,
              username: cleanUsername,
              updatedAt: new Date().toISOString(),
              updatedBy: req.user?.uid || "system",
            });
          updatesForFirestore.username = cleanUsername;
          updatesForFirestore.usernameNormalized = cleanNormalized;
        }
      }

      // 5. Phone
      if (phone !== undefined) {
        const rawPhone = typeof phone === "string" ? phone.trim() : "";
        if (rawPhone) {
          const phoneNormalized = normalizeToE164(rawPhone);
          if (phoneNormalized) {
            updatesForFirestore.phone = phoneNormalized;
            updatesForFirestore.phoneNormalized = phoneNormalized;
          } else {
            updatesForFirestore.phone = rawPhone;
          }
        } else {
          updatesForFirestore.phone = "";
          updatesForFirestore.phoneNormalized = "";
        }
      }

      // 6. Country & Nationality
      if (country !== undefined)
        updatesForFirestore.country =
          typeof country === "string" ? country.trim() : "";
      if (nationality !== undefined)
        updatesForFirestore.nationality =
          typeof nationality === "string" ? nationality.trim() : "";

      // 7. Department
      if (department !== undefined)
        updatesForFirestore.department =
          typeof department === "string" ? department.trim() : "";

      // 8. Bio, Age, Field, Public Profile Consent
      if (bio !== undefined)
        updatesForFirestore.bio = typeof bio === "string" ? bio.trim() : "";
      if (age !== undefined)
        updatesForFirestore.age =
          typeof age === "string" || typeof age === "number" ? age : "";
      if (field !== undefined)
        updatesForFirestore.field =
          typeof field === "string" ? field.trim() : "";
      if (publicProfileConsent !== undefined)
        updatesForFirestore.publicProfileConsent =
          Boolean(publicProfileConsent);

      // 9. Status
      if (
        status &&
        ["active", "pending", "disabled", "suspended"].includes(status)
      ) {
        updatesForFirestore.status = status;
        updatesForFirestore.accountStatus = status;
        updatesForFirestore.isActive = status === "active";
        updatesForAuth.disabled =
          status === "disabled" || status === "suspended";
      }

      // 10. Role
      let roleChanged = false;
      if (requestedRole) {
        updatesForFirestore.role = requestedRole;
        updatesForFirestore.canonicalRole = requestedRole;
        updatesForFirestore.roleDisplayAr =
          applicationRoleDisplay(requestedRole);
        if (
          requestedRole !==
          adminRole(currentData.role || currentData.canonicalRole)
        ) {
          roleChanged = true;
          nextTokenVersion += 1;
          updatesForFirestore.tokenVersion = nextTokenVersion;
        }
      }

      // Safely sync Auth and Custom Claims (without crashing if Auth user is absent)
      await safelySyncUserAuth(auth, effectiveUid, {
        updatesForAuth,
        claimsUpdate:
          roleChanged || requestedRole || status
            ? {
                role: updatesForFirestore.role || requestedRole,
                account_status: updatesForFirestore.status || status,
                token_version: nextTokenVersion,
              }
            : undefined,
        userDataFallback: {
          email: currentData.email,
          name: currentData.name,
        },
      });

      // Apply Firestore updates
      await userDocRef.set(updatesForFirestore, { merge: true });

      // Audit log
      await db.collection("audit_logs").add({
        action: "USER_PROFILE_UPDATED_BY_ADMIN",
        targetUid: effectiveUid,
        updatedFields: Object.keys(updatesForFirestore),
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      // Sync to Supabase profiles table
      await syncUserProfileToSupabase(
        effectiveUid,
        uid,
        updatesForFirestore.email || currentData.email,
        updatesForFirestore,
      );

      const refreshedDoc = await userDocRef.get();
      const finalData = refreshedDoc.data() || {};
      const {
        password: _p,
        passwordHash: _ph,
        pin: _pi,
        ...safeUser
      } = finalData;

      return res.json({
        success: true,
        message: "تم حفظ وتحديث بيانات العضو بنجاح",
        user: { id: uid, uid, ...safeUser },
      });
    } catch (error: any) {
      console.error("Failed to update user profile:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "تعذر تحديث بيانات العضو",
      });
    }
  },
);

adminRouter.patch(
  "/users/:uid/platform-access",
  requireRbacAction("manage_platform_access"),
  async (req, res) => {
    const { uid } = req.params;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    if (!isActionAllowed(req.user, "manage_platform_access"))
      return res.status(403).json({
        success: false,
        error: "تخصيص دخول المنصات محصور بإدارة المنظومة",
      });

    const rawSource =
      req.body?.platformAccess || req.body?.permissions || req.body;
    if (
      !rawSource ||
      typeof rawSource !== "object" ||
      Array.isArray(rawSource)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "إعدادات الوصول غير صالحة" });
    }

    try {
      let userDocRef = db.collection("users").doc(uid);
      let userDoc = await userDocRef.get();
      let effectiveUid = uid;

      if (!userDoc.exists) {
        const snap = await db
          .collection("users")
          .where("uid", "==", uid)
          .limit(1)
          .get();
        if (!snap.empty) {
          userDoc = snap.docs[0];
          userDocRef = userDoc.ref;
          effectiveUid = userDoc.id;
        } else {
          // Additional lookup by email, phone, or username
          const emailSnap = await db
            .collection("users")
            .where("email", "==", uid)
            .limit(1)
            .get();
          if (!emailSnap.empty) {
            userDoc = emailSnap.docs[0];
            userDocRef = userDoc.ref;
            effectiveUid = userDoc.id;
          } else {
            const phoneSnap = await db
              .collection("users")
              .where("phone", "==", uid)
              .limit(1)
              .get();
            if (!phoneSnap.empty) {
              userDoc = phoneSnap.docs[0];
              userDocRef = userDoc.ref;
              effectiveUid = userDoc.id;
            }
          }
        }
      }

      const userData = userDoc.data() || {};
      const currentPlatformAccess = userData?.platformAccess || {};

      const toBool = (val: any, fallback: boolean): boolean => {
        if (typeof val === "boolean") return val;
        if (typeof val === "string") {
          const lower = val.trim().toLowerCase();
          if (lower === "true" || lower === "1" || lower === "yes") return true;
          if (lower === "false" || lower === "0" || lower === "no")
            return false;
        }
        if (typeof val === "number") return val !== 0;
        return fallback;
      };

      const platformAccess: Record<string, boolean> = {
        recording:
          rawSource.recording !== undefined
            ? toBool(rawSource.recording, false)
            : rawSource.canAccessRecordingSite !== undefined
              ? toBool(rawSource.canAccessRecordingSite, false)
              : req.body?.permissions?.canAccessRecordingSite !== undefined
                ? toBool(req.body.permissions.canAccessRecordingSite, false)
                : toBool(currentPlatformAccess.recording, false),
        tasks:
          rawSource.tasks !== undefined
            ? toBool(rawSource.tasks, true)
            : toBool(currentPlatformAccess.tasks, true),
        rewards:
          rawSource.rewards !== undefined
            ? toBool(rawSource.rewards, true)
            : toBool(currentPlatformAccess.rewards, true),
        admin:
          rawSource.admin !== undefined
            ? toBool(rawSource.admin, false)
            : rawSource.canAccessAdminPanel !== undefined
              ? toBool(rawSource.canAccessAdminPanel, false)
              : req.body?.permissions?.canAccessAdminPanel !== undefined
                ? toBool(req.body.permissions.canAccessAdminPanel, false)
                : toBool(currentPlatformAccess.admin, false),
      };

      if (userData?.role === "SUPER_ADMIN" && platformAccess.admin === false) {
        return res.status(400).json({
          success: false,
          error: "لا يمكن منع المدير العام من لوحة الإدارة",
        });
      }

      if (
        platformAccess.admin === true &&
        currentPlatformAccess.admin !== true &&
        req.user?.canonicalRole !== "SUPER_ADMIN"
      ) {
        return res.status(403).json({
          success: false,
          error:
            "منح الدخول إلى لوحة الإدارة يتطلب صلاحية المدير العام الموثقة.",
        });
      }

      await safelySyncUserAuth(auth, effectiveUid, {
        claimsUpdate: { platform_access: platformAccess },
        userDataFallback: { email: userData.email, name: userData.name },
      });

      const nowIso = new Date().toISOString();
      const updateDocPayload: Record<string, any> = {
        platformAccess,
        updatedAt: nowIso,
      };

      // If custom permissions are passed, persist them in Firestore
      const incomingPermissions =
        req.body?.permissions ||
        req.body?.custom_permissions ||
        (rawSource.canViewAllTasks !== undefined ? rawSource : null);
      if (incomingPermissions && typeof incomingPermissions === "object") {
        updateDocPayload.permissions = incomingPermissions;
        updateDocPayload.custom_permissions = incomingPermissions;
      }

      await userDocRef.set(updateDocPayload, { merge: true });

      // Sync to Supabase platform_access table
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          let { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .or(`firebase_uid.eq.${uid},id.eq.${uid}`)
            .maybeSingle();

          if (!prof && userData?.email) {
            const res = await supabase
              .from("profiles")
              .select("id")
              .ilike("email", userData.email)
              .maybeSingle();
            if (res.data) prof = res.data;
          }
          if (!prof && userData?.phone) {
            const res = await supabase
              .from("profiles")
              .select("id")
              .eq("phone", userData.phone)
              .maybeSingle();
            if (res.data) prof = res.data;
          }

          if (prof) {
            const rows = (
              ["recording", "tasks", "rewards", "admin"] as const
            ).map((platId) => ({
              profile_id: prof.id,
              platform_id: platId,
              is_allowed: Boolean(platformAccess[platId]),
              updated_at: nowIso,
            }));
            await supabase
              .from("platform_access")
              .upsert(rows, { onConflict: "profile_id,platform_id" });

            if (
              incomingPermissions &&
              typeof incomingPermissions === "object"
            ) {
              try {
                await supabase
                  .from("profiles")
                  .update({
                    permissions: incomingPermissions,
                    custom_permissions: incomingPermissions,
                    updated_at: nowIso,
                  })
                  .eq("id", prof.id);
              } catch (pErr) {
                console.warn(
                  "[AdminRoutes] Supabase profile permissions update error:",
                  pErr,
                );
              }
            }

            invalidateProfileCache(prof.id);
          }
        } catch (supaErr) {
          console.warn(
            "[AdminRoutes] Supabase platform_access sync warning:",
            supaErr,
          );
        }
      }
      invalidateProfileCache(uid);
      invalidateProfileCache(effectiveUid);

      await db.collection("audit_logs").add({
        action: "PLATFORM_ACCESS_CHANGED",
        targetUid: effectiveUid,
        platformAccess,
        performedBy: req.user.uid,
        timestamp: nowIso,
      });
      return res.json({
        success: true,
        platformAccess,
        permissions: updateDocPayload.permissions,
      });
    } catch (error: any) {
      console.error("Error updating platform access:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر تحديث وصول المنصات" });
    }
  },
);

adminRouter.patch(
  "/users/:uid/action-access",
  requireRbacAction("manage_action_permissions"),
  async (req, res) => {
    const { uid } = req.params;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    if (req.user?.uid === uid && req.user?.canonicalRole !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "لا يمكنك تعديل صلاحياتك الخاصة" });
    }
    const rawActionAccess = req.body?.actionAccess;
    if (
      !rawActionAccess ||
      typeof rawActionAccess !== "object" ||
      Array.isArray(rawActionAccess)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "بيانات الصلاحيات غير صالحة" });
    }
    const privilegedActions = new Set([
      "access_admin",
      "access_admin_platform",
      "access_control_panel",
      "canAccessAdminPanel",
      "can_access_admin_panel",
      "manage_roles",
      "manage_platform_access",
      "manage_action_permissions",
      "manage_database",
      "manage_integrations",
    ]);
    if (
      req.user?.canonicalRole !== "SUPER_ADMIN" &&
      Object.entries(rawActionAccess).some(
        ([key, value]) =>
          privilegedActions.has(key) && (value === "ALLOW" || value === true),
      )
    ) {
      return res.status(403).json({
        success: false,
        error: "منح صلاحيات الإدارة العليا محصور بالمدير العام",
      });
    }

    try {
      let userDocRef = db.collection("users").doc(uid);
      let userDoc = await userDocRef.get();
      let effectiveUid = uid;

      if (!userDoc.exists) {
        const snap = await db
          .collection("users")
          .where("uid", "==", uid)
          .limit(1)
          .get();
        if (!snap.empty) {
          userDoc = snap.docs[0];
          userDocRef = userDoc.ref;
          effectiveUid = userDoc.id;
        } else {
          const emailSnap = await db
            .collection("users")
            .where("email", "==", uid.toLowerCase().trim())
            .limit(1)
            .get();
          if (!emailSnap.empty) {
            userDoc = emailSnap.docs[0];
            userDocRef = userDoc.ref;
            effectiveUid = userDoc.id;
          } else {
            const phoneSnap = await db
              .collection("users")
              .where("phone", "==", uid)
              .limit(1)
              .get();
            if (!phoneSnap.empty) {
              userDoc = phoneSnap.docs[0];
              userDocRef = userDoc.ref;
              effectiveUid = userDoc.id;
            }
          }
        }
      }

      if (!userDoc.exists) {
        return res
          .status(404)
          .json({ success: false, error: "المستخدم غير موجود" });
      }

      const userData = userDoc.data() || {};
      const existingActionAccess =
        userData.actionAccess && typeof userData.actionAccess === "object"
          ? userData.actionAccess
          : {};

      // Build sanitized actionAccess: each key is ALLOW | DENY | INHERIT
      const sanitizedActionAccess: Record<
        string,
        "ALLOW" | "DENY" | "INHERIT"
      > = { ...existingActionAccess };
      for (const [key, val] of Object.entries(rawActionAccess)) {
        if (typeof key !== "string" || !key.trim()) continue;
        const cleanKey = key.trim();
        if (val === "ALLOW" || val === true) {
          sanitizedActionAccess[cleanKey] = "ALLOW";
        } else if (val === "DENY" || val === false) {
          sanitizedActionAccess[cleanKey] = "DENY";
        } else if (val === "INHERIT" || val === null || val === undefined) {
          sanitizedActionAccess[cleanKey] = "INHERIT";
        }
      }

      // Build permissions dictionary with both camelCase and snake_case keys
      const permDict: Record<string, boolean> = {
        ...(userData.permissions || {}),
        ...(userData.custom_permissions || {}),
      };

      for (const [key, val] of Object.entries(sanitizedActionAccess)) {
        const isAllowed = val === "ALLOW";
        permDict[key] = isAllowed;
        const snake = key.replace(
          /[A-Z]/g,
          (letter) => `_${letter.toLowerCase()}`,
        );
        permDict[snake] = isAllowed;
      }

      // Sync platform access if applicable
      const currentPlatformAccess =
        userData.platformAccess && typeof userData.platformAccess === "object"
          ? { ...userData.platformAccess }
          : { recording: false, tasks: true, rewards: true, admin: false };

      if (sanitizedActionAccess.canAccessRecordingSite !== undefined) {
        currentPlatformAccess.recording =
          sanitizedActionAccess.canAccessRecordingSite === "ALLOW";
      }
      if (sanitizedActionAccess.canAccessAdminPanel !== undefined) {
        currentPlatformAccess.admin =
          sanitizedActionAccess.canAccessAdminPanel === "ALLOW";
      }

      const nowIso = new Date().toISOString();
      const updateDocPayload: Record<string, any> = {
        actionAccess: sanitizedActionAccess,
        permissions: permDict,
        custom_permissions: permDict,
        platformAccess: currentPlatformAccess,
        updatedAt: nowIso,
      };

      await userDocRef.set(updateDocPayload, { merge: true });

      // Sync to Supabase user_permission_overrides & platform_access
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .or(
              `firebase_uid.eq.${uid},id.eq.${uid},firebase_uid.eq.${effectiveUid},id.eq.${effectiveUid}`,
            )
            .maybeSingle();

          if (prof) {
            const permRows = Object.entries(sanitizedActionAccess).map(
              ([actId, state]) => ({
                profile_id: prof.id,
                permission_id: actId,
                state,
                updated_at: nowIso,
              }),
            );
            const { error: overridesError } = await supabase
              .from("user_permission_overrides")
              .upsert(permRows, { onConflict: "profile_id,permission_id" });
            if (overridesError) throw overridesError;

            const { error: profileError } = await supabase
              .from("profiles")
              .update({
                permissions: permDict,
                custom_permissions: permDict,
                updated_at: nowIso,
              })
              .eq("id", prof.id);
            if (profileError) throw profileError;

            invalidateProfileCache(prof.id);
          }
        } catch (supaErr) {
          console.warn(
            "[AdminRoutes] Supabase actionAccess sync warning:",
            supaErr,
          );
        }
      }

      invalidateProfileCache(uid);
      invalidateProfileCache(effectiveUid);

      await db.collection("audit_logs").add({
        action: "ACTION_ACCESS_UPDATED",
        targetUid: effectiveUid,
        actionAccess: sanitizedActionAccess,
        performedBy: req.user?.uid || "admin",
        timestamp: nowIso,
      });

      return res.json({
        success: true,
        message: "تم تحديث وحفظ الصلاحيات بنجاح",
        actionAccess: sanitizedActionAccess,
        permissions: permDict,
        platformAccess: currentPlatformAccess,
      });
    } catch (error: any) {
      console.error("Error updating action access:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر تحديث الصلاحيات الدقيقة" });
    }
  },
);

adminRouter.post(
  "/users/sync-platforms",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    const supabase = getSupabaseAdminClient();
    if (!db || !auth)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    try {
      const nowIso = new Date().toISOString();
      let syncedCount = 0;

      // 1. Fetch profiles from Supabase if available
      let supaProfiles: any[] = [];
      if (supabase) {
        const { data } = await supabase
          .from("profiles")
          .select(
            "id, firebase_uid, email, full_name, role_id, is_super_admin, status",
          )
          .eq("is_archived", false);
        if (data) supaProfiles = data;
      }

      // 2. Fetch all Firestore users
      const usersSnap = await db.collection("users").get();
      const firestoreUsersMap = new Map<string, any>();
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        firestoreUsersMap.set(d.id, { docId: d.id, ...data });
        if (data.uid && data.uid !== d.id) {
          firestoreUsersMap.set(data.uid, { docId: d.id, ...data });
        }
      });

      const supabasePlatformBatch: any[] = [];

      // Process Supabase profiles
      for (const p of supaProfiles) {
        const canonicalRole = normalizeRole(p.role_id);
        const recommended = getRecommendedPlatformAccess(canonicalRole, p);

        for (const plat of [
          "recording",
          "tasks",
          "rewards",
          "admin",
        ] as const) {
          supabasePlatformBatch.push({
            profile_id: p.id,
            platform_id: plat,
            is_allowed: Boolean(recommended[plat]),
            updated_at: nowIso,
          });
        }

        const fUser = firestoreUsersMap.get(p.firebase_uid || p.id);
        const targetDocId = fUser?.docId || p.firebase_uid || p.id;
        if (targetDocId) {
          await db.collection("users").doc(targetDocId).set(
            {
              platformAccess: recommended,
              canonicalRole,
              updatedAt: nowIso,
            },
            { merge: true },
          );
        }

        const authUid =
          p.firebase_uid || (fUser ? fUser.uid || fUser.id : null);
        if (authUid && !authUid.startsWith("LEGACY_")) {
          try {
            await safelySyncUserAuth(auth, authUid, {
              claimsUpdate: {
                platform_access: recommended,
                role: canonicalRole,
              },
              userDataFallback: { email: p.email, name: p.full_name },
            });
          } catch {
            // ignore
          }
        }

        invalidateProfileCache(p.id);
        if (p.firebase_uid) invalidateProfileCache(p.firebase_uid);
        syncedCount++;
      }

      // Process any Firestore-only users
      for (const doc of usersSnap.docs) {
        const data = doc.data();
        const uid = doc.id;
        const alreadyHandled = supaProfiles.some(
          (p) =>
            p.id === uid ||
            p.firebase_uid === uid ||
            p.firebase_uid === data.uid,
        );
        if (!alreadyHandled) {
          const canonicalRole = normalizeRole(data.canonicalRole || data.role);
          const recommended = getRecommendedPlatformAccess(canonicalRole, data);
          await doc.ref.set(
            {
              platformAccess: recommended,
              canonicalRole,
              updatedAt: nowIso,
            },
            { merge: true },
          );

          const targetAuthUid = data.uid || uid;
          if (targetAuthUid && !targetAuthUid.startsWith("LEGACY_")) {
            try {
              await safelySyncUserAuth(auth, targetAuthUid, {
                claimsUpdate: {
                  platform_access: recommended,
                  role: canonicalRole,
                },
                userDataFallback: { email: data.email, name: data.name },
              });
            } catch {
              // ignore
            }
          }
          syncedCount++;
        }
      }

      // Batch upsert to Supabase platform_access
      if (supabase && supabasePlatformBatch.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < supabasePlatformBatch.length; i += batchSize) {
          const chunk = supabasePlatformBatch.slice(i, i + batchSize);
          await supabase
            .from("platform_access")
            .upsert(chunk, { onConflict: "profile_id,platform_id" });
        }
      }

      invalidateProfileCache();

      await db.collection("audit_logs").add({
        action: "PLATFORMS_GLOBAL_SYNC",
        syncedCount,
        performedBy: req.user?.uid || "admin",
        timestamp: nowIso,
      });

      return res.json({
        success: true,
        syncedCount,
        message: `تمت مزامنة منصات وصلاحيات ${syncedCount} عضواً بنجاح (المهام والنقاط لجميع الأعضاء، والتسجيل مخصص للرواة ومهندسي الصوت ومدققي الجودة والإدارة).`,
      });
    } catch (error: any) {
      console.error("Global platform sync failed:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "تعذر إتمام المزامنة الشاملة للمنصات",
      });
    }
  },
);

adminRouter.get(
  "/volunteer-applications",
  requireRbacAction("manage_members"),
  async (_req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    try {
      const snapshot = await db
        .collection("volunteer_applications")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      return res.json({
        success: true,
        applications: snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })),
      });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تحميل طلبات التطوع" });
    }
  },
);

/** Accepts an application without ever storing or returning a plaintext password. */
adminRouter.post(
  "/volunteer-applications/:id/approve",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { id } = req.params;
    const rawRole =
      typeof req.body?.role === "string" ? req.body.role.trim() : "MEMBER";
    const role = adminRole(rawRole.slice(0, 64) || "MEMBER");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !role) {
      return res
        .status(400)
        .json({ success: false, error: "طلب أو دور غير صالح" });
    }
    if (!isAssignableMemberRole(role)) {
      return res.status(400).json({ success: false, error: "دور غير صالح" });
    }
    if (!canAssignMemberRole(req.user, role)) {
      return res
        .status(403)
        .json({ success: false, error: "لا تملك صلاحية منح هذه الرتبة" });
    }
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    let createdUid: string | undefined;
    try {
      const applicationRef = db.collection("volunteer_applications").doc(id);
      const applicationSnapshot = await applicationRef.get();
      if (!applicationSnapshot.exists)
        return res
          .status(404)
          .json({ success: false, error: "طلب التطوع غير موجود" });
      const application = applicationSnapshot.data() || {};
      if (application.status === "accepted")
        return res
          .status(409)
          .json({ success: false, error: "تم قبول هذا الطلب مسبقاً" });
      const email = (
        typeof application.email === "string"
          ? application.email
          : typeof application.applicantEmail === "string"
            ? application.applicantEmail
            : ""
      )
        .trim()
        .toLowerCase();
      const rawUsername = (
        typeof application.username === "string"
          ? application.username
          : typeof application.applicantUsername === "string"
            ? application.applicantUsername
            : ""
      )
        .trim()
        .toLowerCase();
      const name = application.name || application.applicantName || "عضو إنصات";
      const phone = application.phone || application.applicantPhone || null;
      const phoneNormalized =
        application.phoneNormalized ||
        application.applicantPhoneNormalized ||
        (phone ? normalizeToE164(String(phone)) : null);
      const country =
        application.country || application.applicantCountry || null;
      const publicProfileConsent = Boolean(application.publicProfileConsent);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({
          success: false,
          error: "يجب توفر بريد إلكتروني لإرسال رابط تفعيل الحساب",
        });
      const username =
        rawUsername ||
        email
          .split("@")[0]
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .slice(0, 30);
      const temporaryPassword = `${crypto.randomBytes(24).toString("base64url")}Aa1!`;
      const userRecord = await auth.createUser({
        email,
        password: temporaryPassword,
        displayName: name,
      });
      createdUid = userRecord.uid;
      await auth.setCustomUserClaims(createdUid, {
        role,
        account_status: "active",
      });
      await db
        .collection("users")
        .doc(createdUid)
        .set(
          {
            uid: createdUid,
            name,
            username,
            usernameNormalized: username,
            email,
            phone: phone || null,
            phoneNormalized: phoneNormalized || null,
            country: country || null,
            age: application.age || application.answers?.age || null,
            field: application.field || application.answers?.field || null,
            role,
            roleDisplayAr: applicationRoleDisplay(role),
            status: "active",
            isActive: true,
            publicProfileConsent,
            createdAt: new Date().toISOString(),
            createdFromApplication: id,
          },
          { merge: true },
        );
      const passwordSetupLink = await auth.generatePasswordResetLink(email);
      await applicationRef.update({
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        acceptedRole: role,
        createdUid,
        updatedAt: new Date().toISOString(),
      });
      await db.collection("audit_logs").add({
        action: "VOLUNTEER_APPLICATION_ACCEPTED",
        applicationId: id,
        targetUid: createdUid,
        role,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });
      return res.json({
        success: true,
        uid: createdUid,
        role,
        passwordSetupLink,
      });
    } catch (error: any) {
      if (createdUid) {
        try {
          await auth.deleteUser(createdUid);
        } catch {
          /* preserve original failure */
        }
      }
      if (error?.code === "auth/email-already-exists")
        return res
          .status(409)
          .json({ success: false, error: "يوجد حساب بهذا البريد مسبقاً" });
      return res
        .status(503)
        .json({ success: false, error: "تعذر قبول الطلب وإنشاء الحساب" });
    }
  },
);

adminRouter.post(
  "/volunteer-applications/:id/reject",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db || !/^[A-Za-z0-9_-]{1,128}$/.test(req.params.id))
      return res.status(400).json({ success: false, error: "طلب غير صالح" });
    const reason =
      typeof req.body?.reason === "string"
        ? req.body.reason.trim().slice(0, 1000)
        : "";
    try {
      await db
        .collection("volunteer_applications")
        .doc(req.params.id)
        .update({
          status: "rejected",
          rejectionReason: reason,
          updatedAt: new Date().toISOString(),
          rejectedBy: req.user?.uid || "system",
        });
      return res.json({ success: true });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تحديث حالة الطلب" });
    }
  },
);

let cachedVolunteerForms: any[] = [...PRESET_VOLUNTEER_FORMS];

/** List all volunteer forms (with fallback to memory/presets if quota or network issue occurs) */
adminRouter.get(
  "/volunteer-forms",
  requireRbacAction("manage_members"),
  async (_req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res.json({
        success: true,
        forms: cachedVolunteerForms,
        isPreset: true,
      });
    try {
      const snapshot = await db
        .collection("volunteer_forms")
        .orderBy("createdAt", "desc")
        .get();
      if (snapshot.empty) {
        return res.json({
          success: true,
          forms: cachedVolunteerForms,
          isPreset: true,
        });
      }
      const forms = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      cachedVolunteerForms = forms;
      return res.json({ success: true, forms, isPreset: false });
    } catch (err: any) {
      console.warn(
        "Serving cached volunteer forms due to Firestore error/quota:",
        err?.message || err,
      );
      return res.json({
        success: true,
        forms: cachedVolunteerForms,
        isPreset: true,
        quotaNotice: true,
      });
    }
  },
);

/** Create a new volunteer form */
adminRouter.post(
  "/volunteer-forms",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();

    const {
      name,
      slug,
      description,
      targetRole,
      status,
      postSubmitMessage,
      termsVersion,
      questions,
    } = req.body;
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, error: "يرجى تحديد عنوان صالح للاستمارة" });
    }

    const cleanSlug =
      typeof slug === "string" && slug.trim()
        ? slug
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "-")
        : `form-${Date.now()}`;

    const formId = cleanSlug.startsWith("form-")
      ? cleanSlug
      : `form-${cleanSlug}`;
    const now = new Date().toISOString();

    const newForm = {
      id: formId,
      slug: cleanSlug,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      targetRole:
        typeof targetRole === "string" && targetRole.trim()
          ? targetRole.trim()
          : "MEMBER",
      status: ["published", "draft", "closed"].includes(status)
        ? status
        : "published",
      postSubmitMessage:
        typeof postSubmitMessage === "string" && postSubmitMessage.trim()
          ? postSubmitMessage.trim()
          : "شكراً لتقديمك! تم استلام طلبك وسيتواصل معك الفريق قريباً.",
      termsVersion: typeof termsVersion === "string" ? termsVersion : "2026.1",
      questions: Array.isArray(questions) ? questions : [],
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.uid || "admin",
    };

    // Always update in-memory cache first
    cachedVolunteerForms = [
      newForm,
      ...cachedVolunteerForms.filter((f) => f.id !== formId),
    ];

    if (db) {
      try {
        await db.collection("volunteer_forms").doc(formId).set(newForm);
      } catch (err: any) {
        console.warn(
          "Saved form in memory cache (Firestore write failed/quota exhausted):",
          err?.message || err,
        );
      }
    }

    return res.status(201).json({ success: true, form: newForm });
  },
);

/** Update an existing volunteer form */
adminRouter.put(
  "/volunteer-forms/:id",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      targetRole,
      status,
      postSubmitMessage,
      termsVersion,
      questions,
    } = req.body;

    if (!id || typeof id !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "معرّف الاستمارة غير صالح" });
    }

    const existingMemory =
      cachedVolunteerForms.find((p) => p.id === id) ||
      PRESET_VOLUNTEER_FORMS.find((p) => p.id === id) ||
      {};
    let existingData = existingMemory;

    if (db) {
      try {
        const docRef = db.collection("volunteer_forms").doc(id);
        const existingSnap = await docRef.get();
        if (existingSnap.exists) {
          existingData = existingSnap.data() || {};
        }
      } catch {
        // Offline / quota exhausted fallback
      }
    }

    const updatedForm = {
      ...existingData,
      id,
      name:
        typeof name === "string" && name.trim()
          ? name.trim()
          : existingData.name || "استمارة تطوع",
      slug:
        typeof slug === "string" && slug.trim()
          ? slug.trim()
          : existingData.slug || id,
      description:
        typeof description === "string"
          ? description.trim()
          : existingData.description || "",
      targetRole:
        typeof targetRole === "string" && targetRole.trim()
          ? targetRole.trim()
          : existingData.targetRole || "MEMBER",
      status: ["published", "draft", "closed"].includes(status)
        ? status
        : existingData.status || "published",
      postSubmitMessage:
        typeof postSubmitMessage === "string"
          ? postSubmitMessage.trim()
          : existingData.postSubmitMessage || "",
      termsVersion:
        typeof termsVersion === "string"
          ? termsVersion
          : existingData.termsVersion || "2026.1",
      questions: Array.isArray(questions)
        ? questions
        : existingData.questions || [],
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "admin",
    };

    // Update in-memory cache
    cachedVolunteerForms = cachedVolunteerForms.map((f) =>
      f.id === id ? updatedForm : f,
    );
    if (!cachedVolunteerForms.some((f) => f.id === id)) {
      cachedVolunteerForms.unshift(updatedForm);
    }

    if (db) {
      try {
        await db
          .collection("volunteer_forms")
          .doc(id)
          .set(updatedForm, { merge: true });
      } catch (err: any) {
        console.warn(
          "Updated form in memory cache (Firestore write failed/quota exhausted):",
          err?.message || err,
        );
      }
    }

    return res.json({ success: true, form: updatedForm });
  },
);

/** Delete a volunteer form */
adminRouter.delete(
  "/volunteer-forms/:id",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const { id } = req.params;

    cachedVolunteerForms = cachedVolunteerForms.filter((f) => f.id !== id);

    if (db) {
      try {
        await db.collection("volunteer_forms").doc(id).delete();
      } catch (err: any) {
        console.warn(
          "Deleted form from memory cache (Firestore delete failed/quota exhausted):",
          err?.message || err,
        );
      }
    }

    return res.json({ success: true, message: "تم حذف الاستمارة بنجاح" });
  },
);

/** Seed/reset preset volunteer forms */
adminRouter.post(
  "/volunteer-forms/seed-presets",
  requireRbacAction("manage_members"),
  async (_req, res) => {
    const db = getFirebaseAdminFirestore();
    cachedVolunteerForms = [...PRESET_VOLUNTEER_FORMS];

    if (db) {
      try {
        const batch = db.batch();
        for (const form of PRESET_VOLUNTEER_FORMS) {
          const docRef = db.collection("volunteer_forms").doc(form.id);
          batch.set(
            docRef,
            {
              ...form,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
        await batch.commit();
      } catch (err: any) {
        console.warn(
          "Seeded preset forms in memory cache (Firestore batch failed/quota exhausted):",
          err?.message || err,
        );
      }
    }

    return res.json({
      success: true,
      message: "تمت تهيئة وتحديث الاستمارات الافتراضية بنجاح",
      forms: PRESET_VOLUNTEER_FORMS,
    });
  },
);

adminRouter.patch(
  "/users/:uid/status",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const { status } = req.body;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (!["active", "pending", "disabled", "suspended"].includes(status)) {
      return res.status(400).json({ success: false, error: "حالة غير صالحة" });
    }

    // Prevent Self-Privilege Escalation
    if (req.user?.uid === uid && req.user?.canonicalRole !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "غير مصرح لك بتغيير حالة حسابك الخاص" });
    }

    try {
      let userDocRef = db.collection("users").doc(uid);
      let userDoc = await userDocRef.get();
      let effectiveUid = uid;

      if (!userDoc.exists) {
        const snap = await db
          .collection("users")
          .where("uid", "==", uid)
          .limit(1)
          .get();
        if (!snap.empty) {
          userDoc = snap.docs[0];
          userDocRef = userDoc.ref;
          effectiveUid = userDoc.id;
        } else {
          const cleanEmail = uid.toLowerCase().trim();
          const emailSnap = await db
            .collection("users")
            .where("email", "==", cleanEmail)
            .limit(1)
            .get();
          if (!emailSnap.empty) {
            userDoc = emailSnap.docs[0];
            userDocRef = userDoc.ref;
            effectiveUid = userDoc.id;
          } else {
            const phoneSnap = await db
              .collection("users")
              .where("phone", "==", uid)
              .limit(1)
              .get();
            if (!phoneSnap.empty) {
              userDoc = phoneSnap.docs[0];
              userDocRef = userDoc.ref;
              effectiveUid = userDoc.id;
            }
          }
        }
      }

      if (!userDoc.exists)
        return res
          .status(404)
          .json({ success: false, error: "المستخدم غير موجود" });

      const userData = userDoc.data() || {};

      if (status === "disabled" || status === "suspended") {
        if (userData?.role === "SUPER_ADMIN") {
          const superAdmins = await db
            .collection("users")
            .where("role", "==", "SUPER_ADMIN")
            .where("status", "==", "active")
            .get();
          if (superAdmins.size <= 1) {
            return res.status(400).json({
              success: false,
              error: "لا يمكن تعطيل المدير العام الأخير",
            });
          }
        }
        if (
          userData?.role === "ADMIN" &&
          req.user?.canonicalRole !== "SUPER_ADMIN"
        ) {
          return res.status(403).json({
            success: false,
            error: "تعطيل حسابات المدراء محصور بالإدارة العليا",
          });
        }
      }

      // Update Auth User & Claims safely
      const nextVersion = (Number(userData.tokenVersion) || 1) + 1;

      await safelySyncUserAuth(auth, effectiveUid, {
        updatesForAuth: {
          disabled: status === "disabled" || status === "suspended",
        },
        claimsUpdate: { account_status: status, token_version: nextVersion },
        userDataFallback: { email: userData.email, name: userData.name },
      });

      // Update Firestore
      await userDocRef.update({
        status,
        accountStatus: status,
        isActive: status === "active",
        tokenVersion: nextVersion,
        updatedAt: new Date().toISOString(),
      });

      // Sync to Supabase profiles
      await syncUserProfileToSupabase(effectiveUid, uid, userData.email, {
        status,
      });

      await db.collection("audit_logs").add({
        action: "USER_STATUS_CHANGED",
        targetUid: effectiveUid,
        newStatus: status,
        tokenVersion: nextVersion,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, status, tokenVersion: nextVersion });
    } catch (error: any) {
      console.error("Failed to update status:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر تحديث حالة الحساب" });
    }
  },
);

adminRouter.patch(
  "/users/:uid/role",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const role = adminRole(req.body?.role);
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (!isAssignableMemberRole(role)) {
      return res.status(400).json({ success: false, error: "دور غير صالح" });
    }

    // Prevent Self-Privilege Escalation
    if (req.user?.uid === uid && req.user?.canonicalRole !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "غير مصرح لك بتغيير رتبة حسابك الخاص" });
    }

    if (!canAssignMemberRole(req.user, role)) {
      return res
        .status(403)
        .json({ success: false, error: "لا تملك صلاحية منح هذه الرتبة" });
    }

    try {
      let userDocRef = db.collection("users").doc(uid);
      let userDoc = await userDocRef.get();
      let effectiveUid = uid;

      if (!userDoc.exists) {
        const snap = await db
          .collection("users")
          .where("uid", "==", uid)
          .limit(1)
          .get();
        if (!snap.empty) {
          userDoc = snap.docs[0];
          userDocRef = userDoc.ref;
          effectiveUid = userDoc.id;
        } else {
          const cleanEmail = uid.toLowerCase().trim();
          const emailSnap = await db
            .collection("users")
            .where("email", "==", cleanEmail)
            .limit(1)
            .get();
          if (!emailSnap.empty) {
            userDoc = emailSnap.docs[0];
            userDocRef = userDoc.ref;
            effectiveUid = userDoc.id;
          } else {
            const phoneSnap = await db
              .collection("users")
              .where("phone", "==", uid)
              .limit(1)
              .get();
            if (!phoneSnap.empty) {
              userDoc = phoneSnap.docs[0];
              userDocRef = userDoc.ref;
              effectiveUid = userDoc.id;
            }
          }
        }
      }

      if (!userDoc.exists)
        return res
          .status(404)
          .json({ success: false, error: "المستخدم غير موجود" });

      const userData = userDoc.data() || {};

      if (
        [uid, effectiveUid, userData.uid, userDoc.id]
          .filter(Boolean)
          .includes(req.user?.uid) &&
        !isSuperAdminCaller(req.user)
      ) {
        return res.status(403).json({
          success: false,
          error: "غير مصرح لك بتغيير رتبة حسابك الخاص",
        });
      }

      if (
        !canManageMemberRole(req.user, userData.role || userData.canonicalRole)
      ) {
        return res.status(403).json({
          success: false,
          error: "لا تملك صلاحية تعديل حساب بهذه الرتبة",
        });
      }
      const nextVersion = (Number(userData.tokenVersion) || 1) + 1;

      // Safely sync role in Auth claims
      await safelySyncUserAuth(auth, effectiveUid, {
        claimsUpdate: { role, token_version: nextVersion },
        userDataFallback: { email: userData.email, name: userData.name },
      });

      const roleDisplayAr =
        role === "SUPER_ADMIN"
          ? "مدير عام"
          : role === "ADMIN"
            ? "مدير النظام"
            : role === "CONTENT_MANAGER"
              ? "مدير المحتوى والمكتبة"
              : role === "MEMBERS_MANAGER"
                ? "مسؤول الأعضاء والتطوع"
                : role === "OPERATIONS_MANAGER"
                  ? "مدير العمليات والتسجيل"
                  : role === "REWARDS_MANAGER"
                    ? "مدير المكافآت والنقاط"
                    : role === "CERTIFICATE_MANAGER"
                      ? "مسؤول الشهادات"
                      : role === "AUDIO_ENGINEER"
                        ? "مهندس صوت"
                        : role === "QA_REVIEWER"
                          ? "مراجع جودة"
                          : role === "NARRATOR"
                            ? "راوي"
                            : "عضو متطوع";

      await userDocRef.update({
        role,
        canonicalRole: role,
        roleDisplayAr,
        tokenVersion: nextVersion,
        updatedAt: new Date().toISOString(),
      });

      // Sync to Supabase profiles
      await syncUserProfileToSupabase(effectiveUid, uid, userData.email, {
        role,
      });

      await db.collection("audit_logs").add({
        action: "ROLE_CHANGED",
        targetUid: effectiveUid,
        newRole: role,
        tokenVersion: nextVersion,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, role, tokenVersion: nextVersion });
    } catch (error: any) {
      console.error("Failed to update role:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر تحديث الدور الوظيفي" });
    }
  },
);

/** Bulk Update Members (Roles, Country, Status, Platform Access, Action Access, Department) */
adminRouter.post(
  "/users/bulk-update",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    const {
      uids,
      role,
      country,
      status,
      platformAccess,
      actionAccess,
      department,
    } = req.body;

    if (
      platformAccess &&
      !isActionAllowed(req.user, "manage_platform_access")
    ) {
      return res
        .status(403)
        .json({ success: false, error: "لا تملك صلاحية تعديل دخول المنصات" });
    }
    if (
      platformAccess &&
      (platformAccess.admin === true || platformAccess.admin === "ALLOW") &&
      req.user?.canonicalRole !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        error: "منح دخول لوحة الإدارة محصور بالمدير العام",
      });
    }
    if (
      actionAccess &&
      !isActionAllowed(req.user, "manage_action_permissions")
    ) {
      return res.status(403).json({
        success: false,
        error: "لا تملك صلاحية تعديل الصلاحيات الدقيقة",
      });
    }
    if (
      actionAccess &&
      req.user?.canonicalRole !== "SUPER_ADMIN" &&
      Object.entries(actionAccess).some(
        ([key, value]) =>
          [
            "access_admin",
            "access_admin_platform",
            "access_control_panel",
            "canAccessAdminPanel",
            "manage_roles",
            "manage_platform_access",
            "manage_action_permissions",
            "manage_database",
          ].includes(key) &&
          (value === "ALLOW" || value === true),
      )
    ) {
      return res.status(403).json({
        success: false,
        error: "منح صلاحيات الإدارة العليا محصور بالمدير العام",
      });
    }

    if (!Array.isArray(uids) || uids.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "يجب تحديد عضو واحد على الأقل" });
    }

    // 1. Prevent Self-Privilege Escalation:
    const isSelfIncluded = uids.includes(req.user?.uid);
    if (isSelfIncluded && req.user?.canonicalRole !== "SUPER_ADMIN") {
      if (role || status || platformAccess || actionAccess) {
        return res.status(403).json({
          success: false,
          error:
            "غير مصرح لك بترقية حسابك أو تعديل رتبتك أو صلاحياتك أو حالة حسابك ضمن التعديل الجماعي",
        });
      }
    }

    const allowedRoles = [
      "MEMBER",
      "NARRATOR",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "OPERATIONS_MANAGER",
      "CONTENT_MANAGER",
      "MEMBERS_MANAGER",
      "REWARDS_MANAGER",
      "CERTIFICATE_MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ];

    if (role && !allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ success: false, error: "الدور المحدد غير صالح" });
    }

    // Hierarchy validation: Non-SuperAdmin cannot grant SuperAdmin
    if (role === "SUPER_ADMIN" && req.user?.canonicalRole !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "لا يمكنك منح صلاحية الإدارة العليا" });
    }

    // Non-SuperAdmin cannot grant Admin unless they are SuperAdmin or Admin
    if (role === "ADMIN" && req.user?.canonicalRole !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "لا تملك صلاحية منح رتبة مدير عام" });
    }

    // Members Manager can only assign team roles & cannot grant admin platform/actions
    if (req.user?.canonicalRole === "MEMBERS_MANAGER") {
      if (
        role &&
        !["MEMBER", "NARRATOR", "AUDIO_ENGINEER", "QA_REVIEWER"].includes(role)
      ) {
        return res.status(403).json({
          success: false,
          error: "صلاحيتك كمسؤول شؤون أعضاء لا تسمح بتعيين هذه الرتبة",
        });
      }
      if (
        platformAccess &&
        (platformAccess.admin === true || platformAccess.admin === "ALLOW")
      ) {
        return res.status(403).json({
          success: false,
          error: "لا يمكنك منح صلاحية دخول لوحة الإدارة",
        });
      }
      if (actionAccess && typeof actionAccess === "object") {
        return res.status(403).json({
          success: false,
          error:
            "مسؤول شؤون الأعضاء لا يملك صلاحية تعديل الصلاحيات الدقيقة جماعياً",
        });
      }
    }

    if (
      status &&
      !["active", "pending", "disabled", "suspended"].includes(status)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "الحالة المحددة غير صالحة" });
    }

    try {
      let successCount = 0;
      const nowIso = new Date().toISOString();

      for (const uid of uids) {
        if (typeof uid !== "string" || !uid.trim()) continue;

        // Prevent non-superadmin from modifying their own user doc in bulk
        if (
          uid === req.user?.uid &&
          req.user?.canonicalRole !== "SUPER_ADMIN"
        ) {
          continue;
        }

        let userDocRef = db.collection("users").doc(uid);
        let userDoc = await userDocRef.get();
        if (!userDoc.exists) {
          const querySnap = await db
            .collection("users")
            .where("uid", "==", uid)
            .limit(1)
            .get();
          if (!querySnap.empty) {
            userDocRef = querySnap.docs[0].ref;
            userDoc = querySnap.docs[0];
          } else {
            continue;
          }
        }

        const currentData = userDoc.data() || {};

        // Guard: only SUPER_ADMIN can modify a SUPER_ADMIN
        if (
          currentData.role === "SUPER_ADMIN" &&
          req.user?.canonicalRole !== "SUPER_ADMIN"
        ) {
          continue;
        }
        // Guard: only SUPER_ADMIN can modify an ADMIN
        if (
          currentData.role === "ADMIN" &&
          req.user?.canonicalRole !== "SUPER_ADMIN" &&
          req.user?.canonicalRole !== "ADMIN"
        ) {
          continue;
        }
        // Guard: MEMBERS_MANAGER cannot modify management accounts
        if (req.user?.canonicalRole === "MEMBERS_MANAGER") {
          const mgmtRoles = [
            "SUPER_ADMIN",
            "ADMIN",
            "CONTENT_MANAGER",
            "MEMBERS_MANAGER",
            "OPERATIONS_MANAGER",
            "REWARDS_MANAGER",
            "CERTIFICATE_MANAGER",
          ];
          if (mgmtRoles.includes(currentData.role)) {
            continue;
          }
        }

        const updates: Record<string, any> = {
          updatedAt: nowIso,
          updatedBy: req.user?.uid || "system",
        };

        if (role) {
          updates.role = role;
          updates.canonicalRole = role;
          updates.roleDisplayAr =
            role === "SUPER_ADMIN"
              ? "إدارة عليا"
              : role === "ADMIN"
                ? "مدير عام"
                : role === "CONTENT_MANAGER"
                  ? "مدير المحتوى"
                  : role === "MEMBERS_MANAGER"
                    ? "مسؤول شؤون الأعضاء"
                    : role === "OPERATIONS_MANAGER"
                      ? "مدير العمليات والتسجيل"
                      : role === "REWARDS_MANAGER"
                        ? "مدير المكافآت والنقاط"
                        : role === "CERTIFICATE_MANAGER"
                          ? "مسؤول الشهادات"
                          : role === "AUDIO_ENGINEER"
                            ? "مهندس صوت"
                            : role === "QA_REVIEWER"
                              ? "مراجع جودة"
                              : role === "NARRATOR"
                                ? "راوي"
                                : "عضو متطوع";
        }

        if (typeof country === "string") {
          updates.country = country.trim();
          updates.nationality = country.trim();
        }

        if (department !== undefined) {
          updates.department =
            typeof department === "string" ? department.trim() : "";
        }

        if (status) {
          updates.status = status;
          updates.accountStatus = status;
          updates.isActive = status === "active";
        }

        if (platformAccess && typeof platformAccess === "object") {
          updates.platformAccess = {
            ...(currentData.platformAccess || {}),
            ...platformAccess,
          };
        }

        if (actionAccess && typeof actionAccess === "object") {
          updates.actionAccess = {
            ...(currentData.actionAccess || {}),
            ...actionAccess,
          };
        }

        const nextVersion = (Number(currentData.tokenVersion) || 1) + 1;
        updates.tokenVersion = nextVersion;

        // Update Firestore
        await userDocRef.set(updates, { merge: true });

        // Sync to Supabase if configured
        await syncUserProfileToSupabase(userDoc.id, uid, currentData.email, {
          role,
          status,
          country,
        });

        const supabase = getSupabaseAdminClient();
        if (supabase) {
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("id")
              .or(
                `firebase_uid.eq.${uid},id.eq.${uid},firebase_uid.eq.${userDoc.id},id.eq.${userDoc.id}`,
              )
              .maybeSingle();

            if (prof) {
              if (platformAccess && typeof platformAccess === "object") {
                const platRows = Object.entries(updates.platformAccess).map(
                  ([pId, allowed]) => ({
                    profile_id: prof.id,
                    platform_id: pId,
                    is_allowed: Boolean(allowed),
                    updated_at: nowIso,
                  }),
                );
                await supabase
                  .from("platform_access")
                  .upsert(platRows, { onConflict: "profile_id,platform_id" });
              }

              if (actionAccess && typeof actionAccess === "object") {
                const permRows = Object.entries(updates.actionAccess).map(
                  ([actId, state]) => ({
                    profile_id: prof.id,
                    permission_id: actId,
                    state: state,
                    updated_at: nowIso,
                  }),
                );
                await supabase
                  .from("user_permission_overrides")
                  .upsert(permRows, { onConflict: "profile_id,permission_id" });
              }

              invalidateProfileCache(prof.id);
            }
          } catch (syncErr) {
            console.warn(
              "[AdminRoutes] Bulk update Supabase sync error:",
              syncErr,
            );
          }
        }
        invalidateProfileCache(uid);

        // Sync Auth & Claims safely
        const targetAuthUid = currentData.uid || userDoc.id;
        await safelySyncUserAuth(auth, targetAuthUid, {
          updatesForAuth: status
            ? { disabled: status === "disabled" || status === "suspended" }
            : undefined,
          claimsUpdate: {
            ...(role ? { role } : {}),
            ...(status ? { account_status: status } : {}),
            ...(platformAccess ? { platform_access: platformAccess } : {}),
            token_version: nextVersion,
          },
          userDataFallback: {
            email: currentData.email,
            name: currentData.name,
          },
        });

        successCount++;
      }

      await db.collection("audit_logs").add({
        action: "BULK_USERS_UPDATED",
        targetUids: uids,
        updatedCount: successCount,
        changes: {
          role,
          country,
          status,
          platformAccess,
          actionAccess,
          department,
        },
        performedBy: req.user?.uid || "system",
        timestamp: nowIso,
      });

      return res.json({
        success: true,
        message: `تم تحديث ${successCount} عضو بنجاح`,
        updatedCount: successCount,
        uids,
      });
    } catch (error: any) {
      console.error("Bulk update failed:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر تنفيذ التحديث الجماعي" });
    }
  },
);

/** Helper to normalize Arabic and international person names for duplicate detection */
function normalizePersonNameForDeduplication(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

/** Preview Duplicate Users Groups (Without Deleting) */
adminRouter.get(
  "/users/duplicates-preview",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    try {
      const snapshot = await db.collection("users").get();
      const users: any[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        const uid = data.uid || doc.id;
        return {
          ...data,
          id: uid,
          uid,
          docId: doc.id,
        };
      });

      const groupsByName = new Map<string, any[]>();
      for (const u of users) {
        const rawName = String(u.name || "").trim();
        if (!rawName) continue;
        const normName = normalizePersonNameForDeduplication(rawName);
        if (!normName) continue;
        const list = groupsByName.get(normName) || [];
        list.push(u);
        groupsByName.set(normName, list);
      }

      const roleRanks: Record<string, number> = {
        SUPER_ADMIN: 100,
        ADMIN: 90,
        OPERATIONS_MANAGER: 80,
        CONTENT_MANAGER: 70,
        MEMBERS_MANAGER: 60,
        REWARDS_MANAGER: 50,
        CERTIFICATE_MANAGER: 40,
        AUDIO_ENGINEER: 30,
        QA_REVIEWER: 20,
        NARRATOR: 10,
        MEMBER: 1,
      };

      const duplicateGroups: Array<{
        normalizedName: string;
        displayName: string;
        recommendedKeptUid: string;
        users: Array<{
          uid: string;
          docId: string;
          name: string;
          email?: string;
          phone?: string;
          role: string;
          country?: string;
          username?: string;
          status?: string;
          createdAt?: string;
          isRecommendedKept: boolean;
        }>;
      }> = [];

      for (const [normName, group] of groupsByName.entries()) {
        if (group.length <= 1) continue;

        // Sort group to pick the recommended primary user to keep
        group.sort((a, b) => {
          if (a.is_super_admin && !b.is_super_admin) return -1;
          if (!a.is_super_admin && b.is_super_admin) return 1;

          const rankA = roleRanks[a.role || "MEMBER"] || 0;
          const rankB = roleRanks[b.role || "MEMBER"] || 0;
          if (rankA !== rankB) return rankB - rankA;

          const scoreA =
            (a.phone ? 2 : 0) + (a.country ? 1 : 0) + (a.username ? 1 : 0);
          const scoreB =
            (b.phone ? 2 : 0) + (b.country ? 1 : 0) + (b.username ? 1 : 0);
          if (scoreA !== scoreB) return scoreB - scoreA;

          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          if (dateA && dateB && dateA !== dateB) return dateA - dateB;

          return 0;
        });

        const primaryUser = group[0];
        const recommendedKeptUid = primaryUser.uid || primaryUser.id;

        duplicateGroups.push({
          normalizedName: normName,
          displayName: primaryUser.name || group[0].name,
          recommendedKeptUid,
          users: group.map((u) => ({
            uid: u.uid || u.id,
            docId: u.docId,
            name: u.name || "بدون اسم",
            email: u.email || "",
            phone: u.phone || "",
            role: u.role || "MEMBER",
            country: u.country || "",
            username: u.username || "",
            status: u.status || "active",
            createdAt: u.createdAt || "",
            isRecommendedKept: (u.uid || u.id) === recommendedKeptUid,
          })),
        });
      }

      return res.json({
        success: true,
        duplicateGroups,
        totalGroups: duplicateGroups.length,
        totalDuplicatesCount: duplicateGroups.reduce(
          (acc, g) => acc + (g.users.length - 1),
          0,
        ),
      });
    } catch (error: any) {
      console.error("Failed to preview duplicate users:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر فحص الأسماء المكررة" });
    }
  },
);

/** Resolve Specific Duplicate Group Safely (Keep One, Delete Others with Optional Merge) */
adminRouter.post(
  "/users/resolve-duplicate-group",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { keptUid, deleteUids, mergeData } = req.body;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (!keptUid || !Array.isArray(deleteUids) || deleteUids.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "معرّفات الحسابات غير صالحة" });
    }

    try {
      const keptDocRef = db.collection("users").doc(keptUid);
      const keptSnap = await keptDocRef.get();
      if (!keptSnap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "الحساب الأساسي غير موجود" });
      }

      const keptData = keptSnap.data() || {};
      const deletedSnapshots: any[] = [];
      const updatesToKept: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      for (const dUid of deleteUids) {
        if (dUid === keptUid) continue; // Safety check

        const dDocRef = db.collection("users").doc(dUid);
        let dSnap = await dDocRef.get();
        let dDocId = dUid;

        if (!dSnap.exists) {
          const querySnap = await db
            .collection("users")
            .where("uid", "==", dUid)
            .get();
          if (!querySnap.empty) {
            dSnap = querySnap.docs[0];
            dDocId = dSnap.id;
          }
        }

        if (dSnap.exists) {
          const dData = dSnap.data() || {};
          deletedSnapshots.push({ uid: dUid, docId: dDocId, ...dData });

          // If merge requested, fill in missing fields in kept account
          if (mergeData) {
            if (!keptData.phone && dData.phone)
              updatesToKept.phone = dData.phone;
            if (!keptData.country && dData.country)
              updatesToKept.country = dData.country;
            if (!keptData.username && dData.username)
              updatesToKept.username = dData.username;
          }

          // Delete Firestore document
          await db.collection("users").doc(dDocId).delete();

          // Delete username doc if it belonged to this duplicate
          if (dData.username) {
            const normUsername = String(dData.username).trim().toLowerCase();
            const unameDoc = await db
              .collection("usernames")
              .doc(normUsername)
              .get();
            if (unameDoc.exists && unameDoc.data()?.uid === dUid) {
              await db.collection("usernames").doc(normUsername).delete();
            }
          }

          // Only delete from Firebase Auth if its UID is not the same as the kept user UID
          if (dUid !== keptUid) {
            await auth.deleteUser(dUid).catch(() => {});
          }
        }
      }

      if (Object.keys(updatesToKept).length > 1) {
        await keptDocRef.set(updatesToKept, { merge: true });
      }

      const nowIso = new Date().toISOString();
      await db.collection("audit_logs").add({
        action: "DUPLICATE_RESOLVED",
        keptUid,
        keptUser: {
          name: keptData.name,
          email: keptData.email,
          role: keptData.role,
        },
        deletedUsers: deletedSnapshots,
        performedBy: req.user?.uid || "system",
        timestamp: nowIso,
      });

      return res.json({
        success: true,
        message: `تم الاحتفاظ بحساب "${keptData.name}" وحذف ${deletedSnapshots.length} حساب مكرر بنجاح`,
        deletedCount: deletedSnapshots.length,
      });
    } catch (error: any) {
      console.error("Failed to resolve duplicate group:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر إتمام عملية المعالجة" });
    }
  },
);

/** Deduplicate Users (Find & Delete duplicate accounts with matching names, keeping the primary account) */
adminRouter.post(
  "/users/deduplicate",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    try {
      const snapshot = await db.collection("users").get();
      const users: any[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        const uid = data.uid || doc.id;
        return {
          ...data,
          id: uid,
          uid,
        };
      });

      // Group by normalized name
      const groupsByName = new Map<string, any[]>();
      for (const u of users) {
        const normName = normalizePersonNameForDeduplication(u.name || "");
        if (!normName) continue;
        const list = groupsByName.get(normName) || [];
        list.push(u);
        groupsByName.set(normName, list);
      }

      const roleRanks: Record<string, number> = {
        SUPER_ADMIN: 100,
        ADMIN: 90,
        OPERATIONS_MANAGER: 80,
        CONTENT_MANAGER: 70,
        MEMBERS_MANAGER: 60,
        REWARDS_MANAGER: 50,
        CERTIFICATE_MANAGER: 40,
        AUDIO_ENGINEER: 30,
        QA_REVIEWER: 20,
        NARRATOR: 10,
        MEMBER: 1,
      };

      let totalDeleted = 0;
      const deduplicationSummary: Array<{
        normalizedName: string;
        kept: { uid: string; name: string; email?: string; role?: string };
        deleted: Array<{
          uid: string;
          name: string;
          email?: string;
          role?: string;
        }>;
      }> = [];

      for (const [normName, group] of groupsByName.entries()) {
        if (group.length <= 1) continue;

        // Sort group to pick the primary user to keep
        group.sort((a, b) => {
          // 1. Super admin always wins
          if (a.is_super_admin && !b.is_super_admin) return -1;
          if (!a.is_super_admin && b.is_super_admin) return 1;

          // 2. Role rank
          const rankA = roleRanks[a.role || "MEMBER"] || 0;
          const rankB = roleRanks[b.role || "MEMBER"] || 0;
          if (rankA !== rankB) return rankB - rankA;

          // 3. Completeness of profile (has phone, country, etc.)
          const scoreA =
            (a.phone ? 2 : 0) + (a.country ? 1 : 0) + (a.username ? 1 : 0);
          const scoreB =
            (b.phone ? 2 : 0) + (b.country ? 1 : 0) + (b.username ? 1 : 0);
          if (scoreA !== scoreB) return scoreB - scoreA;

          // 4. Oldest creation date if available
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          if (dateA && dateB && dateA !== dateB) return dateA - dateB;

          return 0;
        });

        const primaryUser = group[0];
        const duplicatesToDelete = group.slice(1);

        const deletedItems: Array<{
          uid: string;
          name: string;
          email?: string;
          role?: string;
        }> = [];

        for (const dup of duplicatesToDelete) {
          const dupUid = dup.uid || dup.id;
          if (!dupUid) continue;

          // Guard: do not delete SUPER_ADMIN unless caller is SUPER_ADMIN
          if (
            dup.role === "SUPER_ADMIN" &&
            req.user?.canonicalRole !== "SUPER_ADMIN"
          ) {
            continue;
          }

          try {
            // Delete from Firestore users collection
            await db.collection("users").doc(dupUid).delete();

            // Delete from usernames if reserved
            if (dup.username) {
              const normalizedUsername = String(dup.username)
                .trim()
                .toLowerCase();
              const unameDoc = await db
                .collection("usernames")
                .doc(normalizedUsername)
                .get();
              if (unameDoc.exists && unameDoc.data()?.uid === dupUid) {
                await db
                  .collection("usernames")
                  .doc(normalizedUsername)
                  .delete();
              }
            }

            // Delete from Firebase Auth
            await auth.deleteUser(dupUid).catch(() => {});

            totalDeleted++;
            deletedItems.push({
              uid: dupUid,
              name: dup.name,
              email: dup.email,
              role: dup.role,
            });
          } catch (delErr) {
            console.error(`Failed to delete duplicate user ${dupUid}:`, delErr);
          }
        }

        if (deletedItems.length > 0) {
          deduplicationSummary.push({
            normalizedName: normName,
            kept: {
              uid: primaryUser.uid,
              name: primaryUser.name,
              email: primaryUser.email,
              role: primaryUser.role,
            },
            deleted: deletedItems,
          });
        }
      }

      const nowIso = new Date().toISOString();
      await db.collection("audit_logs").add({
        action: "USERS_DEDUPLICATED",
        deletedCount: totalDeleted,
        groupsCount: deduplicationSummary.length,
        details: deduplicationSummary,
        performedBy: req.user?.uid || "system",
        timestamp: nowIso,
      });

      return res.json({
        success: true,
        message:
          totalDeleted > 0
            ? `تم العثور على ${deduplicationSummary.length} اسم متكرر وحذف ${totalDeleted} حساب مكرر بنجاح`
            : "لم يتم العثور على أي أسماء مكررة في النظام",
        deletedCount: totalDeleted,
        groupsCount: deduplicationSummary.length,
        details: deduplicationSummary,
      });
    } catch (error: any) {
      console.error("Deduplication error:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر فحص وحذف الأسماء المتكررة" });
    }
  },
);

/** Delete a Single User */
adminRouter.delete(
  "/users/:uid",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    try {
      // 1. Locate all related documents for this user (by doc.id, by field uid, or by email)
      const docsToDelete: Array<{ docId: string; data: any }> = [];

      // Check doc by direct ID
      const directDocRef = db.collection("users").doc(uid);
      const directSnap = await directDocRef.get();
      if (directSnap.exists) {
        docsToDelete.push({
          docId: directSnap.id,
          data: directSnap.data() || {},
        });
      }

      // Also check query by field 'uid'
      const querySnap = await db
        .collection("users")
        .where("uid", "==", uid)
        .get();
      for (const d of querySnap.docs) {
        if (!docsToDelete.some((item) => item.docId === d.id)) {
          docsToDelete.push({ docId: d.id, data: d.data() || {} });
        }
      }

      if (docsToDelete.length === 0) {
        return res.status(404).json({
          success: false,
          error: "المستخدم غير موجود في قاعدة البيانات",
        });
      }

      // Safety checks
      const primaryData = docsToDelete[0].data;
      if (
        primaryData.role === "SUPER_ADMIN" &&
        req.user?.canonicalRole !== "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({ success: false, error: "لا يمكن حذف حساب الإدارة العليا" });
      }

      if (
        uid === req.user?.uid ||
        docsToDelete.some((item) => item.data.uid === req.user?.uid)
      ) {
        return res.status(400).json({
          success: false,
          error: "لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به",
        });
      }

      // Delete all matched Firestore records
      for (const item of docsToDelete) {
        await db
          .collection("users")
          .doc(item.docId)
          .delete()
          .catch(() => {});

        // Delete username reservation
        if (item.data.username) {
          const normUsername = String(item.data.username).trim().toLowerCase();
          await db
            .collection("usernames")
            .doc(normUsername)
            .delete()
            .catch(() => {});
        }
      }

      // Delete Auth User
      const actualAuthUid = primaryData.uid || uid;
      await auth.deleteUser(actualAuthUid).catch((authErr) => {
        console.warn(
          `Auth delete warning for ${actualAuthUid}:`,
          authErr?.message,
        );
      });

      // Record in audit log
      await db.collection("audit_logs").add({
        action: "USER_DELETED_BY_ADMIN",
        targetUid: uid,
        deletedUserData: {
          name: primaryData.name || null,
          email: primaryData.email || null,
          role: primaryData.role || null,
          phone: primaryData.phone || null,
          country: primaryData.country || null,
          username: primaryData.username || null,
          platformAccess: primaryData.platformAccess || null,
        },
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: `تم حذف العضو "${primaryData.name || uid}" وجميع بياناته بنجاح`,
      });
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      return res
        .status(500)
        .json({ success: false, error: error?.message || "تعذر حذف العضو" });
    }
  },
);

/** Bulk Delete Users */
adminRouter.post(
  "/users/bulk-delete",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uids } = req.body;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (!Array.isArray(uids) || uids.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "يجب تحديد مستخدمين للحذف" });
    }

    try {
      let deletedCount = 0;
      const deletedList: any[] = [];

      for (const uid of uids) {
        if (uid === req.user?.uid) continue;

        // Locate documents
        const docsToDelete: Array<{ docId: string; data: any }> = [];
        const directDocRef = db.collection("users").doc(uid);
        const directSnap = await directDocRef.get();
        if (directSnap.exists) {
          docsToDelete.push({
            docId: directSnap.id,
            data: directSnap.data() || {},
          });
        }

        const querySnap = await db
          .collection("users")
          .where("uid", "==", uid)
          .get();
        for (const d of querySnap.docs) {
          if (!docsToDelete.some((item) => item.docId === d.id)) {
            docsToDelete.push({ docId: d.id, data: d.data() || {} });
          }
        }

        if (docsToDelete.length === 0) continue;

        const primaryData = docsToDelete[0].data;
        if (
          primaryData.role === "SUPER_ADMIN" &&
          req.user?.canonicalRole !== "SUPER_ADMIN"
        ) {
          continue;
        }

        for (const item of docsToDelete) {
          await db
            .collection("users")
            .doc(item.docId)
            .delete()
            .catch(() => {});
          if (item.data.username) {
            const normUsername = String(item.data.username)
              .trim()
              .toLowerCase();
            await db
              .collection("usernames")
              .doc(normUsername)
              .delete()
              .catch(() => {});
          }
        }

        const actualAuthUid = primaryData.uid || uid;
        await auth.deleteUser(actualAuthUid).catch(() => {});

        deletedCount++;
        deletedList.push({
          uid,
          name: primaryData.name || null,
          email: primaryData.email || null,
          role: primaryData.role || null,
          phone: primaryData.phone || null,
          country: primaryData.country || null,
          username: primaryData.username || null,
          platformAccess: primaryData.platformAccess || null,
        });
      }

      await db.collection("audit_logs").add({
        action: "BULK_USERS_DELETED",
        targetUids: uids,
        deletedCount,
        deletedUsers: deletedList,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: `تم حذف ${deletedCount} حساب بنجاح`,
        deletedCount,
      });
    } catch (error: any) {
      console.error("Bulk delete failed:", error);
      return res
        .status(500)
        .json({ success: false, error: "تعذر حذف الأعضاء المحددين" });
    }
  },
);

/** Get List of Deleted Users / Deduplication History for Recovery */
adminRouter.get(
  "/deleted-users",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    try {
      // 1. Fetch from audit logs
      const auditSnap = await db
        .collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();

      const deletedUsersList: Array<{
        id: string;
        originalUid?: string;
        name: string;
        email?: string;
        phone?: string;
        role?: string;
        country?: string;
        username?: string;
        deletedAt: string;
        source: string;
        keptUser?: { uid: string; name: string; email?: string; role?: string };
      }> = [];

      const existingUsersSnap = await db.collection("users").get();
      const existingUids = new Set(existingUsersSnap.docs.map((d) => d.id));
      const existingEmails = new Set(
        existingUsersSnap.docs
          .map((d) =>
            String(d.data().email || "")
              .toLowerCase()
              .trim(),
          )
          .filter(Boolean),
      );

      for (const doc of auditSnap.docs) {
        const data = doc.data();
        const action = data.action;
        const timestamp =
          data.timestamp ||
          doc.createTime?.toDate()?.toISOString() ||
          new Date().toISOString();

        if (action === "USERS_DEDUPLICATED" && Array.isArray(data.details)) {
          for (const group of data.details) {
            if (Array.isArray(group.deleted)) {
              for (const item of group.deleted) {
                if (item && item.name) {
                  deletedUsersList.push({
                    id: `${doc.id}_${item.uid || Math.random().toString(36).slice(2)}`,
                    originalUid: item.uid,
                    name: item.name,
                    email: item.email || "",
                    role: item.role || "MEMBER",
                    phone: item.phone || "",
                    country: item.country || "",
                    username: item.username || "",
                    deletedAt: timestamp,
                    source: "حذف التكرار التلقائي (Deduplication)",
                    keptUser: group.kept,
                  });
                }
              }
            }
          }
        } else if (action === "USER_DELETED_BY_ADMIN" && data.deletedUserData) {
          deletedUsersList.push({
            id: `${doc.id}_${data.targetUid || Math.random().toString(36).slice(2)}`,
            originalUid: data.targetUid,
            name: data.deletedUserData.name || "بدون اسم",
            email: data.deletedUserData.email || "",
            role: data.deletedUserData.role || "MEMBER",
            phone: data.deletedUserData.phone || "",
            country: data.deletedUserData.country || "",
            username: data.deletedUserData.username || "",
            deletedAt: timestamp,
            source: "حذف يدوي من قبل المسؤول",
          });
        }
      }

      // 2. Also check volunteer applications for any approved/registered members that might be missing
      const appsSnap = await db
        .collection("volunteer_applications")
        .limit(100)
        .get()
        .catch(() => null);
      if (appsSnap && !appsSnap.empty) {
        for (const doc of appsSnap.docs) {
          const app = doc.data();
          const appEmail = String(app.email || "")
            .toLowerCase()
            .trim();
          const appUid = app.uid || doc.id;
          // If applicant is approved or existed, but not in existing users, offer as recoverable
          if (
            !existingUids.has(appUid) &&
            (!appEmail || !existingEmails.has(appEmail)) &&
            app.fullName
          ) {
            // Check if not already added in deletedUsersList
            const alreadyAdded = deletedUsersList.some(
              (d) => d.email === app.email || d.name === app.fullName,
            );
            if (!alreadyAdded) {
              deletedUsersList.push({
                id: `app_${doc.id}`,
                originalUid: app.uid,
                name: app.fullName || app.name || "",
                email: app.email || "",
                phone: app.phone || app.whatsapp || "",
                role: app.preferredRole || "MEMBER",
                country: app.country || "العراق",
                username: app.username || "",
                deletedAt:
                  app.updatedAt || app.createdAt || new Date().toISOString(),
                source: "طلب تطوع مسجل سابقاً",
              });
            }
          }
        }
      }

      res.json({ success: true, deletedUsers: deletedUsersList });
    } catch (error: any) {
      console.error("Failed to fetch deleted users:", error);
      res
        .status(500)
        .json({ success: false, error: "تعذر استرجاع قائمة المحذوفات" });
    }
  },
);

/** Restore a Deleted User */
adminRouter.post(
  "/restore-user",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { name, email, role, phone, country, username, password } = req.body;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "اسم العضو مطلوب للاسترجاع" });
    }

    try {
      const targetEmail =
        email && typeof email === "string" && email.includes("@")
          ? email.trim().toLowerCase()
          : `restored_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@ensat.org`;

      let uid: string;
      let authUser = null;

      // Check if user already exists in Firebase Auth by email
      try {
        authUser = await auth.getUserByEmail(targetEmail);
        uid = authUser.uid;
      } catch {
        // Create new Auth User
        const newPassword = password || "EnsatUser@2026";
        const createdAuth = await auth.createUser({
          email: targetEmail,
          password: newPassword,
          displayName: name.trim(),
          emailVerified: true,
        });
        uid = createdAuth.uid;
      }

      const canonicalRole = (role || "MEMBER").toUpperCase();
      const effectiveCountry = country || "العراق";

      // Set Custom Claims
      await auth.setCustomUserClaims(uid, {
        role: canonicalRole,
        canonical_role: canonicalRole,
        account_status: "active",
        country: effectiveCountry,
        platform_access: {
          recording: true,
          tasks: true,
          rewards: true,
          library: true,
          workspace: true,
        },
      });

      const nowIso = new Date().toISOString();
      const userData = {
        uid,
        id: uid,
        name: name.trim(),
        email: targetEmail,
        phone: phone || "",
        country: effectiveCountry,
        nationality: effectiveCountry,
        role: canonicalRole,
        status: "active",
        isActive: true,
        username: username || "",
        department: "فريق إنصات",
        platformAccess: {
          recording: true,
          tasks: true,
          rewards: true,
          library: true,
          workspace: true,
        },
        actionAccess: {},
        createdAt: nowIso,
        updatedAt: nowIso,
        restoredAt: nowIso,
      };

      // Save in Firestore
      await db.collection("users").doc(uid).set(userData, { merge: true });

      // Reserve username if present
      if (username) {
        const normUsername = String(username).trim().toLowerCase();
        await db
          .collection("usernames")
          .doc(normUsername)
          .set(
            {
              uid,
              username: normUsername,
              createdAt: nowIso,
            },
            { merge: true },
          )
          .catch(() => {});
      }

      // Add Audit Log
      await db.collection("audit_logs").add({
        action: "USER_RESTORED",
        targetUid: uid,
        userData: { name, email: targetEmail, role: canonicalRole },
        performedBy: req.user?.uid || "system",
        timestamp: nowIso,
      });

      return res.json({
        success: true,
        message: `تم استرجاع الحساب "${name}" بنجاح`,
        user: userData,
      });
    } catch (error: any) {
      console.error("Failed to restore user:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "تعذر استرجاع الحساب",
      });
    }
  },
);

adminRouter.post(
  "/users/:uid/password-reset",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const { newPassword } = req.body;
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();
    if (!auth || !db)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (
      !newPassword ||
      newPassword.length < 8 ||
      !/\d/.test(newPassword) ||
      !/[a-zA-Z]/.test(newPassword)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "كلمة المرور غير مطابقة للمتطلبات" });
    }

    try {
      await auth.updateUser(uid, { password: newPassword });
      await auth.revokeRefreshTokens(uid);
      const userDocRef = db.collection("users").doc(uid);
      const snap = await userDocRef.get();
      const nextVersion = (Number(snap.data()?.tokenVersion) || 1) + 1;
      await userDocRef.update({
        tokenVersion: nextVersion,
        updatedAt: new Date().toISOString(),
      });
      await db.collection("audit_logs").add({
        action: "PASSWORD_RESET_BY_ADMIN",
        targetUid: uid,
        tokenVersion: nextVersion,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });
      res.json({ success: true, tokenVersion: nextVersion });
    } catch (error) {
      res.status(500).json({ success: false, error: "فشل تعيين كلمة المرور" });
    }
  },
);

const contentText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** CMS endpoints deliberately accept a safe allow-list, never arbitrary Firestore fields. NO productionLabel. */
adminRouter.get(
  "/content/site",
  requireRbacAction("manage_public_content"),
  async (_req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    try {
      const snapshot = await db.collection("public_content").doc("site").get();
      const data = (snapshot.data() || {}) as any;
      return res.json({
        success: true,
        content: {
          aboutTitle: contentText(data.aboutTitle, 180),
          aboutBody: contentText(data.aboutBody, 4000),
          vision: contentText(data.vision, 2000),
          mission: contentText(data.mission, 2000),
          goals: Array.isArray(data.goals) ? data.goals : [],
          sections: Array.isArray(data.sections) ? data.sections : [],
          version: Number(data.version) || 1,
          status: data.status || "PUBLISHED",
        },
      });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر قراءة محتوى الواجهة" });
    }
  },
);

adminRouter.put(
  "/content/site",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    const content = {
      aboutTitle: contentText(req.body?.aboutTitle, 180),
      aboutBody: contentText(req.body?.aboutBody, 4000),
      vision: contentText(req.body?.vision, 2000),
      mission: contentText(req.body?.mission, 2000),
      goals: Array.isArray(req.body?.goals) ? req.body.goals : [],
      sections: Array.isArray(req.body?.sections) ? req.body.sections : [],
      status: "PUBLISHED",
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "system",
    };
    if (!content.aboutTitle || !content.aboutBody) {
      return res
        .status(400)
        .json({ success: false, error: "عنوان ونبذة التعريف مطلوبان" });
    }
    try {
      await db
        .collection("public_content")
        .doc("site")
        .set(content, { merge: true });
      await db.collection("audit_logs").add({
        action: "PUBLIC_CONTENT_UPDATED",
        performedBy: req.user?.uid || "system",
        timestamp: content.updatedAt,
      });
      return res.json({ success: true, content });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر حفظ محتوى الواجهة" });
    }
  },
);

/** Save CMS as Draft (only visible in editor preview) */
adminRouter.put(
  "/cms/draft",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    const content = req.body?.content;
    if (!content || typeof content !== "object") {
      return res
        .status(400)
        .json({ success: false, error: "محتوى المسودة غير صالح" });
    }
    try {
      await db
        .collection("public_content")
        .doc("site_draft")
        .set(
          {
            ...content,
            status: "DRAFT",
            updatedAt: new Date().toISOString(),
            updatedBy: req.user?.uid || "system",
          },
          { merge: true },
        );
      return res.json({ success: true, message: "تم حفظ المسودة" });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر حفظ المسودة" });
    }
  },
);

/** Publish CMS content with versioning & audit trail */
adminRouter.post(
  "/cms/publish",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    const content = req.body?.content;
    const summary = contentText(req.body?.summary, 300) || "تحديث محتوى المنصة";
    if (!content || typeof content !== "object") {
      return res
        .status(400)
        .json({ success: false, error: "المحتوى المطلوب نشره غير صالح" });
    }

    try {
      const siteDoc = await db.collection("public_content").doc("site").get();
      const siteData = siteDoc.data() || {};
      const currentVersion = Number(siteData.version) || 1;
      const expectedVersion =
        req.body?.expectedVersion !== undefined &&
        req.body?.expectedVersion !== null
          ? Number(req.body.expectedVersion)
          : null;
      const force = req.body?.force === true;

      if (
        expectedVersion !== null &&
        currentVersion > expectedVersion &&
        !force
      ) {
        return res.status(409).json({
          success: false,
          conflict: true,
          currentVersion,
          expectedVersion,
          lastUpdatedAt: siteData.updatedAt,
          publishedBy: siteData.publishedBy,
          latestContent: siteData,
          error: `تعارض في التعديل: توجد نسخة أحدث منشورة (v${currentVersion}) تم نشرها بتاريخ ${siteData.updatedAt || "سابق"}. يرجى مراجعة التغييرات الأحدث أو فرض النشر.`,
        });
      }

      const newVersion = currentVersion + 1;

      const publishedContent = {
        ...content,
        version: newVersion,
        status: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        publishedBy: req.user?.uid || "system",
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.uid || "system",
      };

      // Save to public site
      await db
        .collection("public_content")
        .doc("site")
        .set(publishedContent, { merge: true });

      // Save version snapshot
      await db.collection("cms_history").add({
        version: newVersion,
        content: publishedContent,
        summary,
        timestamp: new Date().toISOString(),
        publishedBy: req.user?.uid || "system",
      });

      // Audit log
      await db.collection("audit_logs").add({
        action: "CMS_PUBLISHED",
        version: newVersion,
        summary,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        version: newVersion,
        message: "تم نشر المحتوى بنجاح",
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر نشر المحتوى" });
    }
  },
);

/** Fetch CMS Version History */
adminRouter.get(
  "/cms/history",
  requireRbacAction("manage_public_content"),
  async (_req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    try {
      const snap = await db
        .collection("cms_history")
        .orderBy("version", "desc")
        .limit(20)
        .get();
      const versions = snap.docs.map((doc) => ({
        id: doc.id,
        version: doc.data().version,
        summary: doc.data().summary,
        timestamp: doc.data().timestamp,
        publishedBy: doc.data().publishedBy,
      }));
      return res.json({ success: true, versions });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "تعذر استرجاع سجل النسخ",
      });
    }
  },
);

/** Restore CMS Version */
adminRouter.post(
  "/cms/restore/:version",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const versionNum = Number(req.params.version);
    if (!db || !versionNum)
      return res
        .status(400)
        .json({ success: false, error: "رقم نسخة غير صالح" });

    try {
      const snap = await db
        .collection("cms_history")
        .where("version", "==", versionNum)
        .limit(1)
        .get();
      if (snap.empty)
        return res
          .status(404)
          .json({ success: false, error: "النسخة غير موجودة" });
      const targetVersion = snap.docs[0].data();

      await db
        .collection("public_content")
        .doc("site")
        .set(targetVersion.content, { merge: true });
      await db.collection("audit_logs").add({
        action: "CMS_RESTORED",
        version: versionNum,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, content: targetVersion.content });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر استعادة النسخة" });
    }
  },
);

adminRouter.put(
  "/content/:collection/:id",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const { collection, id } = req.params;
    if (
      !(["public_library", "public_activities"] as string[]).includes(
        collection,
      ) ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(id)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "معرّف محتوى غير صالح" });
    }
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });
    const docRef = db.collection(collection).doc(id);
    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists
      ? (existingDoc.data() as any)
      : null;

    let serverDuration = Math.max(0, Number(req.body?.durationSeconds) || 0);
    if (
      collection === "public_library" &&
      req.body?.audioUrl &&
      serverDuration === 0
    ) {
      serverDuration = await getAudioDurationSeconds(req.body.audioUrl);
    }
    // Fallback to existing valid duration if present
    if (serverDuration === 0 && existingData?.durationSeconds) {
      serverDuration = Number(existingData.durationSeconds);
    }

    const requestedStatus =
      req.body?.status ||
      (req.body?.published === true ? "PUBLISHED" : "DRAFT");
    const isPublishAttempt =
      requestedStatus === "PUBLISHED" || req.body?.published === true;

    // Existing approved duration overrides processing flag
    const hasExistingApproval = Boolean(
      existingData?.manualDurationApproval?.approvedBy,
    );
    const isNeedsProcessing = hasExistingApproval
      ? false
      : Boolean(req.body?.needsProcessing) || serverDuration <= 0;

    if (
      collection === "public_library" &&
      isPublishAttempt &&
      (isNeedsProcessing || serverDuration <= 0)
    ) {
      return res.status(400).json({
        success: false,
        code: "PUBLISH_PROCESSING_REQUIRED",
        error:
          "لا يمكن نشر هذا التسجيل الصوتي لأن المدة الزمنية غير مستخرجة أو يحتاج إلى معالجة (needsProcessing=true). يجب استخراج المدة أولاً أو اعتمادها رسمياً عبر مسار الاعتماد اليدوي المستقل.",
      });
    }

    const base = {
      status: requestedStatus,
      published: isPublishAttempt,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "system",
    };

    const item =
      collection === "public_library"
        ? {
            ...base,
            title: contentText(req.body?.title, 180),
            shortDescription: contentText(
              req.body?.shortDescription || req.body?.description,
              1200,
            ),
            category: contentText(req.body?.category, 80) || "الأدب",
            coverUrl: contentText(req.body?.coverUrl, 2048),
            audioUrl: contentText(req.body?.audioUrl, 2048),
            driveFileId: contentText(req.body?.driveFileId, 200),
            authorName: contentText(
              req.body?.authorName || req.body?.bookAuthor,
              120,
            ),
            narratorName: contentText(
              req.body?.narratorName || req.body?.narrator_name,
              120,
            ),
            audioEngineerName: contentText(
              req.body?.audioEngineerName || req.body?.mastered_by,
              120,
            ),
            reviewerName: contentText(
              req.body?.reviewerName || req.body?.qa_reviewer,
              120,
            ),
            durationSeconds: serverDuration,
            needsProcessing: isNeedsProcessing,
            processingStatus: isNeedsProcessing ? "NEEDS_PROCESSING" : "READY",
            manualDurationApproval:
              existingData?.manualDurationApproval || null,
            tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
            spotifyUrl: contentText(req.body?.spotifyUrl, 2048),
            optionalPdfUrl: contentText(req.body?.optionalPdfUrl, 2048),
            publishDate:
              contentText(req.body?.publishDate, 40) ||
              new Date().toISOString().split("T")[0],
            featured: Boolean(req.body?.featured),
            order: Number(req.body?.order) || 0,
          }
        : {
            ...base,
            title: contentText(req.body?.title, 180),
            slug: contentText(req.body?.slug, 120) || id,
            shortDescription: contentText(
              req.body?.shortDescription || req.body?.summary,
              500,
            ),
            fullDescription: contentText(
              req.body?.fullDescription || req.body?.body,
              6000,
            ),
            coverImage: contentText(
              req.body?.coverImage || req.body?.imageUrl,
              2048,
            ),
            galleryImages: Array.isArray(req.body?.galleryImages)
              ? req.body.galleryImages
              : [],
            activityType:
              contentText(req.body?.activityType, 60) || "CULTURAL_SESSION",
            mode: contentText(req.body?.mode, 30) || "ONLINE",
            location: contentText(req.body?.location, 200),
            meetingLink: contentText(req.body?.meetingLink, 2048),
            startDate: contentText(req.body?.startDate || req.body?.date, 40),
            endDate: contentText(req.body?.endDate, 40),
            organizers: Array.isArray(req.body?.organizers)
              ? req.body.organizers
              : ["فريق إنصات"],
            recordingUrl: contentText(req.body?.recordingUrl, 2048),
            relatedLinks: Array.isArray(req.body?.relatedLinks)
              ? req.body.relatedLinks
              : [],
            featured: Boolean(req.body?.featured),
          };
    if (!item.title)
      return res
        .status(400)
        .json({ success: false, error: "عنوان المحتوى مطلوب" });
    try {
      await db.collection(collection).doc(id).set(item, { merge: true });
      await db.collection("audit_logs").add({
        action: "CONTENT_UPDATED",
        collection,
        contentId: id,
        title: item.title,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, item: { id, ...item } });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر حفظ المحتوى" });
    }
  },
);

adminRouter.post(
  "/content/:collection",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const { collection } = req.params;
    if (
      !(["public_library", "public_activities"] as string[]).includes(
        collection,
      )
    ) {
      return res
        .status(400)
        .json({ success: false, error: "معرّف مجموعة غير صالح" });
    }
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const id = `${collection === "public_activities" ? "act" : "lib"}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let serverDuration = Math.max(0, Number(req.body?.durationSeconds) || 0);
    if (
      collection === "public_library" &&
      req.body?.audioUrl &&
      serverDuration === 0
    ) {
      serverDuration = await getAudioDurationSeconds(req.body.audioUrl);
    }

    const requestedStatus = req.body?.status || "UPCOMING";
    const isPublishAttempt =
      requestedStatus === "PUBLISHED" || req.body?.published === true;
    const isNeedsProcessing =
      Boolean(req.body?.needsProcessing) || serverDuration <= 0;

    if (
      collection === "public_library" &&
      isPublishAttempt &&
      (isNeedsProcessing || serverDuration <= 0)
    ) {
      return res.status(400).json({
        success: false,
        code: "PUBLISH_PROCESSING_REQUIRED",
        error:
          "لا يمكن نشر هذا التسجيل الصوتي لأن المدة الزمنية غير مستخرجة أو يحتاج إلى معالجة (needsProcessing=true). يجب استخراج المدة أولاً أو اعتمادها رسمياً عبر مسار الاعتماد اليدوي المستقل بعد الإنشاء.",
      });
    }

    const base = {
      status: requestedStatus,
      published: isPublishAttempt,
      createdAt: new Date().toISOString(),
      createdBy: req.user?.uid || "system",
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "system",
    };

    const item =
      collection === "public_library"
        ? {
            ...base,
            title: contentText(req.body?.title, 180),
            shortDescription: contentText(
              req.body?.shortDescription || req.body?.description,
              1200,
            ),
            category: contentText(req.body?.category, 80) || "الأدب",
            coverUrl: contentText(req.body?.coverUrl, 2048),
            audioUrl: contentText(req.body?.audioUrl, 2048),
            driveFileId: contentText(req.body?.driveFileId, 200),
            authorName: contentText(
              req.body?.authorName || req.body?.bookAuthor,
              120,
            ),
            narratorName: contentText(
              req.body?.narratorName || req.body?.narrator_name,
              120,
            ),
            audioEngineerName: contentText(
              req.body?.audioEngineerName || req.body?.mastered_by,
              120,
            ),
            reviewerName: contentText(
              req.body?.reviewerName || req.body?.qa_reviewer,
              120,
            ),
            durationSeconds: serverDuration,
            needsProcessing: isNeedsProcessing,
            processingStatus: isNeedsProcessing ? "NEEDS_PROCESSING" : "READY",
            manualDurationApproval: null,
            tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
            spotifyUrl: contentText(req.body?.spotifyUrl, 2048),
            optionalPdfUrl: contentText(req.body?.optionalPdfUrl, 2048),
            publishDate:
              contentText(req.body?.publishDate, 40) ||
              new Date().toISOString().split("T")[0],
            featured: Boolean(req.body?.featured),
            order: Number(req.body?.order) || 0,
          }
        : {
            ...base,
            title: contentText(req.body?.title, 180),
            slug: contentText(req.body?.slug, 120) || id,
            shortDescription: contentText(
              req.body?.shortDescription || req.body?.summary,
              500,
            ),
            fullDescription: contentText(
              req.body?.fullDescription || req.body?.body,
              6000,
            ),
            coverImage: contentText(
              req.body?.coverImage || req.body?.imageUrl,
              2048,
            ),
            galleryImages: Array.isArray(req.body?.galleryImages)
              ? req.body.galleryImages
              : [],
            activityType:
              contentText(req.body?.activityType, 60) || "CULTURAL_SESSION",
            mode: contentText(req.body?.mode, 30) || "ONLINE",
            location: contentText(req.body?.location, 200),
            meetingLink: contentText(req.body?.meetingLink, 2048),
            startDate:
              contentText(req.body?.startDate || req.body?.date, 40) ||
              new Date().toISOString().split("T")[0],
            endDate: contentText(req.body?.endDate, 40),
            organizers:
              Array.isArray(req.body?.organizers) &&
              req.body.organizers.length > 0
                ? req.body.organizers
                : ["فريق إنصات"],
            recordingUrl: contentText(req.body?.recordingUrl, 2048),
            relatedLinks: Array.isArray(req.body?.relatedLinks)
              ? req.body.relatedLinks
              : [],
            featured: Boolean(req.body?.featured),
          };

    if (!item.title)
      return res
        .status(400)
        .json({ success: false, error: "عنوان المحتوى مطلوب" });

    try {
      await db.collection(collection).doc(id).set(item);
      await db.collection("audit_logs").add({
        action: "CONTENT_CREATED",
        collection,
        contentId: id,
        title: item.title,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, item: { id, ...item } });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر إضافة المحتوى" });
    }
  },
);

// Editing content item via PATCH
adminRouter.patch(
  "/content/:collection/:id",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const { collection, id } = req.params;
    if (
      !(["public_library", "public_activities"] as string[]).includes(
        collection,
      ) ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(id)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "معرّف محتوى غير صالح" });
    }
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const docRef = db.collection(collection).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      if (collection === "public_activities") {
        const preset = PRESET_ACTIVITIES.find((p) => p.id === id);
        const baseItem = preset
          ? { ...preset }
          : {
              title: contentText(req.body?.title, 180) || "فعالية ثقافية",
              slug: contentText(req.body?.slug, 120) || id,
              shortDescription: contentText(
                req.body?.shortDescription || req.body?.summary,
                500,
              ),
              fullDescription: contentText(
                req.body?.fullDescription || req.body?.body,
                6000,
              ),
              coverImage: contentText(
                req.body?.coverImage || req.body?.imageUrl,
                2048,
              ),
              activityType:
                contentText(req.body?.activityType, 60) || "CULTURAL_SESSION",
              mode: contentText(req.body?.mode, 30) || "ONLINE",
              startDate:
                contentText(req.body?.startDate || req.body?.date, 40) ||
                new Date().toISOString().split("T")[0],
              status: "UPCOMING",
              createdAt: new Date().toISOString(),
            };
        const initialDoc = {
          ...baseItem,
          ...req.body,
          id,
          updatedAt: new Date().toISOString(),
          updatedBy: req.user?.uid || "system",
        };
        await docRef.set(initialDoc, { merge: true });
        await db.collection("audit_logs").add({
          action: "CONTENT_PATCHED",
          collection,
          contentId: id,
          performedBy: req.user?.uid || "system",
          timestamp: new Date().toISOString(),
        });
        return res.json({ success: true, item: initialDoc });
      }
      return res
        .status(404)
        .json({ success: false, error: "العنصر غير موجود" });
    }

    const updates: Record<string, any> = {
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "system",
    };
    delete updates.id;

    try {
      await docRef.set(updates, { merge: true });
      await db.collection("audit_logs").add({
        action: "CONTENT_PATCHED",
        collection,
        contentId: id,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });
      const updatedSnap = await docRef.get();
      return res.json({ success: true, item: { id, ...updatedSnap.data() } });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر تحديث المحتوى" });
    }
  },
);

// Changing status (e.g. PUBLISHED / DRAFT)
adminRouter.patch(
  "/content/:collection/:id/status",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const { collection, id } = req.params;
    const status = req.body?.status;
    if (
      !status ||
      !["PUBLISHED", "DRAFT", "ARCHIVED", "UPCOMING", "COMPLETED"].includes(
        status,
      )
    ) {
      return res
        .status(400)
        .json({ success: false, error: "حالة النشر غير صالحة" });
    }
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const docRef = db.collection(collection).doc(id);
    const snap = await docRef.get();
    if (!snap.exists)
      return res
        .status(404)
        .json({ success: false, error: "العنصر غير موجود" });

    const currentData = snap.data() || {};

    // Check if publishing an audio item that has needsProcessing=true or missing duration
    if (collection === "public_library" && status === "PUBLISHED") {
      let dur = Number(currentData.durationSeconds) || 0;
      let needsProc = currentData.needsProcessing === true || dur <= 0;

      const manualApproval = req.body?.manualDurationApproval;
      if (
        manualApproval &&
        typeof manualApproval === "object" &&
        Number(manualApproval.durationSeconds) > 0 &&
        manualApproval.reason &&
        ["SUPER_ADMIN", "ADMIN", "AUDIO_ENGINEER"].includes(
          req.user?.canonicalRole || "",
        )
      ) {
        dur = Math.round(Number(manualApproval.durationSeconds));
        needsProc = false;
      }

      if (needsProc || dur <= 0) {
        return res.status(400).json({
          success: false,
          code: "PUBLISH_PROCESSING_REQUIRED",
          error:
            "لا يمكن نشر هذا التسجيل الصوتي لأن المدة الزمنية غير مستخرجة أو يحتاج إلى معالجة (needsProcessing=true). يجب استخراج المدة أولاً أو اعتمادها رسمياً عبر معالجة موثقة.",
        });
      }
    }

    const patchData: Record<string, any> = {
      status,
      published: status === "PUBLISHED",
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "system",
    };

    if (status === "ARCHIVED") {
      patchData.isArchived = true;
      patchData.archivedAt = new Date().toISOString();
      patchData.archivedBy = req.user?.uid || "system";
    } else if (snap.data()?.isArchived) {
      patchData.isArchived = false;
    }

    try {
      await docRef.set(patchData, { merge: true });
      return res.json({
        success: true,
        status,
        item: { id, ...snap.data(), ...patchData },
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر تغيير الحالة" });
    }
  },
);

/**
 * Dedicated, RBAC-protected endpoint to approve audio duration manually.
 * Requires: library.approve_manual_duration
 * - Admin identity extracted strictly from authenticated session (req.user.uid, req.user.canonicalRole).
 * - Body MUST NOT supply approvedBy, approvedAt, or approvedRole.
 * - Reason is strictly mandatory (>= 5 chars).
 * - Records previousDuration, newDuration, source, executor, and reason in audit_logs.
 */
adminRouter.post(
  "/content/public_library/:id/approve-duration",
  requireRbacAction("library.approve_manual_duration"),
  async (req, res) => {
    const { id } = req.params;
    if (!id || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) {
      return res
        .status(400)
        .json({ success: false, error: "معرّف تسجيل غير صالح" });
    }

    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const adminUid = req.user?.uid;
    const adminRole = req.user?.canonicalRole;
    if (!adminUid) {
      return res
        .status(401)
        .json({ success: false, error: "غير مصرح: يجب تسجيل الدخول" });
    }

    // Strictly forbid spoofed approval fields in body
    if (
      req.body?.approvedBy ||
      req.body?.approvedAt ||
      req.body?.approvedRole
    ) {
      return res.status(400).json({
        success: false,
        error:
          "ممنوع تمرير بيانات المسؤول أو وقت الاعتماد في جسم الطلب؛ يتم استخراجها تلقائياً من الجلسة الموثقة.",
      });
    }

    const durationSeconds = Math.round(Number(req.body?.durationSeconds));
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return res.status(400).json({
        success: false,
        error: "المدة الزمنية بالثواني مطلوبة ويجب أن تكون أكبر من الصفر",
      });
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason || reason.length < 5) {
      return res.status(400).json({
        success: false,
        error: "سبب اعتماد المدة يدويًا إلزامي ومفصل (5 أحرف على الأقل)",
      });
    }

    try {
      const docRef = db.collection("public_library").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "التسجيل الصوتي غير موجود" });
      }

      const currentData = snap.data() || {};
      const previousDuration = Number(currentData.durationSeconds) || 0;

      const approvalRecord = {
        approvedBy: adminUid,
        approvedRole: adminRole,
        durationSeconds,
        reason,
        approvedAt: new Date().toISOString(),
      };

      const updatePayload = {
        durationSeconds,
        needsProcessing: false,
        processingStatus: "READY",
        manualDurationApproval: approvalRecord,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUid,
      };

      await docRef.set(updatePayload, { merge: true });

      // Write comprehensive audit log
      await db.collection("audit_logs").add({
        action: "MANUAL_DURATION_APPROVED",
        collection: "public_library",
        contentId: id,
        title: currentData.title || "",
        previousDuration,
        newDuration: durationSeconds,
        source: "manual_approval",
        performedBy: adminUid,
        performedRole: adminRole,
        reason,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "تم اعتماد المدة الزمنية بنجاح وتوثيق العملية في سجل التدقيق",
        durationSeconds,
        manualDurationApproval: approvalRecord,
        item: { id, ...currentData, ...updatePayload },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "تعذر اعتماد المدة يدويًا",
      });
    }
  },
);

// Archiving content (Soft Delete)
adminRouter.patch(
  "/content/:collection/:id/archive",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const { collection, id } = req.params;
    if (
      !(["public_library", "public_activities"] as string[]).includes(
        collection,
      ) ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(id)
    ) {
      return res.status(400).json({ success: false, error: "معرّف غير صالح" });
    }
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const docRef = db.collection(collection).doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      if (collection === "public_activities") {
        const preset = PRESET_ACTIVITIES.find((p) => p.id === id);
        const archiveData = {
          ...(preset || {}),
          id,
          status: "ARCHIVED",
          isArchived: true,
          published: false,
          archivedAt: new Date().toISOString(),
          archivedBy: req.user?.uid || "system",
          updatedAt: new Date().toISOString(),
          updatedBy: req.user?.uid || "system",
        };
        await docRef.set(archiveData, { merge: true });
        await db.collection("audit_logs").add({
          action: "CONTENT_ARCHIVED",
          collection,
          contentId: id,
          title: preset?.title || "فعالية مؤرشفة",
          performedBy: req.user?.uid || "system",
          timestamp: new Date().toISOString(),
        });
        return res.json({
          success: true,
          message: "تمت أرشفة العنصر بنجاح وحفظ بيانات الأرشفة",
          item: archiveData,
        });
      }
      return res
        .status(404)
        .json({ success: false, error: "العنصر غير موجود للأرشفة" });
    }

    const archivePatch = {
      status: "ARCHIVED",
      isArchived: true,
      published: false,
      archivedAt: new Date().toISOString(),
      archivedBy: req.user?.uid || "system",
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "system",
    };

    try {
      await docRef.set(archivePatch, { merge: true });
      await db.collection("audit_logs").add({
        action: "CONTENT_ARCHIVED",
        collection,
        contentId: id,
        title: snap.data()?.title || "",
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });
      return res.json({
        success: true,
        message: "تمت أرشفة العنصر بنجاح وحفظ بيانات الأرشفة",
        item: { id, ...snap.data(), ...archivePatch },
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر أرشفة المحتوى" });
    }
  },
);

// Restoring archived content
adminRouter.patch(
  "/content/:collection/:id/restore",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const { collection, id } = req.params;
    if (
      !(["public_library", "public_activities"] as string[]).includes(
        collection,
      ) ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(id)
    ) {
      return res.status(400).json({ success: false, error: "معرّف غير صالح" });
    }
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const docRef = db.collection(collection).doc(id);
    const snap = await docRef.get();
    if (!snap.exists)
      return res
        .status(404)
        .json({ success: false, error: "العنصر غير موجود للاستعادة" });

    const restorePatch = {
      status: "DRAFT",
      isArchived: false,
      published: false,
      restoredAt: new Date().toISOString(),
      restoredBy: req.user?.uid || "system",
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "system",
    };

    try {
      await docRef.set(restorePatch, { merge: true });
      await db.collection("audit_logs").add({
        action: "CONTENT_RESTORED",
        collection,
        contentId: id,
        title: snap.data()?.title || "",
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });
      return res.json({
        success: true,
        message: "تمت استعادة العنصر إلى المسودة بنجاح",
        item: { id, ...snap.data(), ...restorePatch },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "تعذر استعادة المحتوى",
      });
    }
  },
);

// Deletion of content items
adminRouter.delete(
  "/content/:collection/:id",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const { collection, id } = req.params;
    if (
      !(["public_library", "public_activities"] as string[]).includes(
        collection,
      ) ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(id)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "معرّف غير صالح للحذف" });
    }
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Firebase Admin is not configured" });

    try {
      const docRef = db.collection(collection).doc(id);
      const snap = await docRef.get();

      if (collection === "public_activities") {
        const preset = PRESET_ACTIVITIES.find((p) => p.id === id);
        const title = snap.exists
          ? snap.data()?.title || ""
          : preset?.title || "";
        // Write permanent deletion tombstone in Firestore so it never resurrects on refresh
        await docRef.set(
          {
            id,
            status: "ARCHIVED",
            isDeleted: true,
            isArchived: true,
            published: false,
            deletedAt: new Date().toISOString(),
            deletedBy: req.user?.uid || "system",
          },
          { merge: true },
        );

        await db.collection("audit_logs").add({
          action: "CONTENT_DELETED",
          collection,
          contentId: id,
          title,
          performedBy: req.user?.uid || "system",
          timestamp: new Date().toISOString(),
        });

        return res.json({
          success: true,
          message: "تم حذف الفعالية وتوثيق الحذف بنجاح",
          id,
        });
      }

      if (!snap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "العنصر غير موجود" });
      }

      const title = snap.data()?.title || "";
      await docRef.delete();

      await db.collection("audit_logs").add({
        action: "CONTENT_DELETED",
        collection,
        contentId: id,
        title,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "تم حذف العنصر بنجاح من قاعدة البيانات",
        id,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "تعذر إتمام عملية الحذف",
      });
    }
  },
);

// Server-side verified CMS permission check
adminRouter.get(
  "/check-cms-permission",
  requireRbacAction("manage_public_content"),
  (req, res) => {
    return res.json({
      success: true,
      allowed: true,
      uid: req.user.uid,
      role: req.user.canonicalRole,
    });
  },
);

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

// Secure server-side media upload with signature inspection and duration extraction
adminRouter.post(
  "/media/upload",
  requireRbacAction("manage_public_content"),
  mediaUpload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: "لم يتم اختيار أي ملف" });
    }

    const mediaType = req.body?.type === "image" ? "image" : "audio";

    if (mediaType === "image") {
      // 10MB limit for images
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: "حجم الصورة يجب ألا يتجاوز 10 ميجابايت",
        });
      }
      const sig = validateImageSignature(file.buffer);
      if (!sig.valid) {
        return res.status(400).json({
          success: false,
          error: "الملف المرفوع ليس صورة صالحة أو يحتوي على توقيع غير مدعوم",
        });
      }

      const safeExt = sig.format === "jpeg" ? "jpg" : sig.format;
      const cleanFileName = `public_images/${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${safeExt}`;

      // Always persist to local uploads directory for reliable serving
      const imagesDir = path.join(process.cwd(), "uploads", "images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      const localImgName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${safeExt}`;
      fs.writeFileSync(path.join(imagesDir, localImgName), file.buffer);
      let downloadUrl = `/uploads/images/${localImgName}`;

      // Optional cloud storage backup if an explicit bucket is configured
      const storage = getFirebaseAdminStorage();
      if (storage && process.env.FIREBASE_STORAGE_BUCKET) {
        try {
          const bucket = storage.bucket();
          const fileRef = bucket.file(cleanFileName);
          await fileRef.save(file.buffer, {
            contentType: `image/${sig.format}`,
            public: true,
            metadata: { uploadedBy: req.user?.uid || "admin" },
          });
          downloadUrl = `https://storage.googleapis.com/${bucket.name}/${cleanFileName}`;
        } catch {
          // Silently fallback to the local URL
        }
      }

      return res.json({
        success: true,
        url: downloadUrl,
        format: sig.format,
        size: file.size,
      });
    }

    // Audio Upload
    if (file.size > 100 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: "حجم الملف الصوتي يجب ألا يتجاوز 100 ميجابايت",
      });
    }

    const audioSig = validateAudioSignature(file.buffer);
    if (!audioSig.valid) {
      return res.status(400).json({
        success: false,
        error:
          "الملف المرفوع ليس ملفاً صوتياً معتمداً أو يحتوي على توقيع غير مدعوم",
      });
    }

    const meta = await extractAudioMetadataFromBuffer(
      file.buffer,
      file.mimetype,
    );

    const cleanFileName = `public_library_audio/${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${audioSig.format}`;
    const localAudioName = `public_library_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${audioSig.format}`;

    // 1. Always store locally in uploads/recordings for instant, reliable zero-dependency playback
    const localRecordingsDir = path.join(
      process.cwd(),
      "uploads",
      "recordings",
    );
    if (!fs.existsSync(localRecordingsDir)) {
      fs.mkdirSync(localRecordingsDir, { recursive: true });
    }
    const localFilePath = path.join(localRecordingsDir, localAudioName);
    fs.writeFileSync(localFilePath, file.buffer);

    let audioUrl = `/api/public-audio/${localAudioName}`;

    // 2. Optional cloud storage backup if an explicit bucket is configured
    const storage = getFirebaseAdminStorage();
    if (storage && process.env.FIREBASE_STORAGE_BUCKET) {
      try {
        const bucket = storage.bucket();
        const fileRef = bucket.file(cleanFileName);
        await fileRef.save(file.buffer, {
          contentType: file.mimetype || `audio/${audioSig.format}`,
          public: true,
          metadata: {
            uploadedBy: req.user?.uid || "admin",
            durationSeconds: String(meta.durationSeconds),
          },
        });
        audioUrl = `https://storage.googleapis.com/${bucket.name}/${cleanFileName}`;
      } catch {
        // Gracefully maintain the local URL without crashing or logging raw errors
      }
    }

    return res.json({
      success: true,
      url: audioUrl,
      durationSeconds: meta.durationSeconds,
      needsProcessing: meta.needsProcessing,
      format: audioSig.format,
      size: file.size,
    });
  },
);

// Member profile editing with duplicate phone protection
adminRouter.patch(
  "/users/:uid",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const { name, phone, country, department, role } = req.body;
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res
        .status(404)
        .json({ success: false, error: "المستخدم غير موجود" });
    }
    const currentData = userSnap.data() || {};
    if (
      !canManageMemberRole(
        req.user,
        currentData.role || currentData.canonicalRole,
      )
    ) {
      return res.status(403).json({
        success: false,
        error: "لا تملك صلاحية تعديل حساب بهذه الرتبة",
      });
    }
    if (role !== undefined) {
      return res
        .status(400)
        .json({ success: false, error: "استخدم مسار تغيير الرتبة المخصص" });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || "admin",
    };

    if (name && typeof name === "string") {
      updates.name = name.trim();
      updates.fullName = name.trim();
    }
    if (country && typeof country === "string") {
      updates.country = country.trim();
    }
    if (department && typeof department === "string") {
      updates.department = department.trim();
    }
    if (phone !== undefined) {
      const rawPhone = String(phone || "").trim();
      if (rawPhone) {
        const phoneNormalized = normalizeToE164(rawPhone);
        if (!phoneNormalized) {
          return res
            .status(400)
            .json({ success: false, error: "صيغة رقم الهاتف غير صالحة" });
        }

        // Check duplicate on other accounts
        const existingSnap = await db
          .collection("users")
          .where("phoneNormalized", "==", phoneNormalized)
          .limit(2)
          .get();

        const isTakenByOther = existingSnap.docs.some((doc) => doc.id !== uid);
        if (isTakenByOther) {
          return res.status(409).json({
            success: false,
            error: "رقم الهاتف مسجل بالفعل لعضو آخر. يرجى استخدام رقم فريد.",
          });
        }

        updates.phone = phoneNormalized;
        updates.phoneNormalized = phoneNormalized;
      } else {
        updates.phone = "";
        updates.phoneNormalized = "";
      }
    }

    try {
      await userRef.set(updates, { merge: true });

      // Sync to Supabase profiles
      await syncUserProfileToSupabase(uid, uid, currentData.email, updates);

      await db.collection("audit_logs").add({
        action: "USER_PROFILE_UPDATED",
        targetUid: uid,
        updates,
        performedBy: req.user?.uid || "admin",
        timestamp: new Date().toISOString(),
      });
      return res.json({
        success: true,
        message: "تم تحديث بيانات العضو بنجاح",
        updates,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر حفظ التعديلات" });
    }
  },
);

/** GET /api/admin/countries - Get managed countries list and mode */
adminRouter.get(
  "/countries",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
    }

    try {
      const siteDoc = await db.collection("public_content").doc("site").get();
      const data = siteDoc.exists ? siteDoc.data() : {};
      return res.json({
        success: true,
        countryMetricMode: data?.countryMetricMode || "AUTO",
        manualCountries: Array.isArray(data?.manualCountries)
          ? data.manualCountries
          : [],
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "تعذر جلب قائمة الدول",
      });
    }
  },
);

/** POST /api/admin/countries - Add or update a single country */
adminRouter.post(
  "/countries",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
    }

    const name = cleanString(req.body?.name, 80);
    const count = Math.max(1, Number(req.body?.count) || 1);
    const members = Array.isArray(req.body?.members)
      ? req.body.members.map((m: any) => cleanString(m, 100)).filter(Boolean)
      : [];

    if (!name) {
      return res
        .status(400)
        .json({ success: false, error: "اسم الدولة مطلوب" });
    }

    try {
      const siteRef = db.collection("public_content").doc("site");
      const siteDoc = await siteRef.get();
      const data = siteDoc.exists ? siteDoc.data() : {};
      const existingList: Array<{
        name: string;
        count: number;
        members: string[];
      }> = Array.isArray(data?.manualCountries)
        ? [...data.manualCountries]
        : [];

      const existingIdx = existingList.findIndex(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      if (existingIdx >= 0) {
        existingList[existingIdx] = { name, count, members };
      } else {
        existingList.push({ name, count, members });
      }

      await siteRef.set(
        {
          manualCountries: existingList,
          countryMetricMode: "MANUAL",
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      // Also update draft
      await db.collection("public_content").doc("site_draft").set(
        {
          manualCountries: existingList,
          countryMetricMode: "MANUAL",
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      return res.json({
        success: true,
        message: `تم حفظ بيانات الدولة (${name}) بنجاح`,
        countries: existingList,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر حفظ الدولة" });
    }
  },
);

/** PUT /api/admin/countries - Update all countries list & mode */
adminRouter.put(
  "/countries",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
    }

    const { mode, countries } = req.body;
    if (!Array.isArray(countries)) {
      return res
        .status(400)
        .json({ success: false, error: "قائمة الدول غير صالحة" });
    }

    const cleanedCountries = countries
      .map((c: any) => ({
        name: cleanString(c.name, 80),
        count: Math.max(1, Number(c.count) || 1),
        members: Array.isArray(c.members)
          ? c.members.map((m: any) => cleanString(m, 100)).filter(Boolean)
          : [],
      }))
      .filter((c) => Boolean(c.name));

    try {
      const siteRef = db.collection("public_content").doc("site");
      const payload = {
        manualCountries: cleanedCountries,
        countryMetricMode: mode === "AUTO" ? "AUTO" : "MANUAL",
        updatedAt: new Date().toISOString(),
      };

      await siteRef.set(payload, { merge: true });
      await db
        .collection("public_content")
        .doc("site_draft")
        .set(payload, { merge: true });

      return res.json({
        success: true,
        message: "تم تحديث إعدادات وقائمة الدول بنجاح",
        countries: cleanedCountries,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || "تعذر تحديث قائمة الدول",
      });
    }
  },
);

/** DELETE /api/admin/countries/:name - Delete a country from manual list */
adminRouter.delete(
  "/countries/:name",
  requireRbacAction("manage_public_content"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
    }

    const countryName = decodeURIComponent(req.params.name || "").trim();
    if (!countryName) {
      return res
        .status(400)
        .json({ success: false, error: "اسم الدولة غير محدد" });
    }

    try {
      const siteRef = db.collection("public_content").doc("site");
      const siteDoc = await siteRef.get();
      const data = siteDoc.exists ? siteDoc.data() : {};
      const existingList: Array<{
        name: string;
        count: number;
        members: string[];
      }> = Array.isArray(data?.manualCountries)
        ? [...data.manualCountries]
        : [];

      const updatedList = existingList.filter(
        (c) => c.name.toLowerCase() !== countryName.toLowerCase(),
      );

      await siteRef.set(
        {
          manualCountries: updatedList,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      await db.collection("public_content").doc("site_draft").set(
        {
          manualCountries: updatedList,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      return res.json({
        success: true,
        message: `تم حذف (${countryName}) من قائمة الدول`,
        countries: updatedList,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: err?.message || "تعذر حذف الدولة" });
    }
  },
);

// ==========================================
// 🔍 MIGRATION AUDIT & VERIFICATION ENDPOINTS
// ==========================================

/** GET /api/admin/migration-audits - Get all migrated accounts for manual audit */
adminRouter.get(
  "/migration-audits",
  requireRbacAction("view_audit_logs"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
    }

    try {
      const auditsSnap = await db
        .collection("migration_audits")
        .orderBy("migratedAt", "desc")
        .get()
        .catch(() => null);
      let audits: any[] = [];

      if (auditsSnap && !auditsSnap.empty) {
        audits = auditsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } else {
        // Fallback: search users collection for legacyMigrated == true
        const usersSnap = await db
          .collection("users")
          .where("legacyMigrated", "==", true)
          .get()
          .catch(() => null);
        if (usersSnap && !usersSnap.empty) {
          audits = usersSnap.docs.map((doc) => {
            const d = doc.data();
            return {
              id: doc.id,
              uid: doc.id,
              legacyId: d.legacyId || doc.id,
              name: d.name || d.fullName || "عضو إنصات",
              originalIdentifier:
                d.identifier || d.rawIdentifier || d.phone || d.email || doc.id,
              originalPhone: d.phone || null,
              originalEmail: d.email || null,
              newUsername: d.username || "",
              newEmail: d.email || "",
              newPhone: d.phone || "",
              country: d.country || d.nationality || "",
              field: d.field || "",
              role: d.role || "NARRATOR",
              role_display_ar: d.role_display_ar || "راوي",
              migratedAt:
                d.migratedAt || d.pinMigratedAt || new Date().toISOString(),
              auditStatus: d.migrationAuditStatus || "PENDING_AUDIT",
              auditedBy: d.migrationAuditedBy || null,
              auditedAt: d.migrationAuditedAt || null,
              auditNotes: d.migrationAuditNotes || "",
              verifiedVia: "PIN_MIGRATION",
            };
          });
        }
      }

      return res.json({
        success: true,
        audits,
      });
    } catch (err: any) {
      console.error("[adminRoutes] Fetch migration audits error:", err);
      return res
        .status(500)
        .json({ success: false, error: "تعذر تحميل سجلات تدقيق الترحيل" });
    }
  },
);

/** POST /api/admin/migration-audits/:uid/verify - Approve / Verify a migrated account */
adminRouter.post(
  "/migration-audits/:uid/verify",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
    }

    const targetUid = cleanString(req.params.uid, 128);
    const { status = "VERIFIED", notes = "" } = req.body;
    const auditorName = (
      req.user?.name ||
      req.user?.email ||
      req.user?.uid ||
      "الإدارة"
    ).trim();
    const now = new Date().toISOString();

    try {
      const batch = db.batch();

      // 1. Update migration_audits
      const auditDocRef = db.collection("migration_audits").doc(targetUid);
      batch.set(
        auditDocRef,
        {
          auditStatus: status,
          auditedBy: auditorName,
          auditedAt: now,
          auditNotes: cleanString(notes, 500),
          updatedAt: now,
        },
        { merge: true },
      );

      // 2. Update user doc
      const userRef = db.collection("users").doc(targetUid);
      batch.set(
        userRef,
        {
          migrationAuditStatus: status,
          migrationAuditedBy: auditorName,
          migrationAuditedAt: now,
          migrationAuditNotes: cleanString(notes, 500),
          updatedAt: now,
        },
        { merge: true },
      );

      // 3. Log to audit_logs
      const logRef = db.collection("audit_logs").doc();
      batch.set(logRef, {
        action:
          status === "VERIFIED"
            ? "MIGRATION_AUDIT_VERIFIED"
            : "MIGRATION_AUDIT_UPDATED",
        targetUid,
        auditor: auditorName,
        status,
        notes: cleanString(notes, 500),
        timestamp: now,
        performedBy: req.user?.uid || "system",
      });

      await batch.commit();

      return res.json({
        success: true,
        message:
          status === "VERIFIED"
            ? "تم اعتماد وتأكيد تدقيق الحساب بنجاح"
            : "تم تحديث حالة التدقيق",
        auditStatus: status,
        auditedBy: auditorName,
        auditedAt: now,
      });
    } catch (err: any) {
      console.error("[adminRoutes] Verify migration audit error:", err);
      return res
        .status(500)
        .json({ success: false, error: "تعذر اعتماد التدقيق" });
    }
  },
);

/** POST /api/admin/migration-audits/:uid/note - Update audit notes */
adminRouter.post(
  "/migration-audits/:uid/note",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db) {
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير مهيأة" });
    }

    const targetUid = cleanString(req.params.uid, 128);
    const { notes = "", status } = req.body;
    const auditorName = (
      req.user?.name ||
      req.user?.email ||
      req.user?.uid ||
      "الإدارة"
    ).trim();
    const now = new Date().toISOString();

    try {
      const payload: any = {
        auditNotes: cleanString(notes, 500),
        lastAuditorNoteBy: auditorName,
        lastAuditorNoteAt: now,
        updatedAt: now,
      };
      if (status) {
        payload.auditStatus = status;
        payload.auditedBy = auditorName;
        payload.auditedAt = now;
      }

      await db
        .collection("migration_audits")
        .doc(targetUid)
        .set(payload, { merge: true });
      await db
        .collection("users")
        .doc(targetUid)
        .set(
          {
            migrationAuditNotes: cleanString(notes, 500),
            ...(status
              ? {
                  migrationAuditStatus: status,
                  migrationAuditedBy: auditorName,
                  migrationAuditedAt: now,
                }
              : {}),
            updatedAt: now,
          },
          { merge: true },
        );

      return res.json({
        success: true,
        message: "تم حفظ ملاحظة التدقيق بنجاح",
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, error: "تعذر حفظ الملاحظة" });
    }
  },
);

export { adminRouter };
