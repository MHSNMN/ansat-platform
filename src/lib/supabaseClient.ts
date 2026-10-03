import { apiFetch } from "./api";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  limit,
} from "firebase/firestore";
import { db } from "./firebaseClient";
import { driveClient } from "./googleDriveClient";
import { User, Book, AudioRecording, ActivityLog } from "../types";
import { normalizeUserPermissions } from "./permissions";
import { sharedSupabase, getSupabaseCredentials } from "./supabaseSingleton";

export const isSupabaseConfigured = Boolean(
  getSupabaseCredentials().url &&
  getSupabaseCredentials().key &&
  getSupabaseCredentials().url.includes("supabase.co"),
);

export const supabase = sharedSupabase;

// Memory Cache to drastically eliminate redundant Firestore reads (60s TTL)
interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
}
const MEMORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (prevents read exhaustion)
let memUsersCache: MemoryCacheEntry<User[]> | null = null;
let memBooksCache: MemoryCacheEntry<Book[]> | null = null;
let memRecordingsCache: MemoryCacheEntry<AudioRecording[]> | null = null;
let memLogsCache: MemoryCacheEntry<ActivityLog[]> | null = null;

export function invalidateClientCache(
  type?: "users" | "books" | "recordings" | "logs",
) {
  if (!type || type === "users") memUsersCache = null;
  if (!type || type === "books") memBooksCache = null;
  if (!type || type === "recordings") memRecordingsCache = null;
  if (!type || type === "logs") memLogsCache = null;
}

// Local Storage Keys
const USERS_KEY = "ensat_hub_users_v1";
const BOOKS_KEY = "ensat_hub_books_v1";
const RECORDINGS_KEY = "ensat_hub_recordings_v1";
const ACTIVITY_LOGS_KEY = "ensat_hub_activity_logs_v1";

import { INITIAL_BOOKS } from "../data/mockData";

const INITIAL_USERS: User[] = [];
const INITIAL_RECORDINGS: AudioRecording[] = [];
const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];

// Helper: Convert Google Drive URLs to Direct Playable/Download Stream URLs
export function convertDriveUrlToDirectStream(url: string): string {
  if (!url) return "";
  // Check for drive file URL match: /file/d/FILE_ID or ?id=FILE_ID
  const fileIdMatch =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    const fileId = fileIdMatch[1];
    return `https://docs.google.com/uc?export=download&id=${fileId}`;
  }
  return url;
}

// Initialize Local Storage if empty
export function initLocalDatabase() {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
  }
  const existingBooks = localStorage.getItem(BOOKS_KEY);
  if (!existingBooks || existingBooks === "[]") {
    localStorage.setItem(BOOKS_KEY, JSON.stringify(INITIAL_BOOKS));
  }
  if (!localStorage.getItem(RECORDINGS_KEY)) {
    localStorage.setItem(RECORDINGS_KEY, JSON.stringify(INITIAL_RECORDINGS));
  }
  if (!localStorage.getItem(ACTIVITY_LOGS_KEY)) {
    localStorage.setItem(
      ACTIVITY_LOGS_KEY,
      JSON.stringify(INITIAL_ACTIVITY_LOGS),
    );
  }
}

// Ensure database initialized
initLocalDatabase();

// API Helper Layer (Firebase Firestore + Supabase + Local Storage)

// 1. USERS
export async function fetchUsers(forceRefresh = false): Promise<User[]> {
  const now = Date.now();
  if (
    !forceRefresh &&
    memUsersCache &&
    now - memUsersCache.timestamp < MEMORY_CACHE_TTL_MS
  ) {
    return memUsersCache.data;
  }

  // 1. Check local storage first (0 network/reads)
  const localRaw = localStorage.getItem(USERS_KEY);
  if (!forceRefresh && localRaw) {
    try {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memUsersCache = { data: parsed, timestamp: now };
        return parsed;
      }
    } catch {
      // Ignore corrupted localStorage cache
    }
  }

  let usersList: User[] = [];

  // 2. Secondary/Preferred: Supabase (0 Firestore reads)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .limit(200);
      if (!error && data && data.length > 0) {
        usersList = (data as any[]).map((raw) => {
          const uid = raw.firebase_uid || raw.id;
          const resolvedName = (
            raw.full_name ||
            raw.username ||
            (raw.email ? raw.email.split("@")[0] : "") ||
            "عضو إنصات"
          ).trim();
          return {
            ...raw,
            id: uid,
            uid,
            name: resolvedName,
            fullName: resolvedName,
            displayName: resolvedName,
          } as unknown as User;
        });
      }
    } catch (e) {
      console.warn("Supabase fetchUsers fallback:", e);
    }
  }

  // 3. Fallback: Firebase Firestore only if Supabase and local cache returned nothing
  if (usersList.length === 0) {
    try {
      const snap = await getDocs(query(collection(db, "users"), limit(50)));
      if (!snap.empty) {
        usersList = snap.docs.map((d) => {
          const raw = d.data();
          const uid = raw.uid || d.id;
          const resolvedName = (
            raw.name ||
            raw.displayName ||
            raw.fullName ||
            (raw.email ? raw.email.split("@")[0] : "") ||
            "عضو إنصات"
          ).trim();
          return {
            ...raw,
            id: uid,
            uid,
            name: resolvedName,
            fullName: resolvedName,
            displayName: resolvedName,
          } as unknown as User;
        });
      }
    } catch (e) {
      console.warn("Firebase Firestore fetchUsers fallback:", e);
    }
  }
  const safeUsers = usersList.map((u) => {
    const resolvedName = (
      u.name ||
      (u as any).displayName ||
      (u as any).fullName ||
      (u.email ? u.email.split("@")[0] : "") ||
      "عضو إنصات"
    ).trim();
    return normalizeUserPermissions({
      ...u,
      name: resolvedName,
      fullName: resolvedName,
      displayName: resolvedName,
    } as any);
  });
  if (safeUsers.length > 0) {
    localStorage.setItem(USERS_KEY, JSON.stringify(safeUsers));
  }
  memUsersCache = { data: safeUsers, timestamp: now };
  return safeUsers;
}

