import React, { useState } from "react";
import { User, Book, AudioRecording, ThemeMode, StudioSubTab } from "../types";
import {
  Mic,
  Wand2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { NarratorUploader } from "./NarratorUploader";
import { AudioEngineerStudio } from "./AudioEngineerStudio";
import { QAReviewStudio } from "./QAReviewStudio";
import { AdminPermissionsManager } from "./AdminPermissionsManager";
import { hasPermission } from "../lib/permissions";

interface StudioContainerProps {
  currentUser: User;
  users: User[];
  books: Book[];
  recordings: AudioRecording[];
  preselectedBookTitle?: string;
  onRecordingsUpdated: (updated: AudioRecording[]) => void;
  onUsersUpdated: (updatedUsers: User[]) => void;
  onPlayAudio: (rec: AudioRecording) => void;
  theme: ThemeMode;
}

export const StudioContainer: React.FC<StudioContainerProps> = ({
  currentUser,
  users,
  books,
  recordings,
  preselectedBookTitle,
  onRecordingsUpdated,
  onUsersUpdated,
  onPlayAudio,
  theme,
}) => {
  const canUpload = Boolean(
    hasPermission(currentUser, "can_upload_raw") ||
    currentUser?.can_upload_raw ||
    currentUser?.is_super_admin ||
    ["SUPER_ADMIN", "ADMIN", "NARRATOR", "MEMBER"].includes(
      String(currentUser?.role || "").toUpperCase(),
    ),
  );
  const canMaster = Boolean(
    hasPermission(currentUser, "can_master_audio") ||
    currentUser?.can_master_audio ||
    currentUser?.is_super_admin ||
    ["SUPER_ADMIN", "ADMIN", "AUDIO_ENGINEER"].includes(
      String(currentUser?.role || "").toUpperCase(),
    ),
  );
  const canQa = Boolean(
    hasPermission(currentUser, "can_qa_review") ||
    currentUser?.can_qa_review ||
    currentUser?.is_super_admin ||
    ["SUPER_ADMIN", "ADMIN", "QA_REVIEWER", "REVIEWER"].includes(
      String(currentUser?.role || "").toUpperCase(),
    ),
  );
  const canManageMembers = Boolean(
    hasPermission(currentUser, "can_manage_members") ||
    currentUser?.can_manage_members ||
    currentUser?.is_super_admin,
  );

  // Determine default sub tab based on user permissions
  const getDefaultSubTab = (): StudioSubTab => {
    if (canManageMembers) return "admin_permissions";
    if (canUpload) return "narrator_upload";
    if (canMaster) return "mastering_studio";
    if (canQa) return "qa_review";
    return "narrator_upload";
  };

  const [activeSubTab, setActiveSubTab] =
    useState<StudioSubTab>(getDefaultSubTab());

  return (
    <div className="space-y-6">
      {/* Studio Banner */}
      <div
        className={`p-6 rounded-3xl border relative overflow-hidden transition-all shadow-xl ${
          theme === "dark"
            ? "bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-950 border-amber-500/30"
            : "bg-gradient-to-r from-amber-50 via-white to-amber-100/50 border-amber-200"
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                استوديو إنصات للإنتاج الصوتي (Central Audio Production Hub)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-amber-400">
              🎙️ استوديو الإنتاج الصوتي المباشر
            </h1>
            <p className="text-xs text-slate-300">
              أهلاً بك يا{" "}
              <strong className="text-amber-400">{currentUser.name}</strong> (
              {currentUser.role_display_ar}). اختر القسم المناسب للبدء.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-amber-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>بوابة الاستوديو الآمنة</span>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800/80">
        {/* 1) Narrator Upload */}
        {canUpload && (
          <button
            onClick={() => setActiveSubTab("narrator_upload")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 relative ${
              activeSubTab === "narrator_upload"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold"
                : theme === "dark"
                  ? "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>1. الرفع الذكي للرواة (Zero-Effort Upload)</span>
          </button>
        )}

        {/* 2) Audio Engineer Mastering */}
        {canMaster && (
          <button
            onClick={() => setActiveSubTab("mastering_studio")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 relative ${
              activeSubTab === "mastering_studio"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold"
                : theme === "dark"
                  ? "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Wand2 className="w-4 h-4 text-indigo-400" />
            <span>2. هندسة الصوت والمونتاج (Mahdi Studio)</span>
          </button>
        )}

        {/* 3) QA Review */}
        {canQa && (
          <button
            onClick={() => setActiveSubTab("qa_review")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 relative ${
              activeSubTab === "qa_review"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold"
                : theme === "dark"
                  ? "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>3. تدقيق ومراقبة الجودة (Mona QA Studio)</span>
          </button>
        )}

        {/* 4) Admin Permissions Manager */}
        {canManageMembers && (
          <button
            onClick={() => setActiveSubTab("admin_permissions")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 relative ${
              activeSubTab === "admin_permissions"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold"
                : theme === "dark"
                  ? "bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span>4. إدارة صلاحيات الأعضاء</span>
          </button>
        )}
      </div>

      {/* Sub Tab Content */}
      <div className="pt-2">
        {activeSubTab === "narrator_upload" && canUpload && (
          <NarratorUploader
            currentUser={currentUser}
            users={users}
            books={books}
            recordings={recordings}
            preselectedBookTitle={preselectedBookTitle}
            onRecordingAdded={onRecordingsUpdated}
            theme={theme}
          />
        )}

        {activeSubTab === "mastering_studio" && canMaster && (
          <AudioEngineerStudio
            currentUser={currentUser}
            users={users}
            books={books}
            recordings={recordings}
            onRecordingsUpdated={onRecordingsUpdated}
            theme={theme}
            onPlayAudio={onPlayAudio}
          />
        )}

        {activeSubTab === "qa_review" && canQa && (
          <QAReviewStudio
            currentUser={currentUser}
            recordings={recordings}
            onRecordingsUpdated={onRecordingsUpdated}
            theme={theme}
            onPlayAudio={onPlayAudio}
          />
        )}

        {activeSubTab === "admin_permissions" && canManageMembers && (
          <AdminPermissionsManager
            currentUser={currentUser}
            theme={theme}
            onShowToast={(message, type) => {
              import("../lib/toastStore").then(({ toastStore }) =>
                toastStore.addToast({
                  type,
                  title: type === "error" ? "تعذر الإجراء" : "إدارة الأعضاء",
                  message,
                }),
              );
            }}
          />
        )}
      </div>
    </div>
  );
};
