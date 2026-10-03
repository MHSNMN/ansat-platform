// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  Database,
  CheckCircle2,
  Copy,
  Check,
  Server,
  RefreshCw,
  Zap,
  ShieldCheck,
  FileCode,
} from "lucide-react";
import {
  getSupabaseCredentials,
  resetSupabaseClient,
} from "../utils/supabase/client";
import { syncFromSupabase } from "../lib/storageService";

interface SupabaseConfigTabProps {
  onSyncRefresh: () => void;
  canManageSupabase?: boolean;
}

export const SupabaseConfigTab: React.FC<SupabaseConfigTabProps> = ({
  onSyncRefresh,
  canManageSupabase = true,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    msg: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    const creds = getSupabaseCredentials();
    setSupabaseUrl(creds.url);
    setSupabaseKey(creds.key);
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (supabaseUrl.trim()) {
      localStorage.setItem("insat_supabase_url", supabaseUrl.trim());
    } else {
      localStorage.removeItem("insat_supabase_url");
    }

    if (supabaseKey.trim()) {
      localStorage.setItem("insat_supabase_key", supabaseKey.trim());
    } else {
      localStorage.removeItem("insat_supabase_key");
    }

    resetSupabaseClient();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);

    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const success = await syncFromSupabase();
    setIsTesting(false);

    if (success) {
      setTestResult({
        success: true,
        msg: "تم الاتصال بالسحابة وسحب البيانات وتزامنها بنجاح! 🟢",
      });
      onSyncRefresh();
    } else {
      setTestResult({
        success: false,
        msg: "لم يتم العثور على الجداول في Supabase أو المفتاح غير صحيح. الحفظ المحلي الشامل نشط وحافظ لكل البيانات 100%! 🟡",
      });
    }
  };

  const sqlSchemaScript = `-- ===============================================
-- 🚀 سكربت إنشاء جداول منصة إنصات لـ Supabase SQL Editor
-- قم بفتح SQL Editor في مشروع Supabase الخاص بك ثم اضغط Run!
-- ===============================================

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  "roleName" text,
  "departmentName" text,
  country text,
  "isAdmin" boolean DEFAULT false,
  code text NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  "memberId" text,
  "memberName" text NOT NULL,
  country text,
  "departmentId" text,
  "departmentName" text,
  title text NOT NULL,
  description text,
  deadline text,
  status text NOT NULL,
  progress integer DEFAULT 0,
  "completionNote" text,
  "completedAt" text
);

CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  name text NOT NULL,
  leader text,
  description text,
  "iconName" text,
  color text,
  "memberCount" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cloud_folders (
  id text PRIMARY KEY,
  title text NOT NULL,
  "departmentName" text,
  "departmentId" text,
  "iconName" text,
  "fileCount" integer DEFAULT 0,
  size text,
  "lastUpdated" text,
  url text NOT NULL,
  description text,
  files jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id text PRIMARY KEY,
  "userName" text NOT NULL,
  "userRole" text,
  action text NOT NULL,
  details text,
  timestamp text NOT NULL,
  type text
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text
);

-- تمكين الاستماع اللحظي (Enable Realtime Subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE users, tasks, departments, cloud_folders, activity_logs, settings;
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const isConfigured = Boolean(
    supabaseUrl && supabaseKey && !supabaseUrl.includes("your-project"),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-['Cairo']">
      {/* Left Box: Credentials & Status */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              <span>إعدادات الاتصال بقاعدة بيانات Supabase</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ربط التطبيق بقاعدة بيانات Supabase للحفظ الدائم والتزامن اللحظي
              بين كل الأعضاء.
            </p>
          </div>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              isConfigured
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>
              {isConfigured ? "مربوط بـ Supabase" : "الحفظ المحلي الشامل نشط"}
            </span>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>تم حفظ بيانات الاتصال وتحديث الاتصال بنجاح!</span>
          </div>
        )}

        {testResult && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              testResult.success
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
            }`}
          >
            <Server className="w-4 h-4 shrink-0" />
            <span>{testResult.msg}</span>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">
              رابط مشروع Supabase (Project URL):
            </label>
            <input
              type="text"
              readOnly={!canManageSupabase}
              placeholder="https://your-project-id.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className={`w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs focus:outline-none dir-ltr text-right ${canManageSupabase ? "focus:border-amber-500" : "opacity-80 cursor-not-allowed"}`}
            />
            <p className="text-[10px] text-slate-500">
              يُحفظ أيضاً تلقائياً في المتغير VITE_SUPABASE_URL أو
              NEXT_PUBLIC_SUPABASE_URL.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">
              مفتاح الوصول العام (Anon / Public Key):
            </label>
            <textarea
              rows={3}
              readOnly={!canManageSupabase}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className={`w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs focus:outline-none dir-ltr text-right resize-none ${canManageSupabase ? "focus:border-amber-500" : "opacity-80 cursor-not-allowed"}`}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            {canManageSupabase ? (
              <button
                type="submit"
                className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4" />
                <span>حفظ البيانات وتفعيل Supabase</span>
              </button>
            ) : (
              <div className="text-xs text-slate-500 font-medium">
                عرض وقراءة فقط — لا تملك صلاحية تعديل وحفظ إعدادات الربط السحابي
              </div>
            )}

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <RefreshCw
                className={`w-4 h-4 ${isTesting ? "animate-spin text-amber-400" : ""}`}
              />
              <span>فحص المزامنة</span>
            </button>
          </div>
        </form>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs text-slate-400">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>نظام الحفظ المزدوج الفولاذي:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            النظام يعمل بتقنية الحفظ المزدوج: يقوم بحفظ كل تعديل (إضافة عضو،
            كود، قسم، ملف درايف، مهمة، أو إعلان) مباشرة بداخل المتصفح المحلي
            (Local Indexed Persistence) وفي جدول Supabase في نفس اللحظة، مما
            يضمن أن لا تضيع أي معلومة نهائياً حتى عند إعادة تحميل الصفحة!
          </p>
        </div>
      </div>

      {/* Right Box: SQL Schema Code */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-amber-400" />
              <span>سكربت إنشاء الجداول (Supabase SQL Script)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              انسخ الكود وألصقه في قسم SQL Editor بـ Supabase بضغطة زر.
            </p>
          </div>

          <button
            onClick={handleCopySql}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
          >
            {copiedSql ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">تم نسخ السكربت!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>نسخ السكربت</span>
              </>
            )}
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
          <pre className="p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[380px] custom-scrollbar dir-ltr text-left leading-relaxed">
            {sqlSchemaScript}
          </pre>
        </div>
      </div>
    </div>
  );
};