export async function getUserByPin(pin: string): Promise<User | null> {
  // Legacy PINs must never be queried in browser-accessible tables. Members
  // migrate once through the verified server route, then use unified Firebase Auth.
  void pin;
  return null;
}

export async function saveUsers(users: User[]): Promise<void> {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Firebase Firestore (Parallel Batch Write)
  try {
    await Promise.all(
      users
        .filter((u) => u && u.id)
        .map((u) => setDoc(doc(db, "users", u.id), u, { merge: true })),
    );
  } catch (e) {
    console.warn("Firebase saveUsers error:", e);
  }

  // Supabase
  if (supabase) {
    try {
      await supabase.from("users").upsert(users);
    } catch (e) {
      console.warn("Supabase upsert users failed:", e);
    }
  }
}

export async function addUser(
  newUser: User | Omit<User, "id">,
  actorName = "المدير",
): Promise<User[]> {
  const users = await fetchUsers();
  const userId =
    "id" in newUser && newUser.id ? newUser.id : "usr-" + Date.now();
  const user: User = {
    ...newUser,
    id: userId,
  };
  const updated = [user, ...users.filter((u) => u.id !== userId)];

  localStorage.setItem(USERS_KEY, JSON.stringify(updated));

  // Firebase Firestore - single doc update
  try {
    await setDoc(doc(db, "users", userId), user);
  } catch (e) {
    console.warn("Firebase single add user error:", e);
  }

  // Supabase
  if (supabase) {
    try {
      await supabase.from("users").insert([user]);
    } catch (e) {
      console.warn("Supabase single add user error:", e);
    }
  }

  await addActivityLog({
    user_name: actorName,
    action_type: "EDIT_PERMISSION",
    action_display_ar: "إضافة عضو جديد",
    details: `تمت إضافة العضو الجديد [${user.name}] بدور (${user.role_display_ar})`,
  });

  return updated;
}

export async function deleteUser(
  userId: string,
  actorName = "المدير",
): Promise<User[]> {
  const users = await fetchUsers();
  const target = users.find((u) => u.id === userId);
  const updated = users.filter((u) => u.id !== userId);

  // 1. Immediately sync local storage
  localStorage.setItem(USERS_KEY, JSON.stringify(updated));

  // 2. Delete from Firestore
  try {
    await deleteDoc(doc(db, "users", userId));
  } catch (e) {
    console.warn("Firebase delete user error:", e);
  }

  // 3. Delete from Supabase
  if (supabase) {
    try {
      await supabase.from("users").delete().eq("id", userId);
    } catch (e) {
      console.warn("Supabase delete user failed:", e);
    }
  }

  if (target) {
    await addActivityLog({
      user_name: actorName,
      action_type: "EDIT_PERMISSION",
      action_display_ar: "حذف عضو",
      details: `تم إلغاء حساب وتصريح العضو [${target.name}] من المنصة`,
    });
  }

  return updated;
}

export async function updateUserFull(
  userId: string,
  updates: Partial<User>,
  actorName = "المدير",
): Promise<User[]> {
  const localRaw = localStorage.getItem(USERS_KEY);
  const users: User[] = localRaw ? JSON.parse(localRaw) : await fetchUsers();
  const target = users.find((u) => u.id === userId);
  const updated = users.map((u) =>
    u.id === userId ? { ...u, ...updates } : u,
  );

  localStorage.setItem(USERS_KEY, JSON.stringify(updated));

  // Firebase Firestore - single doc update
  if (target) {
    try {
      const merged = { ...target, ...updates };
      await setDoc(doc(db, "users", userId), merged, { merge: true });
    } catch (e) {
      console.warn("Firebase single user update error:", e);
    }

    // Supabase
    if (supabase) {
      try {
        const merged = { ...target, ...updates };
        await supabase.from("users").upsert([merged]);
      } catch (e) {
        console.warn("Supabase single user update error:", e);
      }
    }
  }

  if (target && updates.name && updates.name.trim() !== target.name) {
    const oldName = target.name;
    const newName = updates.name.trim();

    // Cascading updates across recordings and books
    try {
      const recs = await fetchRecordings();
      const updatedRecs = recs.map((r) =>
        r.narratorId === oldName ? { ...r, narratorId: newName } : r,
      );
      await saveRecordings(updatedRecs);

      const booksList = await fetchBooks();
      const updatedBooks = booksList.map((b) => ({
        ...b,
        assigned_narrators: b.assigned_narrators.map((n) =>
          n === oldName ? newName : n,
        ),
      }));
      await saveBooks(updatedBooks);
    } catch (e) {
      console.warn("Cascading updates on narrator name change warning:", e);
    }
  }

  if (target) {
    await addActivityLog({
      user_name: actorName,
      action_type: "EDIT_PERMISSION",
      action_display_ar: "تعديل بيانات عضو",
      details: `تم تحديث بيانات العضو [${updates.name || target.name}] وتحديث كافة تسجيلاته المربوطة باسمه القديم تلقائياً`,
    });
  }

  return updated;
}

export async function updateUserPermissions(
  userId: string,
  updates: Partial<User>,
  actorName = "المدير",
): Promise<User[]> {
  return updateUserFull(userId, updates, actorName);
}

