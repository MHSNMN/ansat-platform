import React from "react";
import { User, ThemeMode, MainTab } from "../types";
import { hasPermission } from "../lib/permissions";
import {
  Mic,
  Sun,
  Moon,
  ShieldAlert,
  Key,
  Sparkles,
  Database,
  HardDrive,
  Volume2,
  Lock,
  Menu,
} from "lucide-react";

interface NavbarProps {
  currentUser: User | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenLogin: () => void;
  onLogout?: () => void;
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  onOpenSupabaseSetup: () => void;
  onOpenDriveSetup?: () => void;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  theme,
  onToggleTheme,
  onOpenLogin,
  onLogout,
  activeTab,
  onSelectTab,
  onOpenSupabaseSetup,
  onOpenDriveSetup,
  onOpenMobileMenu,
}) => {
  // Check studio access requirement:
  const canSeeStudio = Boolean(
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

  return (
    <header
      className={`sticky top-0 z-40 w-full backdrop-blur-xl border-b transition-colors durationSeconds-300 ${
        theme === "dark"
          ? "bg-slate-950/85 border-slate-800/80 text-white"
          : "bg-white/90 border-slate-200 text-slate-900"
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Mobile Drawer Trigger & Logo & Platform Name */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenMobileMenu && (
              <button
                onClick={onOpenMobileMenu}
                className={`p-2 rounded-xl border md:hidden transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800"
                    : "bg-slate-100 border-slate-200 text-amber-600 hover:bg-slate-200"
                }`}
                aria-label="القائمة"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div
              className="relative group cursor-pointer flex items-center gap-2"
              onClick={() => onSelectTab("dashboard")}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-500/20 transform group-hover:scale-105 transition-all durationSeconds-300">
                <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[2.5]" />
              </div>

              <div className="block">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
                    إنصات
                  </h1>
                  <span
                    className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      theme === "dark"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    المركزية
                  </span>
                </div>
                <p
                  className={`hidden sm:block text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                >
                  منصة الإنتاج الصوتي والكتب الصوتية
                </p>
              </div>
            </div>
          </div>

          {/* Center / Protected Studio CTA (Desktop / Tablet) */}
          {canSeeStudio ? (
            <button
              id="studio-access-btn"
              onClick={() => onSelectTab("studio")}
              className={`hidden sm:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all durationSeconds-300 ${
                activeTab === "studio"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400"
                  : theme === "dark"
                    ? "bg-slate-900/90 text-amber-400 border border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-400"
                    : "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
              }`}
            >
              <Volume2 className="w-4 h-4 animate-pulse text-amber-500 fill-amber-500/20" />
              <span>🎙️ استوديو الإنتاج</span>
              {currentUser?.is_super_admin && (
                <span className="text-[10px] bg-slate-950/40 text-amber-300 px-1.5 py-0.5 rounded font-mono hidden md:inline">
                  أدمن
                </span>
              )}
            </button>
          ) : (
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/30 px-3 py-1.5 rounded-lg border border-slate-800">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>الاستوديو محمي (يتطلب صلاحية وصول)</span>
            </div>
          )}

          {/* Right Action Tools: Supabase setup, Theme Toggle & PIN User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Google Drive Status & Setup modal trigger */}
            {onOpenDriveSetup && (
              <button
                id="drive-setup-btn"
                onClick={onOpenDriveSetup}
                title="حالة وتوصيل Google Drive"
                className={`p-2 rounded-xl text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-900 text-blue-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                    : "bg-slate-100 text-blue-600 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                <HardDrive className="w-4 h-4 text-blue-400" />
                <span className="hidden xl:inline text-xs font-medium">
                  Google Drive
                </span>
              </button>
            )}

            {/* Supabase connection modal trigger - Super Admin / Admin with permissions only */}
            {(currentUser?.is_super_admin || currentUser?.can_manage_books) && (
              <button
                id="supabase-setup-btn"
                onClick={onOpenSupabaseSetup}
                title="إعدادات قاعدة بيانات Supabase (للمدير التقني)"
                className={`p-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                <Database className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            {/* Dark / Light Theme Switcher Button */}
            <button
              id="theme-toggle-btn"
              onClick={onToggleTheme}
              title={
                theme === "dark"
                  ? "التحويل للوضع الفاتح"
                  : "التحويل للوضع الداكن"
              }
              className={`p-2 rounded-xl text-xs sm:text-sm transition-all ${
                theme === "dark"
                  ? "bg-slate-900 text-amber-400 hover:bg-slate-800 border border-slate-800"
                  : "bg-slate-100 text-amber-600 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Current User & PIN Authentication Switcher */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  id="user-profile-btn"
                  onClick={onOpenLogin}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all text-right ${
                    theme === "dark"
                      ? "bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800"
                  }`}
                  title="تبديل أو إدخال رمز آخر"
                >
                  <div
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm shrink-0 ${currentUser.avatar_color || "bg-amber-500 text-slate-950"}`}
                  >
                    {currentUser.name.slice(0, 1)}
                  </div>
                  <div className="block text-xs leading-tight max-w-[90px] sm:max-w-none truncate">
                    <div className="font-semibold flex items-center gap-1 truncate">
                      <span className="truncate">{currentUser.name}</span>
                      {currentUser.is_super_admin && (
                        <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                  </div>
                  <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="قفل المنصة وتسجيل الخروج"
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                  >
                    <Lock className="w-4 h-4" />
                    <span className="hidden sm:inline">قفل</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                id="login-btn"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer whitespace-nowrap"
              >
                <Key className="w-3.5 h-3.5" />
                <span>رمز الدخول</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
