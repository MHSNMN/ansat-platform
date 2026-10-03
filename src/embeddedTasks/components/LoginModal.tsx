// @ts-nocheck
import React, { useState } from "react";
import { AUTHORIZED_USERS } from "../data/mockData";
import { UserSession } from "../types";
import { KeyRound, ShieldCheck, AlertCircle, Lock } from "lucide-react";

interface LoginModalProps {
  announcement?: string;
  users?: UserSession[];
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  announcement,
  users = AUTHORIZED_USERS,
  onLoginSuccess,
}) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    const cleanCode = code.trim();
    if (!cleanCode) {
      setError("يرجى إدخال كود الدخول الخاص بك");
      return;
    }

    const foundUser = users.find((u) => u.code === cleanCode);
    if (foundUser) {
      onLoginSuccess(foundUser);
    } else {
      setError("كود الدخول غير صحيح، يرجى التأكد من الرمز وإعادة المحاولة.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md font-['Cairo']">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-right">
        {/* Header Icon */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">
              منصة إنصات الرقمية
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-semibold">
              الرجاء إدخال رمز الوصول للتعرف على هويتك وصلاحياتك
            </p>
          </div>
        </div>

        {/* Admin Announcement Bar above Passcode input */}
        {announcement && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold leading-relaxed shadow-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="block text-amber-400 font-extrabold mb-0.5">
                📢 شريط التنبيهات الإداري:
              </span>
              <span>{announcement}</span>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              رمز الوصول الشخصي (Passcode):
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="أدخل رمز الدخول المكون من 6 أرقام"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError("");
                }}
                className="w-full p-3.5 pr-11 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold text-center text-lg placeholder:text-slate-600 focus:border-amber-500 focus:outline-none tracking-widest"
              />
              <KeyRound className="w-5 h-5 text-slate-500 absolute right-3.5 top-4" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>تأكيد رمز الوصول والدخول</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">
            منظومة سرية ومغلقة لأعضاء مبادرة إنصات فقط 🔒
          </p>
        </div>
      </div>
    </div>
  );
};