// 2. BOOKS
export async function fetchBooks(forceRefresh = false): Promise<Book[]> {
  const authoritative = await apiFetch("/api/recording/books");
  if (!authoritative.ok)
    throw new Error(`تعذر جلب الكتب (${authoritative.status})`);
  const authoritativeBody = await authoritative.json();
  if (!Array.isArray(authoritativeBody.books))
    throw new Error("استجابة الكتب غير صالحة");
  memBooksCache = { data: authoritativeBody.books, timestamp: Date.now() };
  return authoritativeBody.books;
  const now = Date.now();
  if (
    !forceRefresh &&
    memBooksCache &&
    now - memBooksCache.timestamp < MEMORY_CACHE_TTL_MS
  ) {
    return memBooksCache.data;
  }

  // 1. Try server API endpoint first (merges Supabase + Firestore seamlessly)
  try {
    const apiRes = await apiFetch("/api/recording/books");
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.books && Array.isArray(data.books)) {
        if (data.books.length > 0) {
          const local = localStorage.getItem(BOOKS_KEY);
          let localBooks: Book[] = [];
          try {
            localBooks = local ? JSON.parse(local) : [];
          } catch {
            /* ignore */
          }
          const serverIds = new Set(data.books.map((b: any) => b.id));
          const recentLocal = Array.isArray(localBooks)
            ? localBooks.filter(
                (b) =>
                  !serverIds.has(b.id) &&
                  b.createdAt &&
                  Date.now() - new Date(b.createdAt).getTime() < 10 * 60 * 1000,
              )
            : [];
          const mergedBooks = [...recentLocal, ...data.books];
          localStorage.setItem(BOOKS_KEY, JSON.stringify(mergedBooks));
          memBooksCache = { data: mergedBooks as Book[], timestamp: now };
          return mergedBooks as Book[];
        }
      }
    }
  } catch (apiErr) {
    console.warn("API /api/recording/books fetch note:", apiErr);
  }

  // 2. Check local storage
  const local = localStorage.getItem(BOOKS_KEY);
  if (!forceRefresh && local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memBooksCache = { data: parsed as Book[], timestamp: now };
        return parsed as Book[];
      }
    } catch (e) {
      console.warn("Failed to parse local books", e);
    }
  }

  // 3. Supabase direct read with schema-conforming column mapping
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data && data.length > 0) {
        const mappedBooks: Book[] = data.map((b: any) => ({
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
          createdAt: b.created_at || b.createdAt || new Date().toISOString(),
        }));
        localStorage.setItem(BOOKS_KEY, JSON.stringify(mappedBooks));
        memBooksCache = { data: mappedBooks, timestamp: now };
        return mappedBooks;
      }
    } catch (e) {
      console.warn("Supabase fetchBooks fallback note:", e);
    }
  }

  // 4. Fallback: Firebase Firestore
  try {
    const snap = await getDocs(query(collection(db, "books"), limit(50)));
    if (!snap.empty) {
      const booksList = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Book)
        .filter((b) => !b.isArchived);
      if (booksList.length > 0) {
        localStorage.setItem(BOOKS_KEY, JSON.stringify(booksList));
        memBooksCache = { data: booksList, timestamp: now };
        return booksList;
      }
    }
  } catch (e) {
    console.warn("Firebase fetchBooks fallback note:", e);
  }

  // 5. Fallback: return cached local if exists, otherwise initial books
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memBooksCache = { data: parsed as Book[], timestamp: now };
        return parsed as Book[];
      }
    } catch {
      // ignore
    }
  }

  return INITIAL_BOOKS;
}

export async function saveBooks(books: Book[]): Promise<void> {
  if (!books || books.length === 0) return;
  invalidateClientCache("books");
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));

  // Firebase Firestore (Parallel Batch Write)
  try {
    await Promise.all(
      books
        .filter((b) => b && b.id)
        .map((b) => setDoc(doc(db, "books", b.id), b, { merge: true })),
    );
  } catch (e) {
    console.warn("Firebase saveBooks error:", e);
  }

  // Supabase
  if (supabase) {
    try {
      const sbPayload = books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category,
        description: b.description || "",
        target_chapters: b.total_parts,
        completed_chapters: b.completed_parts,
        assigned_narrators: b.assigned_narrators || [],
        drive_folder_link: b.drive_folder_link || null,
        pdf_drive_link: b.pdf_url || null,
        cover_image_url: b.coverUrl || null,
        is_archived: false,
        created_at: b.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("books")
        .upsert(sbPayload, { onConflict: "id" });
      if (error) {
        console.warn("Supabase upsert books warning:", error);
      }
    } catch (e) {
      console.warn("Supabase upsert books failed:", e);
    }
  }
}

