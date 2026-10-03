import { getFirebaseAdminFirestore } from "../firebaseAdmin";
import { getSupabaseAdminClient } from "../supabaseAdmin";
import { normalizePhone } from "../userLookup";

function roleToCanonicalId(roleStr?: string): string {
  if (!roleStr) return "member";
  const r = roleStr.toUpperCase().trim();
  switch (r) {
    case "SUPER_ADMIN":
    case "SUPERADMIN":
      return "super_admin";
    case "ADMIN":
      return "admin";
    case "CONTENT_MANAGER":
      return "content_manager";
    case "MEMBERS_MANAGER":
    case "HR":
      return "members_manager";
    case "OPERATIONS_MANAGER":
      return "operations_manager";
    case "AUDIO_ENGINEER":
      return "audio_engineer";
    case "QA_REVIEWER":
      return "qa_reviewer";
    case "NARRATOR":
      return "narrator";
    case "REWARDS_MANAGER":
      return "rewards_manager";
    case "CERTIFICATE_MANAGER":
      return "certificate_manager";
    case "PENDING":
      return "pending";
    case "SUSPENDED":
      return "suspended";
    default:
      return "member";
  }
}

function statusToCanonical(
  statusStr?: string,
): "ACTIVE" | "PENDING" | "SUSPENDED" | "REVIEW" {
  if (!statusStr) return "ACTIVE";
  const s = statusStr.toUpperCase().trim();
  if (s === "PENDING") return "PENDING";
  if (s === "SUSPENDED" || s === "INACTIVE") return "SUSPENDED";
  if (s === "REVIEW") return "REVIEW";
  return "ACTIVE";
}

