import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTaskSnapshot,
} from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { storage, db } from "../lib/firebaseClient";
import { AudioAsset, UploadJob } from "../types";
import { openDB } from "idb";

// IndexedDB for frontend upload jobs
const DB_NAME = "EnsatUploadQueue";
const DB_VERSION = 1;

export async function initUploadDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("upload_jobs")) {
        db.createObjectStore("upload_jobs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "id" }); // to store actual File blobs
      }
    },
  });
}

export interface UploadProgressCallback {
  (
    progress: number,
    workflowStatus: "uploading" | "paused" | "failed" | "success",
    error?: string,
  ): void;
}

export const storageService = {
  async startResumableUpload(
    file: File,
    bookId: string,
    recordingId: string,
    variant: "raw" | "mastered" | "published" | "pdf",
    version: number,
    ownerUid: string,
    onProgress?: UploadProgressCallback,
    abortSignal?: AbortSignal,
  ) {
    // 1. Validation
    const MAX_SIZE = 500 * 1024 * 1024; // 500 MB limit
    if (file.size > MAX_SIZE) {
      throw new Error(
        `حجم الملف يتجاوز الحد المسموح (500MB). حجم الملف الحالي: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const allowedExtensions = ["mp3", "wav", "m4a", "aac", "pdf"];
    if (!allowedExtensions.includes(ext)) {
      throw new Error(
        `صيغة الملف غير مدعومة: ${ext}. يرجى رفع ملف بصيغة مدعومة.`,
      );
    }

    // Fixed path structure
    const storagePath = `audio/${bookId}/${recordingId}/${variant}/v${version}.${ext}`;
    const assetId = `${recordingId}-${variant}-v${version}`;
    const jobId = `job-${assetId}`;

    const storageRef = ref(storage, storagePath);

    // Metadata
    const metadata = {
      contentType: file.type || "audio/mpeg",
      customMetadata: {
        bookId,
        recordingId,
        variant,
        ownerUid,
      },
    };

    // 2. Create UploadJob in Firestore
    const jobDoc: UploadJob = {
      id: jobId,
      assetId,
      ownerUid,
      bytesTotal: file.size,
      bytesUploaded: 0,
      workflowStatus: "uploading",
      attempts: 1,
    };
    await setDoc(doc(db, "upload_jobs", jobId), jobDoc);

    // 2. Create Asset in Firestore
    const assetDoc: AudioAsset = {
      id: assetId,
      bookId,
      recordingId,
      variant,
      provider: "firebase",
      storagePath,
      contentType: metadata.contentType,
      sizeBytes: file.size,
      workflowStatus: "UPLOADING",
      createdBy: ownerUid,
      createdAt: new Date().toISOString(),
      driveMirror: {
        workflowStatus: "PENDING",
        attempts: 0,
      },
    };
    await setDoc(doc(db, "audio_assets", assetId), assetDoc);

    // 3. Save to IDB for offline resumption
    try {
      const idb = await initUploadDB();
      await idb.put("upload_jobs", jobDoc);
      await idb.put("files", { id: jobId, file });
    } catch (e) {
      console.warn("Failed to cache file in IDB", e);
    }

    // 4. Start Upload
    return new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
          uploadTask.pause();
          reject(new Error("Upload aborted"));
        });
      }

      uploadTask.on(
        "state_changed",
        (snapshot: UploadTaskSnapshot) => {
          const progress = Math.min(
            99,
            Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          );
          const state = snapshot.state === "paused" ? "paused" : "uploading";
          if (onProgress) onProgress(progress, state);

          // Debounced update to IDB/Firestore could go here
        },
        (error) => {
          console.error("Firebase upload error:", error);
          if (onProgress) onProgress(0, "failed", error.message);

          setDoc(
            doc(db, "upload_jobs", jobId),
            { workflowStatus: "error", error: error.message },
            { merge: true },
          ).catch(() => {});
          setDoc(
            doc(db, "audio_assets", assetId),
            { workflowStatus: "FAILED" },
            { merge: true },
          ).catch(() => {});

          reject(error);
        },
        async () => {
          // Success
          if (onProgress) onProgress(100, "success");

          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Update Asset (safe create/merge)
          await setDoc(
            doc(db, "audio_assets", assetId),
            {
              id: assetId,
              workflowStatus: "READY",
            },
            { merge: true },
          ).catch((e) => console.warn("audio_assets persist fallback:", e));

          // Update Job (safe create/merge)
          await setDoc(
            doc(db, "upload_jobs", jobId),
            {
              id: jobId,
              workflowStatus: "success",
              bytesUploaded: file.size,
            },
            { merge: true },
          ).catch((e) => console.warn("upload_jobs persist fallback:", e));

          // Delete from IDB cache
          try {
            const idb = await initUploadDB();
            await idb.delete("upload_jobs", jobId);
            await idb.delete("files", jobId);
          } catch (e) {
            console.warn("تعذر تنظيف ملف الرفع المؤقت محلياً", e);
          }

          resolve(downloadURL);
        },
      );
    });
  },
};
