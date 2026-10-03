import React, { useState } from "react";
import { apiFetch, safeJson } from "../lib/api";
import { X, Save, Loader2, AlertCircle } from "lucide-react";
import { RECORDING_PERMISSIONS_REGISTRY } from "../lib/recordingPermissions";

interface ActionAccessModalProps {
  user: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function ActionAccessModal({
  user,
  onClose,
  onUpdate,
}: ActionAccessModalProps) {
  const [access, setAccess] = useState<Record<string, string>>(
    user.actionAccess || {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (action: string, value: string) => {
    setAccess((prev) => ({ ...prev, [action]: value }));
  };

  const handleSave = async () => {
    const targetUid = user?.uid || user?.id;
    if (!targetUid) {
      setError("معرّف العضو غير متوفر");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}/action-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionAccess: access }),
        },
      );
      const data = await safeJson<{ success?: boolean; error?: string }>(
        response,
        {
          success: false,
          error: "تعذر الاتصال بالخادم لحفظ الصلاحيات",
        },
      );
      if (!response.ok || !data.success) {
        throw new Error(data.error || "فشل في حفظ الصلاحيات");
      }
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء حفظ الصلاحيات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="w-full max-w-2xl rounded-2xl p-6 bg-white text-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold">
              صلاحيات منصة التسجيل الدقيقة (Overrides)
            </h3>
            <p className="text-sm text-slate-500">
              تخصيص أذونات العضو: {user.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4">
            <strong>ملاحظة:</strong> الحالة الافتراضية (تلقائي) تعتمد على دور
            العضو الأساسي ({user.role}). يمكنك منح إذن إضافي أو منعه بشكل صريح.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(RECORDING_PERMISSIONS_REGISTRY).map(
              ([id, label]) => (
                <div
                  key={id}
                  className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100"
                >
                  <span
                    className="font-semibold text-slate-700 text-xs w-48 truncate"
                    title={label as string}
                  >
                    {label as string}{" "}
                    <code className="text-[10px] text-slate-400 block font-normal mt-1">
                      {id}
                    </code>
                  </span>
                  <select
                    value={access[id] || "INHERIT"}
                    onChange={(e) => handleChange(id, e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold w-24 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INHERIT">تلقائي</option>
                    <option value="ALLOW" className="text-emerald-600">
                      منح (ALLOW)
                    </option>
                    <option value="DENY" className="text-rose-600">
                      منع (DENY)
                    </option>
                  </select>
                </div>
              ),
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  );
}
