// @ts-nocheck
import { initUploadDB } from "../services/storageService";
import { toastStore } from "./toastStore";

export type HonestUploadState =
  | "pending" // قيد الانتظار
  | "uploading_storage" // جارٍ الرفع إلى مساحة التخزين الأساسية
  | "uploaded_storage" // تم الحفظ في التخزين بنجاح
  | "retryable_failure" // فشل مؤقت ويمكن إعادة المحاولة
  | "paused"; // متوقف مؤقتاً

export interface QueueItem {
  id: string;
  recId: string;
  bookId?: string;
  file: File;
  fileName: string;
  bookTitle: string;
  driveFolderId?: string;
  mimeType: string;
  stage?: string;
  workflowStatus: "pending" | "uploading" | "paused" | "success" | "failed";
  honestState?: HonestUploadState;
  stateTextAr?: string;
  subfolderName?: string;
  error?: string;
  progress: number;
  attempts?: number;
}

type QueueListener = (queue: QueueItem[]) => void;

const RETRY_DELAYS_MS = [10_000, 30_000, 90_000];
const MAX_QUEUE_ATTEMPTS = 3;

class UploadQueueManager {
  private queue: QueueItem[] = [];
  private listeners: QueueListener[] = [];
  private isProcessing = false;
  private isGlobalPaused = false;
  private currentUploadAbortController: AbortController | null = null;
  private initialized = false;

  constructor() {
    this.restoreFromIDB();
  }

  private async restoreFromIDB() {
    try {
      const idb = await initUploadDB();
      const files = await idb.getAll("files");
      const jobs = await idb.getAll("upload_jobs");

      const recoveredItems: QueueItem[] = [];

      for (const job of jobs) {
        const fileEntry = files.find((f) => f.id === job.id);
        if (!fileEntry || !fileEntry.file) continue;

        const assetParts = job.assetId.split("-");
        const recId = assetParts[0];
        const stage = assetParts[1] || "raw";

        recoveredItems.push({
          id: job.id,
          recId,
          bookId: "unknown",
          file: fileEntry.file,
          fileName: fileEntry.file.name,
          bookTitle: "Recovered",
          mimeType: fileEntry.file.type,
          stage,
          workflowStatus: "pending",
          honestState: "pending",
          stateTextAr: "تم استرداد المهمة (قيد الانتظار)",
          progress: job.bytesTotal
            ? Math.floor((job.bytesUploaded / job.bytesTotal) * 100)
            : 0,
          attempts: 0,
        });
      }

      if (recoveredItems.length > 0) {
        this.queue = [...this.queue, ...recoveredItems];
        this.notify();
        this.processQueue();
      }
    } catch (e) {
      console.warn("Failed to restore upload queue from IndexedDB", e);
    }
    this.initialized = true;
  }

