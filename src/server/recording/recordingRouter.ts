import { Router } from "express";
import { getFirebaseAdminFirestore } from "../firebaseAdmin";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import {
  evaluatePermission,
  RecordingPermissionKey,
} from "../../lib/recordingPermissions";
import { canAccessPlatform } from "../../lib/rbacPolicy";

export const recordingRouter = Router();

recordingRouter.use((req: any, res: any, next: any) => {
  if (!req.user)
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED" });
  if (!canAccessPlatform(req.user, "recording"))
    return res
      .status(403)
      .json({ success: false, code: "PLATFORM_RECORDING_DENIED" });
  next();
});

recordingRouter.get(
  "/books",
  requireRecordingPermission("recording.books.view"),
  async (req: any, res: any) => {
    try {
      const books = await fetchAllMergedBooks();
      res.json({ success: true, books });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// Generic permission middleware for Recording platform
function requireRecordingPermission(permission: RecordingPermissionKey) {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "رمز التحقق مفقود.",
        code: "AUTH_TOKEN_MISSING",
      });
    }

    const { allowed, reasonCode } = evaluatePermission({
      authenticatedUser: req.user as any,
      accountStatus: req.user.status,
      canonicalRole: req.user.canonicalRole,
      platformDecision: req.user.platformAccess?.recording ?? "INHERIT",
      actionAccessOverrides: req.user.actionAccess || {},
      requestedPermission: permission,
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: `ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء (${permission}). الدور الحالي: ${req.user.canonicalRole}`,
        action: permission,
        code: "FORBIDDEN_INSUFFICIENT_ROLE",
        reasonCode,
      });
    }

    next();
  };
}

