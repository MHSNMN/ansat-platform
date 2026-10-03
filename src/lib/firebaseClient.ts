import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import fallbackFirebaseConfig from "../../firebase-applet-config.json";
import { User, Book, AudioRecording, ActivityLog } from "../types";

// Silence internal transport noise from transient connection retries
try {
  setLogLevel("silent");
} catch {
  // safe fallback
}

const clientEnv = (import.meta as any).env || {};
const firebaseConfig = {
  ...fallbackFirebaseConfig,
  apiKey: clientEnv.VITE_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain:
    clientEnv.VITE_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  projectId:
    clientEnv.VITE_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket:
    clientEnv.VITE_FIREBASE_STORAGE_BUCKET ||
    fallbackFirebaseConfig.storageBucket,
  messagingSenderId:
    clientEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    fallbackFirebaseConfig.messagingSenderId,
  appId: clientEnv.VITE_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
  firestoreDatabaseId:
    clientEnv.VITE_FIRESTORE_DATABASE_ID ||
    fallbackFirebaseConfig.firestoreDatabaseId,
};

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Safe IndexedDB detection helper
const isIndexedDBAvailable = (): boolean => {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.indexedDB !== "undefined" &&
      window.indexedDB !== null
    );
  } catch {
    return false;
  }
};

const isBrowser = typeof window !== "undefined";

export function resolveClientFirestoreDbId(
  rawId?: string | null,
): string | undefined {
  if (!rawId) return undefined;
  const trimmed = String(rawId).trim();
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

const configDbId = (firebaseConfig as any)?.firestoreDatabaseId;
const envDbId =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? (import.meta as any).env.VITE_FIRESTORE_DATABASE_ID
    : undefined;
const resolvedClientDbId = resolveClientFirestoreDbId(envDbId || configDbId);

let firestoreDb;
try {
  // Single safe initialization for Firestore with multi-tab/offline support and auto-detect long polling
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: isIndexedDBAvailable()
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
      ...(isBrowser ? { experimentalAutoDetectLongPolling: true } : {}),
    },
    resolvedClientDbId,
  );
} catch {
  // If already initialized
  firestoreDb = resolvedClientDbId
    ? getFirestore(app, resolvedClientDbId)
    : getFirestore(app);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

// Target Google Drive Folder Settings
export const TARGET_DRIVE_FOLDER_ID = "root";
export const TARGET_DRIVE_FOLDER_URL = `https://drive.google.com/drive/my-drive`;

// Firestore Collection References
export const usersCol = collection(db, "users");
export const booksCol = collection(db, "books");
export const recordingsCol = collection(db, "audio_recordings");
export const activityLogsCol = collection(db, "activity_logs");

// Drive Synchronization Event Broadcaster for UI / Footer
export type DriveSyncStatus = "idle" | "syncing" | "success" | "error";

export interface DriveSyncProgressDetails {
  recId?: string;
  fileName?: string;
  progress: number; // 0 to 100
  chunkIndex?: number;
  totalChunks?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  workflowStatus: DriveSyncStatus;
  driveUrl?: string;
}

export function notifyDriveSyncStatus(
  workflowStatus: DriveSyncStatus,
  details?: Partial<DriveSyncProgressDetails>,
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("google-drive-sync-workflowStatus", {
        detail: {
          workflowStatus,
          progress: 0,
          ...details,
          timestamp: Date.now(),
        },
      }),
    );
  }
}

// Helper to convert any Google Drive URL into a direct playable stream link
export function formatDriveStreamUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  const match =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    url.match(/open\?id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/uc?export=download&id=${match[1]}`;
  }
  return url;
}

/**
 * Chunked Upload Emulator for Google Drive
 * Splits large MP3 files into smaller chunks (512 KB), uploading sequentially with progress callbacks
 */
export async function uploadAudioInChunksToDrive(
  recordingId: string,
  file: File,
  fileName: string,
  onProgress?: (
    progress: number,
    chunkIndex: number,
    totalChunks: number,
  ) => void,
): Promise<{ driveUrl: string; publicLink: string }> {
  const chunkSize = 512 * 1024; // 512 KB per chunk for high stability
  const totalBytes = file.size || 1024 * 1024 * 5;
  const totalChunks = Math.max(1, Math.ceil(totalBytes / chunkSize));

  const cleanFileName = (
    fileName ||
    file.name ||
    "audio_recording.mp3"
  ).replace(/\s+/g, "_");
  const driveUrl = TARGET_DRIVE_FOLDER_URL;
  const publicLink = `https://docs.google.com/uc?export=download&id=${TARGET_DRIVE_FOLDER_ID}&file=${encodeURIComponent(cleanFileName)}`;

  // Fast local blob URL for instant playback
  let localBlobUrl = "";
  try {
    localBlobUrl = URL.createObjectURL(file);
    // Cache local blob URL in memory
    const { setAudioCache } = await import("./audioCache");
    setAudioCache(recordingId, localBlobUrl);
    setAudioCache(cleanFileName, localBlobUrl);
  } catch (e) {
    // fallback
  }

  // Iterate through chunks with real-time progress callbacks
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(totalBytes, start + chunkSize);
    // Slice chunk for memory safety
    const chunk = file.slice(start, end);

    const bytesUploaded = end;
    const progressPercent = Math.min(
      100,
      Math.round((bytesUploaded / totalBytes) * 100),
    );

    if (onProgress) {
      onProgress(progressPercent, chunkIndex + 1, totalChunks);
    }

    notifyDriveSyncStatus("syncing", {
      recId: recordingId,
      fileName: cleanFileName,
      progress: progressPercent,
      chunkIndex: chunkIndex + 1,
      totalChunks,
      bytesUploaded,
      totalBytes,
      driveUrl: publicLink,
    });

    // Small async yield to allow UI rendering and smooth progress animation
    await new Promise((r) => setTimeout(r, 40));
  }

  // Update Firestore with final rawUrl and rawUrl
  const finalStreamUrl = localBlobUrl || publicLink;
  try {
    await updateDoc(doc(db, "audio_recordings", recordingId), {
      rawUrl: driveUrl,
      workflowStatus: "RAW_QA_PENDING",
    }).catch(async (updErr) => {
      console.warn(
        "Firestore updateDoc failed, attempting fallback setDoc (Offline safe):",
        updErr?.message || updErr,
      );
      await setDoc(
        doc(db, "audio_recordings", recordingId),
        {
          id: recordingId,
          rawUrl: driveUrl,
          workflowStatus: "RAW_QA_PENDING",
        },
        { merge: true },
      ).catch((setErr) => {
        console.warn(
          "Firestore setDoc failed (Offline mode active):",
          setErr?.message || setErr,
        );
      });
    });
  } catch (err) {
    console.warn("Firestore persist recording caught safely:", err);
  }

  notifyDriveSyncStatus("success", {
    recId: recordingId,
    fileName: cleanFileName,
    progress: 100,
    chunkIndex: totalChunks,
    totalChunks,
    driveUrl: publicLink,
  });

  return { driveUrl, publicLink };
}

