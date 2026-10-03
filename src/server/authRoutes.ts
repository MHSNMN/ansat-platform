import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import {
  getFirebaseAdminFirestore,
  getFirebaseAdminAuth,
} from "./firebaseAdmin";
import { normalizeToE164 } from "../lib/phoneUtils";
import { authenticateRequest } from "./authMiddleware";
import { findUserDocumentByIdentifier } from "./userLookup";
import {
  invalidateProfileCache,
  getSupabaseAdminClient,
  getProfileByFirebaseUid,
} from "./supabaseAdmin";
import { invalidateUserLookupCache } from "./userLookup";
import firebaseConfig from "../../firebase-applet-config.json";

export const authRouter = Router();

// Constant dummy hash for timing attack mitigation
const DUMMY_BCRYPT_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ5qgK6Wvhf9F8zQkK4i.iP7C4pXyq/C";

// 1. Strict IP-based rate limiter to prevent Brute-force attacks
const isTestEnv =
  process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv ? 10000 : 5, // 5 attempts per window in production
  skip: () => isTestEnv,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error:
      "تم تجاوز عدد محاولات الدخول المسموح بها، يرجى المحاولة بعد 15 دقيقة",
  },
});

// 2. Account-based Rate Limiter using SHA-256 masked key to prevent account enumeration
const accountLimiterMap = new Map<string, { count: number; resetAt: number }>();

function checkMaskedAccountLimit(rawIdentifier: string): boolean {
  if (isTestEnv || !rawIdentifier) return true;
  const maskedKey = crypto
    .createHash("sha256")
    .update(rawIdentifier.trim().toLowerCase())
    .digest("hex");
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  const entry = accountLimiterMap.get(maskedKey);
  if (!entry || now > entry.resetAt) {
    accountLimiterMap.set(maskedKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Validates password strength: minimum 8 characters, letters and numbers.
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "كلمة المرور مطلوبة" };
  }
  if (password.length < 8) {
    return { valid: false, error: "يجب ألا تقل كلمة المرور عن 8 خانات" };
  }
  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return {
      valid: false,
      error: "يجب أن تحتوي كلمة المرور على أحرف وأرقام معاً",
    };
  }
  return { valid: true };
}

/**
 * Clean & normalize text inputs
 */
function sanitizeInput(raw: any, maxLen = 128): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, maxLen);
}

/**
 * Secure login endpoint preventing Account Enumeration and Brute Force attacks.
 * Resolves phone numbers, usernames, or emails into the canonical Firebase UID.
 */
