import { getSupabaseAdminClient } from "../supabaseAdmin";

export interface DriveFileMetadata {
  id?: string;
  drive_file_id: string;
  drive_folder_id?: string | null;
  file_name: string;
  mime_type?: string | null;
  file_size?: number;
  duration_seconds?: number;
  status?: "PENDING" | "SYNCED" | "FAILED";
  uploaded_by_profile_id?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export class DriveFileRepository {
  async registerDriveFile(file: DriveFileMetadata): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !file.drive_file_id) return false;

    try {
      const payload = {
        drive_file_id: file.drive_file_id,
        drive_folder_id: file.drive_folder_id || null,
        file_name: file.file_name,
        mime_type: file.mime_type || null,
        file_size: file.file_size || 0,
        duration_seconds: file.duration_seconds || 0,
        status: file.status || "SYNCED",
        uploaded_by_profile_id: file.uploaded_by_profile_id || null,
        metadata: file.metadata || {},
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("drive_files")
        .upsert(payload, { onConflict: "drive_file_id" });

      return !error;
    } catch (err: any) {
      console.warn(
        "[DriveFileRepository] registerDriveFile error:",
        err?.message || err,
      );
      return false;
    }
  }

  async getDriveFileByFileId(
    driveFileId: string,
  ): Promise<DriveFileMetadata | null> {
    const supabase = getSupabaseAdminClient();
    if (!supabase || !driveFileId) return null;

    try {
      const { data, error } = await supabase
        .from("drive_files")
        .select("*")
        .eq("drive_file_id", driveFileId)
        .maybeSingle();

      if (error || !data) return null;
      return data as DriveFileMetadata;
    } catch {
      return null;
    }
  }

  async listPendingSyncJobs(limit = 10): Promise<DriveFileMetadata[]> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("drive_files")
        .select("*")
        .eq("status", "PENDING")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error || !data) return [];
      return data as DriveFileMetadata[];
    } catch {
      return [];
    }
  }
}

export const driveFileRepository = new DriveFileRepository();