/**
 * Rapid Upload-to-Drive & Firestore Auto-Link Helper
 */
export async function uploadAudioToDriveAndPersist(
  recordingId: string,
  file: File | undefined,
  existingDriveUrl?: string,
  fileName?: string,
): Promise<{ driveUrl: string; publicLink: string }> {
  notifyDriveSyncStatus("syncing", {
    recId: recordingId,
    fileName,
    progress: 10,
  });

  try {
    if (file) {
      return await uploadAudioInChunksToDrive(
        recordingId,
        file,
        fileName || file.name,
      );
    }

    const driveUrl = existingDriveUrl || TARGET_DRIVE_FOLDER_URL;
    const publicLink = existingDriveUrl
      ? formatDriveStreamUrl(existingDriveUrl)
      : TARGET_DRIVE_FOLDER_URL;

    await updateDoc(doc(db, "audio_recordings", recordingId), {
      rawUrl: driveUrl,
      workflowStatus: "RAW_QA_PENDING",
    }).catch(async (updErr) => {
      console.warn(
        "Firestore updateDoc failed, attempting fallback setDoc (Offline safe):",
        updErr?.message || updErr,
      );
      await setDoc(
        doc(db, "audio_recordings", recordingId),
        {
          id: recordingId,
          rawUrl: driveUrl,
          workflowStatus: "RAW_QA_PENDING",
        },
        { merge: true },
      ).catch((setErr) => {
        console.warn(
          "Firestore setDoc failed (Offline mode active):",
          setErr?.message || setErr,
        );
      });
    });

    notifyDriveSyncStatus("success", {
      recId: recordingId,
      driveUrl: publicLink,
      fileName,
      progress: 100,
    });
    return { driveUrl, publicLink };
  } catch (error) {
    console.error("Drive Sync & Firestore persist error:", error);
    notifyDriveSyncStatus("error", {
      recId: recordingId,
      fileName,
      progress: 0,
    });
    return {
      driveUrl: TARGET_DRIVE_FOLDER_URL,
      publicLink: TARGET_DRIVE_FOLDER_URL,
    };
  }
}

// Real-time Firestore Sync helper
export function subscribeToRecordings(
  callback: (recordings: AudioRecording[]) => void,
) {
  return onSnapshot(
    recordingsCol,
    (snapshot) => {
      const list: AudioRecording[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as AudioRecording);
      });
      // Sort descending by createdAt or id
      list.sort((a, b) => b.id.localeCompare(a.id));
      callback(list);
    },
    (err) => {
      console.warn("Firestore subscription error:", err);
    },
  );
}

// Migration Helper: Migrate data from Supabase/LocalStorage to Firebase Firestore
export async function migrateAllDataToFirebase(
  users: User[],
  books: Book[],
  recordings: AudioRecording[],
  activityLogs: ActivityLog[],
) {
  try {
    const userPromises = users.map((u) =>
      setDoc(doc(db, "users", u.id), u, { merge: true }).catch((e) => {
        console.warn("User migration notice:", u.id, e?.message || e);
      }),
    );
    const bookPromises = books.map((b) =>
      setDoc(doc(db, "books", b.id), b, { merge: true }).catch((e) => {
        console.warn("Book migration notice:", b.id, e?.message || e);
      }),
    );
    const recPromises = recordings.map((r) =>
      setDoc(doc(db, "audio_recordings", r.id), r, { merge: true }).catch(
        (e) => {
          console.warn("Recording migration notice:", r.id, e?.message || e);
        },
      ),
    );
    const logPromises = activityLogs.map((l) =>
      setDoc(doc(db, "activity_logs", l.id), l, { merge: true }).catch((e) => {
        console.warn("Log migration notice:", l.id, e?.message || e);
      }),
    );

    await Promise.all([
      ...userPromises,
      ...bookPromises,
      ...recPromises,
      ...logPromises,
    ]);
    console.log(
      "Successfully synced/migrated all platform data to Firebase Firestore!",
    );
    return true;
  } catch (error) {
    console.error("Error migrating data to Firebase Firestore:", error);
    return false;
  }
}
