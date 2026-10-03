import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
} from "./firebaseAdmin";
import { DEFAULT_CMS_CONTENT } from "../cms/cmsDefaults";
import { PRESET_VOLUNTEER_FORMS } from "../volunteer/volunteerPresets";
import { PRESET_TOPICS } from "../library/libraryTypes";
import { normalizeToE164 } from "../lib/phoneUtils";
import { findUserDocumentByIdentifier } from "./userLookup";
import { publicRepository, bookRepository } from "./repository";
import { decodeAndValidateTokenStrict } from "./authMiddleware";
import { isActionAllowed } from "../lib/rbacPolicy";

const publicRouter = Router();

const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "تم تجاوز عدد الطلبات المسموح. حاول لاحقاً.",
  },
});

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error:
      "تم تجاوز عدد المحاولات المسموح. يرجى الانتظار بضع دقائق والمحاولة ثانية.",
  },
});

const identifierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "تعذر التحقق من بيانات الدخول." },
});

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizedPhone(value: string): string {
  if (!value) return "";
  return normalizeToE164(value);
}

function maskArabicName(name: string): string {
  if (!name || typeof name !== "string") return "عضو في إنصات";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part) => (part.length > 1 ? part[0] + "***" : part))
    .join(" ");
}

export function activationEmailMatchesAccount(
  storedEmail: unknown,
  submittedEmail: unknown,
): boolean {
  const stored = cleanText(storedEmail, 254).toLowerCase();
  const submitted = cleanText(submittedEmail, 254).toLowerCase();
  return !stored || stored === submitted;
}

export function isFirebaseUserBoundToActivation(
  firebaseUid: string,
  legacyId: string,
  storedUid: unknown,
): boolean {
  return [legacyId, cleanText(storedUid, 128)]
    .filter(Boolean)
    .includes(firebaseUid);
}

/** Only explicitly public fields may leave the server. Never expose Drive file IDs or internal storage tokens. */
function publicLibraryItem(id: string, value: Record<string, unknown>) {
  return {
    id,
    title: cleanText(value.title, 180),
    shortDescription: cleanText(
      value.shortDescription || value.description,
      1200,
    ),
    category: cleanText(value.category, 80) || "الأدب",
    coverUrl: cleanText(value.coverUrl, 2048),
    audioUrl: cleanText(value.audioUrl || value.audio_url, 2048),
    authorName: cleanText(
      value.authorName || value.bookAuthor || value.author,
      120,
    ),
    narratorName: cleanText(
      value.narratorName || value.narrator_name || value.narrator,
      120,
    ),
    audioEngineerName: cleanText(
      value.audioEngineerName || value.mastered_by,
      120,
    ),
    reviewerName: cleanText(value.reviewerName || value.qa_reviewer, 120),
    durationSeconds: Math.max(
      0,
      Number(value.durationSeconds ?? value.duration_seconds) || 0,
    ),
    tags: Array.isArray(value.tags)
      ? value.tags.map((t) => cleanText(t, 40))
      : [],
    spotifyUrl: cleanText(value.spotifyUrl, 2048),
    optionalPdfUrl: cleanText(value.optionalPdfUrl, 2048),
    publishDate: cleanText(value.publishDate || value.createdAt, 40),
    status: value.status || "PUBLISHED",
  };
}

function publicActivityItem(id: string, value: Record<string, unknown>) {
  return {
    id,
    title: cleanText(value.title, 180),
    slug: cleanText(value.slug, 120) || id,
    shortDescription: cleanText(value.shortDescription || value.summary, 500),
    fullDescription: cleanText(value.fullDescription || value.body, 6000),
    coverImage: cleanText(value.coverImage || value.imageUrl, 2048),
    galleryImages: Array.isArray(value.galleryImages)
      ? value.galleryImages
      : [],
    activityType: cleanText(value.activityType, 60) || "CULTURAL_SESSION",
    mode: cleanText(value.mode, 30) || "ONLINE",
    location: cleanText(value.location, 200),
    startDate: cleanText(value.startDate || value.date, 40),
    endDate: cleanText(value.endDate, 40) || undefined,
    meetingLink: cleanText(value.meetingLink, 2048) || undefined,
    organizers: Array.isArray(value.organizers)
      ? value.organizers.map((o) => cleanText(o, 80))
      : ["فريق إنصات"],
    recordingUrl: cleanText(value.recordingUrl, 2048) || undefined,
    relatedLinks: Array.isArray(value.relatedLinks) ? value.relatedLinks : [],
    status: cleanText(value.status, 40) || "UPCOMING",
    featured: Boolean(value.featured),
    createdAt: cleanText(value.createdAt, 50) || undefined,
    updatedAt: cleanText(value.updatedAt, 50) || undefined,
  };
}

