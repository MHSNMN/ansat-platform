import { getSupabaseAdminClient } from "../supabaseAdmin";

export class BookRepository {
  async listBooks(options?: {
    status?: string;
    isPublishedPublic?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ books: any[]; total: number }> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { books: [], total: 0 };

    const limit = Math.min(options?.limit || 100, 200);
    const offset = options?.offset || 0;

    try {
      let query = supabase
        .from("books")
        .select("*", { count: "exact" })
        .eq("is_archived", false);

      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.isPublishedPublic !== undefined) {
        query = query.eq("is_published_public", options.isPublishedPublic);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error || !data) {
        console.warn("[BookRepository] listBooks error:", error?.message);
        return { books: [], total: 0 };
      }

      const books = data.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description || "",
        category: b.category || "",
        total_parts: b.target_chapters || 0,
        completed_parts: b.completed_chapters || 0,
        status: b.status,
        assigned_narrators: b.assigned_narrators || [],
        drive_folder_id: b.drive_folder_id,
        drive_folder_link: b.drive_folder_link,
        pdf_drive_id: b.pdf_drive_id,
        pdf_url: b.pdf_drive_link,
        cover_image_url: b.cover_image_url,
        isPublishedPublic: Boolean(b.is_published_public),
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      }));

      return { books, total: count || data.length };
    } catch (err: any) {
      console.warn(
        "[BookRepository] listBooks exception:",
        err?.message || err,
      );
      return { books: [], total: 0 };
    }
  }

  async upsertBook(book: any): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !book.id) return false;

    try {
      const payload: any = {
        id: book.id,
        title: book.title,
        author: book.author || "",
        description: book.description || "",
        category: book.category || "",
        target_chapters: book.total_parts || book.target_chapters || 0,
        completed_chapters:
          book.completed_parts || book.completed_chapters || 0,
        status: book.status || "PLANNED",
        assigned_narrators: book.assigned_narrators || [],
        drive_folder_id: book.drive_folder_id || null,
        drive_folder_link: book.drive_folder_link || null,
        pdf_drive_id: book.pdf_drive_id || null,
        pdf_drive_link: book.pdf_url || book.pdf_drive_link || null,
        cover_image_url: book.cover_image_url || null,
        is_published_public: Boolean(
          book.isPublishedPublic || book.is_published_public,
        ),
        is_archived: false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("books").upsert(payload);
      return !error;
    } catch {
      return false;
    }
  }

  async archiveBook(bookId: string, archivedBy: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !bookId) return false;

    try {
      const { error } = await supabase
        .from("books")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookId);

      return !error;
    } catch {
      return false;
    }
  }
}

export const bookRepository = new BookRepository();
