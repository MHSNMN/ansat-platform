import React, { useEffect, useState, useMemo } from "react";
import {
  X,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Check,
  UserCheck,
  Mail,
  Phone,
  Globe,
  Calendar,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../lib/api";

interface DuplicateUser {
  uid: string;
  docId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  country?: string;
  username?: string;
  status?: string;
  createdAt?: string;
  isRecommendedKept: boolean;
}

interface DuplicateGroup {
  normalizedName: string;
  displayName: string;
  recommendedKeptUid: string;
  users: DuplicateUser[];
}

interface DeduplicateUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
  onOpenRestore: () => void;
}

export const DeduplicateUsersModal: React.FC<DeduplicateUsersModalProps> = ({
  isOpen,
  onClose,
  onResolved,
  onOpenRestore,
}) => {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedKeptUids, setSelectedKeptUids] = useState<
    Record<string, string>
  >({});
  const [mergeDataOptions, setMergeDataOptions] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvingGroup, setResolvingGroup] = useState<string>("");
  const [busyAction, setBusyAction] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // In-app Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    type: "single_non_primary" | "group_non_primary" | "all_groups_non_primary";
    group?: DuplicateGroup;
    targetUser?: DuplicateUser;
    totalCount?: number;
  } | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await apiFetch("/api/admin/users/duplicates-preview");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.duplicateGroups)) {
        setGroups(data.duplicateGroups);
        const initialKept: Record<string, string> = {};
        const initialMerge: Record<string, boolean> = {};
        data.duplicateGroups.forEach((g: DuplicateGroup) => {
          initialKept[g.normalizedName] = g.recommendedKeptUid;
          initialMerge[g.normalizedName] = true;
        });
        setSelectedKeptUids(initialKept);
        setMergeDataOptions(initialMerge);
      } else {
        throw new Error(data.error || "تعذر جلب قائمة الأسماء المتكررة");
      }
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "حدث خطأ أثناء فحص التكرارات",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchDuplicates();
    }
  }, [isOpen]);

  // Filtered duplicate groups
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();
    return groups.filter((g) => {
      if (
        (g.displayName && g.displayName.toLowerCase().includes(q)) ||
        (g.normalizedName && g.normalizedName.toLowerCase().includes(q))
      )
        return true;
      return g.users.some(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.phone && u.phone.includes(q)) ||
          (u.country && u.country.toLowerCase().includes(q)),
      );
    });
  }, [groups, searchQuery]);

  const totalNonPrimaryCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + Math.max(0, g.users.length - 1), 0);
  }, [groups]);

  if (!isOpen) return null;

  const handleSelectKept = (groupKey: string, uid: string) => {
    setSelectedKeptUids((prev) => ({ ...prev, [groupKey]: uid }));
  };

  const handleToggleMerge = (groupKey: string) => {
    setMergeDataOptions((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Delete a single non-primary account from a group
  const executeDeleteSingleNonPrimary = async (
    group: DuplicateGroup,
    targetUser: DuplicateUser,
  ) => {
    const targetUid = targetUser.uid;
    if (!targetUid) return;

    setBusyAction(`delete_single:${targetUid}`);
    setNotice(null);

    try {
      const res = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر حذف الحساب غير الرئيسي");
      }

      setNotice({
        type: "success",
        text: `✅ تم حذف الحساب غير الرئيسي "${targetUser.name}" بنجاح.`,
      });

      // Update local state: remove this user from group
      setGroups((prevGroups) => {
        return prevGroups
          .map((g) => {
            if (g.normalizedName === group.normalizedName) {
              const updatedUsers = g.users.filter((u) => u.uid !== targetUid);
              return { ...g, users: updatedUsers };
            }
            return g;
          })
          .filter((g) => g.users.length > 1); // remove group if only 1 user left
      });

      setConfirmModal(null);
      onResolved();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "فشل حذف الحساب غير الرئيسي",
      });
    } finally {
      setBusyAction("");
    }
  };

  // Resolve an entire group (delete all non-primary accounts in this group)
  const executeResolveGroup = async (group: DuplicateGroup) => {
    const groupKey = group.normalizedName;
    const keptUid = selectedKeptUids[groupKey] || group.recommendedKeptUid;
    const deleteUids = group.users
      .map((u) => u.uid)
      .filter((uid) => uid !== keptUid);

    if (deleteUids.length === 0) return;

    setResolvingGroup(groupKey);
    setNotice(null);

    try {
      const res = await apiFetch("/api/admin/users/resolve-duplicate-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keptUid,
          deleteUids,
          mergeData: mergeDataOptions[groupKey] !== false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر معالجة التكرار");
      }

      setNotice({
        type: "success",
        text: data.message || "تم حذف الحسابات غير الرئيسية بنجاح",
      });
      setGroups((prev) => prev.filter((g) => g.normalizedName !== groupKey));
      setConfirmModal(null);
      onResolved();
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "فشلت معالجة المجموعة" });
    } finally {
      setResolvingGroup("");
    }
  };

  // Auto resolve all groups (delete all non-primary accounts across system)
  const executeAutoResolveAll = async () => {
    if (groups.length === 0) return;

    setLoading(true);
    setNotice(null);

    try {
      const res = await apiFetch("/api/admin/users/deduplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إتمام المعالجة الشاملة");
      }
      setNotice({ type: "success", text: `✅ ${data.message}` });
      setConfirmModal(null);
      await fetchDuplicates();
      onResolved();
    } catch (err: any) {
      setNotice({
        type: "error",
        text: err.message || "فشلت المعالجة الشاملة",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                مركز فحص ومعالجة الأسماء المكررة
              </h3>
              <p className="text-xs text-slate-400">
                حذف الحسابات غير الرئيسية والمكررة مع إمكانية دمج البيانات
                والاحتفاظ بالحساب الأساسي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notices */}
        {notice && (
          <div
            className={`mx-4 sm:mx-5 mt-4 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold ${
              notice.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Action bar, Search & Bulk Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute right-3 top-2.5 text-slate-400"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الأسماء المكررة..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenRestore();
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <RotateCcw size={14} className="text-amber-400" />
              <span>سجل المحذوفات والاسترجاع</span>
            </button>

            {groups.length > 0 && (
              <button
                onClick={() =>
                  setConfirmModal({
                    type: "all_groups_non_primary",
                    totalCount: totalNonPrimaryCount,
                  })
                }
                disabled={loading || totalNonPrimaryCount === 0}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>
                  حذف كافة الحسابات غير الرئيسية ({totalNonPrimaryCount})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Groups Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="spin text-amber-400" size={28} />
              <span>جارٍ فحص ومطابقة جميع الأسماء في قاعدة البيانات...</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-base font-black text-white">
                {searchQuery
                  ? "لا توجد نتائج مطابقة لبحثك"
                  : "قاعدة البيانات نظيفة تماماً!"}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchQuery
                  ? "جرب البحث بكلمة أو اسم آخر"
                  : "لا توجد أي حسابات مكررة بنفس الاسم حالياً. جميع الأسماء فريدة وموثقة."}
              </p>
            </div>
          ) : (
            filteredGroups.map((group, gIdx) => {
              const groupKey = group.normalizedName;
              const currentKeptUid =
                selectedKeptUids[groupKey] || group.recommendedKeptUid;
              const isBusyThisGroup = resolvingGroup === groupKey;
              const shouldMerge = mergeDataOptions[groupKey] !== false;
              const nonPrimaryCount = group.users.filter(
                (u) => u.uid !== currentKeptUid,
              ).length;

              return (
                <div
                  key={groupKey}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-3xl p-4 sm:p-5 shadow-lg space-y-4"
                >
                  {/* Group header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-black text-xs border border-amber-500/30">
                        مجموعة #{gIdx + 1}
                      </span>
                      <h4 className="text-base font-black text-white">
                        {group.displayName}
                      </h4>
                      <span className="text-xs text-slate-500 font-normal">
                        ({group.users.length} حسابات · {nonPrimaryCount} غير
                        رئيسي)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={shouldMerge}
                          onChange={() => handleToggleMerge(groupKey)}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span>دمج الهاتف والبيانات إلى الأساسي</span>
                      </label>

                      {/* Delete All Non-Primary in this Group */}
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({ type: "group_non_primary", group })
                        }
                        disabled={isBusyThisGroup || nonPrimaryCount === 0}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-red-600/20"
                        id={`btn-resolve-group-${gIdx}`}
                      >
                        {isBusyThisGroup ? (
                          <>
                            <Loader2 size={14} className="spin" />
                            <span>جارٍ الحذف...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={14} />
                            <span>
                              حذف الحسابات غير الرئيسية ({nonPrimaryCount})
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Users Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.users.map((u) => {
                      const isKept = u.uid === currentKeptUid;
                      const isBusySingle =
                        busyAction === `delete_single:${u.uid}`;

                      return (
                        <div
                          key={u.uid}
                          className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                            isKept
                              ? "bg-emerald-950/25 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-md"
                              : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            {/* Badge Status */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              {isKept ? (
                                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black flex items-center gap-1">
                                  <Check size={12} /> الحساب الأساسي (المحتفظ
                                  به)
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1">
                                  <AlertCircle size={12} /> حساب غير رئيسي
                                  (مكرر)
                                </span>
                              )}

                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                                {u.role}
                              </span>
                            </div>

                            {/* Member info */}
                            <div className="space-y-1.5 text-xs text-slate-300">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white text-sm">
                                  {u.name}
                                </span>
                                {u.username && (
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    @{u.username}
                                  </span>
                                )}
                              </div>

                              {u.email && (
                                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono">
                                  <Mail size={12} className="text-slate-500" />
                                  <span>{u.email}</span>
                                </div>
                              )}

                              {u.phone && (
                                <div
                                  className="flex items-center gap-1.5 text-slate-400 text-[11px]"
                                  dir="ltr"
                                >
                                  <Phone size={12} className="text-slate-500" />
                                  <span>{u.phone}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                                {u.country && (
                                  <span className="flex items-center gap-1">
                                    <Globe size={11} /> {u.country}
                                  </span>
                                )}
                                {u.createdAt && (
                                  <span
                                    className="flex items-center gap-1"
                                    dir="ltr"
                                  >
                                    <Calendar size={11} />{" "}
                                    {new Date(u.createdAt).toLocaleDateString(
                                      "ar-EG",
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action CTA buttons for non-primary vs primary */}
                          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                            {!isKept ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSelectKept(groupKey, u.uid)
                                  }
                                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition"
                                >
                                  <UserCheck size={13} />
                                  <span>تعيين كأساسي</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmModal({
                                      type: "single_non_primary",
                                      group,
                                      targetUser: u,
                                    })
                                  }
                                  disabled={isBusySingle}
                                  className="text-[11px] text-red-300 hover:text-white font-black flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 border border-red-500/40 transition disabled:opacity-50"
                                >
                                  {isBusySingle ? (
                                    <>
                                      <Loader2 size={12} className="spin" />
                                      <span>جارٍ الحذف...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 size={12} />
                                      <span>حذف هذا الحساب غير الرئيسي</span>
                                    </>
                                  )}
                                </button>
                              </>
                            ) : (
                              <div className="w-full text-left">
                                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 justify-end">
                                  <CheckCircle2 size={13} /> الحساب المعتمد في
                                  المنظومة
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            إجمالي المجموعات المتكررة:{" "}
            <b className="text-white">{groups.length}</b> (
            {totalNonPrimaryCount} حساب مكرر غير رئيسي)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* IN-APP CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-slate-900 border border-red-500/60 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative text-right"
            dir="rtl"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-2xl shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  {confirmModal.type === "single_non_primary" &&
                    "تأكيد حذف الحساب غير الرئيسي"}
                  {confirmModal.type === "group_non_primary" &&
                    "تأكيد حذف الحسابات غير الرئيسية في المجموعة"}
                  {confirmModal.type === "all_groups_non_primary" &&
                    "حذف كافة الحسابات غير الرئيسية في كل المجموعات"}
                </h3>
                <span className="text-xs text-red-300">
                  يتم توثيق الإجراء في سجلات التدقيق وسلة المحذوفات
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmModal.type === "single_non_primary" && (
                <>
                  هل أنت متأكد من حذف الحساب غير الرئيسي للـعضو{" "}
                  <strong className="text-white">
                    "{confirmModal.targetUser?.name}"
                  </strong>{" "}
                  (
                  {confirmModal.targetUser?.email ||
                    confirmModal.targetUser?.uid}
                  ) نهائياً؟
                  <br />
                  <span className="text-emerald-300 text-[11px] block mt-1">
                    سيظل الحساب الأساسي الآخر محفوظاً ونشطاً بالكامل.
                  </span>
                </>
              )}

              {confirmModal.type === "group_non_primary" &&
                confirmModal.group && (
                  <>
                    هل تريد حذف جميع الحسابات المكررة غير الرئيسية (
                    {confirmModal.group.users.length - 1} حسابات) للمجموعة{" "}
                    <strong className="text-white font-bold">
                      "{confirmModal.group.displayName}"
                    </strong>
                    ؟
                    <br />
                    <span className="text-emerald-300 text-[11px] block mt-1">
                      سيتم الإبقاء على الحساب الأساسي المعتمد فقط.
                    </span>
                  </>
                )}

              {confirmModal.type === "all_groups_non_primary" && (
                <>
                  هل أنت متأكد من حذف جميع الحسابات غير الرئيسية والمكررة في
                  النظام بإجمالي (
                  <strong className="text-white font-bold">
                    {confirmModal.totalCount}
                  </strong>{" "}
                  حساب) دفعة واحدة؟
                  <br />
                  <span className="text-amber-300 text-[11px] block mt-1">
                    سيتم الحفاظ على الحساب الأساسي الأعلى رتبة لكل عضو.
                  </span>
                </>
              )}
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={Boolean(busyAction || resolvingGroup || loading)}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
              >
                تراجع
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    confirmModal.type === "single_non_primary" &&
                    confirmModal.group &&
                    confirmModal.targetUser
                  ) {
                    void executeDeleteSingleNonPrimary(
                      confirmModal.group,
                      confirmModal.targetUser,
                    );
                  } else if (
                    confirmModal.type === "group_non_primary" &&
                    confirmModal.group
                  ) {
                    void executeResolveGroup(confirmModal.group);
                  } else if (confirmModal.type === "all_groups_non_primary") {
                    void executeAutoResolveAll();
                  }
                }}
                disabled={Boolean(busyAction || resolvingGroup || loading)}
                className="bg-red-600 hover:bg-red-500 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30"
              >
                {busyAction || resolvingGroup || loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>جارٍ التنفيذ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>تأكيد الحذف الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