// ----------------------------------------------------
// Dashboard / Activity Logs
// ----------------------------------------------------
recordingRouter.get(
  "/activity-logs",
  requireRecordingPermission("recording.audit.view_own"),
  async (req: any, res: any) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    try {
      const snap = await db
        .collection("activity_logs")
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();
      const canViewAll = evaluatePermission({
        authenticatedUser: req.user,
        accountStatus: req.user.status,
        canonicalRole: req.user.canonicalRole,
        platformDecision: req.user.platformAccess?.recording ?? "INHERIT",
        actionAccessOverrides: req.user.actionAccess || {},
        requestedPermission: "recording.audit.view_all",
      }).allowed;
      const logs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (entry: any) =>
            canViewAll ||
            entry.uid === req.user.uid ||
            entry.actorUid === req.user.uid ||
            entry.userId === req.user.uid,
        );
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// Helper: Get all books merged from Supabase and Firestore
export async function fetchAllMergedBooks(): Promise<any[]> {
  const booksMap = new Map<string, any>();
  const db = getFirebaseAdminFirestore();
  const sb = getSupabaseAdminClient();

  // 1. Supabase (Primary relational storage)
  if (sb) {
    try {
      const { data: sbBooks, error } = await sb
        .from("books")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (!error && sbBooks) {
        for (const b of sbBooks) {
          booksMap.set(b.id, {
            id: b.id,
            title: b.title,
            author: b.author,
            description: b.description || "",
            category: b.category || "عام",
            total_parts: Number(b.target_chapters ?? b.total_parts ?? 12),
            completed_parts: Number(
              b.completed_chapters ?? b.completed_parts ?? 0,
            ),
            status: b.status || "in_progress",
            assigned_narrators: Array.isArray(b.assigned_narrators)
              ? b.assigned_narrators
              : [],
            cover_color: b.cover_color || "from-amber-600 to-amber-950",
            coverUrl: b.cover_image_url || b.coverUrl || null,
            drive_folder_link: b.drive_folder_link || "",
            driveFolderId: b.drive_folder_id || null,
            pdf_url: b.pdf_drive_link || b.pdf_url || "",
            pdf_file_id: b.pdf_drive_id || b.pdf_file_id || "",
            isArchived: false,
            createdAt: b.created_at || new Date().toISOString(),
            created_at: b.created_at || new Date().toISOString(),
            updated_at: b.updated_at || new Date().toISOString(),
          });
        }
      }
    } catch (sbErr) {
      console.warn("[recordingRouter] Supabase fetch books notice:", sbErr);
    }
  }

  // 2. Firestore (NoSQL document storage)
  if (db) {
    try {
      const snap = await db.collection("books").get();
      for (const d of snap.docs) {
        const data = d.data();
        if (data.isArchived || data.is_archived) {
          booksMap.delete(d.id);
          continue;
        }
        const existing = booksMap.get(d.id);
        const mapped = {
          id: d.id,
          title: data.title || existing?.title || "كتاب بدون عنوان",
          author: data.author || existing?.author || "مؤلف غير محدد",
          category: data.category || existing?.category || "عام",
          total_parts: Number(data.total_parts ?? existing?.total_parts ?? 12),
          completed_parts: Number(
            data.completed_parts ?? existing?.completed_parts ?? 0,
          ),
          assigned_narrators: Array.isArray(data.assigned_narrators)
            ? data.assigned_narrators
            : existing?.assigned_narrators || [],
          cover_color:
            data.cover_color ||
            existing?.cover_color ||
            "from-amber-600 to-amber-950",
          description: data.description || existing?.description || "",
          coverUrl:
            data.coverUrl || data.cover_image_url || existing?.coverUrl || null,
          drive_folder_link:
            data.drive_folder_link || existing?.drive_folder_link || "",
          driveFolderId:
            data.driveFolderId ||
            data.drive_folder_id ||
            existing?.driveFolderId ||
            null,
          pdf_url:
            data.pdf_url || data.pdf_drive_link || existing?.pdf_url || "",
          pdf_file_id:
            data.pdf_file_id ||
            data.pdf_drive_id ||
            existing?.pdf_file_id ||
            "",
          status: data.status || existing?.status || "in_progress",
          isArchived: false,
          createdAt:
            data.createdAt ||
            data.created_at ||
            existing?.createdAt ||
            new Date().toISOString(),
          created_at:
            data.created_at ||
            data.createdAt ||
            existing?.created_at ||
            new Date().toISOString(),
          updated_at:
            data.updated_at || existing?.updated_at || new Date().toISOString(),
        };
        booksMap.set(d.id, mapped);
      }
    } catch (fsErr) {
      console.warn("[recordingRouter] Firestore fetch books notice:", fsErr);
    }
  }

  return Array.from(booksMap.values()).sort((a: any, b: any) => {
    const dateA = a.createdAt || a.created_at || "";
    const dateB = b.createdAt || b.created_at || "";
    return dateB.localeCompare(dateA);
  });
}

// Helper: Get all recordings merged from Firestore and Supabase with robust normalization
export async function fetchAllMergedRecordings(): Promise<any[]> {
  const recordingsMap = new Map<string, any>();
  const db = getFirebaseAdminFirestore();
  const sb = getSupabaseAdminClient();

  const extractDriveId = (...candidates: any[]): string => {
    for (const c of candidates) {
      if (!c || typeof c !== "string") continue;
      const trimmed = c.trim();
      if (
        trimmed.length > 15 &&
        !trimmed.includes("/") &&
        !trimmed.includes(" ") &&
        !trimmed.includes("http")
      ) {
        return trimmed;
      }
      if (trimmed.includes("/my-drive") || trimmed.includes("/folders/"))
        continue;
      const m =
        trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/open\?id=([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/\/api\/audio\/([a-zA-Z0-9_-]+)/);
      if (m && m[1] && m[1].length > 10) return m[1];
    }
    return "";
  };

  const normalizeRec = (d: any, id: string): any => {
    const driveId = extractDriveId(
      d.drive_file_id,
      d.rawDriveFileId,
      d.driveFileId,
      d.masteredDriveFileId,
      d.mastered_file_url,
      d.masteredUrl,
      d.file_url,
      d.rawUrl,
      d.drive_url,
      d.public_link,
      d.audioUrl,
    );

    const bookTitle = d.book_title || d.bookId || d.title || "تسجيل صوتي";
    const bookId = d.bookId || d.book_title || bookTitle;
    const partNum = Number(d.part_number ?? d.partNumber ?? 1);
    const narratorName = d.narrator_name || d.narratorId || "راوي";
    const rawStatus = String(
      d.status || d.workflowStatus || "RAW_QA_PENDING",
    ).toUpperCase();
    const isMastered =
      rawStatus === "MASTERED" ||
      rawStatus === "FINAL" ||
      rawStatus === "FINAL_APPROVED";
    const status =
      d.status ||
      (isMastered
        ? "MASTERED"
        : rawStatus.includes("APPROVED")
          ? "QA_APPROVED"
          : "RAW");
    const workflowStatus =
      d.workflowStatus ||
      (isMastered
        ? "FINAL_APPROVED"
        : rawStatus.includes("APPROVED")
          ? "RAW_APPROVED"
          : "RAW_QA_PENDING");

    const playableUrl = driveId ? `/api/audio/${driveId}` : "";
    const rawUrl =
      d.rawUrl && !d.rawUrl.includes("/my-drive")
        ? d.rawUrl
        : playableUrl || d.file_url || "";
    const masteredUrl =
      d.masteredUrl && !d.masteredUrl.includes("/my-drive")
        ? d.masteredUrl
        : d.mastered_file_url && !d.mastered_file_url.includes("/my-drive")
          ? d.mastered_file_url
          : isMastered && playableUrl
            ? playableUrl
            : "";

    const dateVal = d.createdAt || d.created_at || new Date().toISOString();

    return {
      id: id || d.id,
      bookId: bookId,
      book_title: bookTitle,
      title: d.title || `${bookTitle} - جزء ${partNum}`,
      chapter: d.chapter || null,
      partNumber: partNum,
      part_number: partNum,
      narratorId: narratorName,
      narrator_name: narratorName,
      status,
      workflowStatus,
      rawDriveFileId: driveId || undefined,
      drive_file_id: driveId || undefined,
      driveFileId: driveId || undefined,
      rawUrl: rawUrl || undefined,
      masteredUrl: masteredUrl || undefined,
      file_url: rawUrl || undefined,
      mastered_file_url: masteredUrl || undefined,
      drive_url: driveId
        ? `https://drive.google.com/file/d/${driveId}/view`
        : d.drive_url || undefined,
      public_link: driveId
        ? `https://drive.google.com/file/d/${driveId}/view`
        : d.public_link || undefined,
      file_name:
        d.file_name ||
        d.mastered_file_name ||
        `${bookTitle}_Part${String(partNum).padStart(2, "0")}.mp3`,
      mastered_file_name:
        d.mastered_file_name ||
        d.file_name ||
        `${bookTitle}_Part${String(partNum).padStart(2, "0")}.mp3`,
      duration:
        d.duration ||
        (Number(d.durationSeconds) > 0
          ? `${Math.floor(Number(d.durationSeconds) / 60)}:${Number(d.durationSeconds) % 60}`
          : ""),
      durationSeconds:
        Number(d.durationSeconds) > 0 ? Number(d.durationSeconds) : 0,
      file_size: d.file_size || "",
      isArchived: Boolean(d.isArchived === true || d.is_archived === true),
      is_archived: Boolean(d.isArchived === true || d.is_archived === true),
      ownerId: d.ownerId || d.userId || d.narratorId || undefined,
      userId: d.userId || d.ownerId || undefined,
      createdAt: dateVal,
      created_at: dateVal,
      updatedAt: d.updatedAt || d.updated_at || dateVal,
      updated_at: d.updated_at || d.updatedAt || dateVal,
    };
  };

  // 1. Supabase
  if (sb) {
    try {
      const { data: sbRecs, error } = await sb
        .from("audio_recordings")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (!error && sbRecs) {
        for (const r of sbRecs) {
          recordingsMap.set(r.id, normalizeRec(r, r.id));
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Firestore
  if (db) {
    try {
      const snap = await db.collection("audio_recordings").get();
      for (const d of snap.docs) {
        const data = d.data();
        if (data.isArchived === true || data.is_archived === true) {
          recordingsMap.delete(d.id);
          continue;
        }
        recordingsMap.set(d.id, normalizeRec(data, d.id));
      }
    } catch (fsErr) {
      console.warn(
        "[recordingRouter] Firestore fetch recordings notice:",
        fsErr,
      );
    }
  }

  return Array.from(recordingsMap.values()).sort((a: any, b: any) => {
    if (a.book_title === b.book_title) {
      return (
        Number(a.partNumber || a.part_number || 0) -
        Number(b.partNumber || b.part_number || 0)
      );
    }
    const dateA = a.createdAt || a.created_at || "";
    const dateB = b.createdAt || b.created_at || "";
    return dateB.localeCompare(dateA);
  });
}

// ----------------------------------------------------
// Recordings
// ----------------------------------------------------
recordingRouter.get(
  "/recordings",
  requireRecordingPermission("recording.access"),
  async (req: any, res: any) => {
    try {
      const recordings = await fetchAllMergedRecordings();
      const can = (requestedPermission: RecordingPermissionKey) =>
        evaluatePermission({
          authenticatedUser: req.user,
          accountStatus: req.user.status,
          canonicalRole: req.user.canonicalRole,
          platformDecision: req.user.platformAccess?.recording ?? "INHERIT",
          actionAccessOverrides: req.user.actionAccess || {},
          requestedPermission,
        }).allowed;
      const all = can("recording.recordings.view_all");
      const assigned = can("recording.recordings.view_assigned");
      const own = can("recording.recordings.view_own");
      const visible = recordings.filter(
        (r: any) =>
          all ||
          (assigned &&
            ((Array.isArray(r.assigneeUids) &&
              r.assigneeUids.includes(req.user.uid)) ||
              r.qaReviewerId === req.user.uid ||
              r.engineerId === req.user.uid)) ||
          (own &&
            (r.ownerId === req.user.uid ||
              r.userId === req.user.uid ||
              r.narratorId === req.user.uid)),
      );
      res.json({ success: true, recordings: visible });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// ----------------------------------------------------
// Recording Writes
// ----------------------------------------------------
recordingRouter.post(
  "/recordings",
  requireRecordingPermission("recording.raw.upload"),
  async (req: any, res: any) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    try {
      const rawData = req.body || {};
      const recordId =
        typeof rawData.id === "string" && rawData.id.trim()
          ? rawData.id.trim()
          : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();

      // Check if doc already exists, verify ownership
      const existingDoc = await db
        .collection("audio_recordings")
        .doc(recordId)
        .get();
      if (existingDoc.exists) {
        const existingData = existingDoc.data() || {};
        const isOwner =
          existingData.ownerId === req.user.uid ||
          existingData.userId === req.user.uid ||
          existingData.narratorId === req.user.uid;
        const isAdmin =
          req.user.canonicalRole === "SUPER_ADMIN" ||
          req.user.canonicalRole === "ADMIN";
        if (!isOwner && !isAdmin) {
          return res.status(403).json({
            success: false,
            error: "لا تملك صلاحية تعديل هذا التسجيل",
          });
        }
      }

      const sanitizedRecording = {
        id: recordId,
        title:
          typeof rawData.title === "string"
            ? rawData.title.slice(0, 200)
            : "تسجيل بدون عنوان",
        bookId: typeof rawData.bookId === "string" ? rawData.bookId : null,
        partNumber:
          Number.isInteger(Number(rawData.partNumber)) &&
          Number(rawData.partNumber) > 0
            ? Number(rawData.partNumber)
            : 1,
        chapter: typeof rawData.chapter === "string" ? rawData.chapter : null,
        duration: Number(rawData.duration) || 0,
        audioUrl:
          typeof rawData.audioUrl === "string" ? rawData.audioUrl : null,
        rawUrl: typeof rawData.rawUrl === "string" ? rawData.rawUrl : null,
        driveFileId:
          typeof rawData.driveFileId === "string" ? rawData.driveFileId : null,
        notes:
          typeof rawData.notes === "string"
            ? rawData.notes.slice(0, 2000)
            : null,
        status: existingDoc.exists
          ? existingDoc.data()?.status || "RAW_QA_PENDING"
          : "RAW_QA_PENDING",
        workflowStatus: existingDoc.exists
          ? existingDoc.data()?.workflowStatus || "RAW_QA_PENDING"
          : "RAW_QA_PENDING",
        ownerId: req.user.uid,
        userId: req.user.uid,
        narratorId: rawData.narratorId || req.user.uid,
        isArchived: false,
        created_at: existingDoc.exists
          ? existingDoc.data()?.created_at || nowIso
          : nowIso,
        updated_at: nowIso,
      };

      await db
        .collection("audio_recordings")
        .doc(recordId)
        .set(sanitizedRecording, { merge: true });
      res.json({ success: true, id: recordId });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

recordingRouter.patch("/recordings/:id", async (req: any, res: any) => {
  const db = getFirebaseAdminFirestore();
  if (!db)
    return res
      .status(503)
      .json({ success: false, error: "Database not available" });
  try {
    const id = req.params.id;
    const existingDoc = await db.collection("audio_recordings").doc(id).get();
    if (!existingDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "التسجيل غير موجود" });
    }
    const existingData = existingDoc.data() || {};

    const rawUpdates = req.body || {};
    const can = (permission: RecordingPermissionKey) =>
      evaluatePermission({
        authenticatedUser: req.user as any,
        accountStatus: req.user.status,
        canonicalRole: req.user.canonicalRole,
        platformDecision: req.user.platformAccess?.recording ?? "INHERIT",
        actionAccessOverrides: req.user.actionAccess || {},
        requestedPermission: permission,
      }).allowed;
    const transitionPermission: Record<string, RecordingPermissionKey> = {
      RAW_QA_PENDING: "recording.submit_for_review",
      RAW_APPROVED: "recording.qa.approve",
      NARRATOR_REVISION_REQUIRED: "recording.qa.request_revision",
      MASTERING: "recording.engineering.upload_processed",
      FINAL_QA_PENDING: "recording.master.create",
      FINAL_APPROVED: "recording.master.mark_final",
      PUBLISHED: "recording.final.publish",
      ENGINEER_REVISION_REQUIRED: "recording.master.return_for_revision",
    };
    const targetStatus = rawUpdates.workflowStatus;
    if (
      targetStatus !== undefined &&
      (!transitionPermission[targetStatus] ||
        !can(transitionPermission[targetStatus]))
    ) {
      return res
        .status(403)
        .json({ success: false, code: "WORKFLOW_PERMISSION_DENIED" });
    }
    if (targetStatus !== undefined) {
      const sourceStatus = String(
        existingData.workflowStatus || existingData.status || "RAW_QA_PENDING",
      );
      const allowedNext: Record<string, string[]> = {
        draft: ["RAW_QA_PENDING"],
        RAW: ["RAW_QA_PENDING", "RAW_APPROVED", "NARRATOR_REVISION_REQUIRED"],
        RAW_QA_PENDING: ["RAW_APPROVED", "NARRATOR_REVISION_REQUIRED"],
        NARRATOR_REVISION_REQUIRED: ["RAW_QA_PENDING"],
        RAW_APPROVED: ["MASTERING", "FINAL_QA_PENDING"],
        QA_APPROVED: ["MASTERING", "FINAL_QA_PENDING"],
        MASTERING: ["FINAL_QA_PENDING", "ENGINEER_REVISION_REQUIRED"],
        ENGINEER_REVISION_REQUIRED: ["MASTERING"],
        FINAL_QA_PENDING: ["FINAL_APPROVED", "ENGINEER_REVISION_REQUIRED"],
        FINAL_APPROVED: ["PUBLISHED"],
        MASTERED: ["PUBLISHED"],
      };
      if (
        targetStatus !== sourceStatus &&
        !(allowedNext[sourceStatus] || []).includes(targetStatus)
      ) {
        return res
          .status(409)
          .json({ success: false, code: "INVALID_WORKFLOW_TRANSITION" });
      }
    }
    if (rawUpdates.qaRating !== undefined && !can("recording.qa.score"))
      return res
        .status(403)
        .json({ success: false, code: "QA_PERMISSION_DENIED" });
    if (rawUpdates.qaNotes !== undefined && !can("recording.qa_feedback.add"))
      return res
        .status(403)
        .json({ success: false, code: "QA_PERMISSION_DENIED" });
    if (
      rawUpdates.masteredUrl !== undefined &&
      !can("recording.engineering.upload_processed")
    )
      return res
        .status(403)
        .json({ success: false, code: "ENGINEERING_PERMISSION_DENIED" });

    // RBAC: Metadata is independently gated from workflow transitions.
    const { allowed: canEditAll } = evaluatePermission({
      authenticatedUser: req.user as any,
      accountStatus: req.user.status,
      canonicalRole: req.user.canonicalRole,
      platformDecision: req.user.platformAccess?.recording ?? "INHERIT",
      actionAccessOverrides: req.user.actionAccess || {},
      requestedPermission: "recording.metadata.edit_all",
    });

    const { allowed: canEditOwn } = evaluatePermission({
      authenticatedUser: req.user as any,
      accountStatus: req.user.status,
      canonicalRole: req.user.canonicalRole,
      platformDecision: req.user.platformAccess?.recording ?? "INHERIT",
      actionAccessOverrides: req.user.actionAccess || {},
      requestedPermission: "recording.metadata.edit_own",
    });

    const editsMetadata = ["title", "notes", "duration", "metadata"].some(
      (key) => rawUpdates[key] !== undefined,
    );
    if (editsMetadata && !canEditAll) {
      const isOwner =
        existingData.ownerId === req.user.uid ||
        existingData.userId === req.user.uid ||
        existingData.narratorId === req.user.uid;
      if (!canEditOwn || !isOwner) {
        return res.status(403).json({
          success: false,
          error: "لا تملك الصلاحية لتعديل هذا التسجيل.",
        });
      }
    }

    const sanitizedUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: req.user.uid,
    };

    if (typeof rawUpdates.title === "string")
      sanitizedUpdates.title = rawUpdates.title.slice(0, 200);
    if (typeof rawUpdates.notes === "string")
      sanitizedUpdates.notes = rawUpdates.notes.slice(0, 2000);
    if (targetStatus !== undefined) {
      sanitizedUpdates.workflowStatus = targetStatus;
      sanitizedUpdates.status = targetStatus;
    }
    if (rawUpdates.qaRating !== undefined) {
      const rating = Number(rawUpdates.qaRating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5)
        return res
          .status(400)
          .json({ success: false, code: "INVALID_QA_RATING" });
      sanitizedUpdates.qaRating = rating;
      sanitizedUpdates.qaReviewedBy = req.user.uid;
    }
    if (rawUpdates.masteredUrl !== undefined) {
      if (
        typeof rawUpdates.masteredUrl !== "string" ||
        !/^https:\/\//.test(rawUpdates.masteredUrl)
      )
        return res
          .status(400)
          .json({ success: false, code: "INVALID_MASTERED_URL" });
      sanitizedUpdates.masteredUrl = rawUpdates.masteredUrl;
    }
    if (rawUpdates.duration !== undefined)
      sanitizedUpdates.duration = Number(rawUpdates.duration) || 0;
    if (rawUpdates.qaNotes !== undefined)
      sanitizedUpdates.qaNotes = String(rawUpdates.qaNotes).slice(0, 2000);
    if (rawUpdates.metadata && typeof rawUpdates.metadata === "object")
      sanitizedUpdates.metadata = rawUpdates.metadata;

    await db
      .collection("audio_recordings")
      .doc(id)
      .set(sanitizedUpdates, { merge: true });
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

recordingRouter.delete("/recordings/:id", async (req: any, res: any) => {
  const db = getFirebaseAdminFirestore();
  if (!db)
    return res
      .status(503)
      .json({ success: false, error: "Database not available" });
  try {
    const id = req.params.id;
    const existingDoc = await db.collection("audio_recordings").doc(id).get();
    if (!existingDoc.exists) {
      return res
        .status(404)
        .json({ success: false, error: "التسجيل غير موجود" });
    }
    const existingData = existingDoc.data() || {};

    const { allowed: canArchiveAny } = evaluatePermission({
      authenticatedUser: req.user as any,
      accountStatus: req.user.status,
      canonicalRole: req.user.canonicalRole,
      platformDecision: req.user.platformAccess?.recording || "INHERIT",
      actionAccessOverrides: req.user.actionAccess || {},
      requestedPermission: "recording.archive_any",
    });

    const { allowed: canArchiveOwn } = evaluatePermission({
      authenticatedUser: req.user as any,
      accountStatus: req.user.status,
      canonicalRole: req.user.canonicalRole,
      platformDecision: req.user.platformAccess?.recording || "INHERIT",
      actionAccessOverrides: req.user.actionAccess || {},
      requestedPermission: "recording.archive_own_draft",
    });

    const isOwner =
      existingData.ownerId === req.user.uid ||
      existingData.userId === req.user.uid ||
      existingData.narratorId === req.user.uid;

    const archiveableOwnDraft = ["draft", "RAW", "RAW_QA_PENDING"].includes(
      String(existingData.workflowStatus || existingData.status || "draft"),
    );
    if (
      !canArchiveAny &&
      (!canArchiveOwn || !isOwner || !archiveableOwnDraft)
    ) {
      return res
        .status(403)
        .json({ success: false, error: "لا تملك صلاحية أرشفة هذا التسجيل." });
    }

    // Soft delete: perform archive instead of destructive hard delete
    await db.collection("audio_recordings").doc(id).set(
      {
        isArchived: true,
        status: "archived",
        archivedAt: new Date().toISOString(),
        archivedBy: req.user.uid,
      },
      { merge: true },
    );

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Books Writes
recordingRouter.post(
  "/books",
  requireRecordingPermission("recording.books.create"),
  async (req: any, res: any) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    try {
      const rawData = req.body || {};
      const bookId =
        typeof rawData.id === "string" && rawData.id.trim()
          ? rawData.id.trim()
          : `book-${Date.now()}`;
      if ((await db.collection("books").doc(bookId).get()).exists)
        return res
          .status(409)
          .json({ success: false, code: "BOOK_ALREADY_EXISTS" });
      const nowIso = new Date().toISOString();

      const book = {
        id: bookId,
        title:
          typeof rawData.title === "string"
            ? rawData.title.slice(0, 200).trim()
            : "كتاب بدون عنوان",
        author:
          typeof rawData.author === "string" && rawData.author.trim()
            ? rawData.author.slice(0, 200).trim()
            : "مؤلف غير محدد",
        category:
          typeof rawData.category === "string"
            ? rawData.category.trim()
            : "عام",
        total_parts: Number(rawData.total_parts) || 12,
        completed_parts: Number(rawData.completed_parts) || 0,
        assigned_narrators: Array.isArray(rawData.assigned_narrators)
          ? rawData.assigned_narrators
          : [],
        cover_color:
          typeof rawData.cover_color === "string"
            ? rawData.cover_color
            : "from-amber-600 to-amber-950",
        description:
          typeof rawData.description === "string"
            ? rawData.description.slice(0, 2000)
            : "",
        coverUrl:
          typeof rawData.coverUrl === "string" ? rawData.coverUrl : null,
        drive_folder_link:
          typeof rawData.drive_folder_link === "string"
            ? rawData.drive_folder_link
            : rawData.driveFolderId || "",
        driveFolderId:
          typeof rawData.driveFolderId === "string"
            ? rawData.driveFolderId
            : null,
        pdf_url:
          typeof rawData.pdf_url === "string"
            ? rawData.pdf_url
            : rawData.pdfUrl || "",
        pdf_file_id:
          typeof rawData.pdf_file_id === "string"
            ? rawData.pdf_file_id
            : rawData.pdfFileId || "",
        status: rawData.status || "in_progress",
        isArchived: false,
        createdAt: rawData.createdAt || nowIso.split("T")[0],
        created_by: req.user?.uid || "admin",
        created_at: nowIso,
        updated_at: nowIso,
      };

      // 1. Write to Firestore
      await db.collection("books").doc(bookId).set(book, { merge: true });

      // 2. Sync to Supabase with schema-conforming column names
      try {
        const sb = getSupabaseAdminClient();
        if (sb) {
          await sb.from("books").upsert(
            {
              id: book.id,
              title: book.title,
              author: book.author,
              category: book.category,
              description: book.description,
              target_chapters: book.total_parts,
              completed_chapters: book.completed_parts,
              assigned_narrators: book.assigned_narrators,
              drive_folder_link: book.drive_folder_link || null,
              drive_folder_id: book.driveFolderId || null,
              pdf_drive_link: book.pdf_url || null,
              pdf_drive_id: book.pdf_file_id || null,
              cover_image_url: book.coverUrl || null,
              is_archived: false,
              created_at: book.created_at,
              updated_at: book.updated_at,
            },
            { onConflict: "id" },
          );
        }
      } catch (sbErr) {
        console.warn(
          "[recordingRouter] Supabase book insert sync warning:",
          sbErr,
        );
      }

      const books = await fetchAllMergedBooks();
      res.json({ success: true, book, books });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

recordingRouter.patch(
  "/books/:id",
  requireRecordingPermission("recording.books.edit"),
  async (req: any, res: any) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    try {
      const existing = await fetchAllMergedBooks();
      if (!existing.some((book: any) => book.id === req.params.id))
        return res.status(404).json({ success: false, code: "BOOK_NOT_FOUND" });
      const rawUpdates = req.body || {};
      const sanitizedUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
        updated_by: req.user?.uid || "admin",
      };
      if (typeof rawUpdates.title === "string")
        sanitizedUpdates.title = rawUpdates.title.slice(0, 200);
      if (typeof rawUpdates.author === "string")
        sanitizedUpdates.author = rawUpdates.author.slice(0, 200);
      if (typeof rawUpdates.category === "string")
        sanitizedUpdates.category = rawUpdates.category;
      if (typeof rawUpdates.description === "string")
        sanitizedUpdates.description = rawUpdates.description.slice(0, 2000);
      if (typeof rawUpdates.coverUrl === "string")
        sanitizedUpdates.coverUrl = rawUpdates.coverUrl;
      if (typeof rawUpdates.cover_color === "string")
        sanitizedUpdates.cover_color = rawUpdates.cover_color;
      if (typeof rawUpdates.total_parts === "number")
        sanitizedUpdates.total_parts = rawUpdates.total_parts;
      if (typeof rawUpdates.completed_parts === "number")
        sanitizedUpdates.completed_parts = rawUpdates.completed_parts;
      if (Array.isArray(rawUpdates.assigned_narrators))
        sanitizedUpdates.assigned_narrators = rawUpdates.assigned_narrators;
      if (typeof rawUpdates.drive_folder_link === "string")
        sanitizedUpdates.drive_folder_link = rawUpdates.drive_folder_link;
      if (typeof rawUpdates.driveFolderId === "string")
        sanitizedUpdates.driveFolderId = rawUpdates.driveFolderId;
      if (typeof rawUpdates.pdf_url === "string")
        sanitizedUpdates.pdf_url = rawUpdates.pdf_url;
      if (typeof rawUpdates.pdf_file_id === "string")
        sanitizedUpdates.pdf_file_id = rawUpdates.pdf_file_id;
      if (typeof rawUpdates.status === "string")
        sanitizedUpdates.status = rawUpdates.status;

      await db
        .collection("books")
        .doc(req.params.id)
        .set(sanitizedUpdates, { merge: true });

      // Sync to Supabase
      try {
        const sb = getSupabaseAdminClient();
        if (sb) {
          const sbPayload: Record<string, any> = {
            updated_at: sanitizedUpdates.updated_at,
          };
          if (sanitizedUpdates.title !== undefined)
            sbPayload.title = sanitizedUpdates.title;
          if (sanitizedUpdates.author !== undefined)
            sbPayload.author = sanitizedUpdates.author;
          if (sanitizedUpdates.category !== undefined)
            sbPayload.category = sanitizedUpdates.category;
          if (sanitizedUpdates.description !== undefined)
            sbPayload.description = sanitizedUpdates.description;
          if (sanitizedUpdates.total_parts !== undefined)
            sbPayload.target_chapters = sanitizedUpdates.total_parts;
          if (sanitizedUpdates.completed_parts !== undefined)
            sbPayload.completed_chapters = sanitizedUpdates.completed_parts;
          if (sanitizedUpdates.assigned_narrators !== undefined)
            sbPayload.assigned_narrators = sanitizedUpdates.assigned_narrators;
          if (sanitizedUpdates.drive_folder_link !== undefined)
            sbPayload.drive_folder_link = sanitizedUpdates.drive_folder_link;
          if (sanitizedUpdates.driveFolderId !== undefined)
            sbPayload.drive_folder_id = sanitizedUpdates.driveFolderId;
          if (sanitizedUpdates.pdf_url !== undefined)
            sbPayload.pdf_drive_link = sanitizedUpdates.pdf_url;
          if (sanitizedUpdates.pdf_file_id !== undefined)
            sbPayload.pdf_drive_id = sanitizedUpdates.pdf_file_id;
          if (sanitizedUpdates.coverUrl !== undefined)
            sbPayload.cover_image_url = sanitizedUpdates.coverUrl;
          if (sanitizedUpdates.status !== undefined)
            sbPayload.status = sanitizedUpdates.status;

          await sb.from("books").update(sbPayload).eq("id", req.params.id);
        }
      } catch (sbErr) {
        console.warn(
          "[recordingRouter] Supabase book update sync warning:",
          sbErr,
        );
      }

      const books = await fetchAllMergedBooks();
      res.json({ success: true, books });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

recordingRouter.delete(
  "/books/:id",
  requireRecordingPermission("recording.books.archive"),
  async (req: any, res: any) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not available" });
    try {
      const existing = await fetchAllMergedBooks();
      if (!existing.some((book: any) => book.id === req.params.id))
        return res.status(404).json({ success: false, code: "BOOK_NOT_FOUND" });
      const nowIso = new Date().toISOString();
      // Soft delete: perform archive
      await db
        .collection("books")
        .doc(req.params.id)
        .set(
          {
            isArchived: true,
            status: "archived",
            archivedAt: nowIso,
            archivedBy: req.user?.uid || "admin",
          },
          { merge: true },
        );

      // Also archive in Supabase
      try {
        const sb = getSupabaseAdminClient();
        if (sb) {
          await sb
            .from("books")
            .update({
              is_archived: true,
              status: "archived",
              archived_at: nowIso,
              archived_by: req.user?.uid || "admin",
            })
            .eq("id", req.params.id);
        }
      } catch (sbErr) {
        console.warn(
          "[recordingRouter] Supabase book delete sync warning:",
          sbErr,
        );
      }

      const books = await fetchAllMergedBooks();
      res.json({ success: true, books });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);
