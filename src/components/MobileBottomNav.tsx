import React from "react";
import { MainTab, User } from "../types";
import { hasPermission } from "../lib/permissions";
import {
  LayoutDashboard,
  BookOpen,
  Headphones,
  Mic,
  Users,
  Menu,
} from "lucide-react";

interface MobileBottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  currentUser: User | null;
  onOpenDrawer: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenDrawer,
}) => {
  const canAccessStudio = Boolean(
    currentUser &&
    (currentUser.can_access_studio ||
      currentUser.can_upload_raw ||
      currentUser.can_master_audio ||
      currentUser.can_qa_review ||
      currentUser.is_super_admin ||
      hasPermission(currentUser, "can_access_studio") ||
      hasPermission(currentUser, "can_upload_raw") ||
      [
        "SUPER_ADMIN",
        "ADMIN",
        "NARRATOR",
        "QA_REVIEWER",
        "AUDIO_ENGINEER",
        "MEMBER",
      ].includes(String(currentUser.role || "").toUpperCase())),
  );
  const canViewTeam =
    currentUser &&
    (currentUser.is_super_admin || currentUser.can_manage_members);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 dir-rtl shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Tab 1: Dashboard */}
        <button
          onClick={() => onSelectTab("dashboard")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-w-[56px] ${
            activeTab === "dashboard"
              ? "text-amber-400 font-bold scale-105"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <LayoutDashboard
            className={`w-5 h-5 ${activeTab === "dashboard" ? "text-amber-400" : "text-slate-400"}`}
          />
          <span className="text-[10px] mt-1 font-semibold">الرئيسية</span>
        </button>

        {/* Tab 2: Books */}
        <button
          onClick={() => onSelectTab("books")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-w-[56px] ${
            activeTab === "books"
              ? "text-amber-400 font-bold scale-105"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen
            className={`w-5 h-5 ${activeTab === "books" ? "text-amber-400" : "text-slate-400"}`}
          />
          <span className="text-[10px] mt-1 font-semibold">الكتب</span>
        </button>

        {/* Tab 3: Audio Library */}
        <button
          onClick={() => onSelectTab("audio_library")}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-w-[56px] ${
            activeTab === "audio_library"
              ? "text-amber-400 font-bold scale-105"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Headphones
            className={`w-5 h-5 ${activeTab === "audio_library" ? "text-amber-400" : "text-slate-400"}`}
          />
          <span className="text-[10px] mt-1 font-semibold">المكتبة</span>
        </button>

        {/* Tab 4: Studio OR Team */}
        {canAccessStudio ? (
          <button
            onClick={() => onSelectTab("studio")}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-w-[56px] relative ${
              activeTab === "studio"
                ? "text-amber-400 font-bold scale-105"
                : "text-amber-500/80 hover:text-amber-400"
            }`}
          >
            <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Mic className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-[10px] mt-0.5 font-bold text-amber-400">
              الاستوديو
            </span>
          </button>
        ) : canViewTeam ? (
          <button
            onClick={() => onSelectTab("team")}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-w-[56px] ${
              activeTab === "team"
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users
              className={`w-5 h-5 ${activeTab === "team" ? "text-amber-400" : "text-slate-400"}`}
            />
            <span className="text-[10px] mt-1 font-semibold">الأعضاء</span>
          </button>
        ) : null}

        {/* Tab 5: More Menu Button */}
        <button
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition-all min-w-[56px]"
        >
          <Menu className="w-5 h-5 text-slate-400" />
          <span className="text-[10px] mt-1 font-semibold">المزيد</span>
        </button>
      </div>
    </nav>
  );
};
