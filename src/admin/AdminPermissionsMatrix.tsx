import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Check,
  RotateCcw,
  CheckCheck,
  XCircle,
  Loader2,
  AlertCircle,
  Mic,
  Activity,
  Shield,
  Globe,
  ListTodo,
  Award,
  Info,
  Sliders,
  CheckSquare,
  Key,
  FolderKanban,
  Database,
  Users,
  CheckCircle2,
  Zap,
  Filter,
} from "lucide-react";
import { apiFetch, safeJson } from "../lib/api";
import {
  PLATFORM_PERMISSIONS_CATALOG,
  normalizeRole,
  isActionAllowed,
} from "../lib/rbacPolicy";

interface Member {
  uid: string;
  id?: string;
  name: string;
  username?: string;
  email: string;
  role: string;
  status?: string;
  department?: string;
  actionAccess?: Record<string, "ALLOW" | "DENY" | "INHERIT" | boolean>;
  platformAccess?: Record<string, boolean>;
}

interface AdminPermissionsMatrixProps {
  members: Member[];
  onMemberUpdated?: (updatedMember: Member) => void;
  currentUserRole?: string;
}

const iconMap: Record<string, React.ElementType> = {
  Mic,
  Activity,
  ShieldCheck,
  Shield,
  Globe,
  ListTodo,
  Award,
  Sliders,
  CheckSquare,
  Key,
  FolderKanban,
  Database,
  Users,
  CheckCircle2,
  Zap,
};