authRouter.post("/login", loginLimiter, async (req, res) => {
  const rawIdentifier = sanitizeInput(req.body?.identifier, 128);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!rawIdentifier || !password) {
    return res
      .status(401)
      .json({ success: false, error: "بيانات الدخول غير صحيحة" });
  }

  // Account-based rate limit without disclosing whether account exists
  if (!checkMaskedAccountLimit(rawIdentifier)) {
    return res.status(429).json({
      success: false,
      error:
        "تم تجاوز عدد محاولات الدخول المسموح بها لهذا الحساب، يرجى المحاولة بعد 15 دقيقة",
    });
  }

  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();

  if (!db || !auth) {
    return res
      .status(503)
      .json({ success: false, error: "خدمة المصادقة غير متاحة حالياً" });
  }

  let matchedUserDoc: any = null;
  let matchedUid = "";

  try {
    matchedUserDoc = await findUserDocumentByIdentifier(db, rawIdentifier);

    // Account Enumeration Defense: If user is not found, perform dummy bcrypt comparison
    if (!matchedUserDoc) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return res
        .status(401)
        .json({ success: false, error: "بيانات الدخول غير صحيحة" });
    }

    const userData = matchedUserDoc.data();
    matchedUid = userData.uid || matchedUserDoc.id;

    // Check account status
    const status = userData.accountStatus || userData.status || "active";
    if (status === "disabled" || status === "suspended") {
      return res.status(403).json({
        success: false,
        error: "تم تعطيل هذا الحساب، يرجى التواصل مع الإدارة",
      });
    }

    let authenticated = false;

    // 1. Check if bcrypt password hash or pin is stored in private_security subcollection (or legacy in user doc)
    let passwordHash: string | null = null;
    let pinHash: string | null = null;
    let pin: string | null = null;

    try {
      const uDoc = db.collection("users").doc(matchedUid);
      if (typeof uDoc?.collection === "function") {
        const credDoc = await uDoc
          .collection("private_security")
          .doc("credentials")
          .get();
        if (credDoc && credDoc.exists) {
          const credData = credDoc.data() || {};
          passwordHash = credData.passwordHash || null;
          pinHash = credData.pinHash || null;
          pin = credData.pin || null;
        }
      }
    } catch {
      // fallback to userData
    }

    if (!passwordHash && userData.passwordHash)
      passwordHash = userData.passwordHash;
    if (!pinHash && userData.pinHash) pinHash = userData.pinHash;
    if (!pin && userData.pin) pin = userData.pin;

    // Background scrub: If sensitive credentials still exist directly on the user doc, safely move them to private_security and delete from user doc
    if (
      userData.passwordHash ||
      userData.pinHash ||
      userData.pin ||
      userData.salt
    ) {
      try {
        const uDoc = db.collection("users").doc(matchedUid);
        if (typeof uDoc?.collection === "function") {
          uDoc
            .collection("private_security")
            .doc("credentials")
            .set(
              {
                passwordHash: passwordHash || null,
                pinHash: pinHash || null,
                pin: pin || null,
                migratedAt: new Date().toISOString(),
              },
              { merge: true },
            )
            .catch(() => {});
        }

        if (typeof uDoc?.update === "function") {
          uDoc
            .update({
              hasPassword: Boolean(passwordHash || userData.hasPassword),
              passwordHash: FieldValue.delete(),
              pinHash: FieldValue.delete(),
              pin: FieldValue.delete(),
              salt: FieldValue.delete(),
            })
            .catch(() => {});
        }
      } catch {
        // Safe ignore
      }
    }

    if (passwordHash && typeof passwordHash === "string") {
      authenticated = await bcrypt.compare(password, passwordHash);
    } else if (userData.pinUsed === true) {
      // Security: PIN is permanently deactivated after migration.
      // Must not allow authentication via disabled PIN.
      authenticated = false;
    } else if (!passwordHash && (pinHash || pin)) {
      // Legacy unmigrated member: check if input matches legacy PIN
      let legacyPinMatch = false;
      if (pinHash && typeof pinHash === "string") {
        legacyPinMatch = await bcrypt.compare(password, pinHash);
      } else if (pin && typeof pin === "string") {
        legacyPinMatch = pin === password;
      }

      if (legacyPinMatch) {
        // Enforce Rule 3: Do NOT issue a normal session token.
        // Direct the user to the one-time migration flow to set a new password and disable PIN.
        return res.status(403).json({
          success: false,
          code: "PIN_MIGRATION_REQUIRED",
          error:
            "يتعين عليك ترحيل رمز PIN القديم وإنشاء كلمة مرور جديدة لحسابك لمتابعة الدخول.",
          legacyId: matchedUserDoc.id,
        });
      }
    }

    // 2. If not authenticated via local hash, check against Firebase Auth Identity Toolkit
    if (!authenticated) {
      const apiKey =
        process.env.VITE_FIREBASE_API_KEY || (firebaseConfig as any)?.apiKey;
      const targetEmail =
        userData.email || `${userData.username || matchedUid}@ensat.org`;

      if (apiKey && targetEmail) {
        try {
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: targetEmail,
                password,
                returnSecureToken: true,
              }),
            },
          );

          if (verifyRes.ok) {
            authenticated = true;
          }
        } catch {
          // Keep authenticated = false
        }
      }
    }

    if (!authenticated) {
      return res
        .status(401)
        .json({ success: false, error: "بيانات الدخول غير صحيحة" });
    }

    // 3. Issue minimal Custom Claims: Only role and token_version.
    // Sensitive actions re-verify live permissions and status directly from Firestore.
    const customToken = await auth.createCustomToken(matchedUid, {
      role: userData.role || "MEMBER",
      token_version: userData.tokenVersion || 1,
    });

    return res.json({
      success: true,
      customToken,
      uid: matchedUid,
      user: {
        uid: matchedUid,
        name: userData.name || userData.fullName || "عضو إنصات",
        email: userData.email || "",
        role: userData.role || "MEMBER",
      },
    });
  } catch (err: any) {
    console.error("[authRouter] login error:", err?.message || err);
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    return res
      .status(401)
      .json({ success: false, error: "بيانات الدخول غير صحيحة" });
  }
});

/**
 * Verified Firebase Phone Auth endpoint:
 * Accepts a real Firebase ID token obtained after client-side Phone Auth OTP verification.
 * Strictly verifies the token with Firebase Admin (checkRevoked=true) and checks server-side status.
 */
