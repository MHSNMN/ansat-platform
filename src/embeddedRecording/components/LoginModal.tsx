// @ts-nocheck
import React, { useState } from "react";
import { User, ThemeMode } from "../types";
import { Key, ShieldCheck, X } from "lucide-react";

interface LoginModalProps {
  users: User[];
  currentUser: User | null;
  onClose: () => void;
  theme: ThemeMode;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentUser,

  onClose,
  theme,
}) => {
  const [emailInput, setEmailInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setIsVerifying(true);
    setErrorMsg("");
    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const { auth } = await import("../lib/firebaseClient");
      await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      onClose(); // onAuthStateChanged in App.tsx handles the rest
    } catch (err: any) {
      if (err.code === "auth/operation-not-allowed") {
        setErrorMsg("تسجيل الدخول غير مفعل حالياً من قبل الإدارة.");
      } else {
        setErrorMsg("بيانات الدخول غير صحيحة.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800/60 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-400">
                تسجيل الدخول إلى حسابك
              </h3>
              <p className="text-xs text-slate-400">
                أدخل البريد الإلكتروني وكلمة المرور للوصول للمنصة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* PIN Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                البريد الإلكتروني:
              </label>
              <div className="relative mb-4">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="name@ensat.org"
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-slate-100"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500 text-slate-900"
                  }`}
                  autoFocus
                />
              </div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                كلمة المرور:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="******"
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all ${
                    theme === "dark"
                      ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-slate-100"
                      : "bg-slate-50 border-slate-300 focus:ring-amber-500 text-slate-900"
                  }`}
                />
              </div>
              {errorMsg && (
                <p className="mt-2 text-xs text-rose-400 font-medium">
                  {errorMsg}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isVerifying ? "جاري التحقق..." : "دخول المنصة"}</span>
            </button>
          </form>

          {/* Security Banner */}

          {currentUser && (
            <div className="text-center pt-1 border-t border-slate-800/40">
              <span className="text-[11px] text-slate-400">
                الحساب الحالي:{" "}
                <strong className="text-amber-400">{currentUser.name}</strong> (
                {currentUser.role_display_ar})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
