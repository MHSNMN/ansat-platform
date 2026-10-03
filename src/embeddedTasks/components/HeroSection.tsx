// @ts-nocheck
import React from "react";
import { UserSession, TeamTask } from "../types";
import {
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ListTodo,
  Plus,
  Award,
  ExternalLink,
} from "lucide-react";

interface HeroSectionProps {
  currentUser: UserSession | null;
  tasks: TeamTask[];
  announcement?: string;
  onAddTaskClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  currentUser,
  tasks,
  announcement,
  onAddTaskClick,
}) => {
  // Compute user specific stats
  const currentUserNameLower = (currentUser?.name || "").toLowerCase();
  const myTasks = currentUser
    ? tasks.filter(
        (t) =>
          (currentUserNameLower &&
            (t.memberName || "")
              .toLowerCase()
              .includes(currentUserNameLower)) ||
          t.memberId === currentUser.id,
      )
    : [];

  const completedCount = tasks.filter(
    (t) => t.status === "مكتمل" || t.status === "مكتملة",
  ).length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "قيد التنفيذ",
  ).length;
  const myPendingTasksCount = myTasks.filter(
    (t) => t.status !== "مكتمل" && t.status !== "مكتملة",
  ).length;

  return (
    <section className="pt-28 pb-8 bg-slate-950 border-b border-slate-800/80 font-['Cairo'] relative overflow-hidden">
      {/* Background Subtle Accent Gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Main Title & Administrative Welcome Message */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-2">
                <ListTodo className="w-3.5 h-3.5" />
                <span>لوحة التحكم الإدارية المغلقة</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                إنصات | لوحة إدارة المهام والأنظمة
              </h1>
            </div>

            {/* Admin Add Task Button or Member Status */}
            {currentUser?.isAdmin ? (
              <button
                onClick={onAddTaskClick}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إسناد مهمة جديدة للوحة العمل (Admin)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 shrink-0">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  حساب عضو فريق:{" "}
                  <strong className="text-white">{currentUser?.name}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Subtitle / Directive Notice / Admin Announcement */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-bold leading-relaxed shadow-md">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="block text-amber-400 font-extrabold mb-1">
                📢 شريط التنبيهات والتوجيه الإداري:
              </span>
              <p className="text-slate-100 font-semibold">{announcement}</p>
              {currentUser?.isAdmin ? (
                <p className="text-[11px] text-amber-300 font-normal mt-1.5 pt-1.5 border-t border-amber-500/20">
                  صلاحية مدير النظام ({currentUser.name}): يمكنك إضافة المهام
                  وتعديلها وأرشفتها ومتابعة أداء الفريق.
                </p>
              ) : (
                <p className="text-[11px] text-amber-300 font-normal mt-1.5 pt-1.5 border-t border-amber-500/20">
                  مرحباً بك يا {currentUser?.name}. يمكنك متابعة مهامك الموكلة
                  وإضافة ملاحظات التسليم فور إكمال العمل.
                </p>
              )}
            </div>
          </div>

          {/* Direct Link Banner to Insat Points System */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-right">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="font-extrabold text-white text-sm block">
                  إنصات - نظام النقاط والإنتاجية 🎯
                </span>
                <p className="text-xs text-slate-300">
                  تابع رصيد نقاطك، تصنيفات الإنجاز، والسجل التفاعلي لمبادرة
                  إنصات عبر التطبيق المخصص.
                </p>
              </div>
            </div>
            <a
              href="/rewards"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer shrink-0"
            >
              <span>فتح نظام النقاط</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-bold mb-1">
                إجمالي المهام بالنظام
              </div>
              <div className="text-2xl font-black text-white">
                {tasks.length}{" "}
                <span className="text-xs text-slate-500 font-normal">مهمة</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="text-[11px] text-emerald-400 font-bold mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>المهام المكتملة</span>
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {completedCount}{" "}
                <span className="text-xs text-slate-500 font-normal">مهمة</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="text-[11px] text-amber-400 font-bold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>قيد التنفيذ والمتابعة</span>
              </div>
              <div className="text-2xl font-black text-amber-400">
                {inProgressCount}{" "}
                <span className="text-xs text-slate-500 font-normal">مهمة</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
              <div className="text-[11px] text-indigo-400 font-bold mb-1">
                مهامك الموكلة لك
              </div>
              <div className="text-2xl font-black text-indigo-300">
                {myTasks.length}{" "}
                <span className="text-xs text-slate-500 font-normal">
                  ({myPendingTasksCount} متبقية)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