authRouter.post("/verify-phone-auth", loginLimiter, async (req, res) => {
  const rawIdToken = sanitizeInput(req.body?.idToken, 4096);
  if (!rawIdToken) {
    return res.status(401).json({ success: false, error: "رمز التحقق مفقود" });
  }

  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  if (!auth || !db) {
    return res
      .status(503)
      .json({ success: false, error: "خدمة المصادقة غير متاحة حالياً" });
  }

  try {
    const decoded = await auth.verifyIdToken(rawIdToken, true);
    const verifiedPhone = decoded.phone_number;
    if (!verifiedPhone) {
      return res.status(401).json({
        success: false,
        error: "لم يتم التحقق من رقم الهاتف عبر مزود الخدمة",
      });
    }

    const normPhone = normalizeToE164(verifiedPhone);
    let userSnap = await db
      .collection("users")
      .where("phoneNormalized", "==", normPhone)
      .limit(1)
      .get();
    if (userSnap.empty) {
      userSnap = await db
        .collection("users")
        .where("phone", "==", normPhone)
        .limit(1)
        .get();
    }

    if (userSnap.empty) {
      return res
        .status(404)
        .json({ success: false, error: "رقم الهاتف غير مسجل كعضو في الجمعية" });
    }

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();
    const status = userData.accountStatus || userData.status || "active";
    if (status === "disabled" || status === "suspended") {
      return res.status(403).json({
        success: false,
        error: "تم تعطيل هذا الحساب، يرجى التواصل مع الإدارة",
      });
    }

    return res.json({
      success: true,
      uid: userDoc.id,
      user: {
        uid: userDoc.id,
        name: userData.name || userData.fullName || "عضو إنصات",
        email: userData.email || "",
        role: userData.role || "MEMBER",
        phone: verifiedPhone,
      },
    });
  } catch (err: any) {
    return res
      .status(401)
      .json({ success: false, error: "فشل التحقق من رمز جلسة الهاتف" });
  }
});

/**
 * Single-device logout: Discards active session tokens locally on this device.
 * Does NOT revoke refresh tokens across other active devices.
 */
authRouter.post("/logout", (req, res) => {
  return res.json({
    success: true,
    message: "تم تسجيل الخروج من هذا الجهاز بنجاح",
  });
});

/**
 * Global logout (All devices):
 * - Calls Firebase Admin auth.revokeRefreshTokens(uid)
 * - Increments tokenVersion in Firestore so any existing ID tokens fail verification
 * - Logs to audit_logs
 */
