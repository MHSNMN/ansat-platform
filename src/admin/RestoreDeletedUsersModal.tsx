import React, { useEffect, useState } from "react";
import {
  RotateCcw,
  X,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
  Phone,
  Mail,
} from "lucide-react";
import { apiFetch } from "../lib/api";

interface DeletedUserItem {
  id: string;
  originalUid?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  country?: string;
  username?: string;
  deletedAt: string;
  source: string;
  keptUser?: { uid: string; name: string; email?: string; role?: string };
}

interface RestoreDeletedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export const RestoreDeletedUsersModal: React.FC<
  RestoreDeletedUsersModalProps
> = ({ isOpen, onClose, onRestored }) => {
  const [deletedList, setDeletedList] = useState<DeletedUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [restoringId, setRestoringId] = useState<string>("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchDeleted = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/deleted-users");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.deletedUsers)) {
        setDeletedList(data.deletedUsers);
      } else {
        throw new Error(data.error || "تعذر جلب سجل المحذوفات");
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "حدث خطأ أثناء تحميل سجل المحذوفات",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchDeleted();
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = deletedList.filter((item) => {
    const q = (search || "").toLowerCase().trim();
    if (!q) return true;
    return (
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.role && item.role.toLowerCase().includes(q))
    );
  });

  const handleRestore = async (item: DeletedUserItem) => {
    setRestoringId(item.id);
    setMessage(null);
    try {
      const res = await apiFetch("/api/admin/restore-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          email: item.email,
          role: item.role || "MEMBER",
          phone: item.phone,
          country: item.country || "العراق",
          username: item.username,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر استرجاع الحساب");
      }

      setMessage({
        type: "success",
        text: `✅ تم استرجاع حساب "${item.name}" بنجاح!`,
      });
      setDeletedList((prev) => prev.filter((d) => d.id !== item.id));
      onRestored();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "فشلت عملية الاسترجاع",
      });
    } finally {
      setRestoringId("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <RotateCcw size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                سجل الحسابات المحذوفة واسترجاع الأعضاء
              </h3>
              <p className="text-xs text-slate-400">
                يمكنك استرجاع أي حساب أو اسم تم حذفه مسبقاً بضغطة زر واحدة
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

        {/* Notice */}
        {message && (
          <div
            className={`mx-5 mt-4 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold ${
              message.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Search */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو البريد أو الهاتف أو الدور..."
              className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-amber-400"
            />
          </div>
          <button
            onClick={() => void fetchDeleted()}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl transition border border-slate-700"
            title="تحديث القائمة"
          >
            <RotateCcw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="spin text-amber-400" size={24} />
              <span>جارٍ تحميل سجل الحسابات المحذوفة...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {deletedList.length === 0
                ? "لا توجد أي حسابات محذوفة في السجل حالياً."
                : "لا توجد نتائج مطابقة للبحث."}
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    {item.name.trim().charAt(0) || "ع"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-white text-sm sm:text-base">
                        {item.name}
                      </span>
                      {item.role && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                          {item.role}
                        </span>
                      )}
                      {item.country && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 flex items-center gap-1">
                          <Globe size={10} /> {item.country}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      {item.email && (
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Mail size={11} /> {item.email}
                        </span>
                      )}
                      {item.phone && (
                        <span
                          className="flex items-center gap-1 font-mono text-[11px]"
                          dir="ltr"
                        >
                          <Phone size={11} /> {item.phone}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-400">
                        {item.source}
                      </span>
                      {item.keptUser && (
                        <span className="text-emerald-400">
                          (الحساب المحفوظ: {item.keptUser.name})
                        </span>
                      )}
                      <span className="text-slate-500" dir="ltr">
                        {new Date(item.deletedAt).toLocaleString("ar-EG")}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => void handleRestore(item)}
                  disabled={restoringId === item.id}
                  className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shrink-0 disabled:opacity-50"
                  id={`btn-restore-${item.id}`}
                >
                  {restoringId === item.id ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      <span>جارٍ الاسترجاع...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={14} />
                      <span>استرجاع الحساب</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            إجمالي السجلات: {deletedList.length}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
