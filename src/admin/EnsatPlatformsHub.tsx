import React, { useState, useMemo } from "react";
import {
  Mic,
  ListTodo,
  Award,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Sparkles,
  AlertCircle,
  Filter,
} from "lucide-react";
import { apiFetch, safeJson } from "../lib/api";
import {
  getRecommendedPlatformAccess,
  isAuthorizedAdminIdentity,
} from "../lib/rbacPolicy";
import type { AdminMember, PlatformAccess } from "./AdminApp";

interface EnsatPlatformsHubProps {
  members: AdminMember[];
  onMemberUpdated: (member: AdminMember) => void;
  currentUserRole?: string;
}

interface PlatformDef {
  id: keyof PlatformAccess;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badgeBg: string;
  badgeText: string;
  route: string;
  targetRoles: string[];
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "recording",
    title: "استوديو التسجيل الصوتي",
    subtitle: "Ensat Voice Studio",
    description:
      "مخصص لكادر الإنتاج الصوتي: الرواة، مهندسو الصوت، مدققو ومراجعو الجودة، والإدارة المشرفة.",
    icon: Mic,
    color:
      "from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400",
    badgeBg: "bg-amber-400/15 border-amber-400/30",
    badgeText: "text-amber-300",
    route: "/recording",
    targetRoles: [
      "NARRATOR",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "OPERATIONS_MANAGER",
      "CONTENT_MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ],
  },
  {
    id: "tasks",
    title: "منصة المهام والإنتاج",
    subtitle: "Production & Workflow",
    description:
      "منصة إدارة وتوزيع المهام التطوعية والإنتاجية، متاحة لجميع أعضاء منصة إنصات للمشاركة في الإنجاز.",
    icon: ListTodo,
    color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-blue-400",
    badgeBg: "bg-blue-400/15 border-blue-400/30",
    badgeText: "text-blue-300",
    route: "/tasks",
    targetRoles: [
      "MEMBER",
      "NARRATOR",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "OPERATIONS_MANAGER",
      "CONTENT_MANAGER",
      "MEMBERS_MANAGER",
      "REWARDS_MANAGER",
      "CERTIFICATE_MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ],
  },
  {
    id: "rewards",
    title: "نظام المكافآت والأوسمة",
    subtitle: "Rewards & Gamification",
    description:
      "نظام احتساب النقاط والمكافآت والأوسمة والشهادات، متاح لجميع الأعضاء لتحفيز العطاء وتكريم جهودهم.",
    icon: Award,
    color:
      "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400",
    badgeBg: "bg-emerald-400/15 border-emerald-400/30",
    badgeText: "text-emerald-300",
    route: "/rewards",
    targetRoles: [
      "MEMBER",
      "NARRATOR",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "OPERATIONS_MANAGER",
      "CONTENT_MANAGER",
      "MEMBERS_MANAGER",
      "REWARDS_MANAGER",
      "CERTIFICATE_MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ],
  },
  {
    id: "admin",
    title: "لوحة الإدارة والتحكم",
    subtitle: "Admin Command Center",
    description:
      "إدارة شجرة الحسابات، مصفوفة الصلاحيات (RBAC)، المحتوى والتدقيق الأمني الشامل.",
    icon: ShieldCheck,
    color:
      "from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400",
    badgeBg: "bg-purple-400/15 border-purple-400/30",
    badgeText: "text-purple-300",
    route: "/admin",
    targetRoles: [
      "SUPER_ADMIN",
      "ADMIN",
      "MEMBERS_MANAGER",
      "CONTENT_MANAGER",
      "OPERATIONS_MANAGER",
      "REWARDS_MANAGER",
      "CERTIFICATE_MANAGER",
    ],
  },
];

export const EnsatPlatformsHub: React.FC<EnsatPlatformsHubProps> = ({
  members,
  onMemberUpdated,
  currentUserRole,
}) => {
  const [selectedPlatformFilter, setSelectedPlatformFilter] =
    useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [busyState, setBusyState] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";
  const canManage = isSuperAdmin || currentUserRole === "ADMIN";

  // Calculate platform statistics
  const stats = useMemo(() => {
    const counts: Record<keyof PlatformAccess, number> = {
      recording: 0,
      tasks: 0,
      rewards: 0,
      admin: 0,
    };

    members.forEach((m) => {
      const access = m.platformAccess || getRecommendedPlatformAccess(m.role);
      if (access.recording) counts.recording++;
      if (access.tasks) counts.tasks++;
      if (access.rewards) counts.rewards++;
      if (access.admin) counts.admin++;
    });

    return counts;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.username || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.country || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedPlatformFilter !== "ALL") {
        const pKey = selectedPlatformFilter as keyof PlatformAccess;
        const access = m.platformAccess || getRecommendedPlatformAccess(m.role);
        return Boolean(access[pKey]);
      }

      return true;
    });
  }, [members, searchQuery, selectedPlatformFilter]);

  const handleToggleAccess = async (
    member: AdminMember,
    platformId: keyof PlatformAccess,
    currentAccess: boolean,
  ) => {
    if (!canManage) {
      setNotice("⚠️ عذراً، تخصيص صلاحيات دخول المنصات محصور بإدارة المنظومة");
      return;
    }

    const targetUid = member.uid || member.id;
    if (!targetUid) return;

    if (
      platformId === "admin" &&
      !currentAccess &&
      !isAuthorizedAdminIdentity(member)
    ) {
      setNotice("⚠️ صلاحية لوحة الإدارة محصورة بالحسابات الإدارية الموثقة.");
      return;
    }

    const baseAccess =
      member.platformAccess ||
      getRecommendedPlatformAccess(member.role, member);
    const newAccess = !currentAccess;
    const nextPlatformAccess = {
      ...baseAccess,
      [platformId]: newAccess,
    };

    const key = `${targetUid}:${platformId}`;
    setBusyState(key);
    setNotice("");

    try {
      const res = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}/platform-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platformAccess: nextPlatformAccess }),
        },
      );
      const data = await safeJson<{ success?: boolean; error?: string }>(res, {
        success: false,
        error: "تعذر حفظ صلاحيات المنصة",
      });
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر حفظ صلاحيات المنصة");
      }

      onMemberUpdated({
        ...member,
        platformAccess: nextPlatformAccess,
      });

      setNotice(
        `✅ تم ${newAccess ? "منح" : "إلغاء"} صلاحية (${platformId}) للعضو "${member.name}"`,
      );
      setTimeout(() => setNotice(""), 3000);
    } catch (err: any) {
      setNotice(err.message || "فشل تحديث الصلاحية");
    } finally {
      setBusyState("");
    }
  };

  const handleGrantRecommendedDefaults = async () => {
    if (!canManage) return;
    const confirm = window.confirm(
      "هل تريد مزامنة وضبط صلاحيات دخول المنصات تلقائياً لجميع الأعضاء بحسب أدوارهم الوظيفية؟\n(المهام والنقاط لجميع الأعضاء، والتسجيل للرواة ومهندسي الصوت ومدققي الجودة والإدارة)",
    );
    if (!confirm) return;

    setBusyState("global_sync");
    setNotice("جارٍ مزامنة صلاحيات المنصات وقواعد البيانات لجميع الأعضاء...");
    try {
      const res = await apiFetch("/api/admin/users/sync-platforms", {
        method: "POST",
      });
      const data = await safeJson<{
        success?: boolean;
        error?: string;
        message?: string;
        syncedCount?: number;
      }>(res, { success: false, error: "تعذر إتمام المزامنة الشاملة" });
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إتمام المزامنة الشاملة");
      }

      // Update local state for all members
      for (const m of members) {
        const recommended = getRecommendedPlatformAccess(m.role || "MEMBER");
        onMemberUpdated({
          ...m,
          platformAccess: recommended,
        });
      }

      setNotice(
        data.message ||
          `✅ تم بنجاح ضبط ومزامنة صلاحيات المنصات لجميع الأعضاء (${data.syncedCount || members.length} حساباً).`,
      );
      setTimeout(() => setNotice(""), 6000);
    } catch (err: any) {
      setNotice(err.message || "فشلت المزامنة العامة");
    } finally {
      setBusyState("");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Sparkles size={20} />
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white">
                مركز إدارة منصات إنصات الموحدة
              </h2>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              تحكم بمرونة في إمكانية وصول كل مستخدم إلى استوديوهات ومنصات منظومة
              إنصات الصوتية، مع إمكانية التعيين الفردي أو المزامنة الجماعية.
            </p>
          </div>

          {canManage && (
            <button
              onClick={handleGrantRecommendedDefaults}
              disabled={busyState === "global_sync"}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition shrink-0 disabled:opacity-50"
            >
              {busyState === "global_sync" ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Sparkles size={16} />
              )}
              <span>مزامنة الصلاحيات التلقائية حسب الدور</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-slate-900 border-2 border-amber-400/80 rounded-2xl text-amber-200 text-sm font-bold flex items-center gap-3 shadow-lg animate-in fade-in">
          <AlertCircle size={18} className="text-amber-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 4 Core Platform Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLATFORMS.map((plat) => {
          const Icon = plat.icon;
          const userCount = stats[plat.id] || 0;
          const percentage =
            members.length > 0
              ? Math.round((userCount / members.length) * 100)
              : 0;
          const isSelected = selectedPlatformFilter === plat.id;

          return (
            <div
              key={plat.id}
              onClick={() =>
                setSelectedPlatformFilter(isSelected ? "ALL" : plat.id)
              }
              className={`p-5 rounded-2xl border transition-all cursor-pointer bg-gradient-to-b ${plat.color} flex flex-col justify-between gap-4 ${
                isSelected
                  ? "ring-2 ring-amber-400 scale-[1.02] shadow-xl"
                  : "hover:border-slate-600"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-white/10 shadow-inner">
                    <Icon size={22} />
                  </div>
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${plat.badgeBg} ${plat.badgeText}`}
                  >
                    {percentage}% من الأعضاء
                  </span>
                </div>
                <h3 className="font-black text-white text-base mb-0.5">
                  {plat.title}
                </h3>
                <span className="text-[11px] font-mono text-slate-400 block mb-2">
                  {plat.subtitle}
                </span>
                <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
                  {plat.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                  <Users size={14} className="text-amber-400" />
                  <span>{userCount} مستخدم مخوّل</span>
                </div>
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  {isSelected ? "تصفية مفعلة" : "عرض المخولين"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
              <Filter size={14} /> تصفية المنصة:
            </span>
            <button
              onClick={() => setSelectedPlatformFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedPlatformFilter === "ALL"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              جميع المنصات ({members.length})
            </button>
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlatformFilter(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  selectedPlatformFilter === p.id
                    ? "bg-amber-400 text-slate-950 shadow-md"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span>{p.title}</span>
                <span className="opacity-70 text-[10px]">({stats[p.id]})</span>
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الأعضاء والمنصات..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3.5">العضو والبيانات</th>
                <th className="p-3.5">الدور والحالة</th>
                <th className="p-3.5 text-center">🎙️ استوديو التسجيل</th>
                <th className="p-3.5 text-center">📋 منصة المهام</th>
                <th className="p-3.5 text-center">🎁 نظام المكافآت</th>
                <th className="p-3.5 text-center">⚡ لوحة الإدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    لا توجد حسابات تطابق معايير البحث والتصفية المحددة.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const mUid = m.uid || m.id || "";
                  const resolvedAccess =
                    m.platformAccess || getRecommendedPlatformAccess(m.role, m);
                  const isAuthorized = isAuthorizedAdminIdentity(m);
                  const isActive =
                    m.status !== "disabled" && m.status !== "suspended";
                  const recEnabled =
                    isActive && resolvedAccess.recording !== false;
                  const tasksEnabled =
                    isActive && resolvedAccess.tasks !== false;
                  const rewardsEnabled =
                    isActive && resolvedAccess.rewards !== false;
                  const adminEnabled =
                    isActive &&
                    isAuthorized &&
                    (resolvedAccess.admin === true || m.role === "SUPER_ADMIN");

                  return (
                    <tr key={mUid} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                            {m.name.trim().charAt(0) || "ع"}
                          </div>
                          <div>
                            <strong className="text-white text-sm block">
                              {m.name}
                            </strong>
                            <span className="text-slate-400 text-[11px] font-mono">
                              @{m.username || "بدون_مستخدم"} · {m.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-amber-300 font-bold">
                            {m.role || "MEMBER"}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full w-max font-bold ${
                              m.status === "disabled"
                                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                : m.status === "pending"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
                            {m.status === "disabled"
                              ? "موقوف"
                              : m.status === "pending"
                                ? "قيد المراجعة"
                                : "نشط"}
                          </span>
                        </div>
                      </td>

                      {/* Recording Platform Switch */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() =>
                            handleToggleAccess(m, "recording", recEnabled)
                          }
                          disabled={
                            !canManage || busyState === `${mUid}:recording`
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
                            recEnabled
                              ? "bg-amber-400/20 border border-amber-400/50 text-amber-300 shadow-sm"
                              : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
                          }`}
                        >
                          {busyState === `${mUid}:recording` ? (
                            <Loader2
                              size={13}
                              className="spin text-amber-400"
                            />
                          ) : recEnabled ? (
                            <CheckCircle2
                              size={13}
                              className="text-amber-400"
                            />
                          ) : (
                            <XCircle size={13} />
                          )}
                          <span>{recEnabled ? "مفعل" : "معطل"}</span>
                        </button>
                      </td>

                      {/* Tasks Platform Switch */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() =>
                            handleToggleAccess(m, "tasks", tasksEnabled)
                          }
                          disabled={!canManage || busyState === `${mUid}:tasks`}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
                            tasksEnabled
                              ? "bg-blue-400/20 border border-blue-400/50 text-blue-300 shadow-sm"
                              : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
                          }`}
                        >
                          {busyState === `${mUid}:tasks` ? (
                            <Loader2 size={13} className="spin text-blue-400" />
                          ) : tasksEnabled ? (
                            <CheckCircle2 size={13} className="text-blue-400" />
                          ) : (
                            <XCircle size={13} />
                          )}
                          <span>{tasksEnabled ? "مفعل" : "معطل"}</span>
                        </button>
                      </td>

                      {/* Rewards Platform Switch */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() =>
                            handleToggleAccess(m, "rewards", rewardsEnabled)
                          }
                          disabled={
                            !canManage || busyState === `${mUid}:rewards`
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
                            rewardsEnabled
                              ? "bg-emerald-400/20 border border-emerald-400/50 text-emerald-300 shadow-sm"
                              : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300"
                          }`}
                        >
                          {busyState === `${mUid}:rewards` ? (
                            <Loader2
                              size={13}
                              className="spin text-emerald-400"
                            />
                          ) : rewardsEnabled ? (
                            <CheckCircle2
                              size={13}
                              className="text-emerald-400"
                            />
                          ) : (
                            <XCircle size={13} />
                          )}
                          <span>{rewardsEnabled ? "مفعل" : "معطل"}</span>
                        </button>
                      </td>

                      {/* Admin Platform Switch */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() =>
                            handleToggleAccess(m, "admin", adminEnabled)
                          }
                          disabled={
                            !canManage ||
                            busyState === `${mUid}:admin` ||
                            !isAuthorized ||
                            m.role === "SUPER_ADMIN"
                          }
                          title={
                            !isAuthorized
                              ? "صلاحية الإدارة محصورة بالحسابات الإدارية الموثقة"
                              : ""
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 ${
                            adminEnabled
                              ? "bg-purple-400/20 border border-purple-400/50 text-purple-300 shadow-sm"
                              : "bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300 opacity-80"
                          }`}
                        >
                          {busyState === `${mUid}:admin` ? (
                            <Loader2
                              size={13}
                              className="spin text-purple-400"
                            />
                          ) : adminEnabled ? (
                            <CheckCircle2
                              size={13}
                              className="text-purple-400"
                            />
                          ) : (
                            <XCircle size={13} />
                          )}
                          <span>{adminEnabled ? "مفعل" : "معطل"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
