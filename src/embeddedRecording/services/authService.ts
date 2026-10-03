// @ts-nocheck
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";
import { normalizeUserPermissions } from "../lib/permissions";
import type { User } from "../types";

const legacyKeys = [
  "ansat_auth_registry_v1",
  "ansat_current_user",
  "ansat_user_session",
  "ENSAT_CURRENT_USER_ID",
  "user_role",
  "is_super_admin",
];

function clearLegacyIdentity(): void {
  if (typeof localStorage === "undefined") return;
  for (const key of legacyKeys) localStorage.removeItem(key);
}

async function profileFor(firebaseUser: FirebaseUser): Promise<User> {
  // First checking claims directly from the ID token (source of truth)
  const token = await firebaseUser.getIdTokenResult(true);
  const status = String(token.claims.account_status || "active");
  const role = String(
    token.claims.role || "MEMBER",
  ).toUpperCase() as User["role"];

  if (status === "disabled") throw new Error("ACCOUNT_DISABLED");
  if (status === "pending") throw new Error("ACCOUNT_PENDING");

  // Only pull display info from Firestore, no auth decisions
  let displayName = firebaseUser.displayName || "عضو إنصات";
  let department = "";
  let username = "";

  try {
    const snapshot = await getDoc(doc(db, "users", firebaseUser.uid));
    if (snapshot.exists()) {
      const profile = snapshot.data();
      if (profile.name) displayName = profile.name;
      if (profile.department) department = profile.department;
      if (profile.username) username = profile.username;
    }
  } catch (err) {
    console.error(
      "Could not fetch user profile metadata, continuing with auth claims",
      err,
    );
  }

  return normalizeUserPermissions({
    id: firebaseUser.uid,
    name: displayName,
    username,
    email: firebaseUser.email || "",
    pin: "", // deprecated
    role,
    role_display_ar:
      role === "SUPER_ADMIN"
        ? "المدير الرئيسي والمسؤول التقني"
        : role === "ADMIN"
          ? "مدير"
          : role === "AUDIO_ENGINEER"
            ? "مهندس صوت"
            : role === "QA_REVIEWER"
              ? "مراجع جودة"
              : role === "NARRATOR"
                ? "راوي"
                : "عضو",
    is_super_admin: false, // Ignored logic now
    can_access_studio: false, // Re-evaluated dynamically
    can_upload_raw: false,
    can_qa_review: false,
    can_master_audio: false,
    is_active: status === "active",
    workflowStatus: status as any,
    department,
  });
}

export const authService = {
  async initialize(): Promise<void> {
    clearLegacyIdentity();
    await setPersistence(auth, browserLocalPersistence);
  },

  async login(email: string, password: string): Promise<User> {
    clearLegacyIdentity();
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password,
    );
    try {
      return await profileFor(credential.user);
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  },

  observe(callback: (user: User | null, error?: string) => void): () => void {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return callback(null);
      try {
        callback(await profileFor(firebaseUser));
      } catch (error) {
        await signOut(auth);
        callback(null, error instanceof Error ? error.message : "AUTH_FAILED");
      }
    });
  },

  async token(forceRefresh = false): Promise<string> {
    if (!auth.currentUser) throw new Error("AUTH_REQUIRED");
    return auth.currentUser.getIdToken(forceRefresh);
  },

  async logout(): Promise<void> {
    clearLegacyIdentity();
    await signOut(auth);
  },

  // Deprecated / stubs to satisfy existing code
  getPreWarmedUsers(): User[] {
    return [];
  },
  getSavedSession(): User | null {
    return null;
  },
  async preWarmRegistry(): Promise<User[]> {
    return [];
  },
  clearLegacyIdentity,
};
