/**
 * Google Drive 7-Stage Hierarchy & Validation Specification
 * Ensat Audio Platform - Phase 3
 *
 * Folder Structure:
 * [ROOT]
 *   └── الكتب
 *       └── {bookId}-{bookTitleSafe}
 *           ├── 01-المواد-الأصلية
 *           ├── 02-التسجيلات-الخام
 *           ├── 03-المونتاج
 *           ├── 04-المكساج-والماستر
 *           ├── 05-النسخ-النهائية
 *           ├── 06-PDF-والنصوص
 *           └── 07-الأرشيف
 */

export const DRIVE_ROOT_BOOKS_CONTAINER = "الكتب";

const serverEnv = typeof process !== "undefined" ? process.env : {};

export const ENSAT_OFFICIAL_DRIVE_FOLDERS = {
  RAW_RECORDINGS: serverEnv.DRIVE_FOLDER_RAW || "",
  REDO_REQUESTED: serverEnv.DRIVE_FOLDER_QA_REJECTED || "",
  DESIGN_AND_MEDIA: serverEnv.DRIVE_FOLDER_MEDIA || "",
  APPROVED_BOOKS: serverEnv.DRIVE_FOLDER_BOOKS || "",
  FINAL_RELEASES: serverEnv.DRIVE_FOLDER_FINAL || "",
  AUDIO_ENGINEERING: serverEnv.DRIVE_FOLDER_ENGINEERED || "",
  CONTENT_AND_TEXTS: serverEnv.DRIVE_FOLDER_PDF || "",
  MEET_RECORDINGS: serverEnv.DRIVE_FOLDER_MEET || "",
} as const;

export const DRIVE_BOOK_SUBFOLDERS = {
  ORIGINAL: "01-المواد-الأصلية",
  RAW: "02-التسجيلات-الخام",
  MONTAGE: "03-المونتاج",
  MASTER: "04-المكساج-والماستر",
  FINAL: "05-النسخ-النهائية",
  PDF: "06-PDF-والنصوص",
  ARCHIVE: "07-الأرشيف",
} as const;

export type DriveSubfolderKey = keyof typeof DRIVE_BOOK_SUBFOLDERS;

/**
 * Sanitizes book title into a safe folder name component:
 * - Strips dangerous characters: / \ : * ? " < > | null-bytes control chars
 * - Normalizes consecutive whitespace into a single hyphen
 * - Retains Arabic characters, English letters, digits, and hyphens
 * - Trims to safe max length
 */
export function sanitizeBookTitle(title: string | undefined | null): string {
  if (!title || typeof title !== "string") {
    return "كتاب-بدون-عنوان";
  }

  // Remove dangerous path characters and control codes
  let clean = title
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F/\\:*?"<>|]/g, " ")
    .replace(/[.]{2,}/g, "") // remove consecutive dots (prevent ../ traversal)
    .trim();

  // Replace whitespace and underscores with a single hyphen
  clean = clean.replace(/[\s_]+/g, "-");

  // Keep Arabic letters, English alphanumeric, hyphens, and Arabic diacritics
  clean = clean.replace(
    /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFa-zA-Z0-9-]/g,
    "",
  );

  // Remove leading/trailing hyphens
  clean = clean.replace(/^-+|-+$/g, "");

  if (!clean || clean.length === 0) {
    return "كتاب";
  }

  return clean.slice(0, 80);
}

/**
 * Generates the unique book folder name: {bookId}-{bookTitleSafe}
 * Using bookId guarantees no collision between books with identical titles.
 */
export function formatBookFolderName(
  bookId: string | undefined | null,
  bookTitle: string | undefined | null,
): string {
  const safeId = sanitizeId(bookId) || "book-unknown";
  const safeTitle = sanitizeBookTitle(bookTitle);
  return `${safeId}-${safeTitle}`;
}

/**
 * Sanitizes IDs to alphanumeric, hyphens, underscores only.
 */
