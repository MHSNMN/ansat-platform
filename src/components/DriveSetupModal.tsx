import React, { useState, useEffect } from "react";
import {
  HardDrive,
  X,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  LogIn,
  LogOut,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import {
  signInWithGoogleForDrive,
  disconnectGoogleDrive,
  isDriveConnected,
  getConnectedGoogleEmail,
  onDriveAuthChange,
} from "../lib/driveOAuth";
import { ThemeMode } from "../types";

interface DriveSetupModalProps {
  onClose: () => void;
  theme: ThemeMode;
}

interface DriveStatusResponse {
  configured: boolean;
  authMode: string;
  message: string;
}

export const DriveSetupModal: React.FC<DriveSetupModalProps> = ({
  onClose,
  theme,
}) => {
  const [serverStatus, setServerStatus] = useState<DriveStatusResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isOAuthConnected, setIsOAuthConnected] =
    useState<boolean>(isDriveConnected());
  const [googleEmail, setGoogleEmail] = useState<string | null>(
    getConnectedGoogleEmail(),
  );
  const [authInProgress, setAuthInProgress] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    apiFetch("/api/drive/status")
      .then((res) => res.json())
      .then((data: DriveStatusResponse) => {
        setServerStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to check Drive status:", err);
        setServerStatus({
          configured: false,
          authMode: "none",
          message: "تعذر الاتصال بخادم فحص حالة Google Drive.",
        });
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStatus();
    const unsubscribe = onDriveAuthChange((connected, user) => {
      setIsOAuthConnected(connected);
      setGoogleEmail(user?.email || null);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthInProgress(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogleForDrive();
      setIsOAuthConnected(true);
      setGoogleEmail(res.user.email || null);
      fetchStatus();
    } catch (err: any) {
      console.error("Google Drive auth error:", err);
      setAuthError(err.message || "فشلت عملية المصادقة مع Google Drive.");
    } finally {
      setAuthInProgress(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setIsOAuthConnected(false);
    setGoogleEmail(null);
    fetchStatus();
  };

  const isReady = Boolean(isOAuthConnected || serverStatus?.configured);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-6 dir-rtl ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                حالة ربط Google Drive
              </h3>
              <p className="text-xs text-slate-400">
                إدارة رفع واسترجاع التسجيلات الصوتية مباشرة عبر Google Drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <span className="text-xs">
              جارٍ فحص حالة الاتصال بـ Google Drive...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Status Banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                isReady
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              {isReady ? (
                <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              )}
              <div>
                <div className="text-sm font-bold">
                  {isReady
                    ? "Google Drive متصل وجاهز للاستخدام"
                    : "Google Drive يتطلب المصادقة"}
                </div>
                <div className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {isOAuthConnected && googleEmail
                    ? `تمت المصادقة بنجاح بحساب Google (${googleEmail}). يتم رفع التسجيلات مباشرة بمساحة الحساب وتخزينها في المجلد السحابي المعتمد.`
                    : serverStatus?.message || "جاهز للربط عبر Google OAuth."}
                </div>
              </div>
            </div>

            {/* Google OAuth Section */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  مصادقة حساب Google (OAuth 2.0):
                </span>
                {isOAuthConnected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    متصل ({googleEmail || "حساب Google"})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
                    غير متصل
                  </span>
                )}
              </div>

              {authError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                  {authError}
                </div>
              )}

              {isOAuthConnected ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">
                    الحساب المرتبط:{" "}
                    <strong className="text-slate-200">{googleEmail}</strong>
                  </span>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    فصل الحساب
                  </button>
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={authInProgress}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
                  >
                    {authInProgress ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جارٍ فتح نافذة تسجيل الدخول عبر Google...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>تسجيل الدخول وربط حساب Google Drive</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Details & Target Folder */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">المجلد السحابي المعتمد:</span>
                <span className="font-medium text-slate-200">
                  النسخ النهائية للنشر
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">وضع التخزين:</span>
                <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {isOAuthConnected
                    ? "Direct User OAuth (drive.file)"
                    : serverStatus?.authMode || "service_account"}
                </span>
              </div>
            </div>

            {/* Security Policy */}
            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-400">
                <ShieldCheck className="w-4 h-4" />
                <span>حماية الخصوصية والأمان:</span>
              </div>
              <p className="leading-relaxed text-slate-400 text-[11px]">
                تقتصر الصلاحية المطلوبة على حفظ وقراءة الملفات المنشأة بواسطة
                المنصة (<code className="text-slate-300">drive.file</code>) دون
                الوصول إلى ملفاتك الشخصية الأخرى.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={fetchStatus}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                إعادة الفحص
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
