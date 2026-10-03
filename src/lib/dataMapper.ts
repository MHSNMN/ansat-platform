import { AudioRecording, Book } from "../types";

export function mapLegacyRecording(
  docData: any,
  books: Book[],
): AudioRecording {
  if (!docData) return {} as AudioRecording;

  const cleanTitle = (t?: string) => (t || "").trim().replace(/\s+/g, " ");
  const docBookTitle = cleanTitle(
    docData.book_title || docData.bookTitle || docData.bookId,
  );
  const matchedBook = (books || []).find(
    (b) =>
      (b && b.id && b.id === docData.bookId) ||
      (b && b.id && b.id === docData.book_id) ||
      (b && cleanTitle(b.title) === docBookTitle) ||
      (docBookTitle &&
        b?.title &&
        cleanTitle(b.title).includes(docBookTitle)) ||
      (docBookTitle && b?.title && docBookTitle.includes(cleanTitle(b.title))),
  );

  // Use matchedBook.title if matched or keep title/id for backward compatibility
  const bookId =
    matchedBook?.title ||
    docData.bookId ||
    docData.book_id ||
    docData.book_title ||
    "unknown";
  const book_title =
    matchedBook?.title || docData.book_title || docData.bookTitle || "";

  // Extract part number safely from part_number, partNumber, or file_name
  let partNumber = Number(docData.part_number ?? docData.partNumber);
  if (isNaN(partNumber) || partNumber === undefined) {
    const match = (docData.file_name || "").match(/Part(\d+)/i);
    partNumber = match ? parseInt(match[1], 10) : 1;
  }

  // Normalize status
  let workflowStatus = docData.workflowStatus;
  if (!workflowStatus) {
    const s = String(docData.status || "").toUpperCase();
    if (s === "MASTERED") workflowStatus = "FINAL_APPROVED";
    else if (s === "RAW") workflowStatus = "RAW_QA_PENDING";
    else if (s === "REVISION" || s === "NEEDS_REVISION")
      workflowStatus = "NARRATOR_REVISION_REQUIRED";
    else if (s === "APPROVED") workflowStatus = "RAW_APPROVED";
    else workflowStatus = "RAW_QA_PENDING";
  }

  // Extract drive IDs
  let rawDriveFileId = docData.rawDriveFileId || docData.drive_file_id || "";
  let masteredDriveFileId =
    docData.masteredDriveFileId || docData.mastered_drive_file_id || "";

  const extractDriveId = (url?: string) => {
    if (!url) return "";
    const m =
      url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : "";
  };

  if (!rawDriveFileId) {
    rawDriveFileId = extractDriveId(
      docData.rawUrl ||
        docData.drive_url ||
        docData.public_link ||
        docData.file_url,
    );
  }
  if (!masteredDriveFileId) {
    masteredDriveFileId = extractDriveId(
      docData.masteredUrl || docData.mastered_file_url,
    );
  }

  const rawUrl =
    docData.rawUrl ||
    docData.file_url ||
    docData.public_link ||
    docData.drive_url ||
    (rawDriveFileId
      ? `https://drive.google.com/file/d/${rawDriveFileId}/view`
      : "");
  const masteredUrl =
    docData.masteredUrl ||
    docData.mastered_file_url ||
    (masteredDriveFileId
      ? `https://drive.google.com/file/d/${masteredDriveFileId}/view`
      : "");

  return {
    id: docData.id,
    bookId,
    partNumber,
    narratorId:
      docData.narratorId ||
      docData.narrator_id ||
      docData.narrator_name ||
      "راوي",
    workflowStatus,
    rawUrl,
    masteredUrl,
    rawDriveFileId,
    masteredDriveFileId,
    durationSeconds:
      docData.durationSeconds ||
      (docData.file_size ? Number(docData.file_size) : 900),
    createdAt:
      docData.createdAt || docData.created_at || new Date().toISOString(),
    updatedAt: docData.updatedAt,

    // Preserve legacy fields for all components that read them
    book_title,
    narrator_name: docData.narrator_name || docData.narratorId || "راوي",
    file_name: docData.file_name || "",
    mastered_file_name: docData.mastered_file_name || "",
    file_size: docData.file_size || "",
    file_url: docData.file_url || rawUrl,
    public_link: docData.public_link || rawUrl,
    drive_url: docData.drive_url || rawUrl,
    drive_file_id: rawDriveFileId,
    drive_folder_id: docData.drive_folder_id || "",
    status:
      docData.status ||
      (workflowStatus === "FINAL_APPROVED" ? "MASTERED" : "RAW"),
    mastered_by: docData.mastered_by || "",
    mastered_file_url: masteredUrl,
    duration: docData.duration || "15:30",
  };
}