export function sanitizeId(id: string | undefined | null): string {
  if (!id || typeof id !== "string") return "";
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

/**
 * Resolves recording workflowStatus or stage into the target Drive subfolder
 * Prioritizes structured data (workflowStatus, stage, recordingType) with safe fallback.
 */
export function resolveStageFolder(stageOrStatus: string | undefined | null): {
  subfolderName: string;
  stageKey: DriveSubfolderKey;
  labelAr: string;
} {
  const normalized = (stageOrStatus || "").toLowerCase().trim();

  // 1. PDF & Text
  if (
    normalized === "pdf" ||
    normalized === "text" ||
    normalized === "manuscript" ||
    normalized === "cover"
  ) {
    return {
      subfolderName: DRIVE_BOOK_SUBFOLDERS.PDF,
      stageKey: "PDF",
      labelAr: "PDF والنصوص",
    };
  }

  // 2. Final Publication (approved audio ready for release)
  if (
    normalized === "final" ||
    normalized === "qa_approved" ||
    normalized === "approved" ||
    normalized === "published"
  ) {
    return {
      subfolderName: DRIVE_BOOK_SUBFOLDERS.FINAL,
      stageKey: "FINAL",
      labelAr: "النسخ النهائية",
    };
  }

  // 3. Mixing & Mastering
  if (
    normalized === "master" ||
    normalized === "mastered" ||
    normalized === "mixing" ||
    normalized === "mastering"
  ) {
    return {
      subfolderName: DRIVE_BOOK_SUBFOLDERS.MASTER,
      stageKey: "MASTER",
      labelAr: "المكساج والماستر",
    };
  }

  // 4. Montage & Sound Engineering
  if (
    normalized === "montage" ||
    normalized === "engineered" ||
    normalized === "editing" ||
    normalized === "qa_rejected" ||
    normalized === "NARRATOR_REVISION_REQUIRED"
  ) {
    return {
      subfolderName: DRIVE_BOOK_SUBFOLDERS.MONTAGE,
      stageKey: "MONTAGE",
      labelAr: "المونتاج والهندسة",
    };
  }

  // 5. Original Sources
  if (
    normalized === "original" ||
    normalized === "source" ||
    normalized === "source_material"
  ) {
    return {
      subfolderName: DRIVE_BOOK_SUBFOLDERS.ORIGINAL,
      stageKey: "ORIGINAL",
      labelAr: "المواد الأصلية",
    };
  }

  // 6. Archive (explicit only)
  if (normalized === "archive" || normalized === "archived") {
    return {
      subfolderName: DRIVE_BOOK_SUBFOLDERS.ARCHIVE,
      stageKey: "ARCHIVE",
      labelAr: "الأرشيف",
    };
  }

  // Default Fallback: Raw Narrator Recording (02-التسجيلات-الخام)
  return {
    subfolderName: DRIVE_BOOK_SUBFOLDERS.RAW,
    stageKey: "RAW",
    labelAr: "التسجيلات الخام",
  };
}

/**
 * Validates upload input parameters to prevent path traversal and bad requests
 */
export function validateUploadInput(params: {
  bookId?: any;
  bookTitle?: any;
  recordingId?: any;
  fileName?: any;
  fileSize?: number;
  mimeType?: any;
}): { valid: boolean; error?: string } {
  const { bookId, bookTitle, recordingId, fileName, fileSize, mimeType } =
    params;

  if (
    bookTitle !== undefined &&
    (typeof bookTitle !== "string" || bookTitle.trim().length === 0)
  ) {
    return { valid: false, error: "عنوان الكتاب مطلوب ولا يمكن تركه فارغاً" };
  }

  if (
    !fileName ||
    typeof fileName !== "string" ||
    fileName.trim().length === 0
  ) {
    return { valid: false, error: "اسم الملف مطلوب ولا يمكن تركه فارغاً" };
  }

  // Prevent path traversal in file name
  if (
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("\0")
  ) {
    return {
      valid: false,
      error: "اسم الملف غير صالح ويحتوي رموز مسارات محظورة",
    };
  }

  if (fileName.length > 255) {
    return {
      valid: false,
      error: "اسم الملف يتجاوز الحد الأقصى المسموح (255 حرفاً)",
    };
  }

  if (recordingId && typeof recordingId === "string") {
    if (
      recordingId.includes("..") ||
      recordingId.includes("/") ||
      recordingId.includes("\\")
    ) {
      return { valid: false, error: "معرف التسجيل غير صالح" };
    }
  }

  if (bookId && typeof bookId === "string") {
    if (
      bookId.includes("..") ||
      bookId.includes("/") ||
      bookId.includes("\\")
    ) {
      return { valid: false, error: "معرف الكتاب غير صالح" };
    }
  }

  // Max file size limit: 500MB
  const MAX_FILE_SIZE = 500 * 1024 * 1024;
  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "حجم الملف يتجاوز الحد الأقصى المسموح (500 ميجابايت)",
    };
  }

  // Validate allowed MIME types
  if (mimeType && typeof mimeType === "string") {
    const isAudio =
      mimeType.startsWith("audio/") ||
      mimeType === "video/mp4" ||
      mimeType === "video/webm";
    const isPdf = mimeType === "application/pdf";
    if (!isAudio && !isPdf) {
      return {
        valid: false,
        error: "نوع الملف غير مدعوم. الأنواع المدعومة: ملفات صوتية أو PDF",
      };
    }
  }

  return { valid: true };
}
