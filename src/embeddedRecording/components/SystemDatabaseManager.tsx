// @ts-nocheck
import React, { useState } from "react";
import {
  Database,
  HardDrive,
  Server,
  Trash2,
  Cloud,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  UploadCloud,
} from "lucide-react";
import { User, AudioRecording, Book, ThemeMode } from "../types";
import { migrateAllDataToFirebase } from "../lib/firebaseClient";
import { fetchActivityLogs, fetchUsers } from "../lib/supabaseClient";
import { toastStore } from "../lib/toastStore";
import FirebaseStorageMigrationTool from "./FirebaseStorageMigrationTool";

interface Props {
  currentUser: User | null;
  theme: ThemeMode;
  books: Book[];
  recordings: AudioRecording[];
  onWipeDataClick: () => void;
  onSetupSupabaseClick: () => void;
  onSetupDriveClick: () => void;
}

export default function SystemDatabaseManager({
  currentUser,
  theme,
  books,
  recordings,
  onWipeDataClick,
  onSetupSupabaseClick,
  onSetupDriveClick,
}: Props) {
  const isAuthorized = currentUser?.is_super_admin;
  const isDark = theme === "dark";
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleSyncAllToFirebase = async () => {
    setIsSyncingFirebase(true);
    try {
      const allUsers = await fetchUsers();
      const allLogs = await fetchActivityLogs();
      const ok = await migrateAllDataToFirebase(
        allUsers,
        books,
        recordings,
        allLogs,
      );
      if (ok) {
        setSyncSuccess(true);
        toastStore.addToast({
          type: "success",
          title: "اكتمل الحفظ السحابي على Firebase",
          message: `تم رفع وتحديث بيانات ${books.length} كتاب و ${recordings.length} تسجيل صوتي و ${allUsers.length} عضو بنجاح على Firebase Firestore!`,
        });
        setTimeout(() => setSyncSuccess(false), 5000);
      } else {
        toastStore.addToast({
          type: "error",
          title: "تنبيه المزامنة",
          message: "تعذر رفع بعض السجلات إلى Firebase Firestore.",
        });
      }
    } catch (err) {
      console.error("Firebase sync error:", err);
      toastStore.addToast({
        type: "error",
        title: "خطأ في الاتصال",
        message: "حدث خطأ أثناء مزامنة البيانات مع Firebase Firestore.",
      });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center text-rose-500">
        <ShieldAlert className="w-16 h-16 mx-auto mb-4" />
        <h2 className="text-xl font-bold">غير مصرح بالوصول</h2>
        <p className="mt-2 text-sm">
          عذراً، الوصول إلى إدارة النظام وقواعد البيانات محصور بالمدير الرئيسي
          (Super Admin).
        </p>
      </div>
    );
  }

  return (
    <div
      className={`p-6 rounded-2xl border transition-all ${isDark ? "bg-slate-900/90 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}
    >
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/60">
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">
            نظام قواعد البيانات والتخزين (Database & Storage)
          </h1>
          <p
            className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            إدارة مباشرة لملفات Google Drive وحفظ المنصة على Firebase Firestore
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Drive Storage Card */}
        <div
          className={`p-5 rounded-2xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg">Google Drive Storage</h3>
          </div>
          <p className="text-sm opacity-80 mb-6">
            محرك التخزين والأرشفة الخلفي للملفات الصوتية ومجلدات الكتب.
          </p>
          <div className="space-y-3">
            <button
              onClick={onSetupDriveClick}
              className="w-full flex justify-center items-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition border border-emerald-500/30 text-sm font-bold cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              إعداد وربط Google Drive
            </button>
            <div className="flex justify-between text-sm">
              <span>الملفات الصوتية</span>
              <span className="font-mono font-bold text-emerald-400">
                {recordings.length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>مجلدات الكتب</span>
              <span className="font-mono font-bold text-emerald-400">
                {books.length}
              </span>
            </div>
          </div>
        </div>

        {/* Firebase Firestore Database Card */}
        <div
          className={`p-5 rounded-2xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-lg">Firebase Firestore (الأساسي)</h3>
          </div>
          <p className="text-sm opacity-80 mb-6">
            قاعدة البيانات السحابية المركزية لتخزين كافة الكتب والتسجيلات
            والمستخدمين وتزامنهم اللحظي.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleSyncAllToFirebase}
              disabled={isSyncingFirebase}
              className={`w-full flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold transition border cursor-pointer ${
                syncSuccess
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/40"
              }`}
            >
              {isSyncingFirebase ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ والرفع لـ Firebase...</span>
                </>
              ) : syncSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تم الحفظ على Firebase بنجاح!</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>رفع ومزامنة كافة البيانات لـ Firebase</span>
                </>
              )}
            </button>

            <button
              onClick={onSetupSupabaseClick}
              className="w-full flex justify-center items-center gap-2 py-2 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition border border-slate-600 text-xs font-semibold cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              إعدادات الربط الإضافية
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div
          className={`p-5 rounded-2xl border ${isDark ? "bg-rose-500/10 border-rose-500/30" : "bg-rose-50 border-rose-200"}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-lg text-rose-500">
              منطقة الخطر (Danger Zone)
            </h3>
          </div>
          <p className="text-sm opacity-80 mb-6 text-rose-600 dark:text-rose-400">
            الحذف النهائي للبيانات والعودة لنقطة الصفر. لا يمكن التراجع عن هذا
            الإجراء.
          </p>
          <button
            onClick={onWipeDataClick}
            className="w-full flex justify-center items-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition text-sm font-bold shadow-lg shadow-rose-600/20 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            مسح وتصفير المنصة (Wipe Data)
          </button>
        </div>
      </div>

      {/* Migration Tool */}
      <FirebaseStorageMigrationTool recordings={recordings} books={books} />
    </div>
  );
}
