import { getSupabaseAdminClient } from "../supabaseAdmin";

export class RecordingRepository {
  async listRecordings(options?: {
    bookId?: string;
    stage?: string;
    status?: string;
    narratorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ recordings: any[]; total: number }> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { recordings: [], total: 0 };

    const limit = Math.min(options?.limit || 100, 200);
    const offset = options?.offset || 0;

    try {
      let query = supabase
        .from("recordings")
        .select("*", { count: "exact" })
        .eq("is_archived", false);

      if (options?.bookId) {
        query = query.eq("book_id", options.bookId);
      }
      if (options?.stage) {
        query = query.eq("stage", options.stage);
      }
      if (options?.status) {
        query = query.eq("status", options.status);
      }
      if (options?.narratorId) {
        query = query.eq("narrator_profile_id", options.narratorId);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error || !data) {
        console.warn(
          "[RecordingRepository] listRecordings error:",
          error?.message,
        );
        return { recordings: [], total: 0 };
      }

      return { recordings: data, total: count || data.length };
    } catch (err: any) {
      console.warn(
        "[RecordingRepository] listRecordings exception:",
        err?.message || err,
      );
      return { recordings: [], total: 0 };
    }
  }

  async upsertRecording(rec: any): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !rec.id) return false;

    try {
      const payload: any = {
        id: rec.id,
        book_id: rec.bookId || rec.book_id || null,
        book_title: rec.bookTitle || rec.book_title || null,
        chapter_id: rec.chapterId || rec.chapter_id || null,
        chapter_number: rec.chapterNumber || rec.chapter_number || null,
        narrator_profile_id:
          rec.narratorProfileId || rec.narrator_profile_id || null,
        narrator_name: rec.narratorName || rec.narrator_name || "مجهول",
        reviewer_profile_id:
          rec.reviewerProfileId || rec.reviewer_profile_id || null,
        engineer_profile_id:
          rec.engineerProfileId || rec.engineer_profile_id || null,
        stage: rec.stage || "RAW",
        status: rec.status || "PENDING",
        drive_file_id: rec.driveFileId || rec.drive_file_id || null,
        drive_file_url: rec.driveFileUrl || rec.drive_file_url || null,
        file_size: rec.fileSize || rec.file_size || 0,
        duration_seconds: Number(
          rec.durationSeconds || rec.duration_seconds || 0,
        ),
        audio_format: rec.audioFormat || rec.audio_format || null,
        feedback_notes: rec.feedbackNotes || rec.feedback_notes || null,
        is_archived: false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("recordings").upsert(payload);
      return !error;
    } catch {
      return false;
    }
  }

  async archiveRecording(recId: string, archivedBy: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !recId) return false;

    try {
      const { error } = await supabase
        .from("recordings")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: archivedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recId);

      return !error;
    } catch {
      return false;
    }
  }
}

export const recordingRepository = new RecordingRepository();
