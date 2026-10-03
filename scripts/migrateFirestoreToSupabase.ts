import "dotenv/config";
import { getFirebaseAdminFirestore } from "../src/server/firebaseAdmin";
import { getSupabaseAdminClient } from "../src/server/supabaseAdmin";
import { normalizeRole } from "../src/lib/rbacPolicy";

function toIsoString(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (typeof val.toDate === "function") {
    try {
      return val.toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  if (typeof val === "number") {
    return new Date(val).toISOString();
  }
  if (val._seconds) {
    return new Date(val._seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

async function runMigration() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`\n======================================================`);
  console.log(`🚀 بدء ترحيل البيانات من Firestore إلى Supabase`);
  console.log(`وضع التشغيل: ${isDryRun ? "🔍 تجريبي (DRY RUN - بدون تعديل فعلي)" : "💾 ترحيل فعلي (LIVE UPSERT)"}`);
  console.log(`======================================================\n`);

  const firestore = getFirebaseAdminFirestore();
  const supabase = getSupabaseAdminClient();

  if (!firestore) {
    console.error("❌ تعذر الاتصال بـ Firebase Firestore. يرجى التحقق من متغيرات البيئة.");
    process.exit(1);
  }

  if (!supabase) {
    console.error("❌ تعذر الاتصال بـ Supabase. يرجى التحقق من SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const stats = {
    users: { total: 0, migrated: 0, errors: 0 },
    books: { total: 0, migrated: 0, errors: 0 },
    recordings: { total: 0, migrated: 0, errors: 0 },
    tasks: { total: 0, migrated: 0, errors: 0 },
    publicLibrary: { total: 0, migrated: 0, errors: 0 },
  };

  // 1. Migrate Users -> Profiles
  console.log("📦 1. قراءة وترحيل المستخدمين (users -> profiles)...");
  try {
    const usersSnap = await firestore.collection("users").get();
    stats.users.total = usersSnap.size;

    for (const doc of usersSnap.docs) {
      const u = doc.data();
      const firebaseUid = u.uid || doc.id;
      const role = normalizeRole(u.canonicalRole || u.role);
      const isSuperAdmin = Boolean(u.is_super_admin || role === "SUPER_ADMIN");

      const profilePayload = {
        id: u.id || `usr_${doc.id}`,
        firebase_uid: firebaseUid,
        email: (u.email || `${doc.id}@ansat.org`).toLowerCase().trim(),
        username: u.username || u.email?.split("@")[0] || doc.id,
        full_name: u.fullName || u.name || "عضو إنصات",
        phone: u.phone || null,
        phone_normalized: u.phoneNormalized || u.normalizedPhone || null,
        country: u.country || null,
        nationality: u.nationality || null,
        show_nationality_public: Boolean(u.publicProfileConsent),
        role_id: role.toLowerCase(),
        status: (u.accountStatus || u.status || "ACTIVE").toUpperCase(),
        is_super_admin: isSuperAdmin,
        token_version: Number(u.tokenVersion || 1),
        is_archived: false,
        created_at: toIsoString(u.createdAt),
        updated_at: toIsoString(u.updatedAt),
      };

      if (!isDryRun) {
        const { error } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "firebase_uid" });
        if (error) {
          console.warn(`⚠️ خطأ ترحيل المستخدم ${doc.id}:`, error.message);
          stats.users.errors++;
        } else {
          stats.users.migrated++;
        }
      } else {
        stats.users.migrated++;
      }
    }
    console.log(`✅ تم فحص ${stats.users.total} مستخدم (ترحيل: ${stats.users.migrated}, أخطاء: ${stats.users.errors})`);
  } catch (err: any) {
    console.error("❌ خطأ أثناء معالجة مجموعة المستخدمين:", err.message);
  }

  // 2. Migrate Books
  console.log("\n📦 2. قراءة وترحيل الكتب (books -> books)...");
  try {
    const booksSnap = await firestore.collection("books").get();
    stats.books.total = booksSnap.size;

    for (const doc of booksSnap.docs) {
      const b = doc.data();
      const bookPayload = {
        id: doc.id,
        title: b.title || "كتاب بدون عنوان",
        author: b.author || "مؤلف مجهول",
        description: b.description || "",
        category: b.category || "",
        target_chapters: Number(b.total_parts || 0),
        completed_chapters: Number(b.completed_parts || 0),
        status: b.status || "PLANNED",
        assigned_narrators: Array.isArray(b.assigned_narrators) ? b.assigned_narrators : [],
        drive_folder_id: b.rawDriveFileId || null,
        drive_folder_link: b.drive_folder_link || null,
        pdf_drive_id: b.pdf_file_id || null,
        pdf_drive_link: b.pdf_url || null,
        cover_image_url: b.cover_color || null,
        is_published_public: Boolean(b.status === "PUBLISHED" || b.is_published_public),
        is_archived: false,
        created_at: toIsoString(b.createdAt),
        updated_at: toIsoString(b.updatedAt),
      };

      if (!isDryRun) {
        const { error } = await supabase.from("books").upsert(bookPayload, { onConflict: "id" });
        if (error) {
          console.warn(`⚠️ خطأ ترحيل الكتاب ${doc.id}:`, error.message);
          stats.books.errors++;
        } else {
          stats.books.migrated++;
        }
      } else {
        stats.books.migrated++;
      }
    }
    console.log(`✅ تم فحص ${stats.books.total} كتاب (ترحيل: ${stats.books.migrated}, أخطاء: ${stats.books.errors})`);
  } catch (err: any) {
    console.error("❌ خطأ أثناء معالجة مجموعة الكتب:", err.message);
  }

  // 3. Migrate Recordings
  console.log("\n📦 3. قراءة وترحيل التسجيلات (recordings -> recordings)...");
  try {
    const recSnap = await firestore.collection("recordings").get();
    stats.recordings.total = recSnap.size;

    for (const doc of recSnap.docs) {
      const r = doc.data();
      const recPayload = {
        id: doc.id,
        book_id: r.bookId || null,
        book_title: r.bookTitle || null,
        chapter_id: r.chapterId || null,
        chapter_number: Number(r.chapterNumber || 0),
        narrator_name: r.narratorName || "قارئ إنصات",
        stage: r.stage || "RAW",
        status: r.status || "PENDING",
        drive_file_id: r.driveFileId || r.drive_file_id || null,
        duration_seconds: Number(r.durationSeconds || r.duration_seconds || 0),
        audio_format: r.audioFormat || null,
        feedback_notes: r.feedbackNotes || null,
        is_archived: false,
        created_at: toIsoString(r.createdAt),
        updated_at: toIsoString(r.updatedAt),
      };

      if (!isDryRun) {
        const { error } = await supabase.from("recordings").upsert(recPayload, { onConflict: "id" });
        if (error) {
          console.warn(`⚠️ خطأ ترحيل التسجيل ${doc.id}:`, error.message);
          stats.recordings.errors++;
        } else {
          stats.recordings.migrated++;
        }
      } else {
        stats.recordings.migrated++;
      }
    }
    console.log(`✅ تم فحص ${stats.recordings.total} تسجيل (ترحيل: ${stats.recordings.migrated}, أخطاء: ${stats.recordings.errors})`);
  } catch (err: any) {
    console.error("❌ خطأ أثناء معالجة مجموعة التسجيلات:", err.message);
  }

  // 4. Migrate Tasks
  console.log("\n📦 4. قراءة وترحيل المهام (tasks -> tasks)...");
  try {
    const tasksSnap = await firestore.collection("tasks").get();
    stats.tasks.total = tasksSnap.size;

    for (const doc of tasksSnap.docs) {
      const t = doc.data();
      const taskPayload = {
        id: doc.id,
        title: t.title || "مهمة إنصات",
        description: t.description || "",
        platform: t.platform || "tasks",
        priority: t.priority || "MEDIUM",
        stage: t.stage || "TODO",
        status: t.status || "OPEN",
        due_date: t.dueDate ? toIsoString(t.dueDate) : null,
        points_reward: Number(t.pointsReward || 0),
        is_archived: false,
        created_at: toIsoString(t.createdAt),
        updated_at: toIsoString(t.updatedAt),
      };

      if (!isDryRun) {
        const { error } = await supabase.from("tasks").upsert(taskPayload, { onConflict: "id" });
        if (error) {
          console.warn(`⚠️ خطأ ترحيل المهمة ${doc.id}:`, error.message);
          stats.tasks.errors++;
        } else {
          stats.tasks.migrated++;
        }
      } else {
        stats.tasks.migrated++;
      }
    }
    console.log(`✅ تم فحص ${stats.tasks.total} مهمة (ترحيل: ${stats.tasks.migrated}, أخطاء: ${stats.tasks.errors})`);
  } catch (err: any) {
    console.error("❌ خطأ أثناء معالجة مجموعة المهام:", err.message);
  }

  // Summary
  console.log(`\n======================================================`);
  console.log(`📊 تقرير مقارنة الترحيل النهائي:`);
  console.log(`- المستخدمين: ${stats.users.migrated} من أصل ${stats.users.total}`);
  console.log(`- الكتب: ${stats.books.migrated} من أصل ${stats.books.total}`);
  console.log(`- التسجيلات: ${stats.recordings.migrated} من أصل ${stats.recordings.total}`);
  console.log(`- المهام: ${stats.tasks.migrated} من أصل ${stats.tasks.total}`);
  console.log(`======================================================\n`);
}

runMigration().catch((err) => {
  console.error("❌ فشل غير متوقع في سكربت الترحيل:", err);
  process.exit(1);
});
