/**
 * Utility functions for Google Drive links, URLs, and upload result formatting.
 */

export function buildDriveFilesUrl(folderId?: string): string {
  if (!folderId) return "/api/drive/folders";
  return `/api/drive/files?folderId=${encodeURIComponent(folderId)}`;
}

export function buildDriveDownloadUrl(
  fileId: string,
  fileName: string,
): string {
  return `/api/audio/download/${encodeURIComponent(fileId)}?filename=${encodeURIComponent(fileName)}`;
}

export interface DriveUploadResponse {
  success: boolean;
  driveSuccess: boolean;
  message?: string;
  recId?: string;
  localUrl?: string;
  link?: string;
  fileId?: string;
  folderId?: string;
  driveFileId?: string;
  driveFolderId?: string;
  publicStreamUrl?: string;
  stage?: string;
  subfolderName?: string;
  fileName?: string;
  size?: number;
  mimeType?: string;
  bookId?: string;
  recordingId?: string;
  workflowStatus?: string;
  retryable?: boolean;
}

/**
 * Handles Google Drive upload result safely, preventing false successes and ensuring
 * that localUrl is NEVER passed off as a driveUrl.
 * Drive is the mandatory and only storage for actual files.
 */
export function handleDriveUploadResult(
  driveResult:
    | {
        fileId?: string;
        folderId?: string;
        webViewLink?: string;
        publicStreamUrl?: string;
        stage?: string;
        subfolderName?: string;
      }
    | null
    | undefined,
  recId: string,
  localUrl: string,
): { statusCode: number; body: DriveUploadResponse } {
  if (
    !driveResult ||
    !driveResult.fileId ||
    (!driveResult.webViewLink && !driveResult.publicStreamUrl)
  ) {
    return {
      statusCode: 502,
      body: {
        success: false,
        driveSuccess: false,
        message: "فشل الرفع إلى Google Drive. الرجاء إعادة المحاولة لاحقاً.",
        recId,
        localUrl,
        link: "",
        fileId: "",
        publicStreamUrl: "",
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      driveSuccess: true,
      message: "Uploaded to Drive & stored permanently",
      recId,
      localUrl,
      link: driveResult.webViewLink || "",
      fileId: driveResult.fileId,
      folderId: driveResult.folderId || "",
      driveFileId: driveResult.fileId,
      driveFolderId: driveResult.folderId || "",
      publicStreamUrl: driveResult.publicStreamUrl || "",
      stage: driveResult.stage,
      subfolderName: driveResult.subfolderName,
      workflowStatus: "uploaded",
      retryable: false,
    },
  };
}