authRouter.post("/logout-all", authenticateRequest, async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res
      .status(401)
      .json({ success: false, error: "غير مصرح: يجب تسجيل الدخول" });
  }

  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  if (!auth || !db) {
    return res
      .status(503)
      .json({ success: false, error: "خدمة المصادقة غير متاحة حالياً" });
  }

  try {
    await auth.revokeRefreshTokens(uid);

    const userRef = db.collection("users").doc(uid);
    let nextVersion = 2;
    await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (snap.exists) {
        nextVersion = (Number(snap.data()?.tokenVersion) || 1) + 1;
        t.update(userRef, {
          tokenVersion: nextVersion,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    await db.collection("audit_logs").add({
      action: "LOGOUT_ALL_DEVICES",
      uid,
      tokenVersion: nextVersion,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message:
        "تم تسجيل الخروج من جميع الأجهزة بنجاح وإلغاء جميع الجلسات السابقة",
      tokenVersion: nextVersion,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || "فشل تسجيل الخروج من جميع الأجهزة",
    });
  }
});

/**
 * One-time legacy PIN migration to secure password:
 * - Requires correct legacy PIN
 * - Enforces strong password policy
 * - Permanently disables PIN (sets pinUsed=true, pin=null, pinHash=null)
 * - Increments tokenVersion and revokes old tokens
 * - Never logs PIN or password
 */
authRouter.post("/migrate-pin", loginLimiter, async (req, res) => {
  const legacyId = sanitizeInput(req.body?.legacyId, 128);
  const oldPin = sanitizeInput(req.body?.oldPin, 32);
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const email = req.body?.email
    ? String(req.body.email).trim().toLowerCase()
    : "";
  const rawPhone = req.body?.phone ? String(req.body.phone).trim() : "";

  if (!legacyId || !oldPin || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "المعرف ورمز PIN القديم وكلمة المرور الجديدة مطلوبة",
    });
  }

  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ success: false, error: passwordCheck.error });
  }

  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();
  if (!db || !auth) {
    return res
      .status(503)
      .json({ success: false, error: "خدمة المصادقة غير متاحة حالياً" });
  }

  try {
    const userRef = db.collection("users").doc(legacyId);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res
        .status(404)
        .json({ success: false, error: "الحساب غير موجود" });
    }

    const userData = snap.data() || {};
    if (userData.pinUsed) {
      return res.status(403).json({
        success: false,
        error:
          "تم استخدام رمز PIN وترحيل هذا الحساب مسبقاً، يرجى تسجيل الدخول بكلمة المرور",
      });
    }

    let pinMatches = false;
    if (userData.pinHash && typeof userData.pinHash === "string") {
      pinMatches = await bcrypt.compare(oldPin, userData.pinHash);
    } else if (userData.pin) {
      pinMatches = userData.pin === oldPin;
    }

    if (!pinMatches) {
      return res
        .status(401)
        .json({ success: false, error: "رمز PIN القديم غير صحيح" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const nextVersion = (Number(userData.tokenVersion) || 1) + 1;

    // Update or Create Firebase Auth user
    try {
      await auth.updateUser(legacyId, { password: newPassword });
      await auth.revokeRefreshTokens(legacyId);
    } catch (authError: any) {
      if (authError.code === "auth/user-not-found") {
        const targetEmail =
          email ||
          userData.email ||
          `${userData.username || legacyId}@ensat.org`;
        await auth.createUser({
          uid: legacyId,
          email: targetEmail,
          password: newPassword,
          displayName: userData.name || userData.fullName || "عضو إنصات",
        });
      } else {
        throw authError; // rethrow other errors
      }
    }

    // Save passwordHash strictly in private_security subcollection (client-inaccessible)
    await userRef.collection("private_security").doc("credentials").set(
      {
        passwordHash,
        pin: FieldValue.delete(),
        pinHash: FieldValue.delete(),
        code: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    const updatesForFirestore: any = {
      hasPassword: true,
      pinUsed: true,
      passwordHash: FieldValue.delete(),
      pin: FieldValue.delete(),
      pinHash: FieldValue.delete(),
      salt: FieldValue.delete(),
      pinMigratedAt: new Date().toISOString(),
      migratedAt: new Date().toISOString(),
      legacyMigrated: true,
      migratedViaPin: true,
      migrationAuditStatus: "PENDING_AUDIT",
      tokenVersion: nextVersion,
      updatedAt: new Date().toISOString(),
    };
    if (email) {
      updatesForFirestore.email = email;
    }
    if (rawPhone) {
      const phoneNormalized = normalizeToE164(rawPhone);
      if (phoneNormalized) {
        updatesForFirestore.phone = phoneNormalized;
        updatesForFirestore.phoneNormalized = phoneNormalized;
      }
    }
    await userRef.set(updatesForFirestore, { merge: true });

    // Record into migration_audits
    await db
      .collection("migration_audits")
      .doc(legacyId)
      .set(
        {
          uid: legacyId,
          legacyId,
          name: userData.name || userData.fullName || "عضو إنصات",
          originalIdentifier:
            userData.identifier ||
            userData.rawIdentifier ||
            userData.phone ||
            userData.email ||
            legacyId,
          originalPhone: userData.phone || null,
          originalEmail: userData.email || null,
          newEmail: email || userData.email || null,
          newPhone: rawPhone || userData.phone || null,
          role: userData.role || "NARRATOR",
          role_display_ar: userData.role_display_ar || "راوي",
          migratedAt: new Date().toISOString(),
          auditStatus: "PENDING_AUDIT",
          auditedBy: null,
          auditedAt: null,
          auditNotes: "",
          verifiedVia: "PIN_MIGRATION",
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

    await db.collection("audit_logs").add({
      action: "PIN_MIGRATED_TO_PASSWORD",
      uid: legacyId,
      timestamp: new Date().toISOString(),
      auditStatus: "PENDING_AUDIT",
    });

    return res.json({
      success: true,
      message:
        "تم ترحيل الحساب بنجاح وإنشاء كلمة مرور قوية. يمكنك الآن تسجيل الدخول بها.",
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "فشل ترحيل الحساب" });
  }
});

// The browser receives only its own verified profile. A Firebase token by
// itself is never enough to create a membership or grant a role.
authRouter.get("/me", authenticateRequest, async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false });
  const sb = await getProfileByFirebaseUid(uid);
  let profile: any = sb?.profile;
  if (!profile) {
    const db = getFirebaseAdminFirestore();
    const snap = db ? await db.collection("users").doc(uid).get() : null;
    profile = snap?.exists ? snap.data() : null;
  }
  if (!profile)
    return res
      .status(403)
      .json({ success: false, code: "MEMBERSHIP_REQUIRED" });
  return res.json({
    success: true,
    user: {
      uid,
      id: uid,
      name:
        profile.full_name || profile.fullName || profile.name || "عضو إنصات",
      fullName:
        profile.full_name || profile.fullName || profile.name || "عضو إنصات",
      email: profile.email || req.user?.email || "",
      username: profile.username || "",
      phone: profile.phone || "",
      country: profile.country || profile.nationality || "",
      department: profile.department || "",
      canonicalRole: req.user?.canonicalRole,
      role: req.user?.canonicalRole,
      accountStatus: req.user?.status,
      platformAccess: req.user?.platformAccess || {},
      actionAccess: req.user?.actionAccess || {},
      publicProfileConsent:
        profile.publicProfileConsent === true ||
        profile.show_nationality_public === true,
      termsVersionAccepted:
        profile.termsVersionAccepted || profile.termsAcceptedVersion || "",
      termsAcceptedAt: profile.termsAcceptedAt || "",
      createdAt: profile.createdAt || profile.created_at || "",
    },
  });
});

// PATCH /api/auth/me - تحديث بيانات حسابي لكافة الأعضاء
authRouter.patch("/me", authenticateRequest, async (req, res) => {
  const {
    name,
    fullName,
    email,
    username,
    role,
    canonicalRole,
    phone,
    country,
    department,
    specialization,
    bio,
    newPassword,
  } = req.body;
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, error: "غير مصرح" });
  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();
  if (!db || !auth)
    return res.status(503).json({ success: false, error: "الخدمة غير متاحة" });

  try {
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    let passwordUpdated = false;
    let emailUpdated = false;

    // 1. Name update
    const cleanName = name || fullName;
    if (cleanName && typeof cleanName === "string" && cleanName.trim()) {
      updates.name = cleanName.trim();
      updates.fullName = cleanName.trim();
      updates.displayName = cleanName.trim();
    }

    // 2. Email update
    if (email && typeof email === "string" && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res
          .status(400)
          .json({ success: false, error: "صيغة البريد الإلكتروني غير صالحة" });
      }

      if (cleanEmail !== (req.user?.email || "").toLowerCase()) {
        // Check duplicate in Firebase Auth
        try {
          const existingAuthUser = await auth.getUserByEmail(cleanEmail);
          if (existingAuthUser && existingAuthUser.uid !== uid) {
            return res.status(400).json({
              success: false,
              error: "هذا البريد الإلكتروني مسجل بالفعل بحساب آخر",
            });
          }
        } catch (err: any) {
          if (err.code !== "auth/user-not-found") {
            console.warn(
              "[Auth] getUserByEmail check notice:",
              err?.message || err,
            );
          }
        }

        // Check duplicate in Firestore
        const existingEmailSnap = await db
          .collection("users")
          .where("normalizedEmail", "==", cleanEmail)
          .limit(2)
          .get();
        if (
          !existingEmailSnap.empty &&
          existingEmailSnap.docs.some((d: any) => d.id !== uid)
        ) {
          return res.status(400).json({
            success: false,
            error: "هذا البريد الإلكتروني مسجل بالفعل بحساب آخر",
          });
        }

        // Update in Firebase Auth
        await auth.updateUser(uid, { email: cleanEmail });
        updates.email = cleanEmail;
        updates.normalizedEmail = cleanEmail;
        emailUpdated = true;
      }
    }

    // 3. Username update
    if (username && typeof username === "string" && username.trim()) {
      const cleanUsername = username.trim().replace(/^@+/, "");
      if (cleanUsername.length < 2) {
        return res
          .status(400)
          .json({ success: false, error: "اسم المستخدم يجب ألا يقل عن حرفين" });
      }
      const normalizedUsername = cleanUsername.toLowerCase();
      // Check duplicate in Firestore
      const existingUserSnap = await db
        .collection("users")
        .where("normalizedUsername", "==", normalizedUsername)
        .limit(2)
        .get();
      if (
        !existingUserSnap.empty &&
        existingUserSnap.docs.some((d: any) => d.id !== uid)
      ) {
        return res.status(400).json({
          success: false,
          error: "اسم المستخدم هذا محجوز مسبقاً، يرجى اختيار اسم مستخدم آخر",
        });
      }

      updates.username = cleanUsername;
      updates.normalizedUsername = normalizedUsername;
      updates.displayUsername = `@${cleanUsername}`;
    }

    // Roles and access grants are never changed through the self-service profile route.
    if (role !== undefined || canonicalRole !== undefined) {
      return res.status(403).json({
        success: false,
        error: "تغيير الدور والصلاحيات يتم من لوحة الإدارة فقط.",
      });
    }

    // 5. Phone update
    if (phone !== undefined) {
      const rawPhone = typeof phone === "string" ? phone.trim() : "";
      if (rawPhone) {
        const phoneNormalized = normalizeToE164(rawPhone);
        if (phoneNormalized) {
          updates.phone = phoneNormalized;
          updates.phoneNormalized = phoneNormalized;
          updates.normalizedPhone = phoneNormalized;
        } else {
          updates.phone = rawPhone;
          updates.phoneNormalized = rawPhone;
          updates.normalizedPhone = rawPhone;
        }
      } else {
        updates.phone = "";
        updates.phoneNormalized = "";
        updates.normalizedPhone = "";
      }
    }

    // 6. Country & Department & Specialization & Bio
    if (country && typeof country === "string")
      updates.country = country.trim();
    if (department !== undefined && typeof department === "string") {
      updates.department = department.trim();
      updates.field = department.trim();
    }
    if (specialization !== undefined && typeof specialization === "string") {
      updates.specialization = specialization.trim();
    }
    if (bio !== undefined && typeof bio === "string") {
      updates.bio = bio.trim();
    }

    // 7. Password update
    if (newPassword && typeof newPassword === "string" && newPassword.trim()) {
      const passwordCheck = validatePasswordStrength(newPassword);
      if (!passwordCheck.valid) {
        return res
          .status(400)
          .json({ success: false, error: passwordCheck.error });
      }
      await auth.updateUser(uid, { password: newPassword });
      await auth.revokeRefreshTokens(uid);
      updates.hasPassword = true;
      passwordUpdated = true;
    }

    // Persist all updates to Firestore
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (passwordUpdated) {
      updates.passwordHash = FieldValue.delete();
      updates.pinHash = FieldValue.delete();
      updates.pin = FieldValue.delete();
      updates.salt = FieldValue.delete();
      updates.tokenVersion = (Number(snap.data()?.tokenVersion) || 1) + 1;
      await userRef.collection("private_security").doc("credentials").set(
        {
          passwordHash: FieldValue.delete(),
          pinHash: FieldValue.delete(),
          pin: FieldValue.delete(),
          code: FieldValue.delete(),
          resetCode: FieldValue.delete(),
          resetCodeHash: FieldValue.delete(),
          resetExpiresAt: FieldValue.delete(),
        },
        { merge: true },
      );
    }

    await userRef.set(updates, { merge: true });

    // Sync updates to Supabase profiles table if configured
    try {
      const supa = getSupabaseAdminClient();
      if (supa) {
        const supaUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.name || updates.fullName) {
          supaUpdates.full_name = updates.name || updates.fullName;
          supaUpdates.display_name = updates.name || updates.fullName;
        }
        if (updates.email) supaUpdates.email = updates.email;
        if (updates.username) supaUpdates.username = updates.username;
        if (updates.phone !== undefined) supaUpdates.phone = updates.phone;
        if (updates.country !== undefined)
          supaUpdates.country = updates.country;
        if (updates.department !== undefined)
          supaUpdates.department = updates.department;
        if (updates.bio !== undefined) supaUpdates.bio = updates.bio;
        if (updates.specialization !== undefined)
          supaUpdates.specialization = updates.specialization;

        await supa
          .from("profiles")
          .update(supaUpdates)
          .or(`firebase_uid.eq.${uid},id.eq.${uid}`);
      }
    } catch (supaErr: any) {
      console.warn(
        "[Auth] Supabase sync non-blocking notice:",
        supaErr?.message || supaErr,
      );
    }

    // Invalidate profile cache and user lookup cache
    invalidateProfileCache(uid);
    invalidateUserLookupCache();

    // Audit log
    await db
      .collection("audit_logs")
      .add({
        action: "USER_PROFILE_UPDATED",
        actorUid: uid,
        actorEmail: updates.email || req.user?.email || "",
        targetUid: uid,
        updatedFields: Object.keys(updates),
        timestamp: new Date().toISOString(),
      })
      .catch(() => {});

    let message = "تم حفظ التعديلات بنجاح";
    if (passwordUpdated && emailUpdated) {
      message = "تم تحديث البريد الإلكتروني وكلمة المرور والبيانات بنجاح.";
    } else if (passwordUpdated) {
      message =
        "تم تحديث البيانات وكلمة المرور بنجاح. سيتم تسجيل خروجك من الجلسات القديمة لحماية حسابك.";
    }

    return res.json({
      success: true,
      message,
      user: {
        uid,
        ...snap.data(),
        ...updates,
      },
    });
  } catch (err: any) {
    console.error("[Auth] /me update error:", err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || "تعذر تحديث البيانات" });
  }
});

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "****";
  const start = cleaned.slice(0, 4);
  const end = cleaned.slice(-3);
  return `${start} *** *** ${end}`;
}

