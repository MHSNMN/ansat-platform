import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Globe,
  Briefcase,
  Calendar,
  Copy,
  Check,
  FileText,
  Edit3,
  RefreshCw,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import type { AdminMember } from "./AdminApp";

export interface MigrationAuditRecord {
  id: string;
  uid: string;
  legacyId?: string;
  name: string;
  originalIdentifier?: string;
  originalPhone?: string | null;
  originalEmail?: string | null;
  newUsername?: string;
  newEmail?: string;
  newPhone?: string;
  country?: string;
  field?: string;
  role?: string;
  role_display_ar?: string;
  migratedAt: string;
  auditStatus: "PENDING_AUDIT" | "VERIFIED" | "FLAGGED";
  auditedBy?: string | null;
  auditedAt?: string | null;
  auditNotes?: string;
  verifiedVia?: string;
}

interface AdminMigrationAuditProps {
  onEditMember?: (member: AdminMember) => void;
  members: AdminMember[];
}

export function AdminMigrationAudit({
  onEditMember,
  members,
}: AdminMigrationAuditProps) {
  const [audits, setAudits] = useState<MigrationAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING_AUDIT" | "VERIFIED" | "FLAGGED"
  >("ALL");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{
    record: MigrationAuditRecord;
    note: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string>("");

  const loadAudits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/migration-audits");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.audits)) {
        setAudits(data.audits);
      }
    } catch (err) {
      console.warn("Failed to load migration audits:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudits();
  }, [loadAudits]);

  const copyText = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerify = async (record: MigrationAuditRecord) => {
    setBusyUid(record.uid);
    try {
      const res = await apiFetch(
        `/api/admin/migration-audits/${encodeURIComponent(record.uid)}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "VERIFIED" }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر اعتماد التدقيق");
      }

      setAudits((prev) =>
        prev.map((a) =>
          a.uid === record.uid
            ? {
                ...a,
                auditStatus: "VERIFIED",
                auditedBy: data.auditedBy || "الإدارة",
                auditedAt: data.auditedAt || new Date().toISOString(),
              }
            : a,
        ),
      );

      setActionNotice(`✅ تم اعتماد وتوثيق تدقيق حساب "${record.name}" بنجاح`);
      setTimeout(() => setActionNotice(""), 4000);
    } catch (err: any) {
      setActionNotice(`⚠️ ${err.message || "فشل في اعتماد التدقيق"}`);
    } finally {
      setBusyUid(null);
    }
  };

  const handleSaveNote = async () => {
    if (!noteModal) return;
    const { record, note } = noteModal;
    setBusyUid(record.uid);
    try {
      const res = await apiFetch(
        `/api/admin/migration-audits/${encodeURIComponent(record.uid)}/note`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: note }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر حفظ الملاحظة");
      }

      setAudits((prev) =>
        prev.map((a) =>
          a.uid === record.uid ? { ...a, auditNotes: note } : a,
        ),
      );
      setNoteModal(null);
      setActionNotice("✅ تم حفظ ملاحظة التدقيق");
      setTimeout(() => setActionNotice(""), 3000);
    } catch (err: any) {
      setActionNotice(`⚠️ ${err.message || "فشل حفظ الملاحظة"}`);
    } finally {
      setBusyUid(null);
    }
  };

  // Stats
  const stats = useMemo(() => {
    let pending = 0;
    let verified = 0;
    let flagged = 0;
    audits.forEach((a) => {
      if (a.auditStatus === "VERIFIED") verified++;
      else if (a.auditStatus === "FLAGGED") flagged++;
      else pending++;
    });
    return {
      total: audits.length,
      pending,
      verified,
      flagged,
    };
  }, [audits]);

  // Filtered Audits
  const filteredAudits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return audits.filter((a) => {
      if (statusFilter !== "ALL") {
        const current = a.auditStatus || "PENDING_AUDIT";
        if (statusFilter === "PENDING_AUDIT" && current !== "PENDING_AUDIT")
          return false;
        if (statusFilter === "VERIFIED" && current !== "VERIFIED") return false;
        if (statusFilter === "FLAGGED" && current !== "FLAGGED") return false;
      }
      if (q) {
        const matches = [
          a.name,
          a.originalIdentifier,
          a.originalPhone,
          a.originalEmail,
          a.newUsername,
          a.newEmail,
          a.newPhone,
          a.country,
          a.field,
          a.legacyId,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(q),
        );
        if (!matches) return false;
      }
      return true;
    });
  }, [audits, searchQuery, statusFilter]);

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner & Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-400/20">
              <ClipboardCheck size={26} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                <span>قسم التدقيق والتحقق اليدوي</span>
                <span className="text-xs bg-amber-400/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  الحسابات المرحّلة
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                تسجيل ودخول الأعضاء يتم بشكل تلقائي وفوري دون تعطيل، وهنا يتم
                توثيق ومراجعة بياناتهم يدوياً من قبل الإدارة.
              </p>
            </div>
          </div>

          <button
            onClick={() => void loadAudits()}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            تحديث السجلات
          </button>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-slate-800 border border-amber-400/40 rounded-xl text-xs text-amber-300 font-semibold flex items-center gap-2 animate-fadeIn">
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6">
          <div
            onClick={() => setStatusFilter("ALL")}
            className={`cursor-pointer rounded-2xl p-4 border transition ${statusFilter === "ALL" ? "bg-slate-800/90 border-amber-400" : "bg-slate-950/60 border-slate-800 hover:border-slate-700"}`}
          >
            <span className="text-xs text-slate-400 block mb-1">
              إجمالي الحسابات المرحّلة
            </span>
            <strong className="text-2xl font-black text-white">
              {stats.total}
            </strong>
          </div>

          <div
            onClick={() => setStatusFilter("PENDING_AUDIT")}
            className={`cursor-pointer rounded-2xl p-4 border transition ${statusFilter === "PENDING_AUDIT" ? "bg-amber-500/10 border-amber-400" : "bg-slate-950/60 border-slate-800 hover:border-slate-700"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-300 font-bold block mb-1">
                بانتظار التدقيق اليدوي
              </span>
              <Clock size={16} className="text-amber-400" />
            </div>
            <strong className="text-2xl font-black text-amber-400">
              {stats.pending}
            </strong>
          </div>

          <div
            onClick={() => setStatusFilter("VERIFIED")}
            className={`cursor-pointer rounded-2xl p-4 border transition ${statusFilter === "VERIFIED" ? "bg-emerald-500/10 border-emerald-400" : "bg-slate-950/60 border-slate-800 hover:border-slate-700"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-300 font-bold block mb-1">
                تم التدقيق والاعتماد
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <strong className="text-2xl font-black text-emerald-400">
              {stats.verified}
            </strong>
          </div>

          <div
            onClick={() => setStatusFilter("FLAGGED")}
            className={`cursor-pointer rounded-2xl p-4 border transition ${statusFilter === "FLAGGED" ? "bg-rose-500/10 border-rose-400" : "bg-slate-950/60 border-slate-800 hover:border-slate-700"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-rose-300 font-bold block mb-1">
                محدد للمتابعة
              </span>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <strong className="text-2xl font-black text-rose-400">
              {stats.flagged}
            </strong>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
        <div className="relative w-full sm:w-80">
          <Search
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، الرقم، البريد، أو المعرف..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs md:text-sm text-white focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter size={15} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400 shrink-0">الحالة:</span>
          {(["ALL", "PENDING_AUDIT", "VERIFIED", "FLAGGED"] as const).map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {st === "ALL" && "الكل"}
                {st === "PENDING_AUDIT" && `بانتظار التدقيق (${stats.pending})`}
                {st === "VERIFIED" && `معتمد (${stats.verified})`}
                {st === "FLAGGED" && `للمتابعة (${stats.flagged})`}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Records List / Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-3">
          <RefreshCw size={28} className="spin mx-auto text-amber-400" />
          <p className="text-xs">جارٍ تحميل سجلات التدقيق...</p>
        </div>
      ) : filteredAudits.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
          <ClipboardCheck size={36} className="mx-auto text-slate-600" />
          <h3 className="text-sm font-bold text-slate-300">
            لا توجد سجلات مطابقة للبحث أو التصفية
          </h3>
          <p className="text-xs text-slate-500">
            {statusFilter === "PENDING_AUDIT"
              ? "ممتاز! تم تدقيق واعتماد كافة الحسابات المرحلة حالياً."
              : "لم يتم العثور على حسابات مرحّلة مسجلة وفق المعايير المحددة."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAudits.map((record) => {
            const isPending =
              record.auditStatus === "PENDING_AUDIT" || !record.auditStatus;
            const isVerified = record.auditStatus === "VERIFIED";
            const matchedMember = members.find(
              (m) => m.uid === record.uid || m.id === record.uid,
            );

            return (
              <div
                key={record.id || record.uid}
                className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 shadow-md transition-all hover:border-slate-700 ${
                  isPending
                    ? "border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/10"
                    : isVerified
                      ? "border-emerald-500/20"
                      : "border-slate-800"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Member Bio & Core Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-black text-lg shrink-0">
                      {record.name?.charAt(0) || <User size={22} />}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-black text-white">
                          {record.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {record.role_display_ar || record.role || "عضو إنصات"}
                        </span>
                        {isPending ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Clock size={12} /> بانتظار التدقيق اليدوي
                          </span>
                        ) : isVerified ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 size={12} /> تم التدقيق والاعتماد
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                            <AlertTriangle size={12} /> محدد للمراجعة
                          </span>
                        )}
                      </div>

                      {/* Details Strip */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-slate-300 pt-1">
                        {/* Legacy Identifier / Contact */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">
                            المعرف/الرقم القديم:
                          </span>
                          <span className="font-mono text-amber-300 font-semibold">
                            {record.originalIdentifier ||
                              record.originalPhone ||
                              record.originalEmail ||
                              record.legacyId ||
                              "—"}
                          </span>
                          <button
                            onClick={() =>
                              copyText(
                                record.originalIdentifier ||
                                  record.legacyId ||
                                  "",
                                `legacy-${record.uid}`,
                              )
                            }
                            className="text-slate-400 hover:text-white p-0.5 rounded transition"
                            title="نسخ المعرف القديم"
                          >
                            {copiedKey === `legacy-${record.uid}` ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>

                        {/* New Phone */}
                        <div className="flex items-center gap-1.5">
                          <Phone
                            size={13}
                            className="text-slate-400 shrink-0"
                          />
                          <span className="text-slate-400">الهاتف الجديد:</span>
                          <span className="font-mono text-white">
                            {record.newPhone || "—"}
                          </span>
                          {record.newPhone && (
                            <button
                              onClick={() =>
                                copyText(
                                  record.newPhone || "",
                                  `phone-${record.uid}`,
                                )
                              }
                              className="text-slate-400 hover:text-white p-0.5 rounded transition"
                              title="نسخ الهاتف"
                            >
                              {copiedKey === `phone-${record.uid}` ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          )}
                        </div>

                        {/* New Email */}
                        <div className="flex items-center gap-1.5">
                          <Mail size={13} className="text-slate-400 shrink-0" />
                          <span className="text-slate-400">البريد:</span>
                          <span
                            className="text-white truncate max-w-[170px]"
                            title={record.newEmail}
                          >
                            {record.newEmail || "—"}
                          </span>
                        </div>

                        {/* Country & Field */}
                        <div className="flex items-center gap-1.5">
                          <Globe
                            size={13}
                            className="text-slate-400 shrink-0"
                          />
                          <span className="text-slate-400">الدولة:</span>
                          <span className="text-white">
                            {record.country || "—"}
                          </span>
                        </div>

                        {record.field && (
                          <div className="flex items-center gap-1.5">
                            <Briefcase
                              size={13}
                              className="text-slate-400 shrink-0"
                            />
                            <span className="text-slate-400">المجال:</span>
                            <span className="text-white">{record.field}</span>
                          </div>
                        )}

                        {/* Migration Timestamp */}
                        <div className="flex items-center gap-1.5">
                          <Calendar
                            size={13}
                            className="text-slate-400 shrink-0"
                          />
                          <span className="text-slate-400">وقت الترحيل:</span>
                          <span className="text-slate-300 font-mono text-[11px]">
                            {formatDate(record.migratedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Auditor Note or Audit History if available */}
                      {(record.auditedBy || record.auditNotes) && (
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                          <ShieldCheck
                            size={14}
                            className="text-emerald-400 shrink-0 mt-0.5"
                          />
                          <div>
                            {record.auditedBy && (
                              <span className="font-semibold text-emerald-300 block">
                                دُقّق بواسطة: {record.auditedBy}{" "}
                                {record.auditedAt
                                  ? `(${formatDate(record.auditedAt)})`
                                  : ""}
                              </span>
                            )}
                            {record.auditNotes && (
                              <p className="text-slate-300 text-xs mt-0.5">
                                <strong className="text-slate-400">
                                  ملاحظة التدقيق:
                                </strong>{" "}
                                {record.auditNotes}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                    {isPending && (
                      <button
                        onClick={() => void handleVerify(record)}
                        disabled={busyUid === record.uid}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} />
                        {busyUid === record.uid
                          ? "جارٍ الاعتماد..."
                          : "اعتماد التدقيق وتوثيق الحساب"}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setNoteModal({ record, note: record.auditNotes || "" })
                      }
                      className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-700"
                      title="إضافة ملاحظة تدقيق"
                    >
                      <FileText size={14} />
                      ملاحظة
                    </button>

                    {matchedMember && onEditMember && (
                      <button
                        onClick={() => onEditMember(matchedMember)}
                        className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-700"
                        title="تعديل الحساب الإداري"
                      >
                        <Edit3 size={14} />
                        تعديل الحساب
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <FileText size={18} className="text-amber-400" />
              ملاحظة تدقيق للحساب ({noteModal.record.name})
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              يمكنك تدوين أي تفاصيل أو ملاحظات خاصة بمطابقة الهوية أو المراجعة
              الإدارية لهذا العضو.
            </p>

            <textarea
              rows={4}
              value={noteModal.note}
              onChange={(e) =>
                setNoteModal({ ...noteModal, note: e.target.value })
              }
              placeholder="اكتب ملاحظة التدقيق هنا..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-amber-400 focus:outline-none resize-none"
            />

            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleSaveNote()}
                disabled={busyUid === noteModal.record.uid}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition disabled:opacity-50"
              >
                {busyUid === noteModal.record.uid
                  ? "جارٍ الحفظ..."
                  : "حفظ الملاحظة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