export const AdminPermissionsMatrix: React.FC<AdminPermissionsMatrixProps> = ({
  members,
  onMemberUpdated,
  currentUserRole,
}) => {
  const [selectedMemberUid, setSelectedMemberUid] = useState<string>(
    members[0]?.uid || members[0]?.id || "",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [permSearch, setPermSearch] = useState<string>("");
  const [localActionAccess, setLocalActionAccess] = useState<
    Record<string, "ALLOW" | "DENY" | "INHERIT">
  >({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedMember = useMemo(() => {
    return (
      members.find((m) => (m.uid || m.id) === selectedMemberUid) ||
      members[0] ||
      null
    );
  }, [members, selectedMemberUid]);

  useEffect(() => {
    if (selectedMember) {
      const initialAccess: Record<string, "ALLOW" | "DENY" | "INHERIT"> = {};
      const currentOverrides = selectedMember.actionAccess || {};
      for (const [k, v] of Object.entries(currentOverrides)) {
        if (v === true || v === "ALLOW") initialAccess[k] = "ALLOW";
        else if (v === false || v === "DENY") initialAccess[k] = "DENY";
        else if (v === "INHERIT") initialAccess[k] = "INHERIT";
      }
      setLocalActionAccess(initialAccess);
      setSaveSuccess(false);
      setErrorMessage("");
    }
  }, [selectedMember]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.username || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.department || "").toLowerCase().includes(q);

      const matchesRole = roleFilter === "ALL" || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  const memberCanonicalRole = useMemo(() => {
    return selectedMember ? normalizeRole(selectedMember.role) : "MEMBER";
  }, [selectedMember]);

  // Check if a specific permission is effectively active
  const isPermissionActive = (permKey: string) => {
    if (!selectedMember) return false;
    if (memberCanonicalRole === "SUPER_ADMIN") return true;

    const override = localActionAccess[permKey];
    if (override === "ALLOW") return true;
    if (override === "DENY") return false;

    // Default inherit from role
    return isActionAllowed(
      {
        canonicalRole: memberCanonicalRole,
        actionAccess: localActionAccess,
      },
      permKey as any,
    );
  };

  const handleTogglePermission = (permKey: string) => {
    const currentActive = isPermissionActive(permKey);
    setLocalActionAccess((prev) => ({
      ...prev,
      [permKey]: currentActive ? "DENY" : "ALLOW",
    }));
    setSaveSuccess(false);
  };

  const handleGrantAll = () => {
    const next: Record<string, "ALLOW"> = {};
    PLATFORM_PERMISSIONS_CATALOG.forEach((group) => {
      group.items.forEach((item) => {
        next[item.key] = "ALLOW";
      });
    });
    setLocalActionAccess(next);
    setSaveSuccess(false);
  };

  const handleDenyAll = () => {
    const next: Record<string, "DENY"> = {};
    PLATFORM_PERMISSIONS_CATALOG.forEach((group) => {
      group.items.forEach((item) => {
        next[item.key] = "DENY";
      });
    });
    setLocalActionAccess(next);
    setSaveSuccess(false);
  };

  // Quick preset: Enable all Tasks & Board permissions
  const handleGrantTasksPackage = () => {
    const tasksGroup = PLATFORM_PERMISSIONS_CATALOG.find(
      (g) => g.id === "tasks_and_board",
    );
    if (!tasksGroup) return;
    setLocalActionAccess((prev) => {
      const updated = { ...prev };
      tasksGroup.items.forEach((item) => {
        updated[item.key] = "ALLOW";
      });
      return updated;
    });
    setSaveSuccess(false);
  };

  const handleResetToRoleDefaults = () => {
    setLocalActionAccess({});
    setSaveSuccess(false);
  };

  const handleSavePermissions = async () => {
    if (!selectedMember) return;
    setSaving(true);
    setErrorMessage("");
    setSaveSuccess(false);

    try {
      const targetUid = selectedMember.uid || selectedMember.id || "";
      if (!targetUid) {
        throw new Error("معرّف العضو المحدد غير متوفر");
      }

      const res = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}/action-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionAccess: localActionAccess }),
        },
      );

      const data = await safeJson<{ success?: boolean; error?: string }>(res, {
        success: false,
        error: "تعذر الاتصال بالخادم لحفظ الصلاحيات",
      });
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر حفظ الصلاحيات");
      }

      setSaveSuccess(true);
      if (onMemberUpdated) {
        onMemberUpdated({
          ...selectedMember,
          actionAccess: localActionAccess,
        });
      }
      // Broadcast update across client tabs and components
      try {
        window.dispatchEvent(
          new CustomEvent("ensat:permissions-updated", {
            detail: { uid: targetUid, actionAccess: localActionAccess },
          }),
        );
      } catch {
        /* no-op */
      }
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "حدث خطأ أثناء حفظ الصلاحيات");
    } finally {
      setSaving(false);
    }
  };

  // Filter categories and items based on search and selected tab
  const displayedCategories = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    return PLATFORM_PERMISSIONS_CATALOG.filter(
      (cat) => categoryFilter === "ALL" || cat.id === categoryFilter,
    )
      .map((cat) => {
        if (!q) return cat;
        const matchingItems = cat.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.key.toLowerCase().includes(q),
        );
        return {
          ...cat,
          items: matchingItems,
        };
      })
      .filter((cat) => cat.items.length > 0);
  }, [categoryFilter, permSearch]);

  const activePermissionsCount = (() => {
    let count = 0;
    PLATFORM_PERMISSIONS_CATALOG.forEach((group) => {
      group.items.forEach((item) => {
        if (isPermissionActive(item.key)) count++;
      });
    });
    return count;
  })();

  const totalPermissionsCount = useMemo(() => {
    return PLATFORM_PERMISSIONS_CATALOG.reduce(
      (acc, g) => acc + g.items.length,
      0,
    );
  }, []);

  return (
    <div className="space-y-6" dir="rtl" id="admin-permissions-matrix-root">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-xl">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                نظام إدارة الصلاحيات الدقيقة والأذونات
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  إدارة إنصات المركزية
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                التحكم المركزي الكامل في صلاحيات منصة المهام، لوحة التحكم،
                الأعضاء، الأكواد، الأقسام، Drive، سجل الأنشطة، والربط التقني.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">
                إجمالي الأعضاء
              </span>
              <span className="text-base font-bold text-white font-mono">
                {members.length} عضو مسجّل
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Member List + Right Permissions Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Member Selector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">
                اختر عضواً للتعديل
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                {filteredMembers.length} عضو
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو المعرف..."
                className="w-full px-3.5 py-2 pl-9 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                id="input-perm-search-member"
              />
              <Search
                size={15}
                className="absolute left-3 top-2.5 text-slate-500"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              id="select-perm-role-filter"
            >
              <option value="ALL">جميع الأدوار</option>
              <option value="MEMBER">عضو (MEMBER)</option>
              <option value="NARRATOR">راوي (NARRATOR)</option>
              <option value="AUDIO_ENGINEER">مهندس صوت (AUDIO_ENGINEER)</option>
              <option value="QA_REVIEWER">مراجع جودة (QA_REVIEWER)</option>
              <option value="OPERATIONS_MANAGER">
                مدير عمليات (OPERATIONS_MANAGER)
              </option>
              <option value="CONTENT_MANAGER">
                مدير محتوى (CONTENT_MANAGER)
              </option>
              <option value="MEMBERS_MANAGER">
                مدير أعضاء (MEMBERS_MANAGER)
              </option>
              <option value="ADMIN">مدير (ADMIN)</option>
              <option value="SUPER_ADMIN">مدير عام (SUPER_ADMIN)</option>
            </select>

            {/* Members List */}
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredMembers.map((member) => {
                const isSelected =
                  (member.uid || member.id) ===
                  (selectedMember?.uid || selectedMember?.id);
                return (
                  <button
                    key={member.uid || member.id}
                    onClick={() =>
                      setSelectedMemberUid(member.uid || member.id || "")
                    }
                    className={`w-full text-right p-3 rounded-xl transition border flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-400/10 border-amber-400/40 text-white shadow-md"
                        : "bg-slate-950/60 border-slate-850 hover:border-slate-700 text-slate-300 hover:bg-slate-950"
                    }`}
                    id={`btn-select-perm-member-${member.uid || member.id}`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? "bg-amber-400 text-slate-950"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {member.name.trim().charAt(0) || "ع"}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-xs truncate">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          @{member.username || "بدون_مستخدم"} · {member.role}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check
                        size={16}
                        className="text-amber-400 shrink-0 mr-2"
                      />
                    )}
                  </button>
                );
              })}

              {filteredMembers.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500">
                  لا يوجد أعضاء مطابقون للبحث.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Granular Permissions Configuration */}
        <div className="lg:col-span-8 space-y-6">
          {selectedMember ? (
            <div
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6"
              id="panel-granular-permissions"
            >
              {/* Selected Member Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-xl">
                    {selectedMember.name.trim().charAt(0) || "ع"}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {selectedMember.name}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                        {selectedMember.role}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedMember.email} ·{" "}
                      {selectedMember.department || "فريق إنصات"} ·{" "}
                      <span className="text-amber-400 font-bold font-mono">
                        {activePermissionsCount} / {totalPermissionsCount}{" "}
                        صلاحية مفعلة
                      </span>
                    </p>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleGrantTasksPackage}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="منح كافة صلاحيات منصة المهام والأرشيف السحابي وموقع التسجيل للعضو فورياً"
                    id="btn-perm-grant-tasks-package"
                  >
                    <Zap size={14} className="text-amber-400" /> حزمة المهام
                  </button>
                  <button
                    onClick={handleGrantAll}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    id="btn-perm-grant-all"
                  >
                    <CheckCheck size={14} /> تحديد الكل
                  </button>
                  <button
                    onClick={handleDenyAll}
                    className="px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    id="btn-perm-deny-all"
                  >
                    <XCircle size={14} /> إلغاء الكل
                  </button>
                  <button
                    onClick={handleResetToRoleDefaults}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    id="btn-perm-reset-defaults"
                  >
                    <RotateCcw size={14} /> ضبط للدور
                  </button>
                </div>
              </div>

              {/* Status alerts */}
              {errorMessage && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMessage}
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <Check size={16} /> تم حفظ وتطبيق الصلاحيات بنجاح فورياً في
                  إدارة إنصات ومنصة المهام!
                </div>
              )}

              {memberCanonicalRole === "SUPER_ADMIN" && (
                <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                  <Info size={16} className="shrink-0" />
                  <span>
                    هذا الحساب يمتلك رتبة{" "}
                    <strong>المدير العام (SUPER_ADMIN)</strong> وله وصول شامل
                    وتلقائي لكافة أقسام المنصة.
                  </span>
                </div>
              )}

              {/* Category Filter Pills & Search */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setCategoryFilter("ALL")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        categoryFilter === "ALL"
                          ? "bg-amber-400 text-slate-950 shadow-sm"
                          : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      كافة الأقسام
                    </button>
                    {PLATFORM_PERMISSIONS_CATALOG.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => setCategoryFilter(group.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          categoryFilter === group.id
                            ? "bg-amber-400 text-slate-950 shadow-sm"
                            : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>{group.title.split("(")[0].trim()}</span>
                      </button>
                    ))}
                  </div>

                  {/* Filter by keyword in permissions */}
                  <div className="relative w-full sm:w-48">
                    <input
                      type="text"
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="تصفية الصلاحيات..."
                      className="w-full px-3 py-1 pl-8 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                    <Filter
                      size={13}
                      className="absolute left-2.5 top-2 text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Categorized Permissions Checkbox Groups */}
              <div className="space-y-6">
                {displayedCategories.map((category) => {
                  const CategoryIcon =
                    iconMap[category.iconName] || ShieldCheck;
                  return (
                    <div
                      key={category.id}
                      className="bg-slate-950/60 border border-slate-800 rounded-xl p-4.5 space-y-3"
                      id={`perm-group-${category.id}`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-amber-400/10 text-amber-400 rounded-lg">
                            <CategoryIcon size={16} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-200">
                              {category.title}
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              {category.description}
                            </p>
                          </div>
                        </div>

                        {/* Quick group toggle */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setLocalActionAccess((prev) => {
                                const next = { ...prev };
                                category.items.forEach((it) => {
                                  next[it.key] = "ALLOW";
                                });
                                return next;
                              });
                              setSaveSuccess(false);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                          >
                            تحديد القسم
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLocalActionAccess((prev) => {
                                const next = { ...prev };
                                category.items.forEach((it) => {
                                  next[it.key] = "DENY";
                                });
                                return next;
                              });
                              setSaveSuccess(false);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 cursor-pointer"
                          >
                            إلغاء القسم
                          </button>
                        </div>
                      </div>

                      {/* Checkboxes Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {category.items.map((perm) => {
                          const active = isPermissionActive(perm.key);
                          const isExplicitAllow =
                            localActionAccess[perm.key] === "ALLOW";
                          const isExplicitDeny =
                            localActionAccess[perm.key] === "DENY";

                          return (
                            <label
                              key={perm.key}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition select-none ${
                                active
                                  ? "bg-slate-900 border-amber-400/30 hover:border-amber-400/60"
                                  : "bg-slate-950 border-slate-800/80 hover:border-slate-700 opacity-60"
                              }`}
                              id={`checkbox-perm-label-${perm.key}`}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() =>
                                  handleTogglePermission(perm.key)
                                }
                                className="w-4 h-4 mt-0.5 rounded text-amber-400 focus:ring-amber-400 border-slate-700 bg-slate-900 shrink-0 cursor-pointer"
                                id={`input-perm-checkbox-${perm.key}`}
                              />
                              <div className="space-y-0.5 flex-1">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-xs font-bold ${
                                      active ? "text-white" : "text-slate-400"
                                    }`}
                                  >
                                    {perm.label}
                                  </span>
                                  {isExplicitAllow && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                      ممنوح يدوي
                                    </span>
                                  )}
                                  {isExplicitDeny && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono">
                                      محظور يدوي
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                  {perm.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {displayedCategories.length === 0 && (
                  <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-500">
                    لا توجد صلاحيات مطابقة لكلمة البحث الحالية.
                  </div>
                )}
              </div>

              {/* Save Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  سيتم تطبيق التعديلات فوراً وتحديث جلسات المستخدم وقواعد الوصول
                  في كافة المنصات.
                </span>

                <button
                  onClick={handleSavePermissions}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-amber-400/20 cursor-pointer"
                  id="btn-save-perm-changes"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  حفظ وتطبيق الصلاحيات فورياً
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              اختر عضواً من القائمة الجانبية لتعديل صلاحياته.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AdminPermissionsMatrix;
