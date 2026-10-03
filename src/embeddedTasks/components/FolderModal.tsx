// @ts-nocheck
import React from "react";
import { CloudFolder } from "../types";
import {
  X,
  HardDrive,
  ShieldCheck,
  FolderKanban,
  ArrowUpRight,
} from "lucide-react";

interface FolderModalProps {
  folder: CloudFolder | null;
  onClose: () => void;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  folder,
  onClose,
}) => {
  if (!folder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-right font-['Cairo']">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <FolderKanban className="w-4 h-4" />
              <span>{folder.departmentName}</span>
            </span>
            <h3 className="text-xl font-bold text-white">{folder.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description & Folder Info */}
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
            {folder.description}
          </p>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>الرابط السحابي الرسمي المعالج:</span>
            </div>
            <p className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 dir-ltr text-left break-all select-all">
              {folder.url}
            </p>
          </div>
        </div>

        {/* Notice on Real Cloud Files */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1.5">
          <span className="font-bold text-slate-200 block">
            📁 الإدارة السحابية المباشرة:
          </span>
          <p className="text-[11px] leading-relaxed">
            تخزن كافة المستندات والملفات الصوتية والتصاميم الفعلية مباشرة على
            خوادم Google Drive. اضغط على الزر أدناه للانتقال المباشر وتصفح أو
            رفع الملفات.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-amber-400" />
            <span>
              التخزين: <strong className="text-white">Google Drive</strong>
            </span>
          </div>

          <a
            href={folder.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <span>انتقل للمجلد على Google Drive</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
