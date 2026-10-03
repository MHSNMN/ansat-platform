// @ts-nocheck
import React from "react";
import {
  Sparkles,
  FolderKanban,
  Users,
  Award,
  ExternalLink,
} from "lucide-react";

interface FooterProps {
  setActiveSection: (sectionId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveSection }) => {
  const handleNav = (id: string) => {
    setActiveSection(id);
    const elem = document.getElementById(id);
    if (elem) elem.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 pt-12 pb-10 font-['Cairo']">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-900">
          {/* Brand & System Title */}
          <div className="space-y-1 text-center md:text-right">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-xl font-black text-white">
                إنصات | لوحة المهام والنظام الداخلي
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                نظام مغلق
              </span>
            </div>
            <p className="text-xs text-slate-400">
              منظومة إدارية مركزية لمتابعة إنجاز الأعمال بين كوادر العراق ومصر
            </p>
          </div>

          {/* Quick Section Jump & External Points System Link */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => handleNav("dashboard")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-bold transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>جدول المهام</span>
            </button>

            <button
              onClick={() => handleNav("archive")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-bold transition-colors cursor-pointer"
            >
              <FolderKanban className="w-4 h-4 text-amber-400" />
              <span>Google Drive الأرشيف</span>
            </button>

            <a
              href="/rewards"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 font-bold transition-colors cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>إنصات - نظام النقاط</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Mandatory Copyright Line */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-slate-300 font-bold text-center sm:text-right text-sm">
            تمت البرمجة والإدارة بواسطة: قسم الأنظمة والبحوث الرقمية
          </p>

          <div className="flex items-center gap-1.5 text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>نظام متابعة سير العمل الميداني • بغداد والقاهرة</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
