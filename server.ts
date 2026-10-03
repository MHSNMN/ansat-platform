// Loads local .env only in local/hosted Node processes; Vite loads VITE_* values for the client build.
import "dotenv/config";
import { driveWorker } from "./src/server/driveWorker";
/* eslint-disable no-var */
declare global {
  var refreshDriveService: ((config: any) => void) | undefined;
}
import express from "express";
import helmet from "helmet";
import multer from "multer";
import { adminRouter } from "./src/server/adminRoutes";
import { publicRouter } from "./src/server/publicRoutes";
import { authRouter, scrubLegacyCredentialsFromUsers } from "./src/server/authRoutes";
import { tasksRouter } from "./src/server/tasks/tasksRouter";
import { rewardsRouter } from "./src/server/rewards/rewardsRouter";
import { certificateRouter } from "./src/server/certificateRoutes";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  driveService,
  TARGET_DRIVE_FOLDER_ID,
  STAGE_FOLDERS,
} from "./src/lib/googleDriveService";
import { validateUploadInput } from "./src/lib/driveFolderStructure";
import { uploadRegistry, UploadRecord } from "./src/lib/uploadRegistry";
import {
  authenticateRequest,
  requireRbacAction,
} from "./src/server/authMiddleware";
import { isActionAllowed } from "./src/lib/rbacPolicy";
import { recordingRouter } from "./src/server/recording/recordingRouter";
import { getFirebaseAdminFirestore, checkFirestoreHealth } from "./src/server/firebaseAdmin";
import { getSupabaseAdminClient } from "./src/server/supabaseAdmin";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = Number(process.env.PORT) || 3000;

  app.disable("x-powered-by");
  app.use(
    helmet({
      // Keep the existing third-party integrations working while preventing
      // authenticated pages from being framed by an untrusted origin.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          mediaSrc: ["'self'", "blob:", "https:"],
          connectSrc: ["'self'", "https:", "wss:"],
          workerSrc: ["'self'", "blob:"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
      frameguard: { action: "sameorigin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  // These endpoints are intentionally public and are rate-limited inside their router.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", workflowStatus: "ok" });
  });

  // Safe Status endpoints for Drive
  app.get(["/api/drive/status", "/api/drive/workflowStatus"], (req, res) => {
    const configured = driveService.isConfigured();
    const driveToken = (req.headers["x-drive-access-token"] as string | undefined)?.trim();
    const isReady = configured || Boolean(driveToken);
    res.json({
      success: true,
      configured: isReady,
      authMode: driveToken ? "user_oauth" : driveService.authType,
      message: isReady
        ? "Google Drive متصل وجاهز لتخزين واسترجاع الملفات."
        : "Google Drive غير مهيأ. يرجى تسجيل الدخول بحساب Google.",
    });
  });

  // Only published public-library files may be streamed without a member token.
  const authorizeAudioFile = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const fileId = req.params.fileId;
    if (!/^[A-Za-z0-9_-]{8,160}$/.test(fileId)) return res.status(400).json({ error: "Invalid file ID" });
    const sb = getSupabaseAdminClient();
    if (sb) {
      const { data, error } = await sb.from("public_library").select("id").eq("drive_file_id", fileId).eq("status", "PUBLISHED").eq("is_archived", false).limit(1);
      if (!error && data?.length) return next();
    }
    return authenticateRequest(req, res, () => {
      if (!req.user || !isActionAllowed(req.user, "view_internal_recordings")) return res.status(403).json({ error: "Forbidden" });
      next();
    });
  };
  app.get("/api/audio/:fileId", authorizeAudioFile, async (req, res) => {
    try {
      const fileId = req.params.fileId;
      await driveService.streamFile(fileId, req, res);
    } catch (error) {
      if (!res.headersSent)
        res.status(500).json({ error: "Failed to stream file" });
    }
  });

  app.head("/api/audio/:fileId", authorizeAudioFile, async (req, res) => {
    try {
      const fileId = req.params.fileId;
      await driveService.streamFile(fileId, req, res);
    } catch {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        res.status(404).end();
      }
    }
  });

  app.get("/api/audio/download/:fileId", authorizeAudioFile, async (req, res) => {
    try {
      const fileId = req.params.fileId;
      const filename = (req.query.filename as string) || "audio_recording.mp3";
      await driveService.downloadFile(fileId, filename, req, res);
    } catch (error) {
      if (!res.headersSent)
        res.status(500).json({ error: "Failed to download file" });
    }
  });

  const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
  const PUBLIC_RECORDINGS_DIR = path.join(UPLOADS_ROOT, "recordings");
  const PUBLIC_IMAGES_DIR = path.join(UPLOADS_ROOT, "images");
  if (!fs.existsSync(PUBLIC_RECORDINGS_DIR)) fs.mkdirSync(PUBLIC_RECORDINGS_DIR, { recursive: true });
  if (!fs.existsSync(PUBLIC_IMAGES_DIR)) fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });

  app.use("/uploads/images", express.static(PUBLIC_IMAGES_DIR));
  app.use("/uploads/recordings", authenticateRequest, requireRbacAction("access_recording_platform"), express.static(PUBLIC_RECORDINGS_DIR));

  const publicAudioAuthorizationCache = new Map<string, number>();
  const isPublishedLocalAudio = async (safeName: string): Promise<boolean> => {
    if (!/^public_library_[A-Za-z0-9_.-]{8,180}$/.test(safeName)) return false;
    const cachedUntil = publicAudioAuthorizationCache.get(safeName) || 0;
    if (cachedUntil > Date.now()) return true;
    const audioUrl = `/api/public-audio/${safeName}`;

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("public_library")
        .select("id")
        .eq("audio_url", audioUrl)
        .eq("status", "PUBLISHED")
        .eq("is_archived", false)
        .limit(1);
      if (!error && data?.length) {
        publicAudioAuthorizationCache.set(safeName, Date.now() + 5 * 60 * 1000);
        return true;
      }
    }

    const db = getFirebaseAdminFirestore();
    if (db) {
      const snapshot = await db.collection("public_library").where("audioUrl", "==", audioUrl).limit(1).get();
      const published = snapshot.docs.some((doc) => {
        const value = doc.data();
        return value.status === "PUBLISHED" && value.isArchived !== true;
      });
      if (published) {
        publicAudioAuthorizationCache.set(safeName, Date.now() + 5 * 60 * 1000);
        return true;
      }
    }
    return false;
  };

  // Public Audio streaming endpoint for public library playback with HTTP range support
  app.get("/api/public-audio/:filename", async (req, res) => {
    try {
      const safeName = path.basename(req.params.filename);
      if (!(await isPublishedLocalAudio(safeName))) {
        return res.status(404).json({ error: "File not found" });
      }
      const filePath = path.join(PUBLIC_RECORDINGS_DIR, safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      const ext = path.extname(filePath).toLowerCase();
      const contentType =
        ext === ".webm"
          ? "audio/webm"
          : ext === ".mp4" || ext === ".m4a"
            ? "audio/mp4"
            : ext === ".wav"
              ? "audio/wav"
              : ext === ".ogg"
                ? "audio/ogg"
                : "audio/mpeg";

      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
        if (!match) {
          res.setHeader("Content-Range", `bytes */${fileSize}`);
          return res.status(416).end();
        }
        const start = Number(match[1]);
        const requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
        const end = Math.min(requestedEnd, fileSize - 1);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileSize) {
          res.setHeader("Content-Range", `bytes */${fileSize}`);
          return res.status(416).end();
        }
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream audio file" });
      }
    }
  });

  app.head("/api/public-audio/:filename", async (req, res) => {
    try {
      const safeName = path.basename(req.params.filename);
      if (!(await isPublishedLocalAudio(safeName))) return res.status(404).end();
      const filePath = path.join(PUBLIC_RECORDINGS_DIR, safeName);
      if (!fs.existsSync(filePath)) return res.status(404).end();
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType =
        ext === ".webm" ? "audio/webm"
          : ext === ".mp4" || ext === ".m4a" ? "audio/mp4"
            : ext === ".wav" ? "audio/wav"
              : ext === ".ogg" ? "audio/ogg" : "audio/mpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", stat.size);
      return res.status(200).end();
    } catch {
      return res.status(404).end();
    }
  });

  app.use("/api/public", publicRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/tasks", authenticateRequest, tasksRouter);
  app.use("/api/recording", authenticateRequest, recordingRouter);

  // Every operational API route below this point requires a verified Firebase ID token.
  app.use("/api", authenticateRequest);
  app.use("/api/admin", adminRouter);

  // Modular Independent Routers (Tasks and Rewards)
  app.use("/api/rewards", rewardsRouter);
  app.use("/api/certificates", certificateRouter);

  // Safe Upload Summary Diagnostic Endpoint (Phase 3)
  app.get("/api/uploads/summary", requireRbacAction("access_recording_platform"), (_req, res) => {
    const summary = uploadRegistry.getSummary();
    res.json({ success: true, summary });
  });

  // Safe Upload Status Query Endpoint (Phase 3)
  app.get("/api/uploads/status", requireRbacAction("access_recording_platform"), (req, res) => {
    const recId =
      typeof req.query.recId === "string" ? req.query.recId : undefined;
    const uploadId =
      typeof req.query.uploadId === "string" ? req.query.uploadId : undefined;
    let record: UploadRecord | undefined;
    if (uploadId) {
      record = uploadRegistry.getRecord(uploadId);
    } else if (recId) {
      record = uploadRegistry.getRecordByRecordingId(recId);
    }
    if (!record) {
      return res
        .status(404)
        .json({ success: false, error: "Record not found" });
    }
    res.json({
      success: true,
      record: {
        uploadId: record.uploadId,
        recordingId: record.recordingId,
        bookId: record.bookId,
        workflowStatus: record.workflowStatus,
        attemptCount: record.attemptCount,
        driveFileId: record.driveFileId,
        driveUrl: record.driveUrl,
        lastAttemptAt: record.lastAttemptAt,
        lastErrorMessage: record.lastErrorMessage,
      },
    });
  });

  // Safe Upload Retry Endpoint (Phase 3)
  app.post(
    "/api/uploads/retry",
    requireRbacAction("upload_raw"),
    async (req, res) => {
      try {
        const { recId, uploadId } = req.body;
        let record: UploadRecord | undefined;
        if (uploadId) {
          record = uploadRegistry.getRecord(uploadId);
        } else if (recId) {
          record = uploadRegistry.getRecordByRecordingId(recId);
        }

        if (!record) {
          return res
            .status(404)
            .json({ success: false, error: "Record not found" });
        }

        if (!driveService.isConfigured()) {
          return res.status(503).json({
            success: false,
            retryable: false,
            error: "Google Drive is not configured",
          });
        }

        // If already uploaded with valid driveFileId, don't re-upload to drive!
        if (record.workflowStatus === "uploaded" && record.driveFileId) {
          return res.json({
            success: true,
            driveSuccess: true,
            message: "الملف مرفوع بالفعل إلى Google Drive",
            fileId: record.driveFileId,
            driveUrl: record.driveUrl,
          });
        }

        if (!uploadRegistry.acquireLock(record.recordingId)) {
          return res.status(409).json({
            success: false,
            error: "عملية رفع هذا التسجيل قيد المعالجة بالفعل.",
          });
        }

        uploadRegistry.updateRecord(record.uploadId, {
          workflowStatus: "pending",
        });
        uploadRegistry.releaseLock(record.recordingId);

        res.json({
          success: true,
          message: "تم تجهيز إعادة المحاولة",
          record: {
            uploadId: record.uploadId,
            recordingId: record.recordingId,
            workflowStatus: "pending",
          },
        });
      } catch (error) {
        console.error("Retry endpoint error:", error);
        res.status(500).json({ error: "Failed to initiate retry" });
      }
    },
  );

  app.post(
    "/api/create-book-folder",
    requireRbacAction("create_book"),
    async (req, res) => {
      try {
        if (!driveService.isConfigured()) {
          return res.json({
            success: true,
            folderId: "",
            webViewLink: "",
            configured: false,
            message: "Google Drive غير مهيأ حالياً، تم إكمال العملية محلياً.",
          });
        }
        const { bookId, bookTitle, stage = "raw" } = req.body;
        if (!bookTitle) {
          return res.status(400).json({ error: "bookTitle is required" });
        }

        const validation = validateUploadInput({
          bookId,
          bookTitle,
          fileName: "dummy.mp3",
        });
        if (!validation.valid && validation.error?.includes("الكتاب")) {
          return res.status(400).json({ error: validation.error });
        }

        if (bookId) {
          const structure = await driveService.ensureBookFolderStructure(
            bookId,
            bookTitle,
          );
          return res.json({
            success: true,
            bookFolderId: structure.bookFolderId,
            subfolders: structure.subfolders,
            webViewLink: structure.webViewLink,
          });
        }

        const parentId = STAGE_FOLDERS[stage] || TARGET_DRIVE_FOLDER_ID;
        const folderRes = await driveService.ensureBookFolder(
          bookTitle,
          parentId,
        );
        res.json({
          success: true,
          folderId: folderRes.id,
          webViewLink: folderRes.webViewLink,
        });
      } catch (error: any) {
        if (error?.message === "Google Drive is not configured") {
          return res
            .status(503)
            .json({ success: false, error: "Google Drive is not configured" });
        }
        console.error("Failed to create book folder:", error);
        res.status(500).json({ error: "Failed to create book folder" });
      }
    },
  );

  app.post(
    "/api/move-file",
    requireRbacAction("update_stage"),
    async (req, res) => {
      try {
        if (!driveService.isConfigured()) {
          return res
            .status(503)
            .json({ success: false, error: "Google Drive is not configured" });
        }
        const { fileId, bookTitle, bookId, newStage } = req.body;
        if (!fileId || !bookTitle || !newStage) {
          return res
            .status(400)
            .json({ error: "fileId, bookTitle, and newStage are required" });
        }

        let targetFolderId: string;
        if (bookId) {
          const stageTarget = await driveService.getStageFolderForBook(
            bookId,
            bookTitle,
            newStage,
          );
          targetFolderId = stageTarget.folderId;
        } else {
          const parentId = STAGE_FOLDERS[newStage] || TARGET_DRIVE_FOLDER_ID;
          const folderRes = await driveService.ensureBookFolder(
            bookTitle,
            parentId,
          );
          targetFolderId = folderRes.id;
        }

        const success = await driveService.moveFile(fileId, targetFolderId);

        if (success) {
          res.json({ success: true, newFolderId: targetFolderId });
        } else {
          res
            .status(500)
            .json({ error: "Failed to move file in Google Drive" });
        }
      } catch (error: any) {
        if (error?.message === "Google Drive is not configured") {
          return res
            .status(503)
            .json({ success: false, error: "Google Drive is not configured" });
        }
        console.error("Move file error:", error);
        res.status(500).json({ error: "Failed to move file" });
      }
    },
  );

  // Google Drive archive file endpoint (Permanent Archive instead of trash bin)
  app.post(
    "/api/archive-drive-file",
    requireRbacAction("delete_recording"),
    async (req, res) => {
      try {
        if (!driveService.isConfigured()) {
          return res.status(503).json({ success: false, error: "Google Drive is not configured" });
        }
        const { fileId, parentFolderId } = req.body;
        if (!fileId) {
          return res.status(400).json({ error: "Missing fileId" });
        }

        const success = await driveService.archiveFile(fileId, parentFolderId);
        if (success) {
          res.json({ success: true, message: "تم نقل الملف إلى مجلد الأرشيف الدائم بنجاح" });
        } else {
          res.status(500).json({ error: "فشلت أرشفة الملف في Google Drive" });
        }
      } catch (error: any) {
        res.status(500).json({ error: error?.message || "Failed to archive file" });
      }
    },
  );

  // Google Drive delete API endpoint
  app.post(
    "/api/delete-drive-file",
    requireRbacAction("delete_recording"),
    async (req, res) => {
      try {
        if (!driveService.isConfigured()) {
          return res
            .status(503)
            .json({ success: false, error: "Google Drive is not configured" });
        }
        const { fileId } = req.body;
        if (!fileId) {
          return res.status(400).json({ error: "Missing fileId" });
        }

        const success = await driveService.deleteFile(fileId);
        if (success) {
          res.json({ success: true });
        } else {
          res
            .status(500)
            .json({ error: "Failed to delete file in Google Drive" });
        }
      } catch (error: any) {
        if (error?.message === "Google Drive is not configured") {
          return res
            .status(503)
            .json({ success: false, error: "Google Drive is not configured" });
        }
        console.error("Delete file error:", error);
        res.status(500).json({ error: "Failed to delete file" });
      }
    },
  );

  app.post(
    "/api/delete-book-folders",
    requireRbacAction("delete_book_folder"),
    async (req, res) => {
      try {
        if (!driveService.isConfigured()) {
          return res
            .status(503)
            .json({ success: false, error: "Google Drive is not configured" });
        }
        const { bookTitle } = req.body;
        if (!bookTitle) {
          return res.status(400).json({ error: "Missing bookTitle" });
        }

        const success = await driveService.deleteBookFolders(bookTitle);
        res.json({ success });
      } catch (error: any) {
        if (error?.message === "Google Drive is not configured") {
          return res
            .status(503)
            .json({ success: false, error: "Google Drive is not configured" });
        }
        console.error("Delete book folders error:", error);
        res.status(500).json({ error: "Failed to delete book folders" });
      }
    },
  );

  // Google Drive Make File Public API endpoint - Protected by Security Policy Guard
  app.post(
    "/api/make-drive-file-public",
    requireRbacAction("manage_drive"),
    async (_req, res) => {
      // Policy Guard: strictly disallow altering drive permissions to anyone by default
      res.status(403).json({
        success: false,
        error: "Public file sharing is disabled by security policy.",
      });
    },
  );

  // Google Drive Init Resumable Upload API endpoint
  app.post("/api/init-drive-upload", requireRbacAction("access_recording_platform"), async (req, res) => {
    try {
      if (!driveService.isConfigured()) {
        return res
          .status(503)
          .json({ success: false, error: "Google Drive is not configured" });
      }
      const {
        fileName,
        mimeType,
        folderId,
        bookTitle,
        stage,
        fileSize,
        bookId,
        recordingId,
      } = req.body;
      const action = [
        "master",
        "mastered",
        "mixing",
        "mastering",
        "final",
      ].includes(String(stage || "").toLowerCase())
        ? "upload_master"
        : "upload_raw";
      if (!req.user || !isActionAllowed(req.user as any, action)) {
        return res.status(403).json({
          success: false,
          error: "ليس لديك صلاحية الرفع لهذه المرحلة.",
          code: "UPLOAD_STAGE_FORBIDDEN",
        });
      }
      const validation = validateUploadInput({
        fileName,
        mimeType,
        fileSize,
        bookId,
        bookTitle,
        recordingId,
      });
      if (!validation.valid) {
        return res
          .status(400)
          .json({ success: false, error: validation.error });
      }
      if (folderId && !isActionAllowed(req.user as any, "manage_drive") && !isActionAllowed(req.user as any, "upload_raw")) {
        return res.status(403).json({
          success: false,
          error: "تحديد مجلد Drive يدوياً يحتاج صلاحية إدارة التخزين.",
        });
      }

      let targetFolderId =
        folderId ||
        (stage ? STAGE_FOLDERS[stage] : STAGE_FOLDERS.raw) ||
        TARGET_DRIVE_FOLDER_ID;

      if (bookTitle) {
        const folderRes = await driveService.ensureBookFolder(
          bookTitle,
          targetFolderId,
        );
        targetFolderId = folderRes.id;
      }

      const origin = req.headers.origin || req.headers.host || "";
      const driveToken = (req.headers["x-drive-access-token"] as string | undefined)?.trim();
      const fileSizeNum = fileSize ? Number(fileSize) : undefined;
      const uploadUrl = await driveService.initiateResumableUpload(
        fileName,
        mimeType,
        targetFolderId,
        fileSizeNum,
        driveToken,
      );
      if (uploadUrl) {
        res.json({ success: true, uploadUrl, folderId: targetFolderId });
      } else {
        res.status(500).json({ error: "Failed to initiate upload session" });
      }
    } catch (error: any) {
      if (error?.message === "Google Drive is not configured") {
        return res
          .status(503)
          .json({ success: false, error: "Google Drive is not configured" });
      }
      console.error("Init upload error:", error);
      res.status(500).json({ error: "Failed to initiate upload" });
    }
  });

  // Google Drive Direct Server-Side Audio Upload (resolves CORS and handles refresh token)
  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  app.post(
    "/api/drive/upload-direct",
    requireRbacAction("access_recording_platform"),
    audioUpload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({ success: false, error: "لم يتم استلام أي ملف صوتي" });
        }

        const {
          fileName: customFileName,
          mimeType: customMimeType,
          folderId,
          bookTitle,
          stage = "raw",
          bookId,
          recId,
          recordingId: rawRecordingId,
        } = req.body;

        const effectiveRecId = recId || rawRecordingId || "rec_" + Date.now();
        const requestedName = String(customFileName || req.file.originalname || `${effectiveRecId}.mp3`);
        const effectiveFileName = path.win32.basename(requestedName).replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 180);
        if (!effectiveFileName || effectiveFileName === "." || effectiveFileName === ".." || !/\.(mp3|wav|flac|m4a|aac|ogg|webm)$/i.test(effectiveFileName)) {
          return res.status(400).json({ success: false, code: "INVALID_AUDIO_FILENAME" });
        }
        const header = req.file.buffer.subarray(0, 16);
        const signature = header.toString("ascii");
        const isAudio = signature.startsWith("ID3") || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
          || (signature.startsWith("RIFF") && signature.slice(8, 12) === "WAVE")
          || signature.startsWith("fLaC") || signature.startsWith("OggS")
          || signature.slice(4, 8) === "ftyp"
          || (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3);
        if (!isAudio) return res.status(415).json({ success: false, code: "INVALID_AUDIO_CONTENT" });
        const effectiveMime =
          customMimeType || req.file.mimetype || "audio/mpeg";

        const action = [
          "master",
          "mastered",
          "mixing",
          "mastering",
          "final",
        ].includes(String(stage || "").toLowerCase())
          ? "upload_master"
          : "upload_raw";

        if (!req.user || !isActionAllowed(req.user as any, action)) {
          return res.status(403).json({
            success: false,
            error: "ليس لديك صلاحية الرفع لهذه المرحلة.",
            code: "UPLOAD_STAGE_FORBIDDEN",
          });
        }
        if (folderId && !isActionAllowed(req.user, "manage_drive")) {
          return res.status(403).json({ success: false, code: "FOLDER_OVERRIDE_DENIED" });
        }
        if (!driveService.isConfigured()) {
          return res.status(503).json({ success: false, code: "DRIVE_NOT_CONFIGURED", error: "Google Drive غير مهيأ؛ لم يُحفظ التسجيل." });
        }

        let targetFolderId = folderId;
        let subfolderName = "raw";

        if (!targetFolderId) {
          const effectiveBookId = bookId || "book_" + (bookTitle || "unknown");
          try {
            const stageTarget = await driveService.getStageFolderForBook(
              effectiveBookId,
              bookTitle || "Unsorted",
              stage,
            );
            targetFolderId = stageTarget.folderId;
            subfolderName = stageTarget.subfolderName;
          } catch (err) {
            console.warn(
              "Could not get stage folder, falling back to root:",
              err,
            );
            targetFolderId = TARGET_DRIVE_FOLDER_ID;
          }
        }

        let driveFileId = "";
        let driveUrl = "";
        let finalUrl = "";

        if (driveService.isConfigured()) {
          try {
            const driveRes = await driveService.uploadAudioBuffer(
              req.file.buffer,
              effectiveFileName,
              effectiveMime,
              targetFolderId || TARGET_DRIVE_FOLDER_ID,
            );
            driveFileId = driveRes.fileId;
            driveUrl =
              driveRes.webViewLink ||
              `https://drive.google.com/file/d/${driveFileId}/view`;
            finalUrl = driveUrl;
          } catch (driveErr: any) {
            console.error("Direct Drive upload failed:", driveErr?.message || driveErr);
            return res.status(503).json({ success: false, code: "DRIVE_UPLOAD_FAILED", error: "فشل حفظ التسجيل سحابياً؛ يرجى إعادة المحاولة." });
          }
        }

        return res.json({
          success: true,
          driveSuccess: !!driveFileId,
          fileId: effectiveRecId,
          folderId: targetFolderId,
          driveFileId,
          driveFolderId: targetFolderId,
          driveUrl,
          finalUrl,
          localUrl: null,
          subfolderName,
          stage,
          fileName: effectiveFileName,
          size: req.file.size,
          mimeType: effectiveMime,
          bookId: bookId || "unknown",
          recordingId: effectiveRecId,
        });
      } catch (error: any) {
        console.error("Error in /api/drive/upload-direct:", error);
        return res.status(500).json({
          success: false,
          error: error?.message || "فشل رفع الملف إلى Google Drive",
        });
      }
    },
  );

  // Async Serverless Background Pipeline for Audio Upload

  app.get("/api/drive/usage", requireRbacAction("manage_drive"), async (req, res) => {
    try {
      if (!driveService.isConfigured()) {
        return res
          .status(503)
          .json({ success: false, error: "Google Drive is not configured" });
      }
      const quota = await driveService.getStorageQuota();
      res.json({ success: true, quota });
    } catch (error) {
      console.error("Error fetching drive usage:", error);
      res.status(500).json({ error: "Failed to fetch drive usage" });
    }
  });

  app.get("/api/drive/folders", requireRbacAction("manage_drive"), async (req, res) => {
    try {
      if (!driveService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive is not configured",
          folders: [],
        });
      }
      const folders = await driveService.listFolders();
      res.json({ success: true, folders });
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.get("/api/drive/files", requireRbacAction("manage_drive"), async (req, res) => {
    try {
      if (!driveService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive is not configured",
          files: [],
        });
      }
      const folderId =
        typeof req.query.folderId === "string" ? req.query.folderId : undefined;
      const files = await driveService.listFiles(folderId);
      res.json({ success: true, files });
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  const UPLOADS_DIR = path.join(process.cwd(), "uploads", "recordings");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Local Audio Streaming Route with Range support
  app.get("/api/local-audio/:filename", requireRbacAction("access_recording_platform"), (req, res) => {
    try {
      const filePath = path.join(
        UPLOADS_DIR,
        path.basename(req.params.filename),
      );
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      const ext = path.extname(filePath).toLowerCase();
      const contentType =
        ext === ".webm"
          ? "audio/webm"
          : ext === ".mp4"
            ? "audio/mp4"
            : "audio/mpeg";

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error("Local audio stream error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Streaming error" });
    }
  });

  app.head("/api/local-audio/:filename", requireRbacAction("access_recording_platform"), (req, res) => {
    try {
      const filePath = path.join(
        UPLOADS_DIR,
        path.basename(req.params.filename),
      );
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");
        res.status(200).end();
      } else {
        res.status(404).end();
      }
    } catch (e) {
      res.status(404).end();
    }
  });

  app.post("/api/audio/upload", requireRbacAction("upload_raw"), (req, res) => {
    res.status(410).json({
      error: "Endpoint deprecated. Use Firebase Storage direct upload.",
    });
  });

  app.get("/api/config/drive", requireRbacAction("access_control_panel"), (_req, res) => {
    res.json({
      configured: driveService.isConfigured(),
      authMode: driveService.authType,
    });
  });

  app.post(
    "/api/config/drive",
    requireRbacAction("access_control_panel"),
    (_req, res) => {
      res.status(403).json({
        error:
          "Drive configuration must be provided via server environment variables only.",
      });
    },
  );

  app.get("/api/config/drive/health", requireRbacAction("access_control_panel"), (_req, res) => {
    const configured = driveService.isConfigured();
    res.json({
      workflowStatus: configured ? "configured" : "not_configured",
      message: configured
        ? "Drive credentials are configured."
        : "Drive credentials are not configured.",
    });
  });

  // Catch-all 404 handler for any unhandled /api endpoints - always return JSON, NEVER HTML
  app.all(/^\/api(\/.*)?$/, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(404).json({
      success: false,
      error: "المسار البرمجي المطلوب غير موجود (API endpoint not found)",
      code: "API_NOT_FOUND",
      url: req.originalUrl || req.url,
    });
  });

  // Global API JSON Error Handler - ensure NO Express HTML error leaks to /api requests
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    const fullUrl = req.originalUrl || req.url || req.path || "";
    console.error("[Server API Error]", req.method, fullUrl, err?.message || err);

    if (fullUrl.startsWith("/api") || req.path.startsWith("/api")) {
      const requestedStatus = Number(err?.status || err?.statusCode);
      const status = requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
      const isServerError = status >= 500;
      res.setHeader("Content-Type", "application/json");
      return res.status(status).json({
        success: false,
        error: isServerError ? "حدث خطأ غير متوقع في الخادم" : (err?.message || "تعذر تنفيذ الطلب"),
        code: isServerError ? "INTERNAL_SERVER_ERROR" : (err?.code || "REQUEST_FAILED"),
      });
    }
    return next(err);
  });

  // Firewall before Vite: ensure unhandled API requests NEVER leak into Vite's HTML SPA fallback
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const fullUrl = req.originalUrl || req.url || "";
    if (fullUrl.startsWith("/api")) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({
        success: false,
        error: "المسار البرمجي المطلوب غير موجود (API endpoint not found)",
        code: "API_NOT_FOUND",
        url: fullUrl,
      });
    }
    next();
  });

  // Vite middleware for development / Static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Non-blocking background worker & diagnostics
    setTimeout(async () => {
      try {
        driveWorker.start();
        const health = await checkFirestoreHealth().catch(() => null);
        if (health?.isAvailable) {
          const db = getFirebaseAdminFirestore();
          if (db) {
            scrubLegacyCredentialsFromUsers(db).catch(() => {});
          }
        }
      } catch (bgErr: any) {
        console.warn("[Server] Background worker notice:", bgErr?.message || bgErr);
      }
    }, 2000);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[Server Error] Port ${PORT} is already in use (EADDRINUSE).`,
      );
    } else {
      console.error(
        `[Server Error] Failed to start server on port ${PORT}:`,
        err.message,
      );
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error("[Server Error] Failed to initialize server:", err);
});