export async function addBook(
  newBook: Omit<Book, "id" | "createdAt"> & { id?: string; createdAt?: string },
  actorName = "المدير",
): Promise<Book[]> {
  const response = await apiFetch("/api/recording/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newBook),
  });
  if (!response.ok) throw new Error(`تعذر إضافة الكتاب (${response.status})`);
  invalidateClientCache("books");
  return fetchBooks(true);
  // Pre-create folder in Drive if configured
  let driveFolderLink = "";
  try {
    const res = await driveClient.createBookFolder(newBook.title);
    if (res?.webViewLink) {
      driveFolderLink = res.webViewLink;
    }
  } catch (e) {
    console.warn("Pre-create book folder note:", e);
  }

  const bookId = newBook.id || "book-" + Date.now();
  const nowIso = new Date().toISOString();
  const book: Book = {
    ...newBook,
    id: bookId,
    createdAt: newBook.createdAt || nowIso.split("T")[0],
    drive_folder_link:
      driveFolderLink || (newBook as any).drive_folder_link || "",
  };

  // Immediate optimistic local update for 0ms UI latency
  const currentLocal = localStorage.getItem(BOOKS_KEY);
  let existingBooks: Book[] = [];
  try {
    existingBooks = currentLocal
      ? JSON.parse(currentLocal)
      : memBooksCache?.data || [];
  } catch {
    existingBooks = memBooksCache?.data || [];
  }
  const updated = [book, ...existingBooks.filter((b) => b.id !== bookId)];
  localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));
  memBooksCache = { data: updated, timestamp: Date.now() };

  // Primary: Call server API which writes to Firestore Admin & Supabase
  try {
    const apiRes = await apiFetch("/api/recording/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(book),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.books && Array.isArray(data.books)) {
        const merged = [
          book,
          ...data.books.filter((b: any) => b.id !== bookId),
        ];
        localStorage.setItem(BOOKS_KEY, JSON.stringify(merged));
        memBooksCache = { data: merged, timestamp: Date.now() };
        return merged;
      }
    }
  } catch (apiErr) {
    console.warn(
      "API /api/recording/books add failed, fallback to direct writes:",
      apiErr,
    );
  }

  // Fallback: Direct Firestore & Supabase writes
  try {
    await setDoc(doc(db, "books", book.id), book, { merge: true });
    if (supabase) {
      await supabase.from("books").upsert(
        {
          id: book.id,
          title: book.title,
          author: book.author,
          category: book.category,
          description: book.description || "",
          target_chapters: book.total_parts,
          completed_chapters: book.completed_parts,
          assigned_narrators: book.assigned_narrators || [],
          drive_folder_link: book.drive_folder_link || null,
          pdf_drive_link: book.pdf_url || null,
          pdf_drive_id: (book as any).pdf_file_id || null,
          cover_image_url: book.coverUrl || null,
          is_archived: false,
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "id" },
      );
    }
  } catch (e) {
    console.warn("Single book add direct write note:", e);
  }

  await addActivityLog({
    user_name: actorName,
    action_type: "BOOK_ADD",
    action_display_ar: "إضافة كتاب جديد",
    details: `تمت إضافة كتاب [${book.title}] للمؤلف [${book.author}] عدد أجزائه (${book.total_parts})`,
  });

  return updated;
}

export async function updateBook(
  id: string,
  updates: Partial<Book>,
  actorName = "المدير",
): Promise<Book[]> {
  const response = await apiFetch(
    `/api/recording/books/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    },
  );
  if (!response.ok) throw new Error(`تعذر تعديل الكتاب (${response.status})`);
  invalidateClientCache("books");
  return fetchBooks(true);
  const localRaw = localStorage.getItem(BOOKS_KEY);
  const books: Book[] = localRaw ? JSON.parse(localRaw) : await fetchBooks();
  const target = books.find((b) => b.id === id);
  const updated = books.map((b) => (b.id === id ? { ...b, ...updates } : b));

  localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));
  memBooksCache = { data: updated, timestamp: Date.now() };

  // Primary: Call server API
  try {
    const apiRes = await apiFetch(`/api/recording/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.books && Array.isArray(data.books)) {
        localStorage.setItem(BOOKS_KEY, JSON.stringify(data.books));
        memBooksCache = { data: data.books, timestamp: Date.now() };
        return data.books;
      }
    }
  } catch (apiErr) {
    console.warn("API /api/recording/books update fallback:", apiErr);
  }

  if (target) {
    try {
      const merged = { ...target, ...updates };
      await setDoc(doc(db, "books", id), merged, { merge: true });
      if (supabase) {
        await supabase.from("books").upsert([merged], { onConflict: "id" });
      }
    } catch (e) {
      console.warn("Single book update error:", e);
    }
  }

  if (target) {
    await addActivityLog({
      user_name: actorName,
      action_type: "BOOK_EDIT",
      action_display_ar: "تعديل كتاب",
      details: `تم تعديل بيانات وشروط الكتاب [${updates.title || target.title}]`,
    });
  }

  return updated;
}

