// @ts-nocheck
import {
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage,
} from "../../server/firebaseAdmin";
import {
  driveService,
  STAGE_FOLDERS,
  TARGET_DRIVE_FOLDER_ID,
} from "../lib/googleDriveService";

const SYNC_INTERVAL_MS = 60000; // Run every minute

export class DriveWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.intervalId) return;
    console.log("[Drive Worker] Starting background archiving worker...");
    this.intervalId = setInterval(
      () => this.processArchivingJobs(),
      SYNC_INTERVAL_MS,
    );

    // Run once immediately
    this.processArchivingJobs();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Drive Worker] Stopped background archiving worker.");
    }
  }

  private async processArchivingJobs() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const db = getFirebaseAdminFirestore();
      const storage = getFirebaseAdminStorage();

      if (!db || !storage || !driveService.isConfigured()) {
        this.isRunning = false;
        return; // Missing requirements
      }

      // 1. Query for audio_assets that are READY in Firebase Storage, but not yet synced to Drive
      // Wait, let's just query assets directly. We might need a composite index,
      // but let's query all READY and filter in memory if small, or query by driveMirror.workflowStatus.
      // Firestore structure:
      // audio_assets: { workflowStatus: "READY", driveMirror: { workflowStatus: "PENDING" | "FAILED" } }
      // To avoid index errors, we'll query where workflowStatus == 'READY' and filter in memory.
      const assetsRef = db.collection("audio_assets");
      const snapshot = await assetsRef
        .where("workflowStatus", "==", "READY")
        .get();

      for (const doc of snapshot.docs) {
        const asset = doc.data();

        const driveStatus = asset.driveMirror?.workflowStatus || "PENDING";

        if (
          driveStatus === "PENDING" ||
          driveStatus === "FAILED" ||
          driveStatus === "RETRYING"
        ) {
          const attempts = asset.driveMirror?.attempts || 0;
          if (attempts > 5) continue; // Give up after 5 attempts

          console.log(
            `[Drive Worker] Archiving asset ${doc.id} to Google Drive...`,
          );

          try {
            await doc.ref
              .set(
                {
                  driveMirror: {
                    workflowStatus: "SYNCING",
                    attempts: attempts + 1,
                  },
                },
                { merge: true },
              )
              .catch(() => {});

            // 1. Get readable stream from Firebase Storage
            const bucket = storage.bucket();
            const file = bucket.file(asset.storagePath);
            const [exists] = await file.exists();

            if (!exists) {
              throw new Error("File not found in Firebase Storage");
            }

            const readStream = file.createReadStream();
            const fileName = asset.storagePath.split("/").pop() || "audio.mp3";
            const mimeType = asset.contentType || "audio/mpeg";

            // 2. Resolve Drive Folder
            const bookId = asset.bookId || "unknown";
            const recordingId = asset.recordingId;
            let bookTitle = "عام";

            if (bookId !== "unknown") {
              const bookDoc = await db.collection("books").doc(bookId).get();
              if (bookDoc.exists) {
                bookTitle = bookDoc.data()?.title || "عام";
              }
            }

            if (bookTitle === "عام" && recordingId) {
              const recDoc = await db
                .collection("audio_recordings")
                .doc(recordingId)
                .get();
              if (recDoc.exists) {
                bookTitle = recDoc.data()?.bookId || "عام";
              }
            }

            const stage = asset.variant || "raw";
            let targetFolderId = TARGET_DRIVE_FOLDER_ID;

            if (bookId !== "unknown") {
              const folderTarget = await driveService.getStageFolderForBook(
                bookId,
                bookTitle,
                stage,
              );
              targetFolderId = folderTarget.folderId;
            } else {
              targetFolderId = STAGE_FOLDERS[stage] || TARGET_DRIVE_FOLDER_ID;
            }

            // 3. Upload to Google Drive using streams directly
            const drive = driveService.requireDriveClient();
            const res = await drive.files.create({
              requestBody: { name: fileName, parents: [targetFolderId] },
              media: { mimeType, body: readStream },
              fields: "id, webViewLink",
              supportsAllDrives: true,
            });

            const driveFileId = res.data.id;
            const driveUrl =
              "https://docs.google.com/uc?export=download&id=" + driveFileId;

            if (driveFileId) {
              await driveService.makeFilePublic(driveFileId);
            }

            // 4. Update Asset Document
            await doc.ref
              .set(
                {
                  driveMirror: {
                    workflowStatus: "READY",
                    fileId: driveFileId,
                    folderId: targetFolderId,
                    lastErrorCode: null,
                  },
                },
                { merge: true },
              )
              .catch((e) => console.warn("Asset driveMirror set failed:", e));

            // 5. Update AudioRecording Document
            if (recordingId) {
              const recRef = db.collection("audio_recordings").doc(recordingId);

              await recRef
                .set(
                  {
                    id: recordingId,
                    rawDriveFileId: driveFileId,
                    rawUrl: driveUrl,
                    drive_file_id: driveFileId,
                    drive_web_url: driveUrl,
                  },
                  { merge: true },
                )
                .catch((e) => console.warn("AudioRecording set failed:", e));
            }

            console.log(
              `[Drive Worker] Successfully archived ${doc.id} to Google Drive.`,
            );
          } catch (error: any) {
            console.error(`[Drive Worker] Failed to archive ${doc.id}:`, error);
            await doc.ref
              .set(
                {
                  driveMirror: {
                    workflowStatus: "FAILED",
                    lastErrorCode: error.message || "Unknown error",
                  },
                },
                { merge: true },
              )
              .catch(() => {});
          }
        }
      }
    } catch (error: any) {
      if (
        error?.code === 5 ||
        (error?.message && error.message.includes("NOT_FOUND"))
      ) {
        // Silently skip if database collection is not yet created or uninitialized
      } else {
        console.warn(
          "[Drive Worker] Background archiving check notice:",
          error?.message || error,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }
}

export const driveWorker = new DriveWorker();
