import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../lib/firebaseClient";
import type { User } from "../types";
import { normalizeRole } from "../lib/rbacPolicy";

const legacyKeys = [
  "ansat_auth_registry_v1",
  "ansat_current_user",
  "ansat_user_session",
  "ENSAT_CURRENT_USER_ID",
  "user_role",
  "is_super_admin",
];

let persistencePromise: Promise<void> | null = null;

function clearLegacyIdentity(): void {
  if (typeof localStorage === "undefined") return;
  for (const key of legacyKeys) localStorage.removeItem(key);
}

async function profileFor(firebaseUser: FirebaseUser): Promise<User> {
  const token = await firebaseUser.getIdToken();
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("MEMBERSHIP_OR_SESSION_UNAVAILABLE");
  const payload = await response.json();
  if (!payload?.success || !payload.user)
    throw new Error("MEMBERSHIP_REQUIRED");
  const profile = payload.user;
  const accountStatus = profile.accountStatus || "active";

  if (accountStatus === "disabled" || accountStatus === "suspended") {
    throw new Error(`ACCOUNT_${accountStatus.toUpperCase()}`);
  }

  const role = normalizeRole(profile.canonicalRole || profile.role);

  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    fullName: profile.fullName || profile.name || "عضو إنصات",
    username: profile.username || "",
    normalizedUsername: (profile.username || "").trim().toLowerCase(),
    email: profile.email || firebaseUser.email || "",
    normalizedEmail: (profile.email || firebaseUser.email || "")
      .trim()
      .toLowerCase(),
    phone: profile.phone || "",
    normalizedPhone: profile.normalizedPhone || "",
    country: profile.country || "",
    age: profile.age,
    birthDate: profile.birthDate,
    field: profile.field || profile.specialization || "",
    accountStatus: accountStatus as any,
    canonicalRole: role,
    platformAccess: profile.platformAccess || {},
    actionAccess: profile.actionAccess || {},
    permissions: profile.permissions || profile.custom_permissions || {},
    custom_permissions: profile.custom_permissions || profile.permissions || {},
    department: profile.department || "",
    publicProfileConsent: profile.publicProfileConsent === true,
    termsVersionAccepted:
      profile.termsVersionAccepted || profile.termsAcceptedVersion || "",
    termsAcceptedAt: profile.termsAcceptedAt || "",
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || "",
    lastLoginAt: new Date().toISOString(),

    // Legacy mapping just in case components still read them
    name: profile.fullName || profile.name || "عضو إنصات",
    role: role,
    is_super_admin: role === "super_admin",
    role_display_ar:
      role === "super_admin"
        ? "إدارة عليا"
        : role === "admin"
          ? "مدير"
          : role === "audio_engineer"
            ? "مهندس صوت"
            : role === "reviewer"
              ? "مراجع جودة"
              : "راوي / معلق",
  };
}

export const authService = {
  initialize: (): Promise<void> => {
    if (!persistencePromise) {
      persistencePromise = setPersistence(auth, browserLocalPersistence);
    }
    return persistencePromise;
  },

  observe: (
    callback: (user: User | null, error?: string) => void,
  ): (() => void) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearLegacyIdentity();
        callback(null);
        return;
      }
      try {
        const u = await profileFor(firebaseUser);
        callback(u);
      } catch (err: any) {
        clearLegacyIdentity();
        if (err.message.startsWith("ACCOUNT_")) {
          callback(null, err.message);
        } else {
          callback(null, "SESSION_INITIALIZATION_FAILED");
        }
      }
    });
  },

  getProfile: async (firebaseUser: FirebaseUser): Promise<User> => {
    return profileFor(firebaseUser);
  },

  migratePin: async (
    legacyId: string,
    oldPin: string,
    newPassword: string,
    email?: string,
    phone?: string,
  ): Promise<void> => {
    const res = await fetch("/api/auth/migrate-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legacyId, oldPin, newPassword, email, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل ترحيل الحساب");
    }
  },

  // Multi-method login: securely delegates to /api/auth/login to prevent Account Enumeration and map phone/username/email to central UID
  loginWithIdentifier: async (
    identifier: string,
    passwordOrPin: string,
  ): Promise<User> => {
    await authService.initialize();
    const cleanId = identifier.trim();

    try {
      // 1. Call secure server endpoint which handles rate-limiting, timing mitigation, and central UID mapping
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanId, password: passwordOrPin }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.customToken) {
        // Authenticate with Firebase Auth using the server-minted Custom Token
        const credential = await signInWithCustomToken(auth, data.customToken);
        clearLegacyIdentity();
        return profileFor(credential.user);
      }

      if (res.status === 403) {
        if (data && data.code === "PIN_MIGRATION_REQUIRED") {
          const err = new Error("PIN_MIGRATION_REQUIRED");
          (err as any).legacyId = data.legacyId;
          throw err;
        }
        throw new Error("ACCOUNT_DISABLED");
      }
      if (res.status === 429) {
        throw new Error("RATE_LIMITED");
      }
    } catch (err: any) {
      if (
        err.message === "ACCOUNT_DISABLED" ||
        err.message === "RATE_LIMITED"
      ) {
        throw err;
      }
      // Fallback: If identifier is an email and /api/auth/login was unreachable, try direct signIn
      if (cleanId.includes("@")) {
        try {
          const credential = await signInWithEmailAndPassword(
            auth,
            cleanId.toLowerCase(),
            passwordOrPin,
          );
          clearLegacyIdentity();
          return profileFor(credential.user);
        } catch {
          throw new Error("INVALID_CREDENTIALS");
        }
      }
    }

    throw new Error("INVALID_CREDENTIALS");
  },

  requestResetCode: async (
    identifier: string,
  ): Promise<{
    success: boolean;
    message: string;
    maskedContact?: string;
    code?: string;
    expiresInMinutes?: number;
  }> => {
    const res = await fetch("/api/auth/request-reset-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(
        data.error || "تعذر إرسال كود التحقق. يرجى التأكد من البيانات المدخلة.",
      );
    }
    return data;
  },

  resetPasswordWithCode: async (
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<User> => {
    await authService.initialize();
    const res = await fetch("/api/auth/reset-password-with-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: identifier.trim(),
        code: code.trim(),
        newPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || "فشل إعادة تعيين كلمة المرور.");
    }
    if (data.customToken) {
      const credential = await signInWithCustomToken(auth, data.customToken);
      clearLegacyIdentity();
      return profileFor(credential.user);
    }
    throw new Error(
      "لم يتم استلام جلسة تسجيل الدخول، يرجى تسجيل الدخول يدوياً.",
    );
  },

  token: async (): Promise<string> => {
    const user = auth.currentUser;
    return user ? user.getIdToken() : "";
  },

  getSavedSession: (): User | null => {
    try {
      const data = localStorage.getItem("ansat_current_user");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  getPreWarmedUsers: (): User[] => [],

  preWarmRegistry: async (): Promise<User[]> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return [];
    try {
      const response = await fetch("/api/tasks/members", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload.members) ? (payload.members as User[]) : [];
    } catch {
      return [];
    }
  },

  logout: async (): Promise<void> => {
    clearLegacyIdentity();
    await signOut(auth);
  },
};