export async function deleteBook(
  id: string,
  actorName = "المدير",
): Promise<Book[]> {
  const response = await apiFetch(
    `/api/recording/books/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`تعذر أرشفة الكتاب (${response.status})`);
  invalidateClientCache("books");
  return fetchBooks(true);
  const localRaw = localStorage.getItem(BOOKS_KEY);
  const books: Book[] = localRaw ? JSON.parse(localRaw) : await fetchBooks();
  const target = books.find((b) => b.id === id);
  const updated = books.filter((b) => b.id !== id);

  localStorage.setItem(BOOKS_KEY, JSON.stringify(updated));
  memBooksCache = { data: updated, timestamp: Date.now() };

  // Primary: Call server API
  try {
    const apiRes = await apiFetch(`/api/recording/books/${id}`, {
      method: "DELETE",
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.books && Array.isArray(data.books)) {
        localStorage.setItem(BOOKS_KEY, JSON.stringify(data.books));
        memBooksCache = { data: data.books, timestamp: Date.now() };
      }
    }
  } catch (apiErr) {
    console.warn("API /api/recording/books delete fallback:", apiErr);
  }

  // Firebase
  try {
    await deleteDoc(doc(db, "books", id));
  } catch (e) {
    console.warn("Firebase delete book error:", e);
  }

  // Supabase
  if (supabase) {
    try {
      await supabase.from("books").delete().eq("id", id);
    } catch (e) {
      console.warn("Supabase delete book error:", e);
    }
  }

  // If we have a target book, we need to clean up its associated assets
  if (target) {
    // 1. Delete associated recordings
    try {
      const recordings = await fetchRecordings();
      const bookRecordings = recordings.filter(
        (r) => r.bookId === target.title,
      );

      for (const recording of bookRecordings) {
        await deleteRecording(recording.id, actorName);
      }
    } catch (e) {
      console.warn("Error deleting associated recordings:", e);
    }

    // 2. Delete main drive folder
    if (target.title) {
      try {
        await apiFetch("/api/delete-book-folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookTitle: target.title }),
        });
      } catch (e) {
        console.warn("Error calling delete-book-folders API:", e);
      }
    }

    // 3. Delete PDF file if exists
    if (target.pdf_file_id) {
      try {
        const { driveClient } = await import("./googleDriveClient");
        await driveClient.deleteFile(target.pdf_file_id);
      } catch (e) {
        console.warn("Error deleting PDF file:", e);
      }
    }

    await addActivityLog({
      user_name: actorName,
      action_type: "BOOK_DELETE",
      action_display_ar: "حذف كتاب نهائياً",
      details: `تم حذف مشروع الكتاب [${target.title}] وجميع تسجيلاته وملفاته نهائياً من المنصة`,
    });
  }

  return updated;
}

export async function deleteMultipleBooks(
  ids: string[],
  actorName = "المدير",
): Promise<Book[]> {
  for (const id of ids) {
    await deleteBook(id, actorName);
  }
  return await fetchBooks();
}

// Helper: Normalize recordings from any source (API, Firestore, Supabase, LocalStorage)
export function normalizeRecording(raw: any): AudioRecording {
  if (!raw || typeof raw !== "object") return raw;
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

  const driveId = extractDriveId(
    raw.drive_file_id,
    raw.rawDriveFileId,
    raw.driveFileId,
    raw.masteredDriveFileId,
    raw.mastered_file_url,
    raw.masteredUrl,
    raw.file_url,
    raw.rawUrl,
    raw.drive_url,
    raw.public_link,
    raw.audioUrl,
  );

  const bookTitle = raw.book_title || raw.bookId || raw.title || "كتاب صوتي";
  const bookId = raw.bookId || raw.book_title || bookTitle;
  const partNum = Number(raw.part_number ?? raw.partNumber ?? 1);
  const narratorName = raw.narrator_name || raw.narratorId || "ديمة";
  const rawStatus = String(
    raw.status || raw.workflowStatus || "RAW_QA_PENDING",
  ).toUpperCase();
  const isMastered =
    rawStatus === "MASTERED" ||
    rawStatus === "FINAL" ||
    rawStatus === "FINAL_APPROVED";
  const status = isMastered
    ? "MASTERED"
    : rawStatus.includes("APPROVED")
      ? "QA_APPROVED"
      : "RAW";
  const workflowStatus = isMastered
    ? "MASTERED"
    : rawStatus.includes("APPROVED")
      ? "RAW_APPROVED"
      : "RAW_QA_PENDING";

  const playableUrl = driveId ? `/api/audio/${driveId}` : "";
  const rawUrl =
    raw.rawUrl && !raw.rawUrl.includes("/my-drive")
      ? raw.rawUrl
      : playableUrl || raw.file_url || "";
  const masteredUrl =
    raw.masteredUrl && !raw.masteredUrl.includes("/my-drive")
      ? raw.masteredUrl
      : raw.mastered_file_url && !raw.mastered_file_url.includes("/my-drive")
        ? raw.mastered_file_url
        : isMastered && playableUrl
          ? playableUrl
          : "";

  const dateVal = raw.createdAt || raw.created_at || new Date().toISOString();

  return {
    id: raw.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    bookId: bookId,
    book_title: bookTitle,
    title: raw.title || `${bookTitle} - جزء ${partNum}`,
    chapter: raw.chapter || null,
    partNumber: partNum,
    part_number: partNum,
    narratorId: narratorName,
    narrator_name: narratorName,
    status,
    workflowStatus: workflowStatus as any,
    rawDriveFileId: driveId || undefined,
    drive_file_id: driveId || undefined,
    driveFileId: driveId || undefined,
    rawUrl: rawUrl || undefined,
    masteredUrl: masteredUrl || undefined,
    file_url: rawUrl || undefined,
    mastered_file_url: masteredUrl || undefined,
    drive_url: driveId
      ? `https://drive.google.com/file/d/${driveId}/view`
      : raw.drive_url || undefined,
    public_link: driveId
      ? `https://drive.google.com/file/d/${driveId}/view`
      : raw.public_link || undefined,
    file_name:
      raw.file_name ||
      raw.mastered_file_name ||
      `${bookTitle}_Part${String(partNum).padStart(2, "0")}.mp3`,
    mastered_file_name:
      raw.mastered_file_name ||
      raw.file_name ||
      `${bookTitle}_Part${String(partNum).padStart(2, "0")}.mp3`,
    duration:
      raw.duration ||
      (raw.durationSeconds
        ? `${Math.floor(raw.durationSeconds / 60)}:${raw.durationSeconds % 60}`
        : ""),
    durationSeconds: Number(raw.durationSeconds) || 0,
    file_size: raw.file_size || "",
    isArchived: Boolean(raw.isArchived === true || raw.is_archived === true),
    is_archived: Boolean(raw.isArchived === true || raw.is_archived === true),
    ownerId: raw.ownerId || raw.userId || raw.narratorId || undefined,
    userId: raw.userId || raw.ownerId || undefined,
    createdAt: dateVal,
    created_at: dateVal,
    updatedAt: raw.updatedAt || raw.updated_at || dateVal,
    updated_at: raw.updated_at || raw.updatedAt || dateVal,
  };
}

