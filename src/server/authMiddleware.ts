import { Request, Response, NextFunction } from "express";
import {
  CanonicalRole,
  normalizeRole,
  isActionAllowed,
  SensitiveAction,
} from "../lib/rbacPolicy";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
} from "./firebaseAdmin";

export interface AuthenticatedUser {
  permissions?: string[];
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  fullName?: string;
  role?: string;
  canonicalRole: CanonicalRole | string;
  status: string;
  platformAccess?: Record<string, boolean>;
  actionAccess?: Record<string, "INHERIT" | "ALLOW" | "DENY">;
  can_manage_books?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function decodeAndValidateTokenStrict(
  rawToken: string,
): Promise<AuthenticatedUser | null> {
  if (!rawToken || typeof rawToken !== "string") return null;
  const token = rawToken.trim();

  try {
    const auth = getFirebaseAdminAuth();
    if (!auth) {
      console.warn("[Auth] Firebase Admin Auth is not initialized.");
      return null;
    }

    let decodedToken;
    try {
      // Check revoked tokens (e.g. after password reset or credential changes)
      decodedToken = await auth.verifyIdToken(token, true);
    } catch (verifyErr: any) {
      console.warn(
        "[Auth] verifyIdToken check failed:",
        verifyErr?.message || verifyErr,
      );
      return null;
    }

    // Check if account is explicitly disabled in Firebase Auth
    try {
      const userRecord = await auth.getUser(decodedToken.uid);
      if (userRecord && userRecord.disabled) {
        console.warn(
          `[Auth] User ${decodedToken.uid} is disabled in Firebase Auth.`,
        );
        return null;
      }
    } catch {
      return null;
    }

    // Firestore is the authoritative source for roles and permissions. A Supabase
    // profile may be readable/writable through legacy browser code and must not
    // be able to elevate a signed-in member's privileges.
    const db = getFirebaseAdminFirestore();
    if (!db) return null;
    const snapshot = await db.collection("users").doc(decodedToken.uid).get();
    if (!snapshot.exists) return null;
    const firestoreProfile: any = snapshot.data();

    let canonicalRole: CanonicalRole = "member";
    let status = "ACTIVE";
    let platformAccess: Record<string, boolean> = {};
    let actionAccess: Record<string, "INHERIT" | "ALLOW" | "DENY"> = {};

    const trusted = firestoreProfile;
    const isSuperAdminIdent =
      trusted.is_super_admin === true ||
      normalizeRole(
        trusted.role_id || trusted.canonicalRole || trusted.role,
      ) === "super_admin";

    if (isSuperAdminIdent) {
      canonicalRole = "SUPER_ADMIN" as any;
      status =
        firestoreProfile?.status || firestoreProfile?.accountStatus || "ACTIVE";
      platformAccess = {
        recording: true,
        tasks: true,
        rewards: true,
        admin: true,
        public: true,
        ...(firestoreProfile?.platformAccess || {}),
      };
      actionAccess = firestoreProfile?.actionAccess || {};
    } else {
      const norm = String(
        normalizeRole(
          firestoreProfile?.canonicalRole || firestoreProfile?.role,
        ),
      ).toUpperCase();
      canonicalRole = (norm === "SUPERADMIN" ? "SUPER_ADMIN" : norm) as any;
      status =
        firestoreProfile?.status || firestoreProfile?.accountStatus || "ACTIVE";
      platformAccess = firestoreProfile?.platformAccess || {};
      actionAccess = firestoreProfile?.actionAccess || {};
    }

    if (
      [
        "SUSPENDED",
        "DISABLED",
        "PENDING",
        "REVIEW",
        "PENDING_ACTIVATION",
      ].includes(status.toUpperCase())
    ) {
      console.warn(`[Auth] User ${decodedToken.uid} is suspended.`);
      return null;
    }

    const canManageBooks = Boolean(
      trusted.can_manage_books ||
      firestoreProfile?.actionAccess?.["manage_books"] === "ALLOW" ||
      firestoreProfile?.actionAccess?.["create_book"] === "ALLOW",
    );

    return {
      uid: decodedToken.uid,
      email: trusted.email || decodedToken.email || "",
      name: trusted.full_name || trusted.name || trusted.fullName || "",
      role: canonicalRole,
      canonicalRole,
      status,
      platformAccess,
      actionAccess,
      can_manage_books: canManageBooks,
    };
  } catch (error: any) {
    console.error(
      "[Auth] Unexpected token validation error:",
      error?.message || error,
    );
    return null;
  }
}

export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  let token: string | null = null;

  if (
    authHeader &&
    typeof authHeader === "string" &&
    authHeader.startsWith("Bearer ")
  ) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error:
        "غير مصرح: يجب تسجيل الدخول وإرسال رمز التحقق (Authorization Token).",
      code: "AUTH_TOKEN_MISSING",
    });
  }

  const decoded = await decodeAndValidateTokenStrict(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: "رمز التحقق غير صالح أو منتهي الصلاحية.",
      code: "AUTH_TOKEN_INVALID",
    });
  }

  if (
    [
      "pending",
      "pending_activation",
      "review",
      "disabled",
      "suspended",
    ].includes(decoded.status.toLowerCase())
  ) {
    return res.status(403).json({
      success: false,
      error: "حسابك معلق أو غير مفعل. الرجاء مراجعة الإدارة.",
      code: "ACCOUNT_DISABLED_OR_PENDING",
    });
  }

  req.user = decoded;

  return next();
}

export function requireRbacAction(action: SensitiveAction) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      authenticateRequest(req, res, () => {
        verifyActionPermission(req, res, next, action);
      }).catch(next);
      return;
    }
    verifyActionPermission(req, res, next, action);
  };
}

function verifyActionPermission(
  req: Request,
  res: Response,
  next: NextFunction,
  action: SensitiveAction,
) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "غير مصرح: لم يتم التعرف على هوية المستخدم.",
      code: "AUTH_REQUIRED",
    });
  }

  const allowed = isActionAllowed(user, action);

  if (!allowed) {
    return res.status(403).json({
      success: false,
      error: `ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء (${action}). الدور الحالي: ${user.canonicalRole}`,
      code: "FORBIDDEN_INSUFFICIENT_ROLE",
      action,
      currentRole: user.canonicalRole,
    });
  }

  return next();
}
