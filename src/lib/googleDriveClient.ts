import { apiFetch } from "./api";
import { setDoc, doc } from "firebase/firestore";
import { db } from "./firebaseClient";

export class GoogleDriveAudioClient {
  async createBookFolder(
    bookTitle: string,
    stage: string = "raw",
  ): Promise<{ id: string; webViewLink?: string } | null> {
    try {
      const response = await apiFetch("/api/create-book-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookTitle, stage }),
      });
      if (!response.ok) throw new Error("Failed to create folder");
      const data = await response.json();
      return { id: data.folderId, webViewLink: data.webViewLink };
    } catch (e) {
      console.error("Error creating book folder:", e);
      return null;
    }
  }

  async moveFile(
    fileId: string,
    bookTitle: string,
    newStage: string,
  ): Promise<boolean> {
    try {
      const response = await apiFetch("/api/move-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, bookTitle, newStage }),
      });
      return response.ok;
    } catch (e) {
      console.error("Error moving file:", e);
      return false;
    }
  }

  async uploadPdfToDrive(
    file: File,
    bookTitle: string,
  ): Promise<{ url: string; id: string } | null> {
    try {
      const initRes = await apiFetch("/api/init-drive-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          bookTitle,
          stage: "pdf",
        }),
      });
      if (!initRes.ok) throw new Error("Failed to init pdf upload");
      const { uploadUrl } = await initRes.json();

      // The resumable session URL already authorizes this upload. Never attach
      // the member's Firebase ID token to a third-party origin.
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Drive upload PUT failed");
      const driveFile = await uploadRes.json();
      const fileId = driveFile.id;

      // Note: Automatic public permission modification (make-drive-file-public) is disabled by security policy

      const url = GoogleDriveAudioClient.convertToDirectStreamUrl(
        `https://drive.google.com/file/d/${fileId}/view`,
      );
      return { url, id: fileId };
    } catch (e) {
      console.error("Error uploading PDF:", e);
      return null;
    }
  }

  async uploadAudioToDriveAndPersist(
    recordingId: string,
    fileName: string,
    mimeType: string,
    file: File,
    bookTitle: string,
  ): Promise<string> {
    try {
      const initRes = await apiFetch("/api/init-drive-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          mimeType,
          fileSize: file.size,
          bookTitle,
          recordingId,
        }),
      });
      if (!initRes.ok) throw new Error("Failed to init drive upload");
      const { uploadUrl } = await initRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Drive upload PUT failed");
      const driveFile = await uploadRes.json();
      const fileId = driveFile.id;

      // Note: Automatic public permission modification (make-drive-file-public) is disabled by security policy

      const publicStreamUrl = GoogleDriveAudioClient.convertToDirectStreamUrl(
        `https://drive.google.com/file/d/${fileId}/view`,
      );

      // Persist public link back to recording document in Firestore (Safe create/merge)
      await setDoc(
        doc(db, "audio_recordings", recordingId),
        {
          id: recordingId,
          rawUrl: publicStreamUrl,
          rawDriveFileId: fileId,
          drive_web_url: `https://drive.google.com/file/d/${fileId}/view`,
        },
        { merge: true },
      );

      console.log(`Successfully uploaded ${fileName} to Drive (${fileId})`);
      return publicStreamUrl;
    } catch (error) {
      console.error("Google Drive Upload & Firestore Persist error:", error);
      throw error;
    }
  }

  static convertToDirectStreamUrl(driveUrl: string): string {
    if (!driveUrl) return "";
    const match =
      driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://docs.google.com/uc?export=download&id=${match[1]}`;
    }
    return driveUrl;
  }

  async deleteFile(fileIdOrUrl: string): Promise<boolean> {
    try {
      let fileId = fileIdOrUrl;
      const match =
        fileIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        fileIdOrUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
        fileIdOrUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        fileId = match[1];
      }

      const response = await apiFetch("/api/delete-drive-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      return response.ok;
    } catch (e) {
      console.error("Error deleting drive file:", e);
      return false;
    }
  }
}

export const driveClient = new GoogleDriveAudioClient();