// 3. AUDIO RECORDINGS
export async function fetchRecordings(
  forceRefresh = false,
): Promise<AudioRecording[]> {
  const authoritative = await apiFetch("/api/recording/recordings");
  if (!authoritative.ok)
    throw new Error(`تعذر جلب التسجيلات (${authoritative.status})`);
  const authoritativeBody = await authoritative.json();
  if (!Array.isArray(authoritativeBody.recordings))
    throw new Error("استجابة التسجيلات غير صالحة");
  const visible = authoritativeBody.recordings.map(normalizeRecording);
  memRecordingsCache = { data: visible, timestamp: Date.now() };
  return visible;
  const now = Date.now();
  if (
    !forceRefresh &&
    memRecordingsCache &&
    now - memRecordingsCache.timestamp < MEMORY_CACHE_TTL_MS
  ) {
    return memRecordingsCache.data;
  }

  // 1. Primary Cloud Storage: Server-Side API endpoint (0 Firestore quota exhaustion, always returns all active recordings)
  try {
    const res = await apiFetch("/api/recording/recordings").catch(() => null);
    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (
        json &&
        json.success &&
        Array.isArray(json.recordings) &&
        json.recordings.length > 0
      ) {
        const normalized = json.recordings.map(normalizeRecording);
        localStorage.setItem(RECORDINGS_KEY, JSON.stringify(normalized));
        memRecordingsCache = { data: normalized, timestamp: now };
        return normalized;
      }
    }
  } catch (err) {
    console.warn("API fetchRecordings notice:", err);
  }

  // 2. Check local storage
  const local = localStorage.getItem(RECORDINGS_KEY);
  if (!forceRefresh && local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(normalizeRecording);
        memRecordingsCache = { data: normalized, timestamp: now };
        return normalized;
      }
    } catch (e) {
      console.warn("Failed to parse local recordings", e);
    }
  }

  // 3. Direct Firestore Fallback with normalization
  try {
    const snap = await getDocs(
      query(collection(db, "audio_recordings"), limit(100)),
    );
    if (!snap.empty) {
      const list = snap.docs
        .map((d) => normalizeRecording({ id: d.id, ...d.data() }))
        .filter((r) => !r.isArchived);
      if (list.length > 0) {
        localStorage.setItem(RECORDINGS_KEY, JSON.stringify(list));
        memRecordingsCache = { data: list, timestamp: now };
        return list;
      }
    }
  } catch (e) {
    console.warn("Firebase fetchRecordings fallback:", e);
  }

  const initialNormalized = (INITIAL_RECORDINGS || []).map(normalizeRecording);
  saveRecordings(initialNormalized);
  memRecordingsCache = { data: initialNormalized, timestamp: now };
  return initialNormalized;
}

export async function getMaxPartNumberForBook(
  bookTitle: string,
): Promise<number> {
  const recordings = await fetchRecordings();
  const bookRecordings = recordings.filter((r) => r.bookId === bookTitle);
  if (bookRecordings.length > 0) {
    return Math.max(...bookRecordings.map((r) => r.partNumber));
  }
  return 0;
}

export async function saveRecordings(
  recordings: AudioRecording[],
): Promise<void> {
  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));

  // Firebase Firestore (Parallel Batch Write)
  try {
    await Promise.all(
      recordings
        .filter((r) => r && r.id)
        .map((r) =>
          setDoc(doc(db, "audio_recordings", r.id), r, { merge: true }),
        ),
    );
  } catch (e) {
    console.warn("Firebase saveRecordings error:", e);
  }

  // Supabase
  if (supabase) {
    try {
      const { error } = await supabase
        .from("audio_recordings")
        .upsert(recordings);
      if (error) {
        console.warn("Supabase saveRecordings upsert warning:", error);
      }
    } catch (e) {
      console.warn("Supabase upsert recordings failed:", e);
    }
  }
}

export async function addRecording(
  rec: Omit<AudioRecording, "id" | "createdAt">,
): Promise<AudioRecording> {
  const newId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `rec-${Date.now()}`;
  const response = await apiFetch("/api/recording/recordings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...rec, id: newId }),
  });
  if (!response.ok) throw new Error(`تعذر حفظ التسجيل (${response.status})`);
  invalidateClientCache("recordings");
  const visible = await fetchRecordings(true);
  const saved = visible.find((item) => item.id === newId);
  if (!saved)
    throw new Error(
      "حُفظ التسجيل لكن تعذرت قراءته؛ حدّث الصفحة قبل إعادة المحاولة.",
    );
  return saved;
  const recId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "rec-" + Date.now();
  const newRec: AudioRecording = {
    ...rec,
    id: recId,
    createdAt: new Date().toLocaleString("ar-EG", { hour12: false }),
  };

  // Firebase Firestore
  try {
    await setDoc(doc(db, "audio_recordings", recId), newRec);
  } catch (e) {
    console.warn("Firebase insert recording failed:", e);
  }

  // Supabase
  if (supabase) {
    try {
      await supabase.from("audio_recordings").insert(newRec);
    } catch (e) {
      console.warn("Supabase insert recording failed:", e);
    }
  }

  // Auto increment book completed parts count
  try {
    const localBooksRaw = localStorage.getItem(BOOKS_KEY);
    const books: Book[] = localBooksRaw
      ? JSON.parse(localBooksRaw)
      : await fetchBooks();
    const targetBook = books.find((b) => b.title === rec.bookId);
    if (targetBook) {
      const localRecsRaw = localStorage.getItem(RECORDINGS_KEY);
      const allRecs: AudioRecording[] = localRecsRaw
        ? JSON.parse(localRecsRaw)
        : await fetchRecordings();
      const partsForBook = new Set(
        allRecs.filter((r) => r.bookId === rec.bookId).map((r) => r.partNumber),
      );
      partsForBook.add(rec.partNumber);
      const newCompleted = partsForBook.size;

      if (targetBook.completed_parts !== newCompleted) {
        targetBook.completed_parts = newCompleted;
        await setDoc(
          doc(db, "books", targetBook.id),
          { completed_parts: newCompleted },
          { merge: true },
        );
        if (supabase) {
          await supabase
            .from("books")
            .update({ completed_parts: newCompleted })
            .eq("id", targetBook.id);
        }
        localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
      }
    }
  } catch (e) {
    console.warn("Failed to update book completed parts:", e);
  }

  await addActivityLog({
    user_name: rec.narratorId,
    action_type: "UPLOAD",
    action_display_ar: "رفع تسجيل جديد",
    details: `تم رفع تسجيل خام لكتاب [${rec.bookId} - الجزء ${rec.partNumber}]`,
  });

  return newRec;
}

