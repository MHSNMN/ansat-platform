import { describe, it, expect } from "vitest";
import {
  DRIVE_ROOT_BOOKS_CONTAINER,
  DRIVE_BOOK_SUBFOLDERS,
  sanitizeBookTitle,
  validateUploadInput,
} from "../lib/driveFolderStructure";
import { uploadRegistry } from "../lib/uploadRegistry";

describe("Recording Platform & Drive Hierarchy Tests", () => {
  it("defines the 7-stage Drive folder hierarchy correctly", () => {
    expect(DRIVE_ROOT_BOOKS_CONTAINER).toBe("الكتب");
    expect(DRIVE_BOOK_SUBFOLDERS.ORIGINAL).toBe("01-المواد-الأصلية");
    expect(DRIVE_BOOK_SUBFOLDERS.RAW).toBe("02-التسجيلات-الخام");
    expect(DRIVE_BOOK_SUBFOLDERS.MONTAGE).toBe("03-المونتاج");
    expect(DRIVE_BOOK_SUBFOLDERS.MASTER).toBe("04-المكساج-والماستر");
    expect(DRIVE_BOOK_SUBFOLDERS.FINAL).toBe("05-النسخ-النهائية");
    expect(DRIVE_BOOK_SUBFOLDERS.PDF).toBe("06-PDF-والنصوص");
    expect(DRIVE_BOOK_SUBFOLDERS.ARCHIVE).toBe("07-الأرشيف");
  });

  it("sanitizes book titles removing dangerous characters", () => {
    expect(sanitizeBookTitle("كتاب / رائع : جداً *")).toBe("كتاب-رائع-جداً");
    expect(sanitizeBookTitle(null)).toBe("كتاب-بدون-عنوان");
    expect(sanitizeBookTitle("")).toBe("كتاب-بدون-عنوان");
  });

  it("validates upload input rejecting invalid payloads", () => {
    // Missing fileName
    const res1 = validateUploadInput({
      fileName: "",
      bookId: "book_1",
      bookTitle: "كتاب",
    });
    expect(res1.valid).toBe(false);

    // Invalid path characters in fileName
    const res2 = validateUploadInput({
      fileName: "test/file.mp3",
      bookId: "book_1",
      bookTitle: "كتاب",
    });
    expect(res2.valid).toBe(false);

    // Valid upload input
    const res3 = validateUploadInput({
      fileName: "valid_recording.mp3",
      bookId: "valid_book_id",
      bookTitle: "كتاب تجريبي",
      fileSize: 1024,
    });
    expect(res3.valid).toBe(true);
  });

  it("manages concurrency locks in uploadRegistry preventing duplicate uploads", () => {
    const testRecId = `rec_test_${Date.now()}`;
    const acquiredFirst = uploadRegistry.acquireLock(testRecId);
    expect(acquiredFirst).toBe(true);

    // Second lock attempt for same recording must be rejected
    const acquiredSecond = uploadRegistry.acquireLock(testRecId);
    expect(acquiredSecond).toBe(false);

    // Release lock
    uploadRegistry.releaseLock(testRecId);
    const acquiredAfterRelease = uploadRegistry.acquireLock(testRecId);
    expect(acquiredAfterRelease).toBe(true);
    uploadRegistry.releaseLock(testRecId);
  });
});