export async function runFullMigration(): Promise<{
  usersCount: number;
  booksCount: number;
  tasksCount: number;
  formsCount: number;
  applicationsCount: number;
  libraryCount: number;
  errors: string[];
}> {
  const db = getFirebaseAdminFirestore();
  const supabase = getSupabaseAdminClient();

  const result = {
    usersCount: 0,
    booksCount: 0,
    tasksCount: 0,
    formsCount: 0,
    applicationsCount: 0,
    libraryCount: 0,
    errors: [] as string[],
  };

  if (!supabase) {
    result.errors.push("Supabase admin client is not initialized.");
    return result;
  }

  console.log(
    "=== STARTING FAST ROBUST FIREBASE TO SUPABASE MIGRATION (COPY-ONLY) ===",
  );

  // -------------------------------------------------------------
  // 1. PROFILES & WALLETS
  // -------------------------------------------------------------
  try {
    // 1a. Load existing Supabase profiles into memory
    const { data: existingRows } = await supabase
      .from("profiles")
      .select("id, email, firebase_uid, username, phone_normalized");

    const existingList = existingRows || [];
    const idByFirebaseUid = new Map<string, string>();
    const idByEmail = new Map<string, string>();
    const idByPhone = new Map<string, string>();
    const idByUsername = new Map<string, string>();
    const usedUsernames = new Set<string>();
    const usedEmails = new Set<string>();
    const usedPhones = new Set<string>();

    for (const p of existingList) {
      if (p.firebase_uid) idByFirebaseUid.set(p.firebase_uid, p.id);
      if (p.email) {
        idByEmail.set(p.email.toLowerCase(), p.id);
        usedEmails.add(p.email.toLowerCase());
      }
      if (p.phone_normalized) {
        idByPhone.set(p.phone_normalized, p.id);
        usedPhones.add(p.phone_normalized);
      }
      if (p.username) {
        idByUsername.set(p.username.toLowerCase(), p.id);
        usedUsernames.add(p.username.toLowerCase());
      }
    }

    // 1b. Build consolidated map
    const candidates: any[] = [];

    // Firestore users
    if (db) {
      const snap = await db.collection("users").get();
      console.log(`Loaded ${snap.size} Firestore users.`);
      for (const doc of snap.docs) {
        const d = doc.data();
        const uid = d.uid || doc.id;
        const email = (d.email || "").trim().toLowerCase();
        const phone = d.phone || d.phoneNumber || "";
        const phoneNorm =
          d.phoneNormalized || (phone ? normalizePhone(phone) : "");
        const username = (d.username || d.usernameNormalized || "")
          .replace(/^@/, "")
          .trim()
          .toLowerCase();

        candidates.push({
          firebase_uid: uid,
          full_name: d.fullName || d.displayName || d.name || "عضو إنصات",
          email: email || null,
          phone: phone || null,
          phone_normalized: phoneNorm || null,
          username: username || null,
          country: d.country || d.nationality || null,
          nationality: d.nationality || d.country || null,
          role_id: roleToCanonicalId(d.role || d.canonicalRole),
          status: statusToCanonical(d.status || d.accountStatus),
          is_super_admin: d.is_super_admin === true || d.role === "SUPER_ADMIN",
          platformAccess: d.platformAccess || {},
          bio: d.bio || null,
          field: d.field || null,
          token_version: d.tokenVersion || 1,
          is_archived: d.isArchived === true,
        });
      }
    }

    // Process and upsert profiles
    const profilesToUpsert: any[] = [];
    const walletsToUpsert: any[] = [];
    const platformAccessToUpsert: any[] = [];

    for (const c of candidates) {
      let matchedId: string | null = null;
      if (c.firebase_uid && idByFirebaseUid.has(c.firebase_uid)) {
        matchedId = idByFirebaseUid.get(c.firebase_uid)!;
      } else if (c.email && idByEmail.has(c.email)) {
        matchedId = idByEmail.get(c.email)!;
      } else if (c.phone_normalized && idByPhone.has(c.phone_normalized)) {
        matchedId = idByPhone.get(c.phone_normalized)!;
      } else if (c.username && idByUsername.has(c.username)) {
        matchedId = idByUsername.get(c.username)!;
      }

      const id =
        matchedId ||
        c.firebase_uid ||
        `usr_${Math.random().toString(36).substring(2, 12)}`;

      // Resolve username uniqueness
      let finalUsername = c.username;
      if (finalUsername) {
        const lowerU = finalUsername.toLowerCase();
        if (usedUsernames.has(lowerU) && idByUsername.get(lowerU) !== id) {
          finalUsername = `${lowerU}_${id.slice(-4)}`;
        }
        usedUsernames.add(finalUsername.toLowerCase());
        idByUsername.set(finalUsername.toLowerCase(), id);
      }

      if (c.email) {
        usedEmails.add(c.email.toLowerCase());
        idByEmail.set(c.email.toLowerCase(), id);
      }
      if (c.phone_normalized) {
        usedPhones.add(c.phone_normalized);
        idByPhone.set(c.phone_normalized, id);
      }
      if (c.firebase_uid) {
        idByFirebaseUid.set(c.firebase_uid, id);
      }

      profilesToUpsert.push({
        id,
        firebase_uid: c.firebase_uid || id,
        full_name: c.full_name,
        email: c.email,
        phone: c.phone,
        phone_normalized: c.phone_normalized,
        username: finalUsername,
        country: c.country || "العراق",
        nationality: c.nationality || "العراق",
        role_id: c.role_id || "member",
        status: c.status || "ACTIVE",
        is_super_admin: Boolean(c.is_super_admin),
        token_version: c.token_version || 1,
        is_archived: Boolean(c.is_archived),
        updated_at: new Date().toISOString(),
      });

      walletsToUpsert.push({
        profile_id: id,
        points_balance: 0,
        gems_balance: 0,
        received_gems: 0,
        rest_days_balance: 0,
        updated_at: new Date().toISOString(),
      });

      for (const plat of ["recording", "tasks", "rewards", "admin"]) {
        platformAccessToUpsert.push({
          profile_id: id,
          platform_id: plat,
          is_allowed: c.is_super_admin || Boolean(c.platformAccess?.[plat]),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Deduplicate profilesToUpsert by id
    const uniqueProfilesMap = new Map<string, any>();
    for (const p of profilesToUpsert) uniqueProfilesMap.set(p.id, p);
    const uniqueProfiles = Array.from(uniqueProfilesMap.values());

    console.log(
      `Upserting ${uniqueProfiles.length} deduplicated profiles to Supabase in batches...`,
    );
    const batchSize = 25;
    for (let i = 0; i < uniqueProfiles.length; i += batchSize) {
      const batch = uniqueProfiles.slice(i, i + batchSize);
      const { error } = await supabase
        .from("profiles")
        .upsert(batch, { onConflict: "id" });
      if (error) {
        console.warn("Profiles batch error:", error.message);
        result.errors.push(`Profiles batch error: ${error.message}`);
      } else {
        result.usersCount += batch.length;
      }
    }

    // Deduplicate wallets
    const uniqueWalletsMap = new Map<string, any>();
    for (const w of walletsToUpsert) uniqueWalletsMap.set(w.profile_id, w);
    const uniqueWallets = Array.from(uniqueWalletsMap.values());
    for (let i = 0; i < uniqueWallets.length; i += batchSize) {
      const batch = uniqueWallets.slice(i, i + batchSize);
      await supabase
        .from("gem_wallets")
        .upsert(batch, { onConflict: "profile_id" });
    }

    // Deduplicate platform_access
    const uniquePlatformMap = new Map<string, any>();
    for (const pa of platformAccessToUpsert)
      uniquePlatformMap.set(`${pa.profile_id}_${pa.platform_id}`, pa);
    const uniquePlatform = Array.from(uniquePlatformMap.values());
    for (let i = 0; i < uniquePlatform.length; i += batchSize) {
      const batch = uniquePlatform.slice(i, i + batchSize);
      await supabase
        .from("platform_access")
        .upsert(batch, { onConflict: "profile_id,platform_id" });
    }
  } catch (err: any) {
    result.errors.push(`Profiles migration: ${err?.message}`);
  }

  // -------------------------------------------------------------
  // 2. BOOKS
  // -------------------------------------------------------------
  try {
    if (db) {
      const booksSnap = await db.collection("books").get();
      const booksList: any[] = [];
      for (const doc of booksSnap.docs) {
        const d = doc.data();
        booksList.push({
          id: doc.id,
          title: d.title || "كتاب بدون عنوان",
          author: d.author || "",
          description: d.description || "",
          category: d.category || "عام",
          target_chapters: Number(d.total_parts || d.target_chapters || 0),
          completed_chapters: Number(
            d.completed_parts || d.completed_chapters || 0,
          ),
          status: d.status || "PLANNED",
          assigned_narrators: Array.isArray(d.assigned_narrators)
            ? d.assigned_narrators
            : [],
          drive_folder_id: d.drive_folder_id || null,
          drive_folder_link: d.drive_folder_link || null,
          pdf_drive_id: d.pdf_drive_id || null,
          pdf_drive_link: d.pdf_drive_link || null,
          cover_image_url: d.cover_image_url || null,
          is_published_public: d.is_published_public === true,
          is_archived: d.is_archived === true || d.isArchived === true,
          created_at: d.created_at || d.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (booksList.length > 0) {
        const { error } = await supabase
          .from("books")
          .upsert(booksList, { onConflict: "id" });
        if (error) result.errors.push(`Books error: ${error.message}`);
        else result.booksCount = booksList.length;
      }
    }
  } catch (err: any) {
    result.errors.push(`Books migration: ${err?.message}`);
  }

  // -------------------------------------------------------------
  // 3. TASKS & ASSIGNMENTS
  // -------------------------------------------------------------
  try {
    if (db) {
      const tasksSnap = await db.collection("tasks").get();
      const tasksList: any[] = [];
      const assignmentsList: any[] = [];

      for (const doc of tasksSnap.docs) {
        const d = doc.data();
        const statusStr = String(d.status || "OPEN").toUpperCase();
        const priorityStr = String(d.priority || "MEDIUM").toUpperCase();

        tasksList.push({
          id: doc.id,
          title: d.title || "مهمة بدون عنوان",
          description: d.description || "",
          platform: d.platform || "tasks",
          priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priorityStr)
            ? priorityStr
            : "MEDIUM",
          stage: d.stage || "TODO",
          status: statusStr === "ARCHIVED" ? "COMPLETED" : statusStr || "OPEN",
          due_date: d.dueDate || d.due_date || null,
          book_id: d.bookId || null,
          points_reward: Number(d.pointsReward || 0),
          is_archived: d.isArchived === true || statusStr === "ARCHIVED",
          created_at: d.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (Array.isArray(d.assigneeUids)) {
          for (const uid of d.assigneeUids) {
            assignmentsList.push({
              task_id: doc.id,
              profile_id: uid,
              assigned_at: new Date().toISOString(),
            });
          }
        }
      }

      if (tasksList.length > 0) {
        const { error } = await supabase
          .from("tasks")
          .upsert(tasksList, { onConflict: "id" });
        if (error) result.errors.push(`Tasks error: ${error.message}`);
        else result.tasksCount = tasksList.length;
      }

      // Filter assignments to ensure profile_id actually exists in profiles
      if (assignmentsList.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id");
        const validProfileIds = new Set((profs || []).map((p) => p.id));
        const validAssignments = assignmentsList.filter((a) =>
          validProfileIds.has(a.profile_id),
        );
        if (validAssignments.length > 0) {
          await supabase
            .from("task_assignments")
            .upsert(validAssignments, { onConflict: "task_id,profile_id" });
        }
      }
    }
  } catch (err: any) {
    result.errors.push(`Tasks migration: ${err?.message}`);
  }

  // -------------------------------------------------------------
  // 4. VOLUNTEER FORMS & APPLICATIONS
  // -------------------------------------------------------------
  try {
    if (db) {
      const formsSnap = await db.collection("volunteer_forms").get();
      const formsList: any[] = [];
      for (const doc of formsSnap.docs) {
        const d = doc.data();
        formsList.push({
          id: doc.id,
          title: d.title || "استمارة تطوع",
          description: d.description || "",
          status: d.status || "PUBLISHED",
          is_archived: d.is_archived === true,
          created_at: d.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (formsList.length > 0) {
        const { error } = await supabase
          .from("application_forms")
          .upsert(formsList, { onConflict: "id" });
        if (!error) result.formsCount = formsList.length;
      }

      const appsSnap = await db.collection("volunteer_applications").get();
      const appsList: any[] = [];
      for (const doc of appsSnap.docs) {
        const d = doc.data();
        const phone = d.applicant_phone || d.phone || "";
        const phoneNorm =
          d.applicant_phone_normalized || (phone ? normalizePhone(phone) : "");
        const email = d.applicant_email || d.email || "";

        appsList.push({
          id: doc.id,
          form_id: d.form_id || d.formId || null,
          applicant_name: d.applicant_name || d.name || "متقدم للتطوع",
          applicant_email: email || null,
          applicant_phone: phone || null,
          applicant_phone_normalized: phoneNorm || null,
          country: d.country || "العراق",
          nationality: d.nationality || d.country || "العراق",
          status: String(d.status || "PENDING").toUpperCase(),
          reviewer_notes: d.reviewer_notes || null,
          is_archived: d.is_archived === true,
          created_at: d.createdAt || d.submittedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (appsList.length > 0) {
        // Upsert in batches
        for (let i = 0; i < appsList.length; i += 25) {
          const batch = appsList.slice(i, i + 25);
          const { error } = await supabase
            .from("volunteer_applications")
            .upsert(batch, { onConflict: "id" });
          if (!error) result.applicationsCount += batch.length;
        }
      }
    }
  } catch (err: any) {
    result.errors.push(`Forms/Applications: ${err?.message}`);
  }

  // -------------------------------------------------------------
  // 5. PUBLIC LIBRARY
  // -------------------------------------------------------------
  try {
    if (db) {
      const libSnap = await db.collection("public_library").get();
      const libList: any[] = [];
      for (const doc of libSnap.docs) {
        const d = doc.data();
        libList.push({
          id: doc.id,
          book_id: d.book_id || d.bookId || null,
          title: d.title || "تسجيل صوتي",
          author: d.author || "",
          narrator: d.narrator || "",
          audio_url: d.audio_url || d.audioUrl || "",
          drive_file_id: d.drive_file_id || d.driveFileId || null,
          duration_seconds: Number(d.duration_seconds || d.duration || 0),
          cover_image_url: d.cover_image_url || d.coverImageUrl || null,
          category: d.category || "عام",
          description: d.description || "",
          status: d.status || "PUBLISHED",
          sort_order: Number(d.sort_order || 0),
          is_archived: d.is_archived === true,
          created_at: d.created_at || d.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      if (libList.length > 0) {
        const { error } = await supabase
          .from("public_library")
          .upsert(libList, { onConflict: "id" });
        if (!error) result.libraryCount = libList.length;
      }
    }
  } catch (err: any) {
    result.errors.push(`Library: ${err?.message}`);
  }

  console.log("=== MIGRATION FINISHED ===", result);
  return result;
}