export async function updateRecording(
  id: string,
  updates: Partial<AudioRecording>,
  actorName?: string,
): Promise<AudioRecording[]> {
  if (!id) throw new Error("معرّف التسجيل مطلوب");
  const response = await apiFetch(
    `/api/recording/recordings/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    },
  );
  if (!response.ok) throw new Error(`تعذر تعديل التسجيل (${response.status})`);
  invalidateClientCache("recordings");
  return fetchRecordings(true);
  if (!id) {
    console.error("updateRecording called with undefined id");
    return await fetchRecordings();
  }
  const localRaw = localStorage.getItem(RECORDINGS_KEY);
  const recordings: AudioRecording[] = localRaw
    ? JSON.parse(localRaw)
    : await fetchRecordings();
  const target = recordings.find((r) => r.id === id);

  const updated = recordings.map((r) =>
    r.id === id ? { ...r, ...updates } : r,
  );

  if (
    target &&
    updates.workflowStatus &&
    updates.workflowStatus !== target.workflowStatus
  ) {
    let newStage = "";
    if (updates.workflowStatus === "RAW_APPROVED") {
      newStage = "qa_approved";
    } else if (updates.workflowStatus === "PUBLISHED") {
      newStage = "final";
    } else if (
      [
        "NARRATOR_REVISION_REQUIRED",
        "NARRATOR_REVISION_REQUIRED",
        "NARRATOR_REVISION_REQUIRED",
      ].includes(updates.workflowStatus)
    ) {
      newStage = "qa_rejected";
    } else if (updates.workflowStatus === "MASTERING") {
      newStage = "engineered";
    }
    if (newStage && target.rawDriveFileId && target.bookId) {
      driveClient
        .moveFile(target.rawDriveFileId, target.bookId, newStage)
        .catch((e) => console.warn("Failed to move file", e));
    }
  }

  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));

  // Firebase Firestore
  try {
    await setDoc(doc(db, "audio_recordings", id), updates, { merge: true });
  } catch (e) {
    console.warn("Firebase update recording error:", e);
  }

  // Supabase
  if (supabase) {
    try {
      await supabase.from("audio_recordings").update(updates).eq("id", id);
    } catch (e) {
      console.warn("Supabase update recording error:", e);
    }
  }

  if (target) {
    if (updates.workflowStatus === "MASTERING") {
      await addActivityLog({
        user_name: actorName || updates.masteredBy || "مهندس المونتاج",
        action_type: "MASTERING",
        action_display_ar: "اعتماد مونتاج صوتي",
        details: `تم إضافة النسخة المماسترة لكتاب [${target.bookId} - الجزء ${target.partNumber}]`,
      });
    } else if (
      updates.qaRating !== undefined ||
      updates.workflowStatus === "RAW_APPROVED" ||
      updates.workflowStatus === "PUBLISHED" ||
      updates.workflowStatus === "NARRATOR_REVISION_REQUIRED"
    ) {
      await addActivityLog({
        user_name: actorName || updates.qaReviewedBy || "مراقب الجودة",
        action_type: "QA_REVIEW",
        action_display_ar: "تقييم جودة المقطع",
        details: `تقييم المقطع [${target.bookId} - الجزء ${target.partNumber}] بـ (${updates.qaRating || 5}) نجوم`,
      });
    }
  }

  return updated;
}

export async function deleteRecording(
  id: string,
  actorName = "المدير",
): Promise<AudioRecording[]> {
  if (!id) throw new Error("معرّف التسجيل مطلوب");
  const response = await apiFetch(
    `/api/recording/recordings/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`تعذر أرشفة التسجيل (${response.status})`);
  invalidateClientCache("recordings");
  return fetchRecordings(true);
  if (!id) return await fetchRecordings();
  const localRaw = localStorage.getItem(RECORDINGS_KEY);
  const recordings: AudioRecording[] = localRaw
    ? JSON.parse(localRaw)
    : await fetchRecordings();
  const target = recordings.find((r) => r.id === id);
  if (!target) return recordings;

  const updated = recordings.filter((r) => r.id !== id);

  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));

  // Firebase Firestore
  try {
    await deleteDoc(doc(db, "audio_recordings", id));
  } catch (e) {
    console.warn("Firebase delete recording error:", e);
  }

  // Supabase
  if (supabase) {
    try {
      await supabase.from("audio_recordings").delete().eq("id", id);
    } catch (e) {
      console.warn("Supabase delete recording error:", e);
    }
  }

  if (target) {
    // Delete file from Google Drive
    if (target.rawDriveFileId) {
      try {
        const { driveClient } = await import("./googleDriveClient");
        await driveClient.deleteFile(target.rawDriveFileId);
      } catch (e) {
        console.warn("Error deleting recording file from Drive:", e);
      }
    }

    await addActivityLog({
      user_name: actorName,
      action_type: "RECORDING_DELETE",
      action_display_ar: "حذف تسجيل صوتي",
      details: `تم حذف المقطع والتسجيل الصوتي لكتاب [${target.bookId} - الجزء ${target.partNumber}] للراوي [${target.narratorId}] نهائياً`,
    });
  }

  return updated;
}

