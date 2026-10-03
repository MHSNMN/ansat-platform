import { test, expect, describe, beforeEach } from "vitest";
import {
  DRIVE_ROOT_BOOKS_CONTAINER,
  DRIVE_BOOK_SUBFOLDERS,
  sanitizeBookTitle,
  formatBookFolderName,
  resolveStageFolder,
  validateUploadInput,
} from "./lib/driveFolderStructure";
import { UploadRegistry } from "./lib/uploadRegistry";
import { GoogleDriveService } from "./lib/googleDriveService";

describe("Phase 3: Organized, Retryable, Non-Duplicating Drive Uploads", () => {
  describe("1. Folder Hierarchy & Stage Mapping Specifications", () => {
    test("defines root books container name as 'الكتب'", () => {
      expect(DRIVE_ROOT_BOOKS_CONTAINER).toBe("الكتب");
    });

    test("defines exact 7-stage canonical subfolders in Arabic", () => {
      expect(DRIVE_BOOK_SUBFOLDERS.ORIGINAL).toBe("01-المواد-الأصلية");
      expect(DRIVE_BOOK_SUBFOLDERS.RAW).toBe("02-التسجيلات-الخام");
      expect(DRIVE_BOOK_SUBFOLDERS.MONTAGE).toBe("03-المونتاج");
      expect(DRIVE_BOOK_SUBFOLDERS.MASTER).toBe("04-المكساج-والماستر");
      expect(DRIVE_BOOK_SUBFOLDERS.FINAL).toBe("05-النسخ-النهائية");
      expect(DRIVE_BOOK_SUBFOLDERS.PDF).toBe("06-PDF-والنصوص");
      expect(DRIVE_BOOK_SUBFOLDERS.ARCHIVE).toBe("07-الأرشيف");
    });

    test("sanitizes book title by stripping dangerous characters and normalizing whitespace", () => {
      expect(sanitizeBookTitle("كتاب/الأيام\\الجزء:الأول?")).toBe(
        "كتاب-الأيام-الجزء-الأول",
      );
      expect(sanitizeBookTitle("   رواية 1984 *   ")).toBe("رواية-1984");
      expect(sanitizeBookTitle("")).toBe("كتاب-بدون-عنوان");
    });

    test("formats unique book folder name combining bookId and sanitized title", () => {
      const folderName = formatBookFolderName("book_abc123", "رياض الصالحين");
      expect(folderName).toBe("book_abc123-رياض-الصالحين");
    });

    test("formats unique book folder name safely with whitespace trimmed and punctuation stripped", () => {
      const folderName = formatBookFolderName("bk_99", "تاريخ/ابن/خلدون");
      expect(folderName).toBe("bk_99-تاريخ-ابن-خلدون");
    });

    test("resolves stages to correct subfolders accurately", () => {
      expect(resolveStageFolder("raw")).toEqual({
        stageKey: "RAW",
        subfolderName: "02-التسجيلات-الخام",
        labelAr: "التسجيلات الخام",
      });
      expect(resolveStageFolder("mastered")).toEqual({
        stageKey: "MASTER",
        subfolderName: "04-المكساج-والماستر",
        labelAr: "المكساج والماستر",
      });
      expect(resolveStageFolder("final")).toEqual({
        stageKey: "FINAL",
        subfolderName: "05-النسخ-النهائية",
        labelAr: "النسخ النهائية",
      });
      expect(resolveStageFolder("pdf")).toEqual({
        stageKey: "PDF",
        subfolderName: "06-PDF-والنصوص",
        labelAr: "PDF والنصوص",
      });
      // Default fallback is RAW
      expect(resolveStageFolder("unknown_stage")).toEqual({
        stageKey: "RAW",
        subfolderName: "02-التسجيلات-الخام",
        labelAr: "التسجيلات الخام",
      });
    });
  });

  describe("2. Input Validation Specifications", () => {
    test("accepts valid upload parameters", () => {
      const result = validateUploadInput({
        bookId: "book_1",
        bookTitle: "مقدمة ابن خلدون",
        recordingId: "rec_456",
        fileName: "part_01.mp3",
        fileSize: 10 * 1024 * 1024,
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("rejects missing or whitespace-only book title", () => {
      const result = validateUploadInput({
        bookId: "book_1",
        bookTitle: "   ",
        recordingId: "rec_1",
        fileName: "part_01.mp3",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("عنوان الكتاب مطلوب");
    });

    test("rejects path traversal attempts in file name", () => {
      const result = validateUploadInput({
        bookId: "book_1",
        bookTitle: "كتاب صحيح",
        recordingId: "rec_1",
        fileName: "../../etc/passwd",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("غير صالح");
    });

    test("rejects file exceeding maximum size limit (1GB)", () => {
      const result = validateUploadInput({
        bookId: "book_1",
        bookTitle: "كتاب صحيح",
        recordingId: "rec_1",
        fileName: "massive_file.mp3",
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("الحد الأقصى");
    });
  });

  describe("3. Concurrency Lock & Deduplication Specifications", () => {
    let registry: UploadRegistry;

    beforeEach(() => {
      registry = new UploadRegistry();
    });

    test("acquires lock for a recording and blocks parallel uploads for the same recordingId", () => {
      const recId = "recording_unique_77";
      const acquiredFirst = registry.acquireLock(recId);
      expect(acquiredFirst).toBe(true);

      // Second attempt to acquire lock while active must fail (concurrency prevention)
      const acquiredSecond = registry.acquireLock(recId);
      expect(acquiredSecond).toBe(false);

      // After release, acquiring lock must succeed again
      registry.releaseLock(recId);
      const acquiredThird = registry.acquireLock(recId);
      expect(acquiredThird).toBe(true);
      registry.releaseLock(recId);
    });

    test("different recordings do not block each other", () => {
      expect(registry.acquireLock("rec_A")).toBe(true);
      expect(registry.acquireLock("rec_B")).toBe(true);
      expect(registry.acquireLock("rec_C")).toBe(true);

      registry.releaseLock("rec_A");
      registry.releaseLock("rec_B");
      registry.releaseLock("rec_C");
    });
  });

  describe("4. Upload Registry State Machine & Exponential Backoff Specifications", () => {
    let registry: UploadRegistry;

    beforeEach(() => {
      registry = new UploadRegistry();
    });

    test("creates upload record with pending workflowStatus and correct initial schema", () => {
      const record = registry.createRecord({
        bookId: "book_100",
        recordingId: "rec_200",
        originalFileName: "chapter_01.mp3",
        mimeType: "audio/mpeg",
        size: 5000000,
        stage: "raw",
      });

      expect(record.uploadId).toMatch(/^upl_/);
      expect(record.recordingId).toBe("rec_200");
      expect(record.bookId).toBe("book_100");
      expect(record.workflowStatus).toBe("pending");
      expect(record.attemptCount).toBe(0);
      expect(record.driveFileId).toBeUndefined();
    });

    test("correctly retrieves record by uploadId and recordingId", () => {
      const created = registry.createRecord({
        bookId: "book_test",
        recordingId: "rec_test_lookup",
        originalFileName: "test.mp3",
        mimeType: "audio/mpeg",
        size: 1000,
        stage: "raw",
      });

      const byUploadId = registry.getRecord(created.uploadId);
      expect(byUploadId).toBeDefined();
      expect(byUploadId?.recordingId).toBe("rec_test_lookup");

      const byRecId = registry.getRecordByRecordingId("rec_test_lookup");
      expect(byRecId).toBeDefined();
      expect(byRecId?.uploadId).toBe(created.uploadId);
    });

    test("updates record workflowStatus to uploaded only with a genuine driveFileId", () => {
      const record = registry.createRecord({
        bookId: "book_1",
        recordingId: "rec_1",
        originalFileName: "file.mp3",
        mimeType: "audio/mpeg",
        size: 1000,
        stage: "raw",
      });

      registry.updateRecord(record.uploadId, {
        workflowStatus: "uploaded",
        driveFileId: "drive_file_id_999",
        driveUrl: "https://drive.google.com/file/d/drive_file_id_999/view",
      });

      const updated = registry.getRecord(record.uploadId);
      expect(updated?.workflowStatus).toBe("uploaded");
      expect(updated?.driveFileId).toBe("drive_file_id_999");
      expect(updated?.driveUrl).toContain("drive_file_id_999");
    });

    test("applies exponential backoff schedule: 10s, 30s, 90s across up to 3 attempts", () => {
      const record = registry.createRecord({
        bookId: "book_retry",
        recordingId: "rec_retry",
        originalFileName: "audio.mp3",
        mimeType: "audio/mpeg",
        size: 1000,
        stage: "raw",
      });

      // Attempt 1 Failure -> delay 10s, retryable = true
      const failure1 = registry.recordAttemptFailure(record.uploadId, {
        message: "Network glitch",
      });
      expect(failure1.retryable).toBe(true);
      expect(failure1.nextRetryDelaySeconds).toBe(10);
      expect(failure1.record?.attemptCount).toBe(1);

      // Attempt 2 Failure -> delay 30s, retryable = true
      const failure2 = registry.recordAttemptFailure(record.uploadId, {
        message: "Drive busy",
      });
      expect(failure2.retryable).toBe(true);
      expect(failure2.nextRetryDelaySeconds).toBe(30);
      expect(failure2.record?.attemptCount).toBe(2);

      // Attempt 3 Failure -> reached maximum 3 attempts, retryable = false
      const failure3 = registry.recordAttemptFailure(record.uploadId, {
        message: "Socket closed",
      });
      expect(failure3.retryable).toBe(false);
      expect(failure3.nextRetryDelaySeconds).toBeUndefined();
      expect(failure3.record?.attemptCount).toBe(3);
      expect(failure3.record?.workflowStatus).toBe("failed");
    });

    test("does not retry when Google Drive is unconfigured", () => {
      const record = registry.createRecord({
        bookId: "book_unconf",
        recordingId: "rec_unconf",
        originalFileName: "file.mp3",
        mimeType: "audio/mpeg",
        size: 1000,
        stage: "raw",
      });

      const failure = registry.recordAttemptFailure(record.uploadId, {
        message: "Google Drive is not configured",
        isDriveUnconfigured: true,
      });

      expect(failure.retryable).toBe(false);
      expect(failure.nextRetryDelaySeconds).toBeUndefined();
      expect(failure.record?.workflowStatus).toBe("failed");
    });

    test("provides accurate summary diagnostics without exposing sensitive data", () => {
      registry.clear();

      registry.createRecord({
        bookId: "b1",
        recordingId: "r1",
        originalFileName: "1.mp3",
        mimeType: "audio/mpeg",
        size: 100,
        stage: "raw",
      });

      const u2 = registry.createRecord({
        bookId: "b2",
        recordingId: "r2",
        originalFileName: "2.mp3",
        mimeType: "audio/mpeg",
        size: 100,
        stage: "raw",
      });
      registry.updateRecord(u2.uploadId, { workflowStatus: "uploading" });

      const u3 = registry.createRecord({
        bookId: "b3",
        recordingId: "r3",
        originalFileName: "3.mp3",
        mimeType: "audio/mpeg",
        size: 100,
        stage: "raw",
      });
      registry.updateRecord(u3.uploadId, {
        workflowStatus: "uploaded",
        driveFileId: "f3",
      });

      const u4 = registry.createRecord({
        bookId: "b4",
        recordingId: "r4",
        originalFileName: "4.mp3",
        mimeType: "audio/mpeg",
        size: 100,
        stage: "raw",
      });
      registry.recordAttemptFailure(u4.uploadId, {
        message: "Drive unconfigured",
        isDriveUnconfigured: true,
      });

      const summary = registry.getSummary();
      expect(summary.total).toBe(4);
      expect(summary.pending).toBe(1);
      expect(summary.uploading).toBe(1);
      expect(summary.uploaded).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.retrying).toBe(0);
    });
  });

  describe("5. Drive Service Books Structure & Cache Specifications", () => {
    test("caching prevents duplicate API calls for existing book folder structure", async () => {
      const service = new GoogleDriveService(null);
      // Service unconfigured will reject ensureBookFolderStructure with configured guard
      await expect(
        service.ensureBookFolderStructure("book_100", "كتاب التوحيد"),
      ).rejects.toThrow("Google Drive is not configured");

      // Verify bookStructureCache is initialized and empty
      expect((service as any).bookStructureCache).toBeDefined();
      expect((service as any).bookStructureCache.size).toBe(0);

      // Manually simulate a cached book structure
      (service as any).bookStructureCache.set("book_100", {
        bookFolderId: "cached_book_folder_id_100",
        webViewLink:
          "https://drive.google.com/drive/folders/cached_book_folder_id_100",
        subfolders: {
          ORIGINAL: "sub_orig_100",
          RAW: "sub_raw_100",
          MONTAGE: "sub_mont_100",
          MASTER: "sub_mast_100",
          FINAL: "sub_fin_100",
          PDF: "sub_pdf_100",
          ARCHIVE: "sub_arch_100",
        },
      });

      // Fast cached retrieval without calling Drive API
      const cachedResult = await service.ensureBookFolderStructure(
        "book_100",
        "كتاب التوحيد",
      );
      expect(cachedResult.bookFolderId).toBe("cached_book_folder_id_100");
      expect(cachedResult.subfolders.RAW).toBe("sub_raw_100");
      expect(cachedResult.subfolders.MASTER).toBe("sub_mast_100");

      // Stage lookup retrieves directly from cached structure
      const stageTarget = await service.getStageFolderForBook(
        "book_100",
        "كتاب التوحيد",
        "mastered",
      );
      expect(stageTarget.folderId).toBe("sub_mast_100");
      expect(stageTarget.stageKey).toBe("MASTER");
      expect(stageTarget.subfolderName).toBe("04-المكساج-والماستر");
    });
  });
});