// In-memory cache for CMS content to eliminate redundant Firestore reads and survive quota exhaustion
interface CachedCms {
  data: any;
  timestamp: number;
}
const cmsMemoryCache: Record<string, CachedCms> = {};
let lastFirestoreQuotaExhaustedAt = 0;
const FIRESTORE_QUOTA_BACKOFF_MS = 15 * 60 * 1000; // 15 minutes backoff
const CMS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const PUBLIC_CONTENT_CACHE_TTL_MS = 30 * 60 * 1000;
let publicContentCache: {
  library: any[];
  activities: any[];
  timestamp: number;
} | null = null;

export function invalidatePublicOverviewCache() {
  publicContentCache = null;
  delete cmsMemoryCache.site;
  delete cmsMemoryCache.site_draft;
}

publicRouter.get("/site-overview", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const db = getFirebaseAdminFirestore();
  const now = Date.now();

  try {
    const isDraftPreview = req.query.preview === "draft";
    let canPreviewDraft = false;
    if (isDraftPreview) {
      const authHeader = req.headers.authorization;
      if (
        authHeader &&
        typeof authHeader === "string" &&
        authHeader.startsWith("Bearer ")
      ) {
        const token = authHeader.substring(7).trim();
        const user = await decodeAndValidateTokenStrict(token);
        if (
          user &&
          (user.canonicalRole === "SUPER_ADMIN" ||
            user.canonicalRole === "ADMIN" ||
            user.canonicalRole === "CONTENT_MANAGER" ||
            isActionAllowed(user, "manage_public_content"))
        ) {
          canPreviewDraft = true;
        }
      }
    }
    const docToLoad = isDraftPreview && canPreviewDraft ? "site_draft" : "site";

    // 1. Fetch public statistics from Supabase (Zero collection scans!)
    const publicStats = await publicRepository.getPublicStats();
    const booksResult = await bookRepository.listBooks({
      isPublishedPublic: true,
      limit: 100,
    });
    let libraryFromSource = await publicRepository.listPublicLibrary(50);
    let activitiesFromSource = await publicRepository.listPublicActivities(20);
    if (
      db &&
      Date.now() - lastFirestoreQuotaExhaustedAt >= FIRESTORE_QUOTA_BACKOFF_MS
    ) {
      if (
        publicContentCache &&
        now - publicContentCache.timestamp < PUBLIC_CONTENT_CACHE_TTL_MS
      ) {
        libraryFromSource = publicContentCache.library;
        activitiesFromSource = publicContentCache.activities;
      } else {
        try {
          const [librarySnap, activitySnap] = await Promise.all([
            db.collection("public_library").limit(200).get(),
            db.collection("public_activities").limit(100).get(),
          ]);
          libraryFromSource = librarySnap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter(
              (d: any) =>
                d.status === "PUBLISHED" &&
                d.isArchived !== true &&
                d.is_archived !== true &&
                d.needsProcessing !== true &&
                Number(d.durationSeconds ?? d.duration_seconds) > 0,
            );
          activitiesFromSource = activitySnap.docs
            .map((d: any) => ({ id: d.id, ...d.data() }))
            .filter(
              (d: any) =>
                !["DRAFT", "ARCHIVED"].includes(
                  String(d.status || "").toUpperCase(),
                ) &&
                d.isArchived !== true &&
                d.is_archived !== true,
            );
          publicContentCache = {
            library: libraryFromSource,
            activities: activitiesFromSource,
            timestamp: now,
          };
        } catch (contentError: any) {
          if (
            contentError?.code === 8 ||
            String(contentError?.message || "").includes("RESOURCE_EXHAUSTED")
          )
            lastFirestoreQuotaExhaustedAt = now;
          console.warn(
            "[publicRoutes] Public content read fallback:",
            contentError?.message || contentError,
          );
        }
      }
    }

    // 2. Fetch site CMS settings (cached / quota-resilient fallback)
    let settings: any = {};
    const cachedCms = cmsMemoryCache[docToLoad];
    const isQuotaExhausted =
      now - lastFirestoreQuotaExhaustedAt < FIRESTORE_QUOTA_BACKOFF_MS;

    if (cachedCms && now - cachedCms.timestamp < CMS_CACHE_TTL_MS) {
      settings = cachedCms.data;
    } else if (!isQuotaExhausted && db) {
      try {
        const contentDoc = await db
          .collection("public_content")
          .doc(docToLoad)
          .get();
        if (contentDoc.exists) {
          settings = (contentDoc.data() as any) || {};
          cmsMemoryCache[docToLoad] = { data: settings, timestamp: now };
        } else if (isDraftPreview && canPreviewDraft) {
          const fallbackDoc = await db
            .collection("public_content")
            .doc("site")
            .get();
          if (fallbackDoc.exists) {
            settings = (fallbackDoc.data() as any) || {};
            cmsMemoryCache[docToLoad] = { data: settings, timestamp: now };
          }
        }
      } catch (cmsErr: any) {
        const isQuota =
          cmsErr?.code === 8 ||
          cmsErr?.message?.includes("RESOURCE_EXHAUSTED") ||
          cmsErr?.message?.includes("Quota limit exceeded");
        if (isQuota) {
          lastFirestoreQuotaExhaustedAt = now;
          console.info(
            "[publicRoutes] Firestore daily quota reached, serving default/cached CMS content.",
          );
        } else {
          console.info(
            "[publicRoutes] CMS content doc load notice:",
            cmsErr?.message || cmsErr,
          );
        }
        if (cachedCms) {
          settings = cachedCms.data;
        }
      }
    } else if (cachedCms) {
      settings = cachedCms.data;
    }

    // Projects list extraction from Supabase BookRepository
    const projectsList = (booksResult.books || []).map((b) => ({
      id: b.id,
      title: cleanText(b.title, 180) || "مشروع كتاب صوتي",
      authorName: cleanText(b.author, 120),
      category: cleanText(b.category, 80) || "كتاب صوتي",
      totalParts: Number(b.total_parts) || 1,
      completedParts: Number(b.completed_parts) || 0,
      coverUrl: cleanText(b.cover_image_url, 2048),
    }));

    const publishedLibraryItems = (libraryFromSource || []).map((d: any) =>
      publicLibraryItem(d.id, d),
    );
    const publishedActivities = (activitiesFromSource || []).map((d: any) =>
      publicActivityItem(d.id, d),
    );
    const publishedAudioSeconds = publishedLibraryItems.reduce(
      (sum, item) => sum + item.durationSeconds,
      0,
    );

    const mergedContent = {
      ...DEFAULT_CMS_CONTENT,
      ...settings,
      sections: settings?.sections || DEFAULT_CMS_CONTENT.sections,
    };

    let calculatedCountries: Array<{
      name: string;
      count: number;
      members: string[];
    }> = [];
    if (
      settings.countryMetricMode === "MANUAL" &&
      Array.isArray(settings.manualCountries) &&
      settings.manualCountries.length > 0
    ) {
      calculatedCountries = settings.manualCountries;
    } else if (
      publicStats.countriesWithMembers &&
      publicStats.countriesWithMembers.length > 0
    ) {
      calculatedCountries = publicStats.countriesWithMembers;
    }

    return res.json({
      success: true,
      content: mergedContent,
      topics: PRESET_TOPICS,
      metrics: {
        projects: publicStats.publishedBooksCount,
        projectsList,
        finalAudioSeconds: Math.round(publishedAudioSeconds),
        finalAudioHours: publishedAudioSeconds / 3600,
        volunteers: publicStats.volunteersCount,
        memberNames: publicStats.memberNames,
        countries: calculatedCountries,
        countryMetricMode:
          settings.countryMetricMode ||
          (settings.manualCountries ? "MANUAL" : "AUTO"),
      },
      library: publishedLibraryItems,
      activities: publishedActivities,
      volunteerForms: settings.volunteerForms || PRESET_VOLUNTEER_FORMS,
    });
  } catch (err: any) {
    console.warn(
      "[publicRoutes] site-overview warning (serving default cached content):",
      err?.message || err,
    );
    return res.status(503).json({
      success: false,
      error: "تعذر تحميل بيانات الواجهة من قاعدة البيانات حالياً.",
    });
  }
});