export async function deleteMultipleRecordings(
  ids: string[],
  actorName = "المدير",
): Promise<AudioRecording[]> {
  for (const id of ids) {
    await deleteRecording(id, actorName);
  }
  return await fetchRecordings();
}

export async function wipeAllPlatformData(
  actorName = "المدير الرئيسي",
): Promise<{
  books: Book[];
  recordings: AudioRecording[];
  logs: ActivityLog[];
}> {
  // Clear local storage arrays to empty []
  localStorage.setItem(BOOKS_KEY, JSON.stringify([]));
  localStorage.setItem(RECORDINGS_KEY, JSON.stringify([]));

  // Firebase Firestore
  try {
    const booksSnap = await getDocs(collection(db, "books"));
    for (const d of booksSnap.docs) {
      await deleteDoc(d.ref);
    }
    const recsSnap = await getDocs(collection(db, "audio_recordings"));
    for (const d of recsSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {
    console.warn("Firebase wipeAllPlatformData error:", e);
  }

  if (supabase) {
    try {
      await supabase.from("books").delete().neq("id", "___none___");
      await supabase.from("audio_recordings").delete().neq("id", "___none___");
    } catch (e) {
      console.warn("Supabase wipe all tables warning:", e);
    }
  }

  const logs = await addActivityLog({
    user_name: actorName,
    action_type: "SYSTEM_WIPE",
    action_display_ar: "تصفير كافة البيانات",
    details:
      "تم تفريغ كافة الكتب والتسجيلات الصوتية والتقييمات من قاعدة بيانات المنصة بنجاح",
  });

  return {
    books: [],
    recordings: [],
    logs,
  };
}

// 4. ACTIVITY LOGS
export async function fetchActivityLogs(
  forceRefresh = false,
): Promise<ActivityLog[]> {
  const now = Date.now();
  if (
    !forceRefresh &&
    memLogsCache &&
    now - memLogsCache.timestamp < MEMORY_CACHE_TTL_MS
  ) {
    return memLogsCache.data;
  }

  // 1. Check local storage first (0 network/reads)
  const local = localStorage.getItem(ACTIVITY_LOGS_KEY);
  if (!forceRefresh && local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memLogsCache = { data: parsed as ActivityLog[], timestamp: now };
        return parsed as ActivityLog[];
      }
    } catch (e) {
      console.warn("Failed to parse local activity logs", e);
    }
  }

  // 2. Primary Cloud Storage: Supabase (0 Firestore reads)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("createdAt", { ascending: false })
        .limit(30);
      if (!error && data && data.length > 0) {
        localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(data));
        memLogsCache = { data: data as ActivityLog[], timestamp: now };
        return data as ActivityLog[];
      }
    } catch (e) {
      console.warn("Supabase fetchActivityLogs fallback to local state", e);
    }
  }

  // 3. Fallback: Firebase Firestore only if Supabase and local storage failed
  try {
    const snap = await getDocs(
      query(collection(db, "activity_logs"), limit(20)),
    );
    if (!snap.empty) {
      const logsList = snap.docs.map((d) => d.data() as ActivityLog);
      localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(logsList));
      memLogsCache = { data: logsList, timestamp: now };
      return logsList;
    }
  } catch (e) {
    console.warn("Firebase fetchActivityLogs fallback:", e);
  }

  memLogsCache = { data: INITIAL_ACTIVITY_LOGS, timestamp: now };
  return INITIAL_ACTIVITY_LOGS;
}

export async function addActivityLog(
  log: Omit<ActivityLog, "id" | "createdAt">,
): Promise<ActivityLog[]> {
  invalidateClientCache("logs");
  const currentLogs = await fetchActivityLogs();
  const logId = "act-" + Date.now();
  const newLog: ActivityLog = {
    ...log,
    id: logId,
    createdAt: new Date().toLocaleString("ar-EG", { hour12: false }),
  };
  const updated = [newLog, ...currentLogs];
  localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(updated));
  memLogsCache = { data: updated, timestamp: Date.now() };

  // Firebase Firestore
  try {
    await setDoc(doc(db, "activity_logs", logId), newLog);
  } catch (e) {
    console.warn("Firebase insert activity_log failed:", e);
  }

  if (supabase) {
    try {
      await supabase.from("activity_logs").insert(newLog);
    } catch (e) {
      console.warn("Supabase insert activity_log failed:", e);
    }
  }

  return updated;
}

// 6. LEGACY FILE UPLOADER (Firebase Storage removed per mandate - audio uploads go via uploadQueue to Google Drive)
export async function uploadAudioFileToStorage(
  file: File,
  _path: string,
): Promise<string> {
  // Banned in Phase 4: No local Blob URLs for persistent storage.
  throw new Error("Direct blob generation is deprecated. Use storageService.");
}

export async function purgeCorruptedRecordings(): Promise<void> {
  // Corrupted recordings cleanup is complete - no-op to prevent Firestore read quota waste
  return;
}