  subscribe(listener: QueueListener) {
    this.listeners.push(listener);
    listener(this.queue);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.queue]));
  }

  addItems(
    items: Omit<
      QueueItem,
      | "id"
      | "workflowStatus"
      | "progress"
      | "honestState"
      | "stateTextAr"
      | "attempts"
    >[],
  ) {
    const newItems = items.map((item) => ({
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      workflowStatus: "pending" as const,
      honestState: "pending" as const,
      stateTextAr: "قيد الانتظار",
      progress: 0,
      attempts: 0,
    }));
    this.queue = [...this.queue, ...newItems];
    this.notify();
    this.processQueue();
  }

  pauseAll() {
    this.isGlobalPaused = true;
    if (this.currentUploadAbortController) {
      this.currentUploadAbortController.abort();
      this.currentUploadAbortController = null;
    }
    this.queue = this.queue.map((item) =>
      item.workflowStatus === "uploading" || item.workflowStatus === "pending"
        ? {
            ...item,
            workflowStatus: "paused",
            honestState: "paused",
            stateTextAr: "متوقف مؤقتاً",
          }
        : item,
    );
    this.isProcessing = false;
    this.notify();
  }

  resumeAll() {
    this.isGlobalPaused = false;
    this.queue = this.queue.map((item) =>
      item.workflowStatus === "paused" || item.workflowStatus === "failed"
        ? {
            ...item,
            workflowStatus: "pending",
            honestState: "pending",
            stateTextAr: "قيد الانتظار",
          }
        : item,
    );
    this.notify();
    this.processQueue();
  }

  retryItemByRecId(recId: string) {
    const items = this.queue.filter((q) => q.recId === recId);
    items.forEach((item) => {
      if (
        item.workflowStatus === "failed" ||
        item.workflowStatus === "paused"
      ) {
        item.workflowStatus = "pending";
        item.honestState = "pending";
        item.stateTextAr = "قيد الانتظار";
        item.error = undefined;
        item.progress = 0;
        item.attempts = 0;
      }
    });
    this.notify();
    this.processQueue();
  }

  retryItem(id: string) {
    const item = this.queue.find((q) => q.id === id);
    if (
      item &&
      (item.workflowStatus === "failed" || item.workflowStatus === "paused")
    ) {
      item.workflowStatus = "pending";
      item.honestState = "pending";
      item.stateTextAr = "قيد الانتظار";
      item.error = undefined;
      item.progress = 0;
      item.attempts = 0;
      this.notify();
      this.processQueue();
    }
  }

  clearCompleted() {
    this.queue = this.queue.filter((item) => item.workflowStatus !== "success");
    this.notify();
  }

  clearAll() {
    this.queue = [];
    this.notify();
  }

  removeItem(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.notify();
  }

  getQueue() {
    return this.queue;
  }

  private async processQueue() {
    if (this.isProcessing || this.isGlobalPaused) return;

    const nextItemIndex = this.queue.findIndex(
      (item) => item.workflowStatus === "pending",
    );
    if (nextItemIndex === -1) return;

    this.isProcessing = true;
    const item = this.queue[nextItemIndex];

    this.queue[nextItemIndex].workflowStatus = "uploading";
    this.queue[nextItemIndex].honestState = "uploading_storage";
    this.queue[nextItemIndex].stateTextAr = "جارٍ الرفع إلى التخزين الأساسي...";
    this.queue[nextItemIndex].progress = 5;
    this.queue[nextItemIndex].error = undefined;
    this.notify();

    try {
      this.currentUploadAbortController = new AbortController();

      const { uploadService } = await import("../services/uploadService");
      const { updateRecording } = await import("./supabaseClient");

      const result = await uploadService.uploadAudio(
        item.file,
        item.fileName,
        item.bookTitle,
        item.stage || "raw",
        item.recId,
        item.driveFolderId,
        (progress) => {
          this.queue[nextItemIndex].progress = Math.max(10, progress);
          this.notify();
        },
        this.currentUploadAbortController.signal,
        item.bookId,
      );

      if (result.subfolderName) {
        this.queue[nextItemIndex].subfolderName = result.subfolderName;
      }

      // Update Database
      if (item.stage === "mastered") {
        await updateRecording(item.recId, {
          masteredUrl: result.finalUrl,
          workflowStatus: "MASTERING",
          masteredDriveFileId: result.driveFileId || "",
          mastered_file_url: result.finalUrl,
          file_url: result.finalUrl,
          status: "MASTERED",
        });
      } else {
        await updateRecording(item.recId, {
          rawUrl: result.finalUrl,
          workflowStatus: "RAW_QA_PENDING",
          rawDriveFileId: result.driveFileId || "",
          drive_file_id: result.driveFileId || "",
          drive_url: result.finalUrl,
          file_url: result.finalUrl,
          public_link: result.finalUrl,
          status: "RAW",
        });
      }

      this.queue[nextItemIndex].workflowStatus = "success";
      this.queue[nextItemIndex].honestState = "uploaded_storage";
      this.queue[nextItemIndex].stateTextAr = "تم الحفظ بنجاح";
      this.queue[nextItemIndex].progress = 100;

      toastStore.addToast({
        type: "success",
        title: "اكتمل الرفع!",
        message: `تم رفع ${item.fileName} بنجاح.`,
      });

      this.notify();

      setTimeout(() => {
        this.queue = this.queue.filter((q) => q.id !== item.id);
        this.notify();
      }, 5000);
    } catch (error: any) {
      const isAborted =
        error.name === "AbortError" ||
        (this.currentUploadAbortController &&
          this.currentUploadAbortController.signal.aborted);

      if (isAborted) {
        this.queue[nextItemIndex].workflowStatus = "paused";
        this.queue[nextItemIndex].honestState = "paused";
        this.queue[nextItemIndex].stateTextAr = "متوقف مؤقتاً";
      } else {
        this.queue[nextItemIndex].workflowStatus = "failed";
        const errMsg = error?.message || "فشل الرفع";
        this.queue[nextItemIndex].error = errMsg;

        const currentAttempts = (item.attempts || 0) + 1;
        this.queue[nextItemIndex].attempts = currentAttempts;

        if (currentAttempts < MAX_QUEUE_ATTEMPTS) {
          this.queue[nextItemIndex].honestState = "retryable_failure";
          this.queue[nextItemIndex].stateTextAr =
            `فشل مؤقت (محاولة ${currentAttempts}/${MAX_QUEUE_ATTEMPTS})`;
          const delayMs = RETRY_DELAYS_MS[currentAttempts - 1] || 10_000;
          setTimeout(() => {
            const currentItem = this.queue.find((q) => q.id === item.id);
            if (currentItem && currentItem.workflowStatus === "failed") {
              this.retryItem(item.id);
            }
          }, delayMs);
        } else {
          this.queue[nextItemIndex].honestState = "retryable_failure";
          this.queue[nextItemIndex].stateTextAr =
            "فشل الرفع بعد 3 محاولات (يمكن إعادة المحاولة يدوياً)";
        }

        try {
          toastStore.addToast({
            type: "error",
            title: "فشل الرفع",
            message: errMsg,
          });
        } catch {
          // ignore toast failure
        }
      }
      this.notify();
    } finally {
      this.isProcessing = false;
      this.currentUploadAbortController = null;
      this.processQueue();
    }
  }
}

export const uploadQueueManager = new UploadQueueManager();