/** Verify legacy PIN or new member invitation code */
const verifyActivationCodeHandler = async (req: any, res: any) => {
  const identifier = cleanText(req.body?.identifier, 200);
  const rawPin = cleanText(req.body?.pin || req.body?.code, 40);

  if (!identifier || !rawPin) {
    return res.status(400).json({
      success: false,
      error: "يرجى إدخال المعرف (البريد أو رقم الهاتف) وكود التفعيل/PIN.",
    });
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return res
      .status(503)
      .json({ success: false, error: "خدمة التفعيل غير متاحة حالياً." });
  }

  try {
    const userDoc = await findUserDocumentByIdentifier(db, identifier);

    if (!userDoc || !userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "لم يتم العثور على حساب مطابق للبيانات المدخلة.",
      });
    }

    const userData = userDoc.data() as any;
    if (
      userData.pinUsed === true ||
      (userData.hasPassword && userData.migratedAt)
    ) {
      return res.status(403).json({
        success: false,
        error: "تم تفعيل الحساب مسبقاً. استخدم تسجيل الدخول أو استعادة البريد.",
      });
    }

    // Check credentials from private_security subcollection if present
    let creds: any = {};
    try {
      const credDoc = await userDoc.ref
        .collection("private_security")
        .doc("credentials")
        .get();
      if (credDoc.exists) creds = credDoc.data() || {};
    } catch (err) {
      console.warn(
        "[publicRoutes] Error reading credentials subcollection:",
        err,
      );
    }

    // Verify PIN / Activation Code / Reset Code against stored hashes or codes
    let pinValid = false;
    const targetHash = creds.pinHash || userData.pinHash;
    if (targetHash && typeof targetHash === "string") {
      pinValid = await bcrypt.compare(rawPin, targetHash);
    }
    if (!pinValid) {
      const validPins = [
        userData.pin,
        userData.code,
        userData.activationCode,
        creds.pin,
        creds.code,
      ].filter(Boolean);
      pinValid = validPins.includes(rawPin);
    }

    if (!pinValid) {
      return res.status(401).json({
        success: false,
        error: "كود التحقق غير صحيح. تحقق من الرمز وحاول ثانية.",
      });
    }

    const isAlreadyActive = Boolean(
      userData.pinUsed === true ||
      (userData.status === "active" &&
        userData.hasPassword &&
        userData.migratedAt),
    );
    const isNewInvite = Boolean(
      !isAlreadyActive &&
      (userData.isInvite ||
        userData.status === "pending_activation" ||
        !userData.hasPassword),
    );

    return res.json({
      success: true,
      legacyId: userDoc.id,
      isAlreadyActive,
      canResetPassword: isAlreadyActive,
      isNewInvite,
      maskedName: maskArabicName(userData.name || "عضو إنصات"),
      rawName: userData.name || "",
      message: isAlreadyActive
        ? "تم التحقق من كود الحساب بنجاح. يمكنك الآن تعيين كلمة مرور جديدة لحسابك."
        : undefined,
      prefill: {
        name: userData.name || "",
        username: userData.username || "",
        email: userData.email || "",
        phone: userData.phone || "",
        country: userData.country || "العراق",
        role: userData.role || "MEMBER",
        department: userData.department || "",
      },
    });
  } catch (err: any) {
    console.error(
      "[publicRoutes] PIN/Code verification error:",
      err?.message || err,
    );
    return res
      .status(500)
      .json({ success: false, error: "حدث خطأ أثناء فحص كود التفعيل." });
  }
};

