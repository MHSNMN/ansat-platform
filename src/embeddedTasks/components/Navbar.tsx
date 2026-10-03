// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Users,
  FolderKanban,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  KeyRound,
  Sparkles,
  Award,
  ExternalLink,
  Mic,
  LayoutGrid,
  Edit3,
} from "lucide-react";
import { UserSession } from "../types";

interface NavbarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  currentUser: UserSession | null;
  onLogout: () => void;
  onOpenProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  setActiveSection,
  currentUser,
  onLogout,
  onOpenProfile,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const canAccessAdmin = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canAccessAdminPanel ||
    currentUser?.actionAccess?.canAccessAdminPanel === "ALLOW" ||
    currentUser?.permissions?.canViewMembersTab ||
    currentUser?.permissions?.canViewPermissionsTab ||
    currentUser?.permissions?.canViewCodesTab ||
    currentUser?.permissions?.canViewDepartmentsTab ||
    currentUser?.permissions?.canViewDriveTab ||
    currentUser?.permissions?.canViewEfficiencyTab ||
    currentUser?.permissions?.canViewLogsTab ||
    currentUser?.permissions?.canViewAnnouncementTab ||
    currentUser?.permissions?.canViewSupabaseTab ||
    currentUser?.permissions?.canManageUsers ||
    currentUser?.permissions?.canManagePermissions ||
    currentUser?.permissions?.canManageCodes ||
    currentUser?.permissions?.canManageDepartments ||
    currentUser?.permissions?.canManageDrive ||
    currentUser?.permissions?.canViewEfficiency ||
    currentUser?.permissions?.canViewLogs ||
    currentUser?.permissions?.canManageAnnouncement ||
    currentUser?.permissions?.canManageSupabase,
  );

  const canAccessDrive = Boolean(
    currentUser?.isAdmin ||
    (currentUser?.permissions?.canAccessDrive !== false &&
      currentUser?.actionAccess?.canAccessDrive !== "DENY"),
  );

  const canAccessRecording = Boolean(
    currentUser?.permissions?.canAccessRecordingSite !== false &&
    currentUser?.actionAccess?.canAccessRecordingSite !== "DENY" &&
    currentUser?.actionAccess?.recording !== "DENY",
  );

  const canAccessAdminLink = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canAccessAdminPanel ||
    currentUser?.actionAccess?.canAccessAdminPanel === "ALLOW",
  );

  const navItems = [
    { id: "dashboard", label: "جدول المهام المركزي", icon: Users },
    ...(canAccessDrive
      ? [
          {
            id: "archive",
            label: "الأرشيف السحابي (Google Drive)",
            icon: FolderKanban,
          },
        ]
      : []),
    ...(canAccessAdmin
      ? [
          {
            id: "admin",
            label: "التحكم الإداري والإشعارات ⚙️",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 font-['Cairo'] ${
        isScrolled
          ? "bg-slate-950/95 backdrop-blur-md border-b border-amber-500/10 shadow-2xl py-3"
          : "bg-gradient-to-b from-slate-950/90 via-slate-950/60 to-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo & Branding */}
          <button
            onClick={() => handleNavClick("dashboard")}
            className="flex items-center gap-3 group text-right focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-all flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-wide">
                  إنصـات
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  نظام إدارة المهام
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                لوحة التحكم الإدارية الداخلية المغلَقة
              </p>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
            <a
              href="/portal"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              <LayoutGrid className="w-4 h-4 text-sky-400" />
              <span>بوابة المنصات</span>
            </a>
            {canAccessRecording && (
              <a
                href="/recording"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <Mic className="w-4 h-4 text-violet-400" />
                <span>التسجيل</span>
              </a>
            )}
            {canAccessAdminLink && (
              <a
                href="/admin"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
                title="لوحة التحكم الإدارية العامة (إدارة إنصات)"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>إدارة إنصات 🛡️</span>
              </a>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-extrabold"
                      : "text-slate-300 hover:text-amber-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-amber-400"}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Direct Link to Insat Points System */}
            <a
              href="/rewards"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer shadow-sm"
              title="الانتقال إلى نظام نقاط وأنشطة إنصات"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>إنصات - نظام النقاط</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </nav>

          {/* Logged-in User Info & Logout Button */}
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="text-left bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="font-bold text-white">
                    {currentUser.name}
                  </span>
                  {currentUser.isAdmin ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      مدير نظام
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md">
                      عضو فريق
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 text-right mt-0.5">
                  {currentUser.departmentName} • جلسة موحّدة وآمنة
                </div>
              </div>

              {/* Edit Profile Button - Open to all members */}
              {onOpenProfile && (
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all cursor-pointer shadow-sm"
                  title="تعديل بيانات الملف الشخصي"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>تعديل Profile</span>
                </button>
              )}

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                title="تسجيل الخروج وتغيير الكود"
              >
                <LogOut className="w-4 h-4" />
                <span>خروج</span>
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            {currentUser && (
              <button
                onClick={onLogout}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300"
                title="تغيير الكود"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
              </button>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 animate-in fade-in">
            {currentUser && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    {currentUser.name}
                  </span>
                  <span className="text-emerald-400 font-medium">
                    جلسة موحّدة
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  {currentUser.roleName} • {currentUser.departmentName}
                </div>
                {onOpenProfile && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>تعديل بيانات الملف الشخصي (Profile)</span>
                  </button>
                )}
              </div>
            )}

            <a
              href="/portal"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right text-xs font-bold text-slate-200 bg-slate-950"
            >
              <LayoutGrid className="w-4 h-4 text-sky-400" />
              <span>بوابة المنصات</span>
            </a>
            {canAccessRecording && (
              <a
                href="/recording"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right text-xs font-bold text-slate-200 bg-slate-950"
              >
                <Mic className="w-4 h-4 text-violet-400" />
                <span>منصة التسجيل</span>
              </a>
            )}
            {canAccessAdminLink && (
              <a
                href="/admin"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>إدارة إنصات (لوحة التحكم العامة) 🛡️</span>
              </a>
            )}

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right text-xs font-bold ${
                    isActive
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-200 bg-slate-950"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <a
              href="/rewards"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30"
            >
              <div className="flex items-center gap-3">
                <Award className="w-4 h-4 text-amber-400" />
                <span>إنصات - نظام النقاط</span>
              </div>
              <ExternalLink className="w-4 h-4 text-amber-400" />
            </a>

            {currentUser && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold rounded-xl text-xs"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج وتغيير الكود</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
