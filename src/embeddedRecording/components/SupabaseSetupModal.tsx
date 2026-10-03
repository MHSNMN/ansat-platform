// @ts-nocheck
import React, { useState } from "react";
import { Database, Copy, Check, X, Sparkles } from "lucide-react";
import { SUPABASE_SQL_SCHEMA } from "../data/mockData";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { ThemeMode } from "../types";

interface SupabaseSetupModalProps {
  onClose: () => void;
  theme: ThemeMode;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  onClose,
  theme,
}) => {
  const [copied, setCopied] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(
    localStorage.getItem("ENSAT_SUPABASE_URL") ||
      import.meta.env.VITE_SUPABASE_URL ||
      "",
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    localStorage.getItem("ENSAT_SUPABASE_ANON_KEY") ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      "",
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("ENSAT_SUPABASE_URL", supabaseUrl.trim());
    localStorage.setItem("ENSAT_SUPABASE_ANON_KEY", supabaseAnonKey.trim());
    setSaveSuccessMsg(
      "تم حفظ بيانات الربط بنجاح! سيتم تحديث الصفحة لتطبيق الاتصال المباشر.",
    );
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 space-y-6 dir-rtl ${
          theme === "dark"
            ? "bg-slate-900 border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                إعدادات وتوصيل قاعدة بيانات Supabase
              </h3>
              <p className="text-xs text-slate-400">
                حالة الاتصال الحالية:{" "}
                {isSupabaseConfigured ? (
                  <span className="text-emerald-400 font-bold">
                    متصل بـ Supabase ⚡
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold">
                    وضع التزامن والمحاكاة المحلي (Standby Dynamic Sync)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            {saveSuccessMsg}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            ربط مشروع Supabase الخاص بك:
          </h4>

          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Supabase URL:
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xyz.supabase.co"
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-emerald-400"
                  : "bg-slate-50 border-slate-300"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Supabase Anon Key:
            </label>
            <input
              type="password"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 focus:ring-amber-500 text-emerald-400"
                  : "bg-slate-50 border-slate-300"
              }`}
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            حفظ واستخدام مفاتيح Supabase
          </button>
        </form>

        {/* Copy SQL Schema */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-200">
              كود SQL Schema لتجهيز جداول Supabase تلقائياً:
            </h4>
            <button
              type="button"
              onClick={handleCopySql}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "تم النسخ!" : "نسخ كود SQL Schema"}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-52 overflow-y-auto dir-ltr text-left scrollbar-thin">
            {SUPABASE_SQL_SCHEMA}
          </pre>
        </div>
      </div>
    </div>
  );
};