publicRouter.post(
  "/verify-legacy-pin",
  pinLimiter,
  verifyActivationCodeHandler,
);
publicRouter.post(
  "/verify-activation-code",
  pinLimiter,
  verifyActivationCodeHandler,
);

/** Atomically activate account (legacy or new invited member) with password */
const activateAccountHandler = async (req: any, res: any) => {
  const legacyId = cleanText(req.body?.legacyId || req.body?.inviteId, 200);
  const rawPin = cleanText(req.body?.pin || req.body?.code, 40);
  const name = cleanText(req.body?.name || req.body?.fullName, 120);
  const username = cleanText(req.body?.username, 40).toLowerCase();
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const phone = cleanText(req.body?.phone, 40);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const country = cleanText(req.body?.country, 80) || "العراق";
  const field = cleanText(req.body?.field, 120);
  const publicProfileConsent = req.body?.publicProfileConsent === true;
  const termsAccepted = req.body?.termsAccepted === true;

  if (!legacyId || !rawPin) {
    return res
      .status(400)
      .json({ success: false, error: "بيانات التفعيل غير مكتملة." });
  }

  if (!termsAccepted) {
    return res.status(400).json({
      success: false,
      error: "يجب الموافقة على شروط الاستخدام للمتابعة.",
    });
  }

  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      error: "يرجى إدخال بريد إلكتروني أو رقم هاتف على الأقل.",
    });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "كلمة المرور يجب أن تتكون من 6 خانات على الأقل.",
    });
  }

  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();
  if (!auth || !db) {
    return res
      .status(503)
      .json({ success: false, error: "الخدمة غير متاحة حالياً." });
  }

  try {
    let userRef = db.collection("users").doc(legacyId);
    let userDoc = await userRef.get();
    if (!userDoc.exists) {
      const fallbackDoc = await findUserDocumentByIdentifier(db, legacyId);
      if (fallbackDoc && fallbackDoc.exists) {
        userDoc = fallbackDoc as any;
        userRef = db.collection("users").doc(userDoc.id);
      }
    }
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "لم يتم العثور على سجل العضو أو كود التفعيل.",
      });
    }

    const currentData = userDoc.data() as any;
    if (
      currentData.pinUsed === true ||
      (currentData.status === "active" &&
        currentData.hasPassword &&
        currentData.migratedAt)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "تم تفعيل هذا الحساب مسبقاً. يمكنك تسجيل الدخول بكلمة المرور أو اختيار إعادة تعيينها.",
      });
    }

    // Check credentials subcollection if present
    let creds: any = {};
    try {
      const credDoc = await userDoc.ref
        .collection("private_security")
        .doc("credentials")
        .get();
      if (credDoc.exists) creds = credDoc.data() || {};
    } catch (err) {
      console.warn(
        "[publicRoutes] Error reading credentials subcollection:",
        err,
      );
    }

    // Re-verify PIN / Code / Reset Code
    let pinValid = false;
    const targetHash = creds.pinHash || currentData.pinHash;
    if (targetHash && typeof targetHash === "string") {
      pinValid = await bcrypt.compare(rawPin, targetHash);
    }
    if (!pinValid) {
      const validPins = [
        currentData.pin,
        currentData.code,
        currentData.activationCode,
        creds.pin,
        creds.code,
      ].filter(Boolean);
      pinValid = validPins.includes(rawPin);
    }

    if (!pinValid) {
      return res
        .status(401)
        .json({ success: false, error: "كود التحقق غير صحيح." });
    }

    if (!activationEmailMatchesAccount(currentData.email, email)) {
      return res.status(403).json({
        success: false,
        error: "البريد الإلكتروني لا يطابق حساب التفعيل",
      });
    }

    const cleanPhoneE164 = phone ? normalizedPhone(phone) : "";
    if (cleanPhoneE164) {
      const phoneCheck = await db
        .collection("users")
        .where("phoneNormalized", "==", cleanPhoneE164)
        .limit(1)
        .get();
      if (!phoneCheck.empty) {
        const matchingDoc = phoneCheck.docs[0];
        if (matchingDoc.id !== legacyId && matchingDoc.id !== currentData.uid) {
          return res.status(409).json({
            success: false,
            error:
              "رقم الهاتف مسجل بالفعل لعضو آخر. يرجى استخدام رقم آخر أو التواصل مع الإدارة.",
          });
        }
      }
    }

    // Securely hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Ensure safe UID and valid email for Firebase Auth
    const rawUidCandidate = (currentData.uid || legacyId || "").replace(
      /[^a-zA-Z0-9_-]/g,
      "",
    );
    let authUid = rawUidCandidate
      ? rawUidCandidate.length > 120
        ? rawUidCandidate.slice(0, 120)
        : rawUidCandidate
      : `user_${Date.now()}`;
    const storedEmail = cleanText(currentData.email, 254).toLowerCase();
    const userEmail =
      storedEmail ||
      (email && email.includes("@")
        ? email.trim().toLowerCase()
        : `member_${authUid}@ensat.org`);

    const effectiveName =
      name ||
      currentData.name ||
      currentData.fullName ||
      username ||
      "عضو إنصات";

    // Only update an Auth identity already bound to this Firestore record.
    // A caller-supplied email must never select an unrelated Firebase user.
    let authUser = await auth.getUser(authUid).catch(() => null);
    if (!authUser && userEmail) {
      const emailUser = await auth.getUserByEmail(userEmail).catch(() => null);
      if (
        emailUser &&
        !isFirebaseUserBoundToActivation(
          emailUser.uid,
          legacyId,
          currentData.uid,
        )
      ) {
        return res
          .status(409)
          .json({ success: false, error: "البريد الإلكتروني مرتبط بحساب آخر" });
      }
      authUser = emailUser;
    }

    if (authUser) {
      authUid = authUser.uid;
      await auth.updateUser(authUid, {
        email: userEmail,
        password,
        displayName: effectiveName,
      });
    } else {
      const newAuth = await auth.createUser({
        uid: authUid,
        email: userEmail,
        password,
        displayName: effectiveName,
      });
      authUid = newAuth.uid;
    }

    // In a batch/transaction, disable PIN, update user doc, link data, and log audit
    const batch = db.batch();

    const updatedUserRef = db.collection("users").doc(authUid);
    batch.set(
      updatedUserRef,
      {
        ...currentData,
        uid: authUid,
        legacyId,
        name: effectiveName,
        displayName: effectiveName,
        username: username || currentData.username,
        usernameNormalized: (
          username ||
          currentData.username ||
          ""
        ).toLowerCase(),
        email: userEmail,
        phone: phone || currentData.phone || null,
        phoneNormalized: phone ? normalizedPhone(phone) : null,
        country: country || currentData.country || "",
        field: field || currentData.field || "",
        passwordHash,
        hasPassword: true,
        pinUsed: true,
        pin: null, // Wipe plain PIN
        pinHash: null, // Invalidate PIN hash
        code: null,
        activationCode: null,
        migratedAt: new Date().toISOString(),
        legacyMigrated: !currentData.isInvite,
        migratedViaPin: true,
        migrationAuditStatus: "PENDING_AUDIT",
        publicProfileConsent,
        termsAcceptedAt: new Date().toISOString(),
        status: "active",
        isActive: true,
        isInvite: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Also store passwordHash in private_security subcollection
    const credsRef = updatedUserRef
      .collection("private_security")
      .doc("credentials");
    batch.set(
      credsRef,
      {
        passwordHash,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // If legacy document had a different ID, mark old doc as migrated
    if (legacyId !== authUid) {
      batch.update(userRef, {
        pinUsed: true,
        migratedToUid: authUid,
        migratedAt: new Date().toISOString(),
        pin: null,
      });
    }

    // Migration audit document for the admin audit section
    const migrationAuditRef = db.collection("migration_audits").doc(authUid);
    batch.set(
      migrationAuditRef,
      {
        uid: authUid,
        legacyId,
        name: effectiveName,
        originalIdentifier:
          currentData.identifier ||
          currentData.rawIdentifier ||
          currentData.phone ||
          currentData.email ||
          legacyId,
        originalPhone: currentData.phone || null,
        originalEmail: currentData.email || null,
        newUsername: username || currentData.username,
        newEmail: userEmail,
        newPhone: phone || currentData.phone || null,
        country: country || currentData.country || "",
        field: field || currentData.field || "",
        role: currentData.role || "MEMBER",
        role_display_ar: currentData.role_display_ar || "عضو متطوع",
        migratedAt: new Date().toISOString(),
        auditStatus: "PENDING_AUDIT",
        auditedBy: null,
        auditedAt: null,
        auditNotes: "",
        verifiedVia: currentData.isInvite
          ? "INVITE_CODE_ACTIVATION"
          : "PIN_MIGRATION",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Audit log (NEVER include raw PIN or password)
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: currentData.isInvite
        ? "MEMBER_INVITATION_ACTIVATED"
        : "LEGACY_PIN_MIGRATED",
      targetUid: authUid,
      legacyId,
      timestamp: new Date().toISOString(),
      performedBy: "self_migration",
      auditStatus: "PENDING_AUDIT",
    });

    await batch.commit();

    // Generate custom auth token so user is automatically logged in without waiting
    let customToken: string | null = null;
    try {
      customToken = await auth.createCustomToken(authUid, {
        role: currentData.role || "MEMBER",
        account_status: "active",
      });
    } catch (tokenErr) {
      console.warn(
        "[publicRoutes] Could not generate custom token during PIN migration:",
        tokenErr,
      );
    }

    return res.json({
      success: true,
      customToken,
      uid: authUid,
      email: userEmail,
      message: "تم تفعيل وتأكيد حسابك بنجاح. يمكنك الآن الدخول مباشرة.",
    });
  } catch (err: any) {
    console.error("[publicRoutes] PIN migration failed:", err?.message || err);
    const isQuota =
      err?.message?.includes("RESOURCE_EXHAUSTED") || err?.code === 8;
    const errorMsg = isQuota
      ? "تم الوصول للحد اليومي المؤقت للعمليات السحابية. يرجى المحاولة بعد قليل أو التواصل مع الإدارة."
      : err?.message || "تعذر إكمال الترحيل. حاول ثانية.";
    return res.status(500).json({ success: false, error: errorMsg });
  }
};

publicRouter.post("/migrate-legacy-pin", pinLimiter, activateAccountHandler);
publicRouter.post("/activate-account", pinLimiter, activateAccountHandler);

/** Dynamic volunteer applications submission */
publicRouter.post("/volunteer-apply", applicationLimiter, async (req, res) => {
  const formId = cleanText(req.body?.formId, 100) || "form-general";
  const formName = cleanText(req.body?.formName, 180) || "طلب انضمام عام";
  const targetRole = cleanText(req.body?.targetRole, 60) || "MEMBER";
  const applicantName = cleanText(req.body?.applicantName, 120);
  const applicantUsername = cleanText(
    req.body?.applicantUsername,
    40,
  ).toLowerCase();
  const applicantEmail = cleanText(req.body?.applicantEmail, 254).toLowerCase();
  const applicantPhone = cleanText(req.body?.applicantPhone, 40);
  const applicantCountry = cleanText(req.body?.applicantCountry, 80);
  const answers =
    req.body?.answers && typeof req.body.answers === "object"
      ? req.body.answers
      : {};
  const termsAccepted = req.body?.termsAccepted === true;
  const publicProfileConsent = req.body?.publicProfileConsent === true;

  if (!applicantName || applicantName.length < 2) {
    return res.status(400).json({
      success: false,
      error: "يرجى إدخال الاسم الكامل (حرفان على الأقل).",
    });
  }

  if (!applicantEmail && !applicantPhone) {
    return res.status(400).json({
      success: false,
      error: "يرجى إدخال بريد إلكتروني أو رقم هاتف للتواصل.",
    });
  }

  const db = getFirebaseAdminFirestore();
  if (!db) {
    return res
      .status(503)
      .json({ success: false, error: "خدمة تقديم الطلبات غير مهيأة حالياً." });
  }

  try {
    const docRef = await db.collection("volunteer_applications").add({
      formId,
      formName,
      targetRole,
      applicantName,
      applicantUsername: applicantUsername || null,
      applicantEmail: applicantEmail || null,
      applicantPhone: applicantPhone || null,
      applicantPhoneNormalized: applicantPhone
        ? normalizedPhone(applicantPhone)
        : null,
      applicantCountry: applicantCountry || null,
      answers,
      status: "SUBMITTED",
      workflowStatus: "SUBMITTED",
      termsAccepted,
      publicProfileConsent,
      source: "public_portal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      applicationId: docRef.id,
      message: "تم استلام طلب التطوع بنجاح وسيتم مراجعته.",
    });
  } catch (err: any) {
    console.error(
      "[publicRoutes] Failed to save volunteer application:",
      err?.message || err,
    );
    return res
      .status(500)
      .json({ success: false, error: "تعذر حفظ طلب التطوع." });
  }
});

/**
 * Firebase email/password accepts email only. This endpoint resolves a known
 * username or phone to its account email after rate limiting; passwords are
 * still verified exclusively by Firebase Authentication on the client.
 */
publicRouter.post(
  "/auth/resolve-identifier",
  identifierLimiter,
  async (req, res) => {
    const identifier = cleanText(req.body?.identifier, 254);
    if (!identifier)
      return res
        .status(400)
        .json({ success: false, error: "تعذر التحقق من بيانات الدخول." });
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier))
      return res.json({ success: true, loginEmail: identifier.toLowerCase() });

    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "خدمة تسجيل الدخول غير مهيأة." });

    try {
      const isPhone = /^\+?[0-9\s()-]{7,30}$/.test(identifier);
      const field = isPhone ? "phoneNormalized" : "usernameNormalized";
      const lookup = isPhone
        ? normalizedPhone(identifier)
        : identifier.toLowerCase();
      const snapshot = await db
        .collection("users")
        .where(field, "==", lookup)
        .limit(1)
        .get();
      const user = snapshot.docs[0]?.data();
      if (!user?.email || typeof user.email !== "string") {
        return res
          .status(401)
          .json({ success: false, error: "بيانات الدخول غير صحيحة." });
      }
      return res.json({ success: true, loginEmail: user.email.toLowerCase() });
    } catch {
      return res
        .status(401)
        .json({ success: false, error: "بيانات الدخول غير صحيحة." });
    }
  },
);

