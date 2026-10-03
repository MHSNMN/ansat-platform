import React, { useState } from "react";
import { User, Book, AudioRecording, ActivityLog, ThemeMode } from "../types";
import {
  Sliders,
  Database,
  HardDrive,
  AlertTriangle,
  Trash2,
  Users,
  FileAudio,
  BookOpen,
  Lock,
  CheckCircle2,
  ExternalLink,
  Zap,
} from "lucide-react";
import { TARGET_DRIVE_FOLDER_URL } from "../lib/firebaseClient";

interface ControlPanelProps {
  currentUser: User;
  users: User[];
  books: Book[];
  recordings: AudioRecording[];
  activityLogs: ActivityLog[];
  onWipeDatabase: () => void;
  theme: ThemeMode;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentUser,
  users,
  books,
  recordings,
  activityLogs,
  onWipeDatabase,
  theme,
}) => {
  const isAuthorized =
    currentUser.is_super_admin || currentUser.can_access_control_panel;

  const [dbUrlInput, setDbUrlInput] = useState<string>(
    localStorage.getItem("ENSAT_SUPABASE_URL") ||
      import.meta.env.VITE_SUPABASE_URL ||
      "",
  );
  const [dbAnonKeyInput, setDbAnonKeyInput] = useState<string>(
    localStorage.getItem("ENSAT_SUPABASE_ANON_KEY") ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      "",
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");
  const [showWipeConfirm, setShowWipeConfirm] = useState<boolean>(false);

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-4 max-w-md mx-auto my-12 dir-rtl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-extrabold text-white">
          منطقة إدارية محمية 🔒
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          عذراً، الوصول إلى لوحة التحكم الرئيسية محصور بالمدير الرئيسي (Super
          Admin) أو الأعضاء الممنوحين صلاحية{" "}
          <strong className="text-amber-400">can_access_control_panel</strong>.
        </p>
      </div>
    );
  }

  const canEditUrls =
    currentUser.is_super_admin || currentUser.can_edit_db_urls;
  const canWipeDb = currentUser.is_super_admin || currentUser.can_wipe_database;

  const handleSaveDbSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditUrls) return;
    localStorage.setItem("ENSAT_SUPABASE_URL", dbUrlInput.trim());
    localStorage.setItem("ENSAT_SUPABASE_ANON_KEY", dbAnonKeyInput.trim());
    setSaveSuccessMsg("تم حفظ وتحديث إعدادات خوادم الداتا بيس بنجاح!");
    setTimeout(() => setSaveSuccessMsg(""), 3000);
  };

  const totalRaw = (recordings || [])
    .filter((r) => r && r.id && typeof r.id === "string")
    .filter((r) => r.workflowStatus === "RAW_QA_PENDING").length;
  const totalQA = (recordings || [])
    .filter((r) => r && r.id && typeof r.id === "string")
    .filter(
      (r) =>
        r.workflowStatus === "RAW_APPROVED" || r.workflowStatus === "PUBLISHED",
    ).length;
  const totalMastered = (recordings || [])
    .filter((r) => r && r.id && typeof r.id === "string")
    .filter((r) => r.workflowStatus === "MASTERING").length;
  const totalRevisions = (recordings || [])
    .filter((r) => r && r.id && typeof r.id === "string")
    .filter((r) => r.workflowStatus === "ENGINEER_REVISION_REQUIRED").length;

  return (
    <div className="space-y-6 dir-rtl animate-fade-in">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 space-y-2 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 p-8 opacity-10 pointer-events-none">
          <Sliders className="w-48 h-48 text-amber-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Sliders className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                لوحة التحكم المركزية الرئيسية
                <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-mono">
                  Control Panel v2.5
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-300">
              مرحباً{" "}
              <strong className="text-amber-400">{currentUser.name}</strong> —
              مراقبة لحظية وإدارة متكاملة لسيرفرات الداتا بيس، الاتصال المباشر
              بـ Google Drive، وتخصيص النظام.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={TARGET_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all flex items-center gap-2"
            >
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>Google Drive Audio Hub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">إجمالي التسجيلات الصوتية</span>
            <FileAudio className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {recordings.length}
          </div>
          <div className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
            <span>
              خام {totalRaw} • ماستر {totalMastered}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">مكتبة الكتب المعتمدة</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {books.length}
          </div>
          <div className="text-[11px] text-emerald-400/90 font-medium">
            مشاريع جاهزة ومكتملة
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">أعضاء المبادرة النشطون</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {users.length}
          </div>
          <div className="text-[11px] text-blue-400/90 font-medium">
            أعضاء ورواة ومصرحين
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">
              طلبات إعادة التسجيل / الملاحظات
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {totalRevisions}
          </div>
          <div className="text-[11px] text-rose-400/90 font-medium">
            مراجعات جودة معلقة
          </div>
        </div>
      </div>

      {/* Grid: Server Config & Database Wipe Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Server Configuration Form */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-amber-400 pb-3 border-b border-slate-800">
            <Database className="w-5 h-5" />
            <h3 className="text-sm font-extrabold text-white">
              إعدادات روابط ومفاتيح قاعدة البيانات (Database Config)
            </h3>
          </div>

          {!canEditUrls && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                تعديل السيرفرات محمي بـ صلاحية <strong>can_edit_db_urls</strong>
              </span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveDbSettings} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">
                رابط خادم Supabase API URL:
              </label>
              <input
                type="text"
                disabled={!canEditUrls}
                value={dbUrlInput}
                onChange={(e) => setDbUrlInput(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">
                مفتاح الوصول العام Supabase Anon Key:
              </label>
              <input
                type="text"
                disabled={!canEditUrls}
                value={dbAnonKeyInput}
                onChange={(e) => setDbAnonKeyInput(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {canEditUrls && (
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span>تحديث وحفظ روابط الداتا بيس</span>
              </button>
            )}
          </form>
        </div>

        {/* Database Wipe & Reset Action Card */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-400 pb-3 border-b border-slate-800">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-extrabold text-white">
                إعادة ضبط وتفريغ الداتا بيس (Database Wipe Zone)
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هذه المنطقة تتيح مسح كافة التسجيلات الصوتية ومكتبة الكتب وتعديلات
              المنصة وإعادتها إلى الحالة الأولية. لا يمكن تنفيذه إلا بصلاحية
              خاصة جداً{" "}
              <strong className="text-rose-400 font-mono">
                can_wipe_database
              </strong>
              .
            </p>

            {!canWipeDb && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  محمي! يتطلب صلاحية <strong>can_wipe_database</strong> أو حساب
                  Super Admin.
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            {showWipeConfirm ? (
              <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500 space-y-3 animate-fade-in">
                <div className="text-xs font-extrabold text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>
                    تأكيد نهائي: هل أنت متأكد من تفريغ وإعادت ضبط قاعدة
                    البيانات؟
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      onWipeDatabase();
                      setShowWipeConfirm(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all cursor-pointer shadow-lg shadow-rose-600/30"
                  >
                    نعم، قم بحذف وإعادة ضبط الداتا بيس فوراً
                  </button>
                  <button
                    onClick={() => setShowWipeConfirm(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <button
                disabled={!canWipeDb}
                onClick={() => setShowWipeConfirm(true)}
                className="w-full py-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 disabled:opacity-40 font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>
                  مسح وإعادة ضبط البيانات بالكامل (Wipe Platform Data)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users & Permissions Live Roster Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>جدول كشوفات الأعضاء وتوزيع الصلاحيات الحالية</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            العدد: {users.length} عضو
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">اسم العضو</th>
                <th className="p-3">الدور الإداري</th>
                <th className="p-3">الكود السري (PIN)</th>
                <th className="p-3">الإعدادات</th>
                <th className="p-3">مسح الداتا بيس</th>
                <th className="p-3">روابط الداتا بيس</th>
                <th className="p-3">لوحة التحكم</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-slate-950/40 transition-colors"
                >
                  <td className="p-3 font-bold text-white flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-slate-950 ${u.avatar_color || "bg-amber-500"}`}
                    >
                      {u.name.slice(0, 1)}
                    </span>
                    <span>{u.name}</span>
                    {u.is_super_admin && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-mono">
                        Super Admin
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-300">{u.role_display_ar}</td>
                  <td className="p-3 font-mono text-amber-400 font-bold">
                    {""}
                  </td>
                  <td className="p-3">
                    {u.can_manage_settings || u.is_super_admin
                      ? "✅ مسموح"
                      : "❌ محظور"}
                  </td>
                  <td className="p-3">
                    {u.can_wipe_database || u.is_super_admin
                      ? "✅ مسموح"
                      : "❌ محظور"}
                  </td>
                  <td className="p-3">
                    {u.can_edit_db_urls || u.is_super_admin
                      ? "✅ مسموح"
                      : "❌ محظور"}
                  </td>
                  <td className="p-3">
                    {u.can_access_control_panel || u.is_super_admin
                      ? "✅ مسموح"
                      : "❌ محظور"}
                  </td>
                  <td className="p-3">
                    {u.is_active === false ? (
                      <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        معطل
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        نشط
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
