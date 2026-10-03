// @ts-nocheck
/**
 * Reliable Server-Side Upload Registry & Deduplication Engine
 * Ensat Audio Platform - Phase 3
 *
 * Strict Rules:
 * - NEVER store tokens, secrets, or credentials.
 * - NEVER mark as uploaded unless real driveFileId is returned.
 * - Max 3 automatic retry attempts with backoff (10s, 30s, 90s).
 * - Lock recordingId to prevent concurrent parallel uploads of the same file.
 */

export type UploadStatus =
  "pending" | "uploading" | "uploaded" | "failed" | "retrying";

export interface UploadRecord {
  uploadId: string;
  bookId: string;
  recordingId: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  stage: string;
  driveFolderId?: string;
  driveFileId?: string;
  driveUrl?: string;
  workflowStatus: UploadStatus;
  attemptCount: number;
  lastAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadSummary {
  total: number;
  pending: number;
  uploading: number;
  uploaded: number;
  failed: number;
  retrying: number;
}

export const RETRY_BACKOFF_SECONDS = [10, 30, 90];
export const MAX_RETRY_ATTEMPTS = 3;

export class UploadRegistry {
  private records: Map<string, UploadRecord> = new Map();
  // Active upload locks by recordingId to prevent parallel duplicate uploads
  private activeLocks: Set<string> = new Set();

  /**
   * Acquire lock for a recordingId. Returns false if already in progress.
   */
  acquireLock(recordingId: string): boolean {
    if (!recordingId) return false;
    if (this.activeLocks.has(recordingId)) {
      return false;
    }
    this.activeLocks.add(recordingId);
    return true;
  }

  /**
   * Release lock for a recordingId.
   */
  releaseLock(recordingId: string): void {
    if (recordingId) {
      this.activeLocks.delete(recordingId);
    }
  }

  /**
   * Check if upload is currently in progress for this recordingId.
   */
  isLocked(recordingId: string): boolean {
    return this.activeLocks.has(recordingId);
  }

  /**
   * Creates or initializes an upload tracking record.
   */
  createRecord(params: {
    uploadId?: string;
    bookId: string;
    recordingId: string;
    originalFileName: string;
    mimeType?: string;
    size?: number;
    stage?: string;
    driveFolderId?: string;
  }): UploadRecord {
    const uploadId =
      params.uploadId ||
      `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: UploadRecord = {
      uploadId,
      bookId: params.bookId || "unknown-book",
      recordingId: params.recordingId,
      originalFileName: params.originalFileName,
      mimeType: params.mimeType || "audio/mpeg",
      size: params.size || 0,
      stage: params.stage || "raw",
      driveFolderId: params.driveFolderId,
      workflowStatus: "pending",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(uploadId, record);
    return record;
  }

  getRecord(uploadId: string): UploadRecord | undefined {
    return this.records.get(uploadId);
  }

  getRecordByRecordingId(recordingId: string): UploadRecord | undefined {
    for (const record of this.records.values()) {
      if (record.recordingId === recordingId) {
        return record;
      }
    }
    return undefined;
  }

  /**
   * Updates upload workflowStatus and metadata safely.
   */
  updateRecord(
    uploadId: string,
    updates: Partial<Omit<UploadRecord, "uploadId" | "createdAt">>,
  ): UploadRecord | undefined {
    const existing = this.records.get(uploadId);
    if (!existing) return undefined;

    // Safety contract: Can only mark 'uploaded' if a real driveFileId is provided
    if (updates.workflowStatus === "uploaded") {
      const fileId = updates.driveFileId || existing.driveFileId;
      if (!fileId || typeof fileId !== "string" || fileId.trim().length === 0) {
        console.warn(
          `[UploadRegistry Security] Attempted to mark record ${uploadId} as 'uploaded' without valid driveFileId. Rejecting workflowStatus transition.`,
        );
        updates.workflowStatus = "failed";
        updates.lastErrorMessage =
          "تعذر تأكيد استلام ملف Drive (معرف الملف مفقود)";
      }
    }

    const updated: UploadRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.records.set(uploadId, updated);
    return updated;
  }

  /**
   * Records a failed attempt and computes whether it can be retried.
   */
  recordAttemptFailure(
    uploadId: string,
    error: {
      code?: string;
      message: string;
      isDriveUnconfigured?: boolean;
    },
  ): {
    record: UploadRecord | undefined;
    retryable: boolean;
    nextRetryDelaySeconds?: number;
  } {
    const record = this.records.get(uploadId);
    if (!record) return { record: undefined, retryable: false };

    const newAttemptCount = record.attemptCount + 1;
    const now = new Date().toISOString();

    // Drive unconfigured failure is NEVER retryable automatically
    if (error.isDriveUnconfigured) {
      const updated = this.updateRecord(uploadId, {
        workflowStatus: "failed",
        attemptCount: newAttemptCount,
        lastAttemptAt: now,
        lastErrorCode: error.code || "DRIVE_NOT_CONFIGURED",
        lastErrorMessage:
          "خدمة Google Drive غير مهيأة على الخادم. يرجى تهيئة بيئة الخادم أولاً.",
      });
      return { record: updated, retryable: false };
    }

    // Check retry limits
    const canRetry = newAttemptCount < MAX_RETRY_ATTEMPTS;
    const nextDelay = canRetry
      ? RETRY_BACKOFF_SECONDS[newAttemptCount - 1] || 90
      : undefined;

    const nextStatus: UploadStatus = canRetry ? "retrying" : "failed";

    const updated = this.updateRecord(uploadId, {
      workflowStatus: nextStatus,
      attemptCount: newAttemptCount,
      lastAttemptAt: now,
      lastErrorCode: error.code || "UPLOAD_FAILED",
      lastErrorMessage: error.message || "فشلت محاولة الرفع إلى Google Drive.",
    });

    return {
      record: updated,
      retryable: canRetry,
      nextRetryDelaySeconds: nextDelay,
    };
  }

  /**
   * Safe public diagnostic summary. Never returns secrets, tokens, or file paths.
   */
  getSummary(): UploadSummary {
    let pending = 0;
    let uploading = 0;
    let uploaded = 0;
    let failed = 0;
    let retrying = 0;

    for (const rec of this.records.values()) {
      switch (rec.workflowStatus) {
        case "pending":
          pending++;
          break;
        case "uploading":
          uploading++;
          break;
        case "uploaded":
          uploaded++;
          break;
        case "failed":
          failed++;
          break;
        case "retrying":
          retrying++;
          break;
      }
    }

    return {
      total: this.records.size,
      pending,
      uploading,
      uploaded,
      failed,
      retrying,
    };
  }

  /**
   * Clears registry state (used for testing or maintenance)
   */
  reset(): void {
    this.records.clear();
    this.activeLocks.clear();
  }

  clear(): void {
    this.reset();
  }
}

export const uploadRegistry = new UploadRegistry();
