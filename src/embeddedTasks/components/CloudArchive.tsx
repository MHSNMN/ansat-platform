// @ts-nocheck
import React, { useState } from "react";
import { CLOUD_FOLDERS } from "../data/mockData";
import { CloudFolder, UserSession } from "../types";
import {
  FolderKanban,
  FileText,
  Mic,
  Sliders,
  Volume2,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  Check,
  Eye,
  HardDrive,
  Sparkles,
  Edit3,
  Lock,
  BookOpen,
  FolderHeart,
  Briefcase,
  Layers,
} from "lucide-react";

interface CloudArchiveProps {
  currentUser: UserSession | null;
  folders?: CloudFolder[];
  onOpenFolderModal: (folder: CloudFolder) => void;
  onUpdateFolderUrl?: (folderId: string, newUrl: string) => void;
}

export const CloudArchive: React.FC<CloudArchiveProps> = ({
  currentUser,
  folders: propFolders,
  onOpenFolderModal,
  onUpdateFolderUrl,
}) => {
  const [localFolders, setLocalFolders] =
    useState<CloudFolder[]>(CLOUD_FOLDERS);
  const folders = propFolders || localFolders;

  const [copiedFolderId, setCopiedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newUrlInput, setNewUrlInput] = useState<string>("");

  // Determine user's current department ID
  const getUserDepartmentId = (): string => {
    if (!currentUser) return "audio";
    const dept = (currentUser.departmentName || "").toLowerCase();
    if (
      dept.includes("صوت") ||
      dept.includes("تسجيل") ||
      dept.includes("مونتاج")
    )
      return "audio";
    if (
      dept.includes("محتوى") ||
      dept.includes("حقوق") ||
      dept.includes("ترجمة")
    )
      return "content";
    if (
      dept.includes("تصميم") ||
      dept.includes("فعاليات") ||
      dept.includes("ميديا")
    )
      return "design";
    if (
      dept.includes("تقنية") ||
      dept.includes("نشر") ||
      dept.includes("برمجة")
    )
      return "tech";
    return "audio"; // Default for admin / general
  };

  const userDeptId = getUserDepartmentId();

  const getFolderIcon = (iconName: string) => {
    switch (iconName) {
      case "FileText":
        return FileText;
      case "Mic":
        return Mic;
      case "Sliders":
        return Sliders;
      case "Volume2":
        return Volume2;
      case "Image":
        return ImageIcon;
      case "BookOpen":
        return BookOpen;
      default:
        return FolderKanban;
    }
  };

  const handleCopyLink = (folder: CloudFolder) => {
    navigator.clipboard.writeText(folder.url);
    setCopiedFolderId(folder.id);
    setTimeout(() => setCopiedFolderId(null), 2500);
  };

  const handleSaveDriveLink = (folderId: string) => {
    if (!newUrlInput.trim()) return;
    if (onUpdateFolderUrl) {
      onUpdateFolderUrl(folderId, newUrlInput.trim());
    } else {
      setLocalFolders((prev) =>
        prev.map((f) =>
          f.id === folderId ? { ...f, url: newUrlInput.trim() } : f,
        ),
      );
    }
    setEditingFolderId(null);
    setNewUrlInput("");
  };

  // Divide folders into the 3 requested groups:
  // 1) Activity Folders (الكتب المعتمدة + الجلسات التحضيرية)
  const activityFolders = folders.filter(
    (f) =>
      f.departmentId === "activity" ||
      f.id.includes("books") ||
      f.id.includes("sessions"),
  );

  // 2) User's Department Folders (ملفات قسمي)
  const myDeptFolders = folders.filter(
    (f) =>
      f.departmentId === userDeptId &&
      !activityFolders.some((a) => a.id === f.id),
  );

  // 3) Other Folders (ملفات الأقسام الأخرى)
  const otherFolders = folders.filter(
    (f) =>
      !activityFolders.some((a) => a.id === f.id) &&
      !myDeptFolders.some((m) => m.id === f.id),
  );

  const renderFolderCard = (folder: CloudFolder) => {
    const Icon = getFolderIcon(folder.iconName);
    const isCopied = copiedFolderId === folder.id;
    const isEditing = editingFolderId === folder.id;

    return (
      <div
        key={folder.id}
        className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between space-y-6 group"
      >
        {/* Folder Top Identity */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-slate-900 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <Icon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {folder.departmentName}
            </span>
          </div>

          <div className="space-y-1.5 text-right">
            <h3 className="text-lg font-extrabold text-white leading-snug">
              {folder.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {folder.description}
            </p>
          </div>
        </div>

        {/* Drive Link Editor (Admins Only) */}
        {isEditing && currentUser?.isAdmin ? (
          <div className="space-y-2 p-3 bg-slate-950 border border-amber-500/30 rounded-2xl animate-in fade-in">
            <label className="text-[11px] font-bold text-amber-400 block text-right">
              تعديل رابط Google Drive للمجلد:
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={newUrlInput}
              onChange={(e) => setNewUrlInput(e.target.value)}
              className="w-full p-2 text-xs bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-amber-500 text-left font-mono"
            />
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setEditingFolderId(null)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleSaveDriveLink(folder.id)}
                className="px-3 py-1 text-xs bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400"
              >
                حفظ الرابط
              </button>
            </div>
          </div>
        ) : (
          /* Folder Stats Bar */
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>
                المستضيف: <strong className="text-white">Google Drive</strong>
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
              رابط مباشر
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div
          className={`pt-2 grid ${currentUser?.isAdmin ? "grid-cols-4" : "grid-cols-3"} gap-2`}
        >
          {/* Edit Drive Link Button - ADMINS ONLY */}
          {currentUser?.isAdmin && (
            <button
              onClick={() => {
                setEditingFolderId(folder.id);
                setNewUrlInput(folder.url);
              }}
              className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-400 font-bold text-xs transition-colors cursor-pointer"
              title="تعديل رابط Google Drive (صلاحية الأدمن فقط)"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل</span>
            </button>
          )}

          {/* Inspect Folder Info */}
          <button
            onClick={() => onOpenFolderModal(folder)}
            className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            title="استعراض بيانات المجلد"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>تفاصيل</span>
          </button>

          {/* Copy Folder Link */}
          <button
            onClick={() => handleCopyLink(folder)}
            className={`flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
              isCopied
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
            title="نسخ رابط المجلد"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isCopied ? "تم النسخ" : "نسخ"}</span>
          </button>

          {/* Direct Open Cloud Link */}
          <a
            href={folder.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md"
            title="فتح المجلد المباشر في Google Drive"
          >
            <span>فتح 🔗</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <section
      id="archive"
      className="py-20 bg-slate-950 relative overflow-hidden font-['Cairo']"
    >
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
            <FolderKanban className="w-4 h-4" />
            <span>الأرشيف السحابي المباشر (Google Drive)</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            مجلدات <span className="text-amber-400">Google Drive المباشرة</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            أرشيف منظم وشامل يحتوي على ملفات قسمك، ملفات الأنشطة والكتب، وكافة
            مجلدات العمل المباشرة.
          </p>
        </div>

        {/* SECTION 1: MY DEPARTMENT FOLDERS (ملفات قسمي) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <FolderHeart className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>ملفات قسمي</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {currentUser
                      ? currentUser.departmentName
                      : "قسم العمل الخاص بك"}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  المجلدات الخاصة المخصصة للعمل المباشر داخل قسمك.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myDeptFolders.length > 0 ? (
              myDeptFolders.map((folder) => renderFolderCard(folder))
            ) : (
              <div className="col-span-full p-8 rounded-3xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-xs">
                لا توجد مجلدات مخصصة فقط لقسمك الحالي، يمكنك استعراض الملفات
                العامة والأقسام الأخرى بالأسفل.
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: WORK & ACTIVITIES FOLDERS (ملفات العمل والأنشطة - الكتب والجلسات) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>ملفات العمل والأنشطة</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    الكتب المعتمدة والجلسات
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  تحتوي على ملف الكتب المعتمدة للتسجيل (PDF) وملف الجلسات
                  التحضيرية المباشرة.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {activityFolders.map((folder) => renderFolderCard(folder))}
          </div>
        </div>

        {/* SECTION 3: OTHER DEPARTMENTS FOLDERS (ملفات أخرى) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  ملفات أخرى (بقية الأقسام)
                </h3>
                <p className="text-xs text-slate-400">
                  كافة مجلدات الأرشيف المباشرة للأقسام الأخرى لضمان سهولة الوصول
                  والشفافية.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherFolders.map((folder) => renderFolderCard(folder))}
          </div>
        </div>

        {/* Security & Access Policy Note */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-sm block">
                سياسة وحماية الروابط السحابية
              </span>
              <span>
                روابط المجلدات حقيقية ومباشرة. يُسمح لمدير النظام (Admin) فقط
                بتعديل وتحديث الروابط، بينما يمكن للأعضاء تصفح ونسخ الروابط.
              </span>
            </div>
          </div>
          {!currentUser?.isAdmin && (
            <div className="flex items-center gap-1.5 text-amber-400/80 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 text-[11px]">
              <Lock className="w-3.5 h-3.5" />
              <span>تعديل الروابط مقيد بإدارة النظام</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