/**
 * Public Certificate Verification Endpoint
 * Allows anyone with a certificate code to verify its authenticity and view official details.
 */
publicRouter.get("/certificates/:code", async (req, res) => {
  const code = cleanText(req.params.code, 60).toUpperCase();
  if (!code)
    return res
      .status(400)
      .json({ success: false, error: "رمز الشهادة مطلوب." });

  const db = getFirebaseAdminFirestore();
  if (!db)
    return res
      .status(503)
      .json({ success: false, error: "الخدمة غير متاحة حالياً." });

  try {
    let certDoc: any = null;
    let certId = code;

    const snapshot = await db
      .collection("certificates")
      .where("code", "==", code)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      certDoc = snapshot.docs[0].data();
      certId = snapshot.docs[0].id;
    } else {
      const byId = await db
        .collection("certificates")
        .doc(req.params.code)
        .get();
      if (byId.exists) {
        certDoc = byId.data();
        certId = byId.id;
      }
    }

    if (!certDoc) {
      return res.status(404).json({
        success: false,
        error: "No certificate found with this code.",
      });
    }

    const recipientName =
      certDoc.recipientName || certDoc.targetName || "Valued Recipient";
    const reason =
      certDoc.reason ||
      certDoc.achievement ||
      "Outstanding dedication and volunteer excellence in Ensat Initiative.";
    const status = certDoc.status || "valid";

    return res.json({
      success: true,
      certificate: {
        id: certId,
        code: certDoc.code || certId,
        targetName: recipientName,
        recipientName,
        certType: certDoc.certType || "Certificate of Appreciation",
        reason,
        achievement: reason,
        role: certDoc.role || "MEMBER",
        grantingEntity:
          certDoc.grantingEntity || "Ensat Initiative Administration",
        responsibleName: certDoc.responsibleName || "General Supervisor",
        issuedAt: certDoc.issuedAt || certDoc.createdAt,
        status,
        revokedAt: certDoc.revokedAt || null,
        revokeReason: certDoc.revokeReason || null,
        imageUrl: certDoc.imageUrl || null,
      },
    });
  } catch {
    return res.status(503).json({
      success: false,
      error: "Unable to verify certificate at this time.",
    });
  }
});

