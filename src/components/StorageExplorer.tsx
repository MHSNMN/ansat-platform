import { apiFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import {
  Folder,
  FileAudio,
  RefreshCw,
  HardDrive,
  Download,
  AlertCircle,
  FileText,
} from "lucide-react";
import { ThemeMode } from "../types";
import { toastStore } from "../lib/toastStore";
import { buildDriveFilesUrl, buildDriveDownloadUrl } from "../lib/driveUtils";

interface Props {
  theme: ThemeMode;
}

export default function StorageExplorer({ theme }: Props) {
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const fetchDriveData = async (folderId?: string) => {
    setLoading(true);
    try {
      if (!folderId) {
        const res = await apiFetch(buildDriveFilesUrl());
        const data = await res.json();
        if (data.success) {
          setFolders(data.folders || []);
        }
      } else {
        const res = await apiFetch(buildDriveFilesUrl(folderId));
        const data = await res.json();
        if (data.success) {
          setFiles(data.files || []);
        }
      }
    } catch (e) {
      toastStore.addToast({
        type: "error",
        title: "خطأ",
        message: "تعذر جلب الملفات من Google Drive",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDriveData();
  }, []);

  const handleFolderClick = (id: string) => {
    setSelectedFolder(id);
    fetchDriveData(id);
  };

  const handleDownload = (fileId: string, fileName: string) => {
    window.location.href = buildDriveDownloadUrl(fileId, fileName);
  };

  return (
    <div
      className={`p-6 rounded-3xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-indigo-500" />
            مستكشف الملفات (Google Drive)
          </h2>
          <p
            className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            استعراض الملفات المرفوعة بواسطة حساب الخدمة (Service Account)
          </p>
        </div>
        <button
          onClick={() => fetchDriveData(selectedFolder || undefined)}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="تحديث"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-2">
          <h3 className="font-bold mb-3 text-sm opacity-70">
            المجلدات الأساسية
          </h3>
          <button
            onClick={() => {
              setSelectedFolder(null);
              setFiles([]);
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${!selectedFolder ? (isDark ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-indigo-50 text-indigo-700 border border-indigo-200") : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            <Folder className="w-4 h-4" />
            الرئيسية (بحث عن الملفات)
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => handleFolderClick(f.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${selectedFolder === f.id ? (isDark ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-indigo-50 text-indigo-700 border border-indigo-200") : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              <Folder className="w-4 h-4" />
              {f.name}
            </button>
          ))}
        </div>

        <div
          className={`md:col-span-3 p-4 rounded-2xl border min-h-[400px] ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-500" />
            </div>
          ) : !selectedFolder && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
              <Folder className="w-16 h-16" />
              <p>يرجى اختيار مجلد من القائمة لعرض محتوياته</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
              <AlertCircle className="w-16 h-16" />
              <p>المجلد فارغ أو لا يحتوي على ملفات</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="flex items-center gap-3">
                    {(file.mimeType || "").includes("audio") ? (
                      <FileAudio className="w-8 h-8 text-amber-500" />
                    ) : (
                      <FileText className="w-8 h-8 text-blue-500" />
                    )}
                    <div>
                      <p className="font-bold text-sm max-w-[200px] sm:max-w-xs md:max-w-md truncate">
                        {file.name}
                      </p>
                      <p className="text-xs opacity-50 mt-1">
                        {file.size
                          ? (Number(file.size) / (1024 * 1024)).toFixed(2) +
                            " MB"
                          : "غير معروف"}{" "}
                        • {new Date(file.createdTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        <Folder className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDownload(file.id, file.name)}
                      className="p-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
                      title="تحميل مباشر"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