/**
 * POST /api/auth/request-reset-code
 * Generates a 6-digit verification code for password reset and stores it temporarily (15 min).
 */
authRouter.post("/request-reset-code", loginLimiter, async (req, res) => {
  const rawIdentifier = sanitizeInput(req.body?.identifier, 128);
  if (!rawIdentifier) {
    return res.status(400).json({
      success: false,
      error: "يرجى إدخال البريد الإلكتروني أو اسم المستخدم أو رقم الهاتف",
    });
  }

  try {
    const db = getFirebaseAdminFirestore();
    const userDoc = db
      ? await findUserDocumentByIdentifier(db, rawIdentifier)
      : null;
    const userData = userDoc?.exists ? (userDoc.data() as any) : null;
    const email =
      userData?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)
        ? String(userData.email).trim().toLowerCase()
        : rawIdentifier.includes("@")
          ? rawIdentifier.trim().toLowerCase()
          : "";
    if (
      email &&
      !["disabled", "suspended"].includes(
        String(userData?.status || "").toLowerCase(),
      )
    ) {
      const apiKey =
        process.env.VITE_FIREBASE_API_KEY || (firebaseConfig as any)?.apiKey;
      if (!apiKey)
        return res
          .status(503)
          .json({ success: false, error: "إعدادات استعادة البريد غير متاحة" });
      // Firebase Authentication sends the reset link itself; no secret leaves this API.
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
        },
      );
      if (!response.ok && response.status >= 500)
        throw new Error("RESET_DELIVERY_UNAVAILABLE");
    }
    return res.json({
      success: true,
      deliveryMethod: "email_link",
      message:
        "إذا كان الحساب مرتبطاً ببريد إلكتروني، ستصلك رسالة استعادة عليه. الاستعادة بالرسائل النصية غير مفعّلة حالياً.",
    });
  } catch (err: any) {
    console.error("[Auth] request-reset-code error:", err);
    return res
      .status(500)
      .json({ success: false, error: "حدث خطأ أثناء إصدار كود التحقق" });
  }
});

