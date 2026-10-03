import { apiFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import {
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  Server,
  AlertCircle,
} from "lucide-react";
import { AudioRecording } from "../types";

interface Props {
  recordings: AudioRecording[];
}

export const SyncDiagnosticCenter: React.FC<Props> = ({ recordings }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  const fetchDiagnostics = async () => {
    setIsChecking(true);
    try {
      const res = await apiFetch("/api/config/drive/health");
      const data = await res.json();
      setHealthInfo(data);
    } catch (e) {
      setHealthInfo({
        workflowStatus: "error",
        message: "تعذر الاتصال بالسيرفر.",
      });
    }
    setTimeout(() => setIsChecking(false), 1000);
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const failedUploads = recordings.filter(
    (r) => !r.rawUrl || r.rawUrl.includes("uploading"),
  );

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 dir-rtl text-white mt-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              مركز تشخيص المزامنة (Sync Diagnostics)
            </h2>
            <p className="text-xs text-slate-400">
              مراقبة اتصال السيرفر مع جوجل درايف وحالة الرفع
            </p>
          </div>
        </div>
        <button
          onClick={fetchDiagnostics}
          disabled={isChecking}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold transition disabled:opacity-50"
        >
          <RefreshCcw
            className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`}
          />
          فحص الاتصال
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Token Status Card */}
        <div
          className={`p-5 rounded-2xl border ${
            healthInfo?.workflowStatus === "active"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : healthInfo?.workflowStatus === "error"
                ? "bg-rose-500/10 border-rose-500/30"
                : "bg-slate-800 border-slate-700"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            {healthInfo?.workflowStatus === "active" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            )}
            <h3 className="font-bold">حالة المصادقة (Auth Token)</h3>
          </div>
          <p className="text-sm opacity-80 mb-4">
            {healthInfo?.message || "جاري الفحص..."}
          </p>
          {healthInfo?.workflowStatus !== "active" && (
            <div className="text-xs text-rose-300 bg-rose-950/50 p-2 rounded-lg">
              يرجى إعادة إدخال بيانات الـ API في نافذة إعدادات Google Drive
              لتجديد الـ Refresh Token.
            </div>
          )}
        </div>

        {/* Sync Issues Card */}
        <div className="p-5 rounded-2xl border bg-amber-500/10 border-amber-500/30">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold">ملفات متعثرة ({failedUploads.length})</h3>
          </div>
          <p className="text-sm text-amber-200/80 mb-4">
            التسجيلات التي لم يكتمل رفعها أو تفتقد لرابط الدرايف.
          </p>
        </div>
      </div>

      {failedUploads.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-300">
            قائمة الملفات المتعثرة:
          </h4>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {failedUploads.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800"
              >
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-200">
                    {rec.rawUrl}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {""} - جزء {rec.partNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="أدخل رابط Drive اليدوي هنا..."
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs w-64 focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // Simple manual update dispatch
                        const url = (e.target as HTMLInputElement).value;
                        if (url) {
                          window.dispatchEvent(
                            new CustomEvent("manual-drive-link-update", {
                              detail: { id: rec.id, driveUrl: url },
                            }),
                          );
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
