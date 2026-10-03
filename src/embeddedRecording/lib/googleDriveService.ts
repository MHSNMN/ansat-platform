import { google } from "googleapis";
import fs from "fs";
import path from "path";
import {
  DRIVE_ROOT_BOOKS_CONTAINER,
  DRIVE_BOOK_SUBFOLDERS,
  ENSAT_OFFICIAL_DRIVE_FOLDERS,
  DriveSubfolderKey,
  formatBookFolderName,
  sanitizeBookTitle,
  resolveStageFolder,
} from "./driveFolderStructure";

export const TARGET_DRIVE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
  ENSAT_OFFICIAL_DRIVE_FOLDERS.RAW_RECORDINGS;

export const STAGE_FOLDERS: Record<string, string> = {
  raw: ENSAT_OFFICIAL_DRIVE_FOLDERS.RAW_RECORDINGS,
  qa_approved: ENSAT_OFFICIAL_DRIVE_FOLDERS.FINAL_RELEASES,
  qa_rejected: ENSAT_OFFICIAL_DRIVE_FOLDERS.REDO_REQUESTED,
  engineered: ENSAT_OFFICIAL_DRIVE_FOLDERS.AUDIO_ENGINEERING,
  final: ENSAT_OFFICIAL_DRIVE_FOLDERS.FINAL_RELEASES,
  pdf: ENSAT_OFFICIAL_DRIVE_FOLDERS.CONTENT_AND_TEXTS,
  books: ENSAT_OFFICIAL_DRIVE_FOLDERS.APPROVED_BOOKS,
  media: ENSAT_OFFICIAL_DRIVE_FOLDERS.DESIGN_AND_MEDIA,
  meet: ENSAT_OFFICIAL_DRIVE_FOLDERS.MEET_RECORDINGS,
};

export class GoogleDriveService {
  private drive: any = null;
  public authType: "oauth" | "service_account" | "none" = "none";
  private bookStructureCache: Map<
    string,
    {
      bookFolderId: string;
      subfolders: Record<DriveSubfolderKey, string>;
      webViewLink?: string;
    }
  > = new Map();

  constructor(
    customConfig?: {
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      GOOGLE_REFRESH_TOKEN?: string;
    } | null,
  ) {
    this.initDrive(customConfig);
  }

  clearStructureCache() {
    this.bookStructureCache.clear();
  }

  isConfigured(): boolean {
    return Boolean(this.drive && this.drive.files && this.authType !== "none");
  }

  requireDriveClient() {
    if (!this.isConfigured()) {
      throw new Error("Google Drive is not configured");
    }
    return this.drive;
  }