/**
 * POST /api/auth/reset-password-with-code
 * Resets user password using the verification code (OTP) or the user's permanent PIN/code.
 */
authRouter.post("/reset-password-with-code", loginLimiter, async (req, res) => {
  // Legacy PINs and locally generated codes are not proof of possession of a
  // mailbox or phone. Migration has a separate one-time verified flow.
  return res.status(410).json({
    success: false,
    code: "RESET_LINK_REQUIRED",
    error: "استخدم رابط الاستعادة المرسل إلى البريد الإلكتروني.",
  });
  const rawIdentifier = sanitizeInput(req.body?.identifier, 128);
  const rawCode = sanitizeInput(req.body?.code, 32);
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!rawIdentifier || !rawCode) {
    return res
      .status(400)
      .json({ success: false, error: "يرجى إدخال معرف الحساب وكود التحقق" });
  }

  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ success: false, error: "يجب ألا تقل كلمة المرور عن 6 خانات" });
  }

  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();
  if (!db || !auth) {
    return res
      .status(503)
      .json({ success: false, error: "خدمة المصادقة غير متاحة حالياً" });
  }

  try {
    const userDoc = await findUserDocumentByIdentifier(db, rawIdentifier);
    if (!userDoc || !userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "لم يتم العثور على حساب مطابق للبيانات المدخلة",
      });
    }

    const uid = userDoc.id;
    const userData = userDoc.data() as any;

    if (userData.status === "disabled" || userData.status === "suspended") {
      return res.status(403).json({
        success: false,
        error: "هذا الحساب معلق. يرجى التواصل مع إدارة إنصات.",
      });
    }

    // Retrieve credentials from private_security
    let creds: any = {};
    try {
      const credDoc = await userDoc.ref
        .collection("private_security")
        .doc("credentials")
        .get();
      if (credDoc.exists) {
        creds = credDoc.data() || {};
      }
    } catch (e) {
      console.warn("[Auth] Unable to fetch private_security doc:", e);
    }

    // Verify the code against multiple valid sources:
    // 1. Temporary reset code
    let codeValid = false;
    const now = Date.now();

    if (
      creds.resetCode &&
      typeof creds.resetCode === "string" &&
      creds.resetCode === rawCode
    ) {
      const expTime = creds.resetExpiresAt
        ? new Date(creds.resetExpiresAt).getTime()
        : 0;
      if (!expTime || now <= expTime) {
        codeValid = true;
      }
    }

    if (
      !codeValid &&
      creds.resetCodeHash &&
      typeof creds.resetCodeHash === "string"
    ) {
      const expTime = creds.resetExpiresAt
        ? new Date(creds.resetExpiresAt).getTime()
        : 0;
      if (!expTime || now <= expTime) {
        const matches = await bcrypt.compare(rawCode, creds.resetCodeHash);
        if (matches) codeValid = true;
      }
    }

    // 2. Also allow the permanent PIN or activation code from invitation
    if (!codeValid) {
      const candidatePins = [
        creds.pin,
        creds.code,
        userData.pin,
        userData.code,
        userData.activationCode,
      ].filter(Boolean);

      if (candidatePins.includes(rawCode)) {
        codeValid = true;
      }
    }

    if (!codeValid && (creds.pinHash || userData.pinHash)) {
      const targetHash = creds.pinHash || userData.pinHash;
      if (
        typeof targetHash === "string" &&
        (await bcrypt.compare(rawCode, targetHash))
      ) {
        codeValid = true;
      }
    }

    if (!codeValid) {
      return res.status(401).json({
        success: false,
        error:
          "كود التحقق غير صحيح أو انتهت صلاحيته. يرجى طلب كود جديد أو التأكد من الرمز المدخل.",
      });
    }

    // Hash the new password with bcrypt
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update Firebase Auth user
    const userEmail =
      userData.email && userData.email.includes("@")
        ? userData.email.trim().toLowerCase()
        : `member_${uid}@ensat.org`;
    try {
      await auth.updateUser(uid, {
        password: newPassword,
      });
    } catch (authErr: any) {
      if (authErr.code === "auth/user-not-found") {
        await auth.createUser({
          uid,
          email: userEmail,
          password: newPassword,
          displayName: userData.name || userData.fullName || "عضو إنصات",
        });
      } else {
        console.warn("[Auth] updateUser warning:", authErr?.message || authErr);
      }
    }

    // Revoke any previous refresh tokens
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (e) {
      console.warn("[Auth] Failed to revoke refresh tokens:", e);
    }

    // Update credentials subcollection: clear reset code and set new passwordHash
    await userDoc.ref.collection("private_security").doc("credentials").set(
      {
        passwordHash: newPasswordHash,
        resetCode: null,
        resetCodeHash: null,
        resetExpiresAt: null,
        migratedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Update Firestore users/{uid} document
    const nextVersion = (Number(userData.tokenVersion) || 1) + 1;
    await userDoc.ref.update({
      hasPassword: true,
      status:
        userData.status === "pending_activation"
          ? "active"
          : userData.status || "active",
      tokenVersion: nextVersion,
      migratedAt: userData.migratedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPasswordResetAt: new Date().toISOString(),
      resetCode: FieldValue.delete(),
      resetCodeHash: FieldValue.delete(),
      resetExpiresAt: FieldValue.delete(),
    });

    // Invalidate caches
    invalidateProfileCache(uid);
    invalidateUserLookupCache();

    // Create custom token for immediate automatic login
    const customToken = await auth.createCustomToken(uid, {
      role: userData.canonicalRole || userData.role || "MEMBER",
      account_status: userData.status || "active",
    });

    // Audit log
    await db.collection("audit_logs").add({
      action: "PASSWORD_RESET_VIA_VERIFICATION_CODE",
      uid,
      rawIdentifier,
      tokenVersion: nextVersion,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: "تم تغيير كلمة المرور بنجاح. مرحباً بك مجدداً!",
      customToken,
      user: {
        uid,
        name: userData.name || userData.fullName || "عضو إنصات",
        email: userData.email || userEmail,
        role: userData.role || "MEMBER",
      },
    });
  } catch (err: any) {
    console.error("[Auth] reset-password-with-code error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "فشل إعادة تعيين كلمة المرور",
    });
  }
});

/**
 * Startup scrubber: Automatically moves any residual passwordHash, pin, pinHash, or salt
 * from the public /users/{uid} document into /users/{uid}/private_security/credentials,
 * permanently removing them from /users/{uid} via FieldValue.delete().
 */
export async function scrubLegacyCredentialsFromUsers(db: any) {
  if (!db) return;
  try {
    const snap = await db.collection("users").limit(300).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.passwordHash || data.pinHash || data.pin || data.salt) {
        // Save into private_security (client-forbidden)
        await doc.ref
          .collection("private_security")
          .doc("credentials")
          .set(
            {
              passwordHash: data.passwordHash || null,
              pinHash: data.pinHash || null,
              pin: data.pin || null,
              migratedAt: new Date().toISOString(),
            },
            { merge: true },
          );

        // Delete from main user doc
        await doc.ref.update({
          hasPassword: Boolean(data.passwordHash || data.hasPassword),
          passwordHash: FieldValue.delete(),
          pinHash: FieldValue.delete(),
          pin: FieldValue.delete(),
          salt: FieldValue.delete(),
        });
      }
    }
  } catch (err: any) {
    console.warn(
      "[Auth] Legacy credential scrubber completed or skipped:",
      err?.message || err,
    );
  }
}
