import React from "react";
import { PlatformGuard } from "../auth/PlatformGuard";
import { useAuth } from "../auth/useAuth";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import EmbeddedRecordingApp from "../embeddedRecording/App";
import type { User } from "../embeddedRecording/types";
import { isActionAllowed } from "../lib/rbacPolicy";
import "./styles/recording.css";

function mapUser(user: ReturnType<typeof useAuth>["user"]): User | null {
  if (!user) return null;
  const superAdmin =
    user.canonicalRole === "super_admin" || user.role === "SUPER_ADMIN";
  return {
    id: user.id,
    name: user.name || "مستخدم",
    email: user.email,
    role: user.role as User["role"],
    role_display_ar: user.role_display_ar || "عضو",
    is_super_admin: superAdmin,
    can_access_studio: isActionAllowed(
      user as any,
      "access_recording_platform",
    ),
    can_upload_raw: isActionAllowed(user as any, "upload_raw"),
    can_qa_review: isActionAllowed(user as any, "qa_review"),
    can_master_audio: isActionAllowed(user as any, "master_audio"),
    can_manage_books: Boolean(
      user.can_manage_books ||
      (user as any).permissions?.can_manage_books ||
      isActionAllowed(user as any, "create_book") ||
      isActionAllowed(user as any, "manage_books") ||
      isActionAllowed(user as any, "recording.books.create"),
    ),
    can_manage_members: isActionAllowed(user as any, "manage_members"),
    can_view_activity_logs: isActionAllowed(user as any, "view_activity_logs"),
    can_manage_drive: isActionAllowed(user as any, "manage_drive"),
    can_manage_banner: isActionAllowed(user as any, "manage_public_content"),
    can_manage_settings: isActionAllowed(user as any, "access_control_panel"),
    can_access_control_panel: isActionAllowed(
      user as any,
      "access_control_panel",
    ),
    can_wipe_database: false,
    can_edit_db_urls: false,
    is_active: true,
    workflowStatus: "active",
    department: user.department,
    username: user.username,
    // Preserve the authoritative per-platform and per-action overrides when
    // adapting the unified account for the legacy studio UI.
    platformAccess: (user as any).platformAccess,
    actionAccess: (user as any).actionAccess,
    accountStatus: (user as any).accountStatus || (user as any).status,
  } as User;
}

function RecordingContent() {
  const { user, logout } = useAuth();
  return (
    <div className="recording-platform">
      <EmbeddedRecordingApp
        initialUser={mapUser(user)}
        onUnifiedLogout={logout}
      />
    </div>
  );
}

export function RecordingApp() {
  return (
    <ErrorBoundary>
      <PlatformGuard platform="recording">
        <RecordingContent />
      </PlatformGuard>
    </ErrorBoundary>
  );
}
export default RecordingApp;
