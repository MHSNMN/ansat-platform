// @ts-nocheck
import { authService } from "./authService";

export interface UploadProgressCallback {
  (
    progress: number,
    workflowStatus: "uploading" | "paused" | "failed" | "success",
    error?: string,
  ): void;
}

export interface UploadResult {
  success: boolean;
  driveSuccess: boolean;
  fileId: string;
  folderId: string;
  driveFileId: string;
  driveFolderId: string;
  driveUrl: string;
  finalUrl: string;
  localUrl?: string;
  subfolderName?: string;
  stage: string;
  fileName: string;
  size: number;
  mimeType: string;
  bookId: string;
  recordingId: string;
}

export class DriveUploadError extends Error {
  retryable: boolean;
  isDriveUnconfigured: boolean;
  statusCode?: number;
  constructor(
    message: string,
    options?: {
      retryable?: boolean;
      isDriveUnconfigured?: boolean;
      statusCode?: number;
    },
  ) {
    super(message);
    this.name = "DriveUploadError";
    this.retryable = options?.retryable ?? true;
    this.isDriveUnconfigured = options?.isDriveUnconfigured ?? false;
    this.statusCode = options?.statusCode;
  }
}

export const uploadService = {
  async uploadAudio(
    file: File,
    fileName: string,
    bookTitle: string,
    stage: string = "raw",
    recId: string,
    driveFolderId?: string,
    onProgress?: UploadProgressCallback,
    abortSignal?: AbortSignal,
    bookId?: string,
  ): Promise<UploadResult> {
    if (abortSignal?.aborted) {
      throw new DriveUploadError("تم إلغاء عملية الرفع", { retryable: true });
    }

    const token = await authService.token().catch(() => "");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", fileName);
    formData.append("bookTitle", bookTitle);
    formData.append("stage", stage);
    formData.append("recId", recId);
    if (bookId) formData.append("bookId", bookId);
    if (driveFolderId) formData.append("folderId", driveFolderId);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/drive/upload-direct", true);
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
          xhr.abort();
          reject(
            new DriveUploadError("تم إلغاء عملية الرفع", { retryable: true }),
          );
        });
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.min(99, Math.round((e.loaded / e.total) * 100));
          onProgress(progress, "uploading");
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let responseData: any = {};
          try {
            if (xhr.responseText) responseData = JSON.parse(xhr.responseText);
          } catch (e) {
            console.warn("تعذر تحليل استجابة السيرفر", e);
          }

          if (responseData.success) {
            if (onProgress) onProgress(100, "success");
            resolve({
              success: true,
              driveSuccess: responseData.driveSuccess ?? true,
              fileId: responseData.fileId || recId,
              folderId: responseData.folderId || driveFolderId || "",
              driveFileId: responseData.driveFileId || "",
              driveFolderId: responseData.driveFolderId || driveFolderId || "",
              driveUrl: responseData.driveUrl || "",
              finalUrl: responseData.finalUrl || responseData.driveUrl || "",
              localUrl: responseData.localUrl,
              subfolderName: responseData.subfolderName,
              stage,
              fileName: responseData.fileName || fileName,
              size: responseData.size || file.size,
              mimeType: responseData.mimeType || file.type || "audio/mpeg",
              bookId: responseData.bookId || bookId || "",
              recordingId: responseData.recordingId || recId,
            });
            return;
          }

          const errMsg = responseData.error || "فشل رفع الملف إلى السيرفر";
          if (onProgress) onProgress(0, "failed", errMsg);
          reject(
            new DriveUploadError(errMsg, {
              retryable: xhr.status >= 500,
              statusCode: xhr.status,
            }),
          );
        } else {
          let errMsg = `خطأ في الخادم (${xhr.status})`;
          try {
            const errJson = JSON.parse(xhr.responseText);
            if (errJson.error) errMsg = errJson.error;
          } catch (e) {
            console.warn("Could not parse server error response", e);
          }
          if (onProgress) onProgress(0, "failed", errMsg);
          reject(
            new DriveUploadError(errMsg, {
              retryable: xhr.status >= 500,
              statusCode: xhr.status,
            }),
          );
        }
      };

      xhr.onerror = () => {
        if (onProgress)
          onProgress(0, "failed", "خطأ في الاتصال أثناء رفع الملف");
        reject(
          new DriveUploadError(
            "تعذر الاتصال بالخادم، يرجى التحقق من الشبكة وإعادة المحاولة",
            {
              retryable: true,
            },
          ),
        );
      };

      xhr.send(formData);
    });
  },
};
