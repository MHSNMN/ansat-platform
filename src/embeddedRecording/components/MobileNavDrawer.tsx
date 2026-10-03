// @ts-nocheck
import React from "react";
import { MainTab, ThemeMode, User } from "../types";
import { hasPermission } from "../lib/permissions";
import {
  LayoutDashboard,
  BookOpen,
  Headphones,
  Users,
  Activity,
  Mic,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  Key,
  Lock,
  X,
  Sparkles,
  Database,
  ChevronLeft,
  Sliders,
} from "lucide-react";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  theme: ThemeMode;
  currentUser: User | null;
  onToggleTheme: () => void;
  onOpenLogin: () => void;
  onLogout?: () => void;
  onOpenSupabaseSetup: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  theme,
  currentUser,
  onToggleTheme,
  onOpenLogin,
  onLogout,
  onOpenSupabaseSetup,
}) => {
  if (!isOpen) return null;

  const canAccessStudio = Boolean(
    currentUser &&
    (hasPermission(currentUser, "can_upload_raw") ||
      hasPermission(currentUser, "can_qa_review") ||
      hasPermission(currentUser, "can_master_audio")),
  );
  const canViewTeam = Boolean(
    currentUser && hasPermission(currentUser, "recording.members.view"),
  );
  const canViewActivityLogs = Boolean(
    currentUser && hasPermission(currentUser, "can_view_activity_logs"),
  );
  const canAccessControlPanel = Boolean(
    currentUser && hasPermission(currentUser, "can_access_control_panel"),
  );
  const canManageSettings = Boolean(
    currentUser && hasPermission(currentUser, "can_manage_settings"),
  );

  const mainNavItems = [
    {
      id: "my_space" as MainTab,
      label: "مساحتي الشخصية",
      icon: LayoutDashboard,
    },
    ...(canViewTeam
      ? [
          {
            id: "dashboard" as MainTab,
            label: "لوحة الإدارة والإحصائيات",
            icon: Activity,
          },
        ]
      : []),
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
  ];

  const handleItemClick = (tab: MainTab, isLocked?: boolean) => {
    if (isLocked) return;
    onSelectTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex justify-end dir-rtl">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div
        className={`relative w-4/5 max-w-xs h-full flex flex-col z-10 overflow-y-auto shadow-2xl transition-all durationSeconds-300 border-r ${
          theme === "dark"
            ? "bg-[#0b101d] border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Mic className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-400">منصة إنصات</h2>
              <p className="text-[10px] text-slate-400">
                المركزية للإنتاج الصوتي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card inside Drawer */}
        {currentUser ? (
          <div className="p-4 bg-slate-900/60 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${currentUser.avatar_color || "bg-amber-500 text-slate-950"}`}
                >
                  {currentUser.name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1">
                    {currentUser.name}
                    {currentUser.is_super_admin && (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    )}
                  </h3>
                  <div className="text-[10px] text-amber-400 font-mono">
                    {currentUser.role_display_ar}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
              <span className="text-[11px] text-slate-400">حالة الجلسة:</span>
              <span className="font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                موحّدة وآمنة
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  onOpenLogin();
                  onClose();
                }}
                className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>بوابة الحساب</span>
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>قفل</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-center space-y-2">
            <p className="text-xs text-amber-300 font-medium">
              يجب تسجيل الدخول من البوابة المركزية
            </p>
            <button
              onClick={() => {
                onOpenLogin();
                onClose();
              }}
              className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
            >
              <Key className="w-4 h-4" />
              <span>فتح صفحة الدخول</span>
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <div className="p-4 space-y-4 flex-1">
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2">
              القائمة الرئيسية
            </div>
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id, item.isLocked)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold"
                      : item.isLocked
                        ? "opacity-50 text-slate-500 cursor-not-allowed"
                        : theme === "dark"
                          ? "hover:bg-slate-900 text-slate-300"
                          : "hover:bg-slate-100 text-slate-700"
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
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between">
              <span>استوديو الإنتاج</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>

            {canAccessStudio ? (
              <button
                onClick={() => handleItemClick("studio")}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "studio"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-900 text-amber-400 border border-amber-500/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Mic className="w-4 h-4 text-amber-400" />
                  <span>🎙️ استوديو الصوتيات</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <span>الاستوديو يتطلب صلاحية إدارية</span>
              </div>
            )}
          </div>

          {/* Admin Panel if Super Admin */}
          {currentUser?.is_super_admin && (
            <div className="pt-3 border-t border-slate-800 space-y-1">
              <button
                onClick={() => handleItemClick("studio")}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "studio"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-slate-900/90 text-amber-300 border border-amber-500/20"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>👑 استوديو الإدارة والصلاحيات</span>
              </button>
            </div>
          )}

          {/* Quick Settings & Database */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <button
              onClick={() => handleItemClick("settings", !canManageSettings)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                activeTab === "settings"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : !canManageSettings
                    ? "opacity-50 text-slate-500 cursor-not-allowed"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
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

            {(currentUser?.is_super_admin || currentUser?.can_manage_books) && (
              <button
                onClick={() => {
                  onOpenSupabaseSetup();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all font-semibold"
              >
                <Database className="w-4 h-4 text-emerald-400" />
                <span>إعدادات Supabase والربط</span>
              </button>
            )}

            {/* Dark / Light toggle */}
            <button
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all"
            >
              <div className="flex items-center gap-2">
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
                <span>المظهر ({theme === "dark" ? "الداكن" : "الفاتح"})</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold">
                تغيير
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
