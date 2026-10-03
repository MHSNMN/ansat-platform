import React, { useState } from "react";
import {
  ClipboardCheck,
  Gem,
  Headphones,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  UserCog,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import { PlatformCard, type PlatformCardData } from "./PlatformCard";
import { canAccessPlatform } from "../lib/rbacPolicy";
import { motion } from "motion/react";
import { UserProfileModal } from "../components/UserProfileModal";

const PLATFORMS: PlatformCardData[] = [
  {
    id: "recording",
    label: "استوديو التسجيل",
    description:
      "رفع التسجيلات، المراجعة، المونتاج، الماستر، والنسخ النهائية بصوت نقي.",
    icon: <Headphones size={32} strokeWidth={1.5} />,
    href: "/recording",
    color: "#6366f1",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "NARRATOR",
      "MEMBER",
    ],
    gradient: "from-indigo-500 to-purple-600",
  },
  {
    id: "tasks",
    label: "منصة المهام",
    description:
      "إدارة أجايل Kanban، التكليفات الدقيقة، المراجعة الدورية، ومتابعة الإنجاز.",
    icon: <ClipboardCheck size={32} strokeWidth={1.5} />,
    href: "/tasks",
    color: "#0ea5e9",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "NARRATOR",
      "MEMBER",
    ],
    gradient: "from-sky-500 to-blue-600",
  },
  {
    id: "rewards",
    label: "المجوهرات والنقاط",
    description:
      "رصيد النقاط، شراء الجواهر، الإهداء، الترتيب العام، ويوم الراحة.",
    icon: <Gem size={32} strokeWidth={1.5} />,
    href: "/rewards",
    color: "#f59e0b",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "NARRATOR",
      "MEMBER",
    ],
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "admin",
    label: "إدارة إنصات",
    description:
      "التحكم الشامل: الأعضاء، الأدوار، صلاحيات المنصات، وإدارة المحتوى.",
    icon: <ShieldCheck size={32} strokeWidth={1.5} />,
    href: "/admin",
    color: "#10b981",
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "NARRATOR",
      "MEMBER",
    ],
    gradient: "from-emerald-500 to-teal-600",
  },
];

export function PortalPage() {
  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <PortalContent />
      </ProtectedRoute>
    </ErrorBoundary>
  );
}

function PortalContent() {
  const { user, logout, refreshUser } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);

  if (!user) return null;

  const isAllowed = (platform: PlatformCardData) =>
    canAccessPlatform(user as any, platform.id);
  const firstLetter = user.name.trim().charAt(0) || "ع";

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col items-center selection:bg-indigo-100 selection:text-indigo-900"
    >
      {/* Premium Header */}
      <header className="w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 transform hover:scale-105 transition-transform">
              <Headphones size={24} />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 leading-none mb-1">
                إنصات
              </div>
              <div className="text-xs font-semibold text-slate-500">
                مساحة العمل التطوعي الموحدة
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* User Profile Button */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-3 p-1.5 pr-3.5 pl-2 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all group text-right cursor-pointer"
              title="تعديل الملف الشخصي، البريد، اسم المستخدم، الدور، وكلمة المرور"
            >
              <div className="hidden sm:flex flex-col items-end">
                <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                  <span>{user.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                    {user.role_display_ar || "عضو إنصات"}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-medium dir-ltr">
                  {user.email ||
                    (user.username
                      ? `@${user.username}`
                      : user.phone || "إعدادات الحساب")}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:scale-105 transition-transform">
                {firstLetter}
              </div>
            </button>

            {/* Quick Edit Profile Pill */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="hidden lg:flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-100"
              title="تعديل بيانات الحساب"
            >
              <UserCog size={15} />
              <span>تعديل الحساب</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="w-11 h-11 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all flex items-center justify-center shadow-sm"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-6 py-16 flex-1 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="mb-14 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            جميع المنصات مفعلة لكافة الأعضاء
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-5 tracking-tight leading-tight">
            أهلاً، {user.name.split(" ")[0]}. <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-blue-500">
              اختر مساحة عملك.
            </span>
          </h1>
          <p className="text-slate-600 text-lg max-w-2xl leading-relaxed font-medium">
            جلسة موحدة تتيح لك الدخول لجميع منصات إنصات بحرية، مع تخصيص
            الصلاحيات الفنية والتنفيذية داخل كل منصة حسب دورك.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {PLATFORMS.map((platform, i) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              locked={!isAllowed(platform)}
              index={i}
            />
          ))}
        </div>

        <div className="mt-20 pt-8 border-t border-slate-200/60 flex items-center justify-between">
          <a
            href="/"
            className="text-slate-400 hover:text-indigo-600 font-medium text-sm transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={16} /> العودة للواجهة العامة
          </a>
          <span className="text-xs font-semibold text-slate-400">
            © 2026 إنصات · مبادرة العمل التطوعي
          </span>
        </div>
      </main>

      {/* User Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          currentUser={user}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          theme="light"
          onUpdated={() => {
            refreshUser();
          }}
        />
      )}
    </div>
  );
}

export default PortalPage;
