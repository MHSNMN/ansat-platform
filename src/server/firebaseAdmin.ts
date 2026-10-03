import {
  initializeApp,
  cert,
  getApps,
  applicationDefault,
  App,
} from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";
import firebaseConfig from "../../firebase-applet-config.json";

let isWarned = false;

export function initializeFirebaseAdmin(): App | null {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    (firebaseConfig as any).projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Remove surrounding quotes if they exist, then replace escaped newlines
    privateKey = privateKey.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    (firebaseConfig as any)?.storageBucket ||
    (projectId ? `${projectId}.appspot.com` : undefined);

  if (projectId && clientEmail && privateKey) {
    try {
      const app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        ...(storageBucket && { storageBucket }),
      });
      console.log(
        "[Firebase Admin] Initialized with explicit service account credentials.",
      );
      return app;
    } catch (error: any) {
      if (error?.code !== "app/duplicate-app") {
        console.error(
          "[Firebase Admin] Error initializing with explicit credentials:",
          error,
        );
      } else {
        return getApps()[0];
      }
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const app = initializeApp({
        credential: applicationDefault(),
        ...(storageBucket && { storageBucket }),
      });
      console.log(
        "[Firebase Admin] Initialized with GOOGLE_APPLICATION_CREDENTIALS.",
      );
      return app;
    } catch (error: any) {
      if (error?.code !== "app/duplicate-app") {
        console.error(
          "[Firebase Admin] Error initializing with GOOGLE_APPLICATION_CREDENTIALS:",
          error,
        );
      } else {
        return getApps()[0];
      }
    }
  } else {
    if (!isWarned) {
      console.warn(
        "[Firebase Admin] Warning: No service account credentials found. Auth and DB will fail.",
      );
      isWarned = true;
    }
  }

  return null;
}

export function getFirebaseAdminAuth(): Auth | null {
  const app = initializeFirebaseAdmin();
  if (app) {
    try {
      return getAuth(app);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function resolveFirestoreDatabaseId(
  rawDbId?: string | null,
): string | undefined {
  if (!rawDbId) return undefined;
  const trimmed = String(rawDbId).trim();
  if (
    !trimmed ||
    trimmed === "default" ||
    trimmed === "(default)" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null"
  ) {
    return undefined;
  }
  return trimmed;
}

export function getResolvedFirestoreConfig(): {
  projectId: string;
  databaseMode: "default" | "named";
  databaseId?: string;
} {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    (firebaseConfig as any)?.projectId ||
    "unknown";
  const configDbId = (firebaseConfig as any)?.firestoreDatabaseId;
  const rawDbId = process.env.FIREBASE_DATABASE_ID || configDbId;
  const resolvedDbId = resolveFirestoreDatabaseId(rawDbId);
  return {
    projectId,
    databaseMode: resolvedDbId ? "named" : "default",
    ...(resolvedDbId && { databaseId: resolvedDbId }),
  };
}

let firestoreInstance: Firestore | null = null;

export function getFirebaseAdminFirestore(): Firestore | null {
  if (firestoreInstance) {
    return firestoreInstance;
  }
  const app = initializeFirebaseAdmin();
  if (app) {
    try {
      const configDbId = (firebaseConfig as any)?.firestoreDatabaseId;
      const rawDbId = process.env.FIREBASE_DATABASE_ID || configDbId;
      const resolvedDbId = resolveFirestoreDatabaseId(rawDbId);

      const db = resolvedDbId
        ? getFirestore(app, resolvedDbId)
        : getFirestore(app);

      try {
        db.settings({ ignoreUndefinedProperties: true });
      } catch {
        // settings may already have been set
      }

      firestoreInstance = db;
      return firestoreInstance;
    } catch (e: any) {
      console.warn(
        "[Firebase Admin] Error instantiating Firestore:",
        e?.message || e,
      );
      return null;
    }
  }
  return null;
}

export interface FirestoreHealthStatus {
  isAvailable: boolean;
  projectId: string;
  databaseMode: "default" | "named";
  databaseId?: string;
  errorMessage?: string;
  isNotFound?: boolean;
}

let healthCache: FirestoreHealthStatus | null = null;

export async function checkFirestoreHealth(
  force = false,
): Promise<FirestoreHealthStatus> {
  if (healthCache && !force) {
    return healthCache;
  }

  const { projectId, databaseMode, databaseId } = getResolvedFirestoreConfig();
  const db = getFirebaseAdminFirestore();

  if (!db) {
    healthCache = {
      isAvailable: false,
      projectId,
      databaseMode,
      databaseId,
      errorMessage: "Firebase Admin App credentials are missing or invalid",
    };
    return healthCache;
  }

  try {
    // Perform a lightweight probe query
    await db.collection("users").limit(1).get();
    healthCache = {
      isAvailable: true,
      projectId,
      databaseMode,
      databaseId,
    };
    return healthCache;
  } catch (error: any) {
    const isNotFound =
      error?.code === 5 || String(error?.message || "").includes("5 NOT_FOUND");
    const errorMessage = isNotFound
      ? "Firestore database is not provisioned or the configured database ID does not exist. / قاعدة بيانات Firestore غير متوفرة أو معرف قاعدة البيانات المعين غير موجود."
      : error?.message || "Failed to connect to Firestore";

    healthCache = {
      isAvailable: false,
      projectId,
      databaseMode,
      databaseId,
      errorMessage,
      isNotFound,
    };
    return healthCache;
  }
}

export function getFirebaseAdminStorage(): Storage | null {
  const app = initializeFirebaseAdmin();
  if (app) {
    try {
      return getStorage(app);
    } catch (e) {
      return null;
    }
  }
  return null;
}
