import React from "react";
import { MainTab, ThemeMode, User, Book } from "../types";
import { hasPermission } from "../lib/permissions";
import {
  LayoutDashboard,
  BookOpen,
  Headphones,
  Users,
  Mic,
  Settings,
  Sparkles,
  Lock,
  ChevronLeft,
  Activity,
  Sliders,
  Database,
  Globe2,
  CheckSquare,
} from "lucide-react";

interface SidebarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  theme: ThemeMode;
  currentUser: User | null;
  books: Book[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  theme,
  currentUser,
  books,
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
  const canViewActivityLogs =
    currentUser &&
    (currentUser.is_super_admin || currentUser.can_view_activity_logs);
  const canManageSettings =
    currentUser &&
    (currentUser.is_super_admin || currentUser.can_manage_settings);
  const canAccessControlPanel =
    currentUser &&
    (currentUser.is_super_admin || currentUser.can_access_control_panel);
  const canEditPublicContent =
    currentUser &&
    (currentUser.is_super_admin || currentUser.can_edit_public_content);

  const totalPartsInAllBooks = books.reduce(
    (sum, b) => sum + (b.total_parts || 0),
    0,
  );
  const totalCompletedParts = books.reduce(
    (sum, b) => sum + (b.completed_parts || 0),
    0,
  );
  const overallProgress =
    totalPartsInAllBooks > 0
      ? Math.round((totalCompletedParts / totalPartsInAllBooks) * 100)
      : 0;

  const mainNavItems = [
    {
      id: "platform_hub" as MainTab,
      label: "منصات إنصات",
      icon: LayoutDashboard,
    },
    {
      id: "dashboard" as MainTab,
      label: "لوحة التحكم والمبادرة",
      icon: LayoutDashboard,
    },
    { id: "books" as MainTab, label: "دليل الكتب والمشروعات", icon: BookOpen },
    {
      id: "audio_library" as MainTab,
      label: "المكتبة الصوتية الشاملة",
      icon: Headphones,
    },
    {
      id: "team" as MainTab,
      label: "الأعضاء وفريق العمل",
      icon: Users,
      isLocked: !canViewTeam,
    },
    {
      id: "activity_log" as MainTab,
      label: "سجل النشاط والعمليات",
      icon: Activity,
      isLocked: !canViewActivityLogs,
    },
    {
      id: "control_panel" as MainTab,
      label: "لوحة التحكم الرئيسية",
      icon: Sliders,
      isLocked: !canAccessControlPanel,
    },
    {
      id: "system_database" as MainTab,
      label: "قواعد البيانات والدرايف",
      icon: Database,
      isLocked: !canAccessControlPanel,
    },
    {
      id: "content_management" as MainTab,
      label: "محتوى الواجهة العامة",
      icon: Globe2,
      isLocked: !canEditPublicContent,
    },
    { id: "tasks" as MainTab, label: "المهام", icon: CheckSquare },
    { id: "rewards" as MainTab, label: "النقاط والجواهر", icon: CheckSquare },
  ];

  return (
    <aside
      className={`w-64 shrink-0 hidden md:block border-l transition-colors durationSeconds-300 ${
        theme === "dark"
          ? "bg-slate-950/70 border-slate-800 text-slate-300"
          : "bg-slate-50/80 border-slate-200 text-slate-700"
      }`}
    >
      <div className="p-4 space-y-6 sticky top-20">
        {/* Main Section Navigation */}
        <div className="space-y-1">
          <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-amber-500 mb-2">
            القائمة الرئيسية
          </div>
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold"
                    : theme === "dark"
                      ? "hover:bg-slate-900 text-slate-300 hover:text-white"
                      : "hover:bg-slate-200/60 text-slate-700 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-400"}`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                ) : isActive ? (
                  <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Dedicated Studio Section */}
        <div className="pt-2 border-t border-slate-800/50 space-y-2">
          <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between">
            <span>استوديو الإنتاج</span>
            <Sparkles className="w-3 h-3 text-amber-400" />
          </div>

          {canAccessStudio ? (
            <button
              onClick={() => onSelectTab("studio")}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all relative overflow-hidden group ${
                activeTab === "studio"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                  : theme === "dark"
                    ? "bg-slate-900/90 text-amber-400 border border-amber-500/30 hover:border-amber-400"
                    : "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <Mic className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <div className="text-right">
                  <div>استوديو الصوتيات</div>
                  <div className="text-[10px] opacity-80 font-normal">
                    رفع • مونتاج • جودة
                  </div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            </button>
          ) : (
            <div
              className={`p-3 rounded-xl border text-xs text-right space-y-1.5 ${
                theme === "dark"
                  ? "bg-slate-900/40 border-slate-800 text-slate-500"
                  : "bg-slate-100 border-slate-200 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-slate-400">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>الاستوديو مقفل</span>
              </div>
              <p className="text-[10px] leading-relaxed">
                يتطلب تفعيل صلاحية الوصول من قبل الإدارة العامة.
              </p>
            </div>
          )}
        </div>

        {/* Database & Platform Settings */}
        <div className="pt-2 border-t border-slate-800/50 space-y-3">
          <button
            onClick={() => onSelectTab("settings")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === "settings"
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                : theme === "dark"
                  ? "hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                  : "hover:bg-slate-200/60 text-slate-600 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4 text-slate-400" />
              <span>إعدادات السحابة والمنصة</span>
            </div>
            {!canManageSettings && (
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {/* Overall Progress Widget from Design HTML */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-transparent border border-amber-500/20 space-y-1.5">
            <p className="text-[11px] text-amber-400 font-bold">
              مستوى التقدم العام
            </p>
            <p className="text-2xl font-bold text-white font-mono">
              {overallProgress}%
            </p>
            <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all durationSeconds-1000"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
