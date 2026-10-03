export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CONTENT_MANAGER"
  | "MEMBERS_MANAGER"
  | "OPERATIONS_MANAGER"
  | "AUDIO_ENGINEER"
  | "QA_REVIEWER"
  | "NARRATOR"
  | "REWARDS_MANAGER"
  | "CERTIFICATE_MANAGER"
  | "MEMBER"
  | "PENDING"
  | "SUSPENDED"
  | "HR"; // backwards compatibility

export interface User {
  // Required standard fields
  id: string;
  uid: string; // The primary key (replaces or maps to id)
  fullName: string;
  username: string;
  normalizedUsername: string;
  email: string;
  normalizedEmail: string;
  phone: string;
  phoneNormalized?: string;
  normalizedPhone: string;
  country: string;
  age?: number;
  birthDate?: string;
  field?: string;
  specialization?: string;
  bio?: string;

  accountStatus: "active" | "pending" | "suspended" | "disabled";
  canonicalRole: UserRole | string;

  platformAccess: Record<PlatformId, boolean>;
  actionAccess: Record<string, "INHERIT" | "ALLOW" | "DENY">;

  publicProfileConsent: boolean;
  termsVersionAccepted?: string;
  termsAcceptedAt?: string;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  lastLoginAt?: string;
  permissions?: Record<string, any>;
  custom_permissions?: Record<string, any>;

  // Legacy fields (kept for backwards compatibility during migration)
  name: string;
  role?: UserRole | string;
  role_display_ar?: string;
  is_super_admin?: boolean;
  can_access_studio?: boolean;
  can_upload_raw?: boolean;
  can_qa_review?: boolean;
  can_master_audio?: boolean;
  can_manage_books?: boolean;
  can_manage_members?: boolean;
  can_view_activity_logs?: boolean;
  can_manage_drive?: boolean;
  can_access_ai_eval?: boolean;
  can_manage_banner?: boolean;
  can_manage_settings?: boolean;
  can_manage_tasks?: boolean;
  can_edit_public_content?: boolean;
  can_wipe_database?: boolean;
  can_edit_db_urls?: boolean;
  can_access_control_panel?: boolean;
  is_active?: boolean;
  avatar_color?: string;
  workflowStatus?: string;
  status?: "active" | "pending" | "disabled";
  department?: string;
  termsAcceptedVersion?: string;
  pin?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  total_parts: number;
  completed_parts: number;
  assigned_narrators: string[];
  cover_color?: string;
  category?: string;
  createdAt: string;
  rawDriveFileId?: string;
  drive_folder_link?: string;
  pdf_url?: string;
  pdf_file_id?: string;
  description?: string;
  coverUrl?: string | null;
  isArchived?: boolean;
  is_archived?: boolean;
  driveFolderId?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export type RecordingStatus =
  | "UPLOADING"
  | "RAW_QA_PENDING"
  | "RAW_APPROVED"
  | "MASTERING"
  | "FINAL_QA_PENDING"
  | "FINAL_APPROVED"
  | "PUBLISHED"
  | "NARRATOR_REVISION_REQUIRED"
  | "ENGINEER_REVISION_REQUIRED"
  | "UPLOAD_FAILED";

export interface AudioRecording {
  id: string;
  bookId: string;
  partNumber: number;
  part_number?: number;
  title?: string;
  chapter?: string | null;
  isArchived?: boolean;
  is_archived?: boolean;
  narratorId: string;
  ownerId?: string;
  userId?: string;

  workflowStatus: RecordingStatus;

  // Asset References
  rawAssetId?: string;
  masteredAssetId?: string;
  publishedAssetId?: string;

  // Caching / Denormalization for fast UI rendering
  rawUrl?: string;
  masteredUrl?: string;
  rawDriveFileId?: string;
  masteredDriveFileId?: string;

  // Metadata
  qaRating?: number;
  qaNotes?: string;
  qaReviewedBy?: string;
  masteredBy?: string;
  durationSeconds?: number;

  // Legacy Fields (Do not delete until full migration)
  book_title?: string;
  narrator_name?: string;
  file_name?: string;
  mastered_file_name?: string;
  mastered_file_url?: string;
  mastered_by?: string;
  duration?: string;
  file_size?: string;
  file_url?: string;
  public_link?: string;
  drive_url?: string;
  drive_file_id?: string;
  driveFileId?: string;
  drive_folder_id?: string;
  status?: string;

  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export type AssetStatus = "UPLOADING" | "READY" | "FAILED" | "DELETED";
export type AssetVariant = "raw" | "mastered" | "published" | "pdf";

export interface AudioAsset {
  id: string;
  bookId?: string;
  recordingId: string;
  variant: AssetVariant;
  provider: "firebase" | "supabase" | "local" | "drive";
  storagePath: string;
  generation?: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
  checksum?: string;
  workflowStatus: AssetStatus;
  createdBy: string;
  createdAt: string;
  driveMirror?: {
    workflowStatus:
      | "PENDING"
      | "SYNCING"
      | "READY"
      | "RETRYING"
      | "AUTH_REQUIRED"
      | "QUOTA_WAIT"
      | "FAILED";
    fileId?: string;
    folderId?: string;
    attempts: number;
    nextAttemptAt?: string;
    lastErrorCode?: string;
  };
}

export interface UploadJob {
  id: string;
  assetId: string;
  ownerUid: string;
  bytesTotal: number;
  bytesUploaded: number;
  workflowStatus: "pending" | "uploading" | "paused" | "success" | "error";
  attempts: number;
  expiresAt?: string;
  idempotencyKey?: string;
  error?: string;
}

export interface ArchiveJob {
  id: string;
  assetId: string;
  workflowStatus: "pending" | "processing" | "success" | "error";
  leaseUntil?: string;
  attempts: number;
  nextAttemptAt?: string;
  lastErrorCode?: string;
}

export type ThemeMode = "dark" | "light";

export type MainTab =
  | "platform_hub"
  | "dashboard"
  | "my_space"
  | "books"
  | "audio_library"
  | "team"
  | "studio"
  | "activity_log"
  | "settings"
  | "tasks"
  | "content_management"
  | "rewards"
  | "control_panel"
  | "system_database";

export interface ActivityLog {
  id: string;
  user_name?: string;
  action_type:
    | "UPLOAD"
    | "EDIT_PERMISSION"
    | "BOOK_ADD"
    | "BOOK_EDIT"
    | "BOOK_DELETE"
    | "RECORDING_DELETE"
    | "SYSTEM_WIPE"
    | "MASTERING"
    | "QA_REVIEW"
    | "TASK_UPDATE";
  action_display_ar: string;
  details: string;
  createdAt: string;
}

export type StudioSubTab =
  "narrator_upload" | "mastering_studio" | "qa_review" | "admin_permissions";

export type PlatformId = "recording" | "tasks" | "rewards" | "admin" | "public";

export interface RewardBalance {
  receivedGems?: number;
  leaderboardPoints?: number;
  lastRestDay?: string;
  points: number;
  gems: number;
  uid: string;
}

export interface GemTransaction {
  type: string;
  points: number;
  gems: number;
  id: string;
  uid: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  receivedGems?: number;
  leaderboardPoints?: number;
  uid: string;
  points: number;
  name: string;
  rank?: number;
}
