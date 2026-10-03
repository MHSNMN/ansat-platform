import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

export interface RecordingUploadMetadata {
  bookId: string;
  recordingId: string;
  stage: string;
  driveFileId: string;
  driveFolderId: string;
  fileName: string;
  size: number;
  mimeType: string;
  workflowStatus: "uploaded";
  uploadedAt?: string;
  driveUrl?: string;
  streamUrl?: string;
}

/**
 * Stores file upload metadata in Firestore when Google Drive upload succeeds.
 * Note: Firestore is strictly used for metadata, never for raw file content.
 */
export async function storeRecordingMetadataInFirestore(
  metadata: RecordingUploadMetadata,
): Promise<void> {
  if (!metadata.recordingId) {
    throw new Error("recordingId is required to store metadata in Firestore");
  }
  if (!metadata.driveFileId) {
    throw new Error("driveFileId is required to store metadata in Firestore");
  }

  const payload = {
    bookId: metadata.bookId,
    recordingId: metadata.recordingId,
    stage: metadata.stage,
    driveFileId: metadata.driveFileId,
    driveFolderId: metadata.driveFolderId || "",
    fileName: metadata.fileName,
    size: metadata.size,
    mimeType: metadata.mimeType,
    workflowStatus: "uploaded" as const,
    // Database schema backward-compatible fields:
    rawDriveFileId: metadata.driveFileId,
    rawUrl: metadata.fileName,
    durationSeconds: `${(metadata.size / (1024 * 1024)).toFixed(2)} MB`,
    updated_at: new Date().toISOString(),
    uploaded_at: metadata.uploadedAt || new Date().toISOString(),
    ...(metadata.driveUrl ? { rawUrl: metadata.driveUrl } : {}),
    ...(metadata.streamUrl ? { rawUrl: metadata.streamUrl } : {}),
  };

  // 1. Update/Merge in the primary audio_recordings document
  try {
    const recRef = doc(db, "audio_recordings", metadata.recordingId);
    await setDoc(recRef, payload, { merge: true });
  } catch (err) {
    console.warn(
      "Could not update audio_recordings document in Firestore:",
      err,
    );
  }

  // 2. Also save to dedicated file_metadata collection for explicit metadata audit
  try {
    const metaRef = doc(db, "recording_files_metadata", metadata.recordingId);
    await setDoc(
      metaRef,
      {
        bookId: metadata.bookId,
        recordingId: metadata.recordingId,
        stage: metadata.stage,
        driveFileId: metadata.driveFileId,
        driveFolderId: metadata.driveFolderId || "",
        fileName: metadata.fileName,
        size: metadata.size,
        mimeType: metadata.mimeType,
        workflowStatus: "uploaded",
        storedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn(
      "Could not write to recording_files_metadata collection:",
      err,
    );
  }
}