// Public verify by ID or Code
publicRouter.get("/certificate/verify/:id", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  if (!db)
    return res
      .status(503)
      .json({ success: false, error: "Database not configured" });

  const { id } = req.params;
  if (!id)
    return res.status(400).json({
      success: false,
      error: "Certificate code or identifier is required",
    });

  try {
    let certDoc: any = null;
    let certId = id;

    const snap = await db.collection("certificates").doc(id).get();
    if (snap.exists) {
      certDoc = snap.data();
      certId = snap.id;
    } else {
      const q = await db
        .collection("certificates")
        .where("code", "==", id.toUpperCase())
        .limit(1)
        .get();
      if (!q.empty) {
        certDoc = q.docs[0].data();
        certId = q.docs[0].id;
      }
    }

    if (!certDoc) {
      return res.status(404).json({
        success: false,
        error: "No certificate found matching this identifier.",
      });
    }

    const recipientName =
      certDoc.recipientName || certDoc.targetName || "Valued Recipient";
    const reason =
      certDoc.reason ||
      certDoc.achievement ||
      "Outstanding dedication and volunteer excellence in Ensat Initiative.";
    const status = certDoc.status || "valid";

    return res.json({
      success: true,
      certificate: {
        id: certId,
        code: certDoc.code || certId,
        targetName: recipientName,
        recipientName,
        certType: certDoc.certType || "Certificate of Appreciation",
        reason,
        achievement: reason,
        role: certDoc.role || "MEMBER",
        grantingEntity:
          certDoc.grantingEntity || "Ensat Initiative Administration",
        responsibleName: certDoc.responsibleName || "General Supervisor",
        issuedAt: certDoc.issuedAt || certDoc.createdAt,
        status,
        revokedAt: certDoc.revokedAt || null,
        revokeReason: certDoc.revokeReason || null,
        imageUrl: certDoc.imageUrl || null,
      },
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: "Unable to verify certificate." });
  }
});

export { publicRouter };