  getDriveClient(userAccessToken?: string) {
    if (userAccessToken) {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: userAccessToken });
      return google.drive({ version: "v3", auth: oauth2Client });
    }
    return this.requireDriveClient();
  }

  async getAuthToken(overrideAccessToken?: string): Promise<string> {
    if (overrideAccessToken) return overrideAccessToken;
    if (this.drive) {
      const auth = (this.drive as any)?.context?._options?.auth;
      if (auth) {
        if (typeof auth.getAccessToken === "function") {
          const res = await auth.getAccessToken();
          if (res?.token) return res.token;
          if (typeof res === "string") return res;
        }
        if (typeof auth.getRequestHeaders === "function") {
          const headers = await auth.getRequestHeaders();
          if (headers?.Authorization?.startsWith("Bearer ")) {
            return headers.Authorization.substring(7);
          }
        }
      }
    }
    throw new Error("Google Drive is not configured or authenticated");
  }

  initDrive(
    customConfig?: {
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      GOOGLE_REFRESH_TOKEN?: string;
    } | null,
  ) {
    try {
      if (customConfig === null) {
        this.drive = null;
        this.authType = "none";
        return;
      }

      const isExplicitOverride = customConfig !== undefined;
      const clientId = isExplicitOverride
        ? customConfig?.GOOGLE_CLIENT_ID
        : process.env.GOOGLE_CLIENT_ID;
      const clientSecret = isExplicitOverride
        ? customConfig?.GOOGLE_CLIENT_SECRET
        : process.env.GOOGLE_CLIENT_SECRET;
      const refreshToken = isExplicitOverride
        ? customConfig?.GOOGLE_REFRESH_TOKEN
        : process.env.GOOGLE_REFRESH_TOKEN;

      if (clientId && clientSecret && refreshToken) {
        console.log(
          "ℹ️ [Google Drive Startup] Authenticating via Server Environment OAuth Refresh Token...",
        );
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });
        this.drive = google.drive({ version: "v3", auth: oauth2Client });
        this.authType = "oauth";
        return;
      }

      // Check for Service Account if OAuth is not configured
      const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      let saKey = process.env.GOOGLE_PRIVATE_KEY;
      if (saKey) {
        saKey = saKey.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
      }

      if (saEmail && saKey) {
        console.log(
          "ℹ️ [Google Drive Startup] Authenticating via Server Environment Service Account Credentials...",
        );
        const jwtClient = new google.auth.JWT({
          email: saEmail,
          key: saKey,
          scopes: [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/drive.file",
          ],
        });
        this.drive = google.drive({ version: "v3", auth: jwtClient });
        this.authType = "service_account";
        return;
      }

      const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
      if (keyPath && fs.existsSync(keyPath)) {
        console.log(
          "ℹ️ [Google Drive Startup] Authenticating via Server Environment Service Account File...",
        );
        const auth = new google.auth.GoogleAuth({
          keyFile: keyPath,
          scopes: ["https://www.googleapis.com/auth/drive"],
        });
        this.drive = google.drive({ version: "v3", auth });
        this.authType = "service_account";
        return;
      }

      console.warn(
        "⚠️ [Google Drive Startup] Service is not configured. Server environment credentials missing.",
      );
      this.drive = null;
      this.authType = "none";
    } catch (err: any) {
      console.error("Failed to init Drive Auth:", err?.message || err);
      this.drive = null;
      this.authType = "none";
    }
  }

  async getStorageQuota() {
    if (!this.isConfigured()) return null;
    try {
      const res = await this.drive.about.get({ fields: "storageQuota" });
      return res.data.storageQuota;
    } catch (e: any) {
      console.error("Error getting storage quota:", e?.message || e);
      return null;
    }
  }

  async listFolders() {
    if (!this.isConfigured()) return [];
    try {
      const res = await this.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: "files(id, name)",
        pageSize: 100,
      });
      return res.data.files || [];
    } catch (e: any) {
      console.error("Error listing folders:", e?.message || e);
      return [];
    }
  }

  async listFiles(folderId?: string) {
    if (!this.isConfigured()) return [];
    try {
      const query = folderId
        ? `'${folderId}' in parents and trashed=false`
        : "trashed=false and mimeType != 'application/vnd.google-apps.folder'";
      const res = await this.drive.files.list({
        q: query,
        fields: "files(id, name, size, mimeType, createdTime, webViewLink)",
        orderBy: "createdTime desc",
        pageSize: 100,
      });
      return res.data.files || [];
    } catch (e: any) {
      console.error("Error listing files:", e?.message || e);
      return [];
    }
  }

  async ensureBooksContainerFolder(
    parentFolderId: string = TARGET_DRIVE_FOLDER_ID,
  ): Promise<{ id: string; webViewLink?: string }> {
    const drive = this.requireDriveClient();
    try {
      const searchRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${DRIVE_ROOT_BOOKS_CONTAINER}' and '${parentFolderId}' in parents and trashed=false`,
        fields: "files(id, name, webViewLink)",
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        return {
          id: searchRes.data.files[0].id!,
          webViewLink: searchRes.data.files[0].webViewLink || undefined,
        };
      }
      const folderRes = await drive.files.create({
        requestBody: {
          name: DRIVE_ROOT_BOOKS_CONTAINER,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        },
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });
      return {
        id: folderRes.data.id!,
        webViewLink: folderRes.data.webViewLink || undefined,
      };
    } catch (error: any) {
      if (error?.message === "Google Drive is not configured") throw error;
      console.error("Error ensuring books container folder:", error);
      throw error;
    }
  }

  async ensureBookFolderStructure(
    bookId: string,
    bookTitle: string,
    parentFolderId: string = TARGET_DRIVE_FOLDER_ID,
  ): Promise<{
    bookFolderId: string;
    subfolders: Record<DriveSubfolderKey, string>;
    webViewLink?: string;
  }> {
    // Check in-memory cache first
    const cached = this.bookStructureCache.get(bookId);
    if (cached) {
      return cached;
    }

    const drive = this.requireDriveClient();

    // 1. Ensure the parent "الكتب" container folder exists
    const booksContainer =
      await this.ensureBooksContainerFolder(parentFolderId);

    // 2. Folder name: {bookId}-{bookTitleSafe}
    const folderName = formatBookFolderName(bookId, bookTitle);
    const escapedFolderName = folderName.replace(/'/g, "\\'");

    let bookFolderId: string = "";
    let webViewLink: string | undefined;

    // Search strictly within the books parent container
    const searchRes = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${escapedFolderName}' and '${booksContainer.id}' in parents and trashed=false`,
      fields: "files(id, name, webViewLink)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      bookFolderId = searchRes.data.files[0].id!;
      webViewLink = searchRes.data.files[0].webViewLink || undefined;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [booksContainer.id],
        },
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });
      bookFolderId = createRes.data.id!;
      webViewLink = createRes.data.webViewLink || undefined;
    }

    // 3. Ensure the 7 standard subfolders exist inside {bookId}-{bookTitleSafe}
    const subfolders: Record<DriveSubfolderKey, string> = {} as any;

    const subListRes = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and '${bookFolderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const existingSubfoldersMap = new Map<string, string>();
    if (subListRes.data.files) {
      for (const f of subListRes.data.files) {
        if (f.name && f.id) {
          existingSubfoldersMap.set(f.name, f.id);
        }
      }
    }

    // For each of the 7 stages, create if not present
    for (const [key, subfolderName] of Object.entries(DRIVE_BOOK_SUBFOLDERS)) {
      const stageKey = key as DriveSubfolderKey;
      if (existingSubfoldersMap.has(subfolderName)) {
        subfolders[stageKey] = existingSubfoldersMap.get(subfolderName)!;
      } else {
        const createSubRes = await drive.files.create({
          requestBody: {
            name: subfolderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [bookFolderId],
          },
          fields: "id",
          supportsAllDrives: true,
        });
        subfolders[stageKey] = createSubRes.data.id!;
      }
    }

    const structure = {
      bookFolderId,
      subfolders,
      webViewLink,
    };

    this.bookStructureCache.set(bookId, structure);
    return structure;
  }

  async getStageFolderForBook(
    bookId: string,
    bookTitle: string,
    stageOrStatus?: string,
    parentFolderId: string = TARGET_DRIVE_FOLDER_ID,
  ): Promise<{
    folderId: string;
    subfolderName: string;
    stageKey: DriveSubfolderKey;
  }> {
    const stageInfo = resolveStageFolder(stageOrStatus);
    const structure = await this.ensureBookFolderStructure(
      bookId,
      bookTitle,
      parentFolderId,
    );
    return {
      folderId: structure.subfolders[stageInfo.stageKey],
      subfolderName: stageInfo.subfolderName,
      stageKey: stageInfo.stageKey,
    };
  }

  async archiveBookRecording(
    fileId: string,
    bookId: string,
    bookTitle: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const stageFolder = await this.getStageFolderForBook(
        bookId,
        bookTitle,
        "archive",
      );
      return await this.moveFile(fileId, stageFolder.folderId);
    } catch (error) {
      console.error("Error archiving recording:", error);
      return false;
    }
  }

  async ensureBookInAllStages(
    bookTitle: string,
  ): Promise<Record<string, string>> {
    if (!this.isConfigured()) {
      throw new Error("Google Drive is not configured");
    }
    const stageFolderIds: Record<string, string> = {};
    const stages = ["raw", "qa_approved", "qa_rejected", "engineered", "final"];
    await Promise.all(
      stages.map(async (stage) => {
        const parentId = STAGE_FOLDERS[stage];
        if (parentId) {
          const res = await this.ensureBookFolder(bookTitle, parentId);
          stageFolderIds[stage] = res.id;
        }
      }),
    );
    return stageFolderIds;
  }

  async ensureBookFolder(
    bookTitle: string,
    parentFolderId: string = TARGET_DRIVE_FOLDER_ID,
    bookId?: string,
  ): Promise<{ id: string; webViewLink?: string }> {
    const drive = this.requireDriveClient();
    try {
      if (bookId) {
        const structure = await this.ensureBookFolderStructure(
          bookId,
          bookTitle,
          parentFolderId,
        );
        return {
          id: structure.bookFolderId,
          webViewLink: structure.webViewLink,
        };
      }

      const searchRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${bookTitle.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed=false`,
        fields: "files(id, name, webViewLink)",
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        return {
          id: searchRes.data.files[0].id!,
          webViewLink: searchRes.data.files[0].webViewLink || undefined,
        };
      } else {
        const folderRes = await drive.files.create({
          requestBody: {
            name: bookTitle,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentFolderId],
          },
          fields: "id, webViewLink",
          supportsAllDrives: true,
        });
        return {
          id: folderRes.data.id!,
          webViewLink: folderRes.data.webViewLink || undefined,
        };
      }
    } catch (error: any) {
      if (error?.message === "Google Drive is not configured") {
        throw error;
      }
      console.error("Error ensuring book folder:", error);
      throw error;
    }
  }

  async moveRecordingToStage(
    fileId: string,
    bookTitle: string,
    newStage: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const parentFolderId = STAGE_FOLDERS[newStage];
      if (!parentFolderId) throw new Error("Invalid stage");
      const bookFolder = await this.ensureBookFolder(bookTitle, parentFolderId);
      return await this.moveFile(fileId, bookFolder.id);
    } catch (error) {
      console.error("Error moving recording to stage:", error);
      return false;
    }
  }

  async moveFile(fileId: string, newParentId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const drive = this.requireDriveClient();
      const file = await drive.files.get({
        fileId,
        fields: "parents",
        supportsAllDrives: true,
      });
      const previousParents = file.data.parents?.join(",") || "";
      await drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: "id, parents",
        supportsAllDrives: true,
      });
      return true;
    } catch (error) {
      console.error("Error moving file:", error);
      return false;
    }
  }

  /**
   * Permissions Policy Guard:
   * Automatic publishing of files to 'anyone' with reader role is strictly disabled
   * until an explicit organization access and permissions policy is approved.
   * This prevents unintended public exposure of recordings and book assets.
   */
  async makeFilePublic(fileId: string): Promise<boolean> {
    console.warn(
      `[Drive Permissions Guard] makeFilePublic blocked for file ${fileId}. Public sharing to 'anyone' is disabled by policy.`,
    );
    return false;
  }

  async processBackgroundUpload(
    filePath: string,
    fileName: string,
    mimeType: string,
    bookTitle: string,
    stage: string,
    recId: string,
    customDriveFolderId?: string,
    bookId?: string,
  ) {
    if (!this.isConfigured()) {
      throw new Error("Google Drive is not configured");
    }

    const drive = this.requireDriveClient();
    let attempts = 0;
    const maxAttempts = 2;
    let success = false;
    let result = null;
    let lastError: any = null;

    let targetParentId = customDriveFolderId;
    let stageKey = "RAW_QA_PENDING";
    let subfolderName: string = DRIVE_BOOK_SUBFOLDERS.RAW;

    while (attempts < maxAttempts && !success) {
      try {
        attempts++;

        if (!targetParentId) {
          const effectiveBookId =
            bookId || "book_" + sanitizeBookTitle(bookTitle);
          const stageTarget = await this.getStageFolderForBook(
            effectiveBookId,
            bookTitle,
            stage,
          );
          targetParentId = stageTarget.folderId;
          stageKey = stageTarget.stageKey;
          subfolderName = stageTarget.subfolderName;
        }

        if (!fs.existsSync(filePath)) {
          throw new Error("Audio file not found at " + filePath);
        }

        const stream = fs.createReadStream(filePath);
        const driveRes = await drive.files.create({
          requestBody: { name: fileName, parents: [targetParentId] },
          media: { mimeType: mimeType || "audio/webm", body: stream },
          fields: "id, webViewLink",
          supportsAllDrives: true,
        });

        const fileId = driveRes.data.id;
        if (fileId) {
          const publicStreamUrl =
            "https://docs.google.com/uc?export=download&id=" + fileId;
          success = true;
          result = {
            fileId,
            folderId: targetParentId,
            webViewLink: driveRes.data.webViewLink,
            publicStreamUrl,
            stage: stageKey,
            subfolderName,
          };
        }
      } catch (error: any) {
        lastError = error;
        const errMsg = error?.message || "";
        if (errMsg === "Google Drive is not configured") {
          // Do not retry on unconfigured error, stop immediately!
          break;
        }
        if (
          errMsg.includes("storage quota") ||
          errMsg.includes("quota") ||
          errMsg.includes("insufficientFilePermissions")
        ) {
          console.warn(
            "Drive service account quota restriction encountered:",
            errMsg,
          );
          break;
        }
        if (attempts >= maxAttempts) break;
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    if (!success) {
      throw lastError || new Error("Drive upload failed");
    }
    return result;
  }

  async uploadPdfToDrive(
    filePath: string,
    fileName: string,
    bookTitle: string,
    bookId?: string,
  ): Promise<{ url: string; id: string; folderId?: string } | null> {
    if (!this.isConfigured()) return null;
    try {
      const drive = this.requireDriveClient();
      const effectiveBookId = bookId || "book_" + sanitizeBookTitle(bookTitle);
      const stageTarget = await this.getStageFolderForBook(
        effectiveBookId,
        bookTitle,
        "pdf",
      );
      const stream = fs.createReadStream(filePath);

      const driveRes = await drive.files.create({
        requestBody: { name: fileName, parents: [stageTarget.folderId] },
        media: { mimeType: "application/pdf", body: stream },
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });

      const fileId = driveRes.data.id;
      if (fileId) {
        return {
          url: driveRes.data.webViewLink || "",
          id: fileId,
          folderId: stageTarget.folderId,
        };
      }
      return null;
    } catch (error) {
      console.error("PDF Upload failed:", error);
      return null;
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  async getOrCreateArchiveFolder(
    parentFolderId: string = TARGET_DRIVE_FOLDER_ID,
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const drive = this.requireDriveClient();
    const folderName = "الأرشيف الدائم - Permanent Archive";
    try {
      const searchRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed=false`,
        fields: "files(id, name)",
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        return searchRes.data.files[0].id!;
      }
      const folderRes = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        },
        fields: "id",
        supportsAllDrives: true,
      });
      return folderRes.data.id || null;
    } catch (error) {
      console.warn("Could not create or get archive folder:", error);
      return null;
    }
  }

  async archiveFile(fileId: string, parentFolderId?: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const drive = this.requireDriveClient();
      const archiveFolderId = await this.getOrCreateArchiveFolder(
        parentFolderId || TARGET_DRIVE_FOLDER_ID,
      );
      if (!archiveFolderId) {
        return false;
      }
      const fileRes = await drive.files.get({
        fileId,
        fields: "parents",
        supportsAllDrives: true,
      });
      const currentParents = (fileRes.data.parents || []).join(",");
      await drive.files.update({
        fileId,
        addParents: archiveFolderId,
        removeParents: currentParents,
        supportsAllDrives: true,
      });
      return true;
    } catch (e) {
      console.error("Failed to archive file to permanent archive folder:", e);
      return false;
    }
  }

  async deleteBookFolders(bookTitle: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const drive = this.requireDriveClient();
      let allDeleted = true;
      for (const parentId of Object.values(STAGE_FOLDERS)) {
        if (!parentId) continue;
        try {
          const searchRes = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${bookTitle.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
            fields: "files(id)",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
          if (searchRes.data.files) {
            for (const folder of searchRes.data.files) {
              // Move to permanent Archive folder instead of moving to trash bin (trashed: true)
              const archiveFolderId =
                await this.getOrCreateArchiveFolder(parentId);
              if (archiveFolderId) {
                await drive.files.update({
                  fileId: folder.id!,
                  addParents: archiveFolderId,
                  removeParents: parentId,
                  supportsAllDrives: true,
                });
              } else {
                // Fallback only if archive folder is unreachable
                await drive.files.update({
                  fileId: folder.id!,
                  requestBody: { trashed: true },
                  supportsAllDrives: true,
                });
              }
            }
          }
        } catch (e) {
          allDeleted = false;
        }
      }
      return allDeleted;
    } catch (e) {
      return false;
    }
  }

  async renameFile(fileId: string, newName: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const drive = this.requireDriveClient();
      await drive.files.update({
        fileId,
        requestBody: { name: newName },
        supportsAllDrives: true,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async downloadAudioToStream(
    fileId: string,
    res: any,
    req: any,
    customFileName?: string,
    isDownload = false,
  ) {
    const resolveAudioMimeType = (
      fileName?: string,
      mimeType?: string,
    ): string => {
      if (mimeType) {
        const lower = mimeType.toLowerCase();
        if (lower === "audio/aac-adts" || lower === "audio/aac")
          return "audio/aac";
        if (lower.startsWith("audio/")) return mimeType;
      }
      const name = (fileName || "").toLowerCase();
      if (name.endsWith(".webm")) return "audio/webm";
      if (name.endsWith(".m4a") || name.endsWith(".mp4")) return "audio/mp4";
      if (name.endsWith(".wav")) return "audio/wav";
      if (name.endsWith(".ogg")) return "audio/ogg";
      if (name.endsWith(".aac")) return "audio/aac";
      if (name.endsWith(".mp3")) return "audio/mpeg";
      return "audio/mpeg";
    };

    const dispositionType = isDownload ? "attachment" : "inline";

    const getHeader = (headers: any, name: string): string | undefined => {
      if (!headers) return undefined;
      if (typeof headers.get === "function") {
        const val = headers.get(name);
        if (val) return String(val);
      }
      return headers[name] || headers[name.toLowerCase()] || undefined;
    };

    // 1. Check local files in uploads/recordings first
    try {
      const recordingsDir = path.join(process.cwd(), "uploads", "recordings");
      if (fs.existsSync(recordingsDir)) {
        const files = fs.readdirSync(recordingsDir);
        const matched = files.find((f) => f.includes(fileId));
        if (matched) {
          const filePath = path.join(recordingsDir, matched);
          const stat = fs.statSync(filePath);
          const fileName = customFileName || matched;
          const mimeType = resolveAudioMimeType(
            fileName,
            matched.endsWith(".wav") ? "audio/wav" : undefined,
          );
          const range = req?.headers?.range;

          res.setHeader("Content-Type", mimeType);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Range, Accept-Ranges, Content-Range, Content-Type",
          );
          res.setHeader(
            "Access-Control-Expose-Headers",
            "Content-Range, Content-Length, Accept-Ranges",
          );
          res.setHeader(
            "Content-Disposition",
            `${dispositionType}; filename="${encodeURIComponent(fileName)}"`,
          );

          if (req?.method === "HEAD") {
            res.setHeader("Content-Length", stat.size);
            return res.status(200).end();
          }

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = end - start + 1;
            res.status(206);
            res.setHeader(
              "Content-Range",
              `bytes ${start}-${end}/${stat.size}`,
            );
            res.setHeader("Content-Length", chunksize);
            return fs.createReadStream(filePath, { start, end }).pipe(res);
          } else {
            res.setHeader("Content-Length", stat.size);
            return fs.createReadStream(filePath).pipe(res);
          }
        }
      }
    } catch {
      // continue to Drive check
    }

    // 2. If Google Drive is configured, stream via Authenticated Google Drive API first
    if (this.isConfigured()) {
      try {
        const drive = this.requireDriveClient();
        const fileMeta = await drive.files.get({
          fileId,
          fields: "size, mimeType, name",
          supportsAllDrives: true,
        });
        const fileSize = Number(fileMeta.data.size) || 0;
        const fileName = customFileName || fileMeta.data.name || "audio.mp3";
        const mimeType = resolveAudioMimeType(
          fileName,
          fileMeta.data.mimeType || undefined,
        );
        const range = req?.headers?.range;

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Range, Accept-Ranges, Content-Range, Content-Type",
        );
        res.setHeader(
          "Access-Control-Expose-Headers",
          "Content-Range, Content-Length, Accept-Ranges",
        );
        res.setHeader(
          "Content-Disposition",
          `${dispositionType}; filename="${encodeURIComponent(fileName)}"`,
        );

        if (req?.method === "HEAD") {
          if (fileSize > 0) res.setHeader("Content-Length", fileSize);
          return res.status(200).end();
        }

        const requestHeaders: Record<string, string> = {};
        if (range) {
          requestHeaders["Range"] = range;
        }

        const driveResponse: any = await drive.files.get(
          { fileId, alt: "media", supportsAllDrives: true },
          { headers: requestHeaders, responseType: "stream" },
        );

        const crHeader = getHeader(driveResponse.headers, "content-range");
        const clHeader = getHeader(driveResponse.headers, "content-length");

        if (driveResponse.status === 206 || range) {
          res.status(206);
          if (crHeader) {
            res.setHeader("Content-Range", crHeader);
          } else if (fileSize > 0 && range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10) || 0;
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
            res.setHeader("Content-Length", end - start + 1);
          }
          if (clHeader) {
            res.setHeader("Content-Length", clHeader);
          }
        } else {
          res.status(200);
          if (fileSize > 0) res.setHeader("Content-Length", fileSize);
        }

        driveResponse.data.pipe(res);
        return;
      } catch (err: any) {
        console.warn(
          `[Drive Service] Authenticated stream error for ${fileId}:`,
          err?.message || err,
        );
        // Fall back to public stream
      }
    }

    // 3. Fallback: Try server-side streaming proxy with Range header support
    try {
      const streamed = await this.streamGoogleDriveAudio(
        fileId,
        res,
        req,
        customFileName,
        isDownload,
      );
      if (streamed) return;
    } catch {
      // continue to fallback
    }

    if (!res.headersSent) {
      return res.redirect(
        302,
        `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
      );
    }
  }

  async streamGoogleDriveAudio(
    fileId: string,
    res: any,
    req: any,
    customFileName?: string,
    isDownload = false,
  ): Promise<boolean> {
    const rangeHeader = req?.headers?.range;
    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) {
      fetchHeaders["range"] = rangeHeader;
    }

    try {
      const publicUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;
      const proxyRes = await fetch(publicUrl, { headers: fetchHeaders });

      if (proxyRes.ok || proxyRes.status === 206) {
        const rawType = proxyRes.headers.get("content-type") || "";
        // If Google returned an HTML page (error/virus scan), reject public proxy so fallback happens
        if (
          rawType.includes("text/html") ||
          rawType.includes("application/json")
        ) {
          return false;
        }

        const name = (customFileName || "").toLowerCase();
        let mimeType = rawType;
        if (name.endsWith(".webm")) mimeType = "audio/webm";
        else if (name.endsWith(".m4a") || name.endsWith(".mp4"))
          mimeType = "audio/mp4";
        else if (name.endsWith(".wav")) mimeType = "audio/wav";
        else if (name.endsWith(".ogg")) mimeType = "audio/ogg";
        else if (name.endsWith(".aac")) mimeType = "audio/aac";
        else if (name.endsWith(".mp3")) mimeType = "audio/mpeg";
        else if (
          !mimeType ||
          mimeType.includes("octet-stream") ||
          mimeType.includes("binary")
        )
          mimeType = "audio/mpeg";

        const contentLength = proxyRes.headers.get("content-length");
        const contentRange = proxyRes.headers.get("content-range");
        const acceptRanges = proxyRes.headers.get("accept-ranges") || "bytes";
        const dispositionType = isDownload ? "attachment" : "inline";

        res.status(proxyRes.status);
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Accept-Ranges", acceptRanges);
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (contentLength) res.setHeader("Content-Length", contentLength);
        if (contentRange) res.setHeader("Content-Range", contentRange);
        if (customFileName) {
          res.setHeader(
            "Content-Disposition",
            `${dispositionType}; filename="${encodeURIComponent(customFileName)}"`,
          );
        }

        const { Readable } = await import("stream");
        if (proxyRes.body) {
          Readable.fromWeb(proxyRes.body as any).pipe(res);
          return true;
        }
      }
    } catch (err) {
      console.warn(`[Drive Service] Proxy fetch error for ${fileId}:`, err);
    }
    return false;
  }

  async streamFile(fileId: string, req: any, res: any) {
    return this.downloadAudioToStream(fileId, res, req, undefined, false);
  }

  async downloadFile(
    fileId: string,
    customFileName: string,
    req: any,
    res: any,
  ) {
    return this.downloadAudioToStream(fileId, res, req, customFileName, true);
  }

  async deleteFile(fileId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const drive = this.requireDriveClient();
      await drive.files.delete({ fileId, supportsAllDrives: true });
      return true;
    } catch (e) {
      console.error("Failed to delete file:", e);
      return false;
    }
  }

  async uploadRecordingToDrive(
    filePath: string,
    fileName: string,
    mimeType: string,
    folderId: string,
  ) {
    const drive = this.requireDriveClient();
    try {
      const stream = fs.createReadStream(filePath);
      const res = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType, body: stream },
        fields: "id, webViewLink",
        supportsAllDrives: true,
      });
      if (res.data.id) await this.makeFilePublic(res.data.id);
      return {
        fileId: res.data.id,
        webViewLink: res.data.webViewLink,
        publicStreamUrl:
          "https://docs.google.com/uc?export=download&id=" + res.data.id,
      };
    } catch (e) {
      console.error("Upload error:", e);
      throw e;
    }
  }

  async uploadAudioBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string,
  ): Promise<{ fileId: string; webViewLink?: string }> {
    if (!this.isConfigured()) {
      throw new Error("Google Drive is not configured");
    }
    const drive = this.requireDriveClient();
    const { Readable } = await import("stream");
    const stream = Readable.from(buffer);
    const driveRes = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: mimeType || "audio/mpeg", body: stream },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });
    const fileId = driveRes.data.id;
    if (!fileId) {
      throw new Error("Failed to get file ID from Google Drive");
    }
    return {
      fileId,
      webViewLink:
        driveRes.data.webViewLink ||
        `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  async initiateResumableUpload(
    fileName: string,
    mimeType: string,
    folderId: string,
    fileSize?: number,
    userAccessToken?: string,
  ): Promise<string> {
    const token = await this.getAuthToken(userAccessToken);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType || "audio/mpeg",
    };
    if (fileSize && fileSize > 0) {
      headers["X-Upload-Content-Length"] = String(fileSize);
    }

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: fileName,
          parents: [folderId],
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        "Failed to initiate Drive resumable upload:",
        res.status,
        errText,
      );
      throw new Error(`Google Drive API error (${res.status}): ${errText}`);
    }

    const locationUrl = res.headers.get("location");
    if (!locationUrl) {
      throw new Error(
        "Google Drive did not return a resumable upload Location URL",
      );
    }
    return locationUrl;
  }
}
export const driveService = new GoogleDriveService();

// Global hook for server.ts and background sync
(global as any).refreshDriveService = (config: any) => {
  driveService.initDrive(config);
};
