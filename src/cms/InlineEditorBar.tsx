import React, { useState } from "react";
import {
  Edit3,
  Eye,
  Save,
  Send,
  History,
  Plus,
  Check,
  X,
  Loader2,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { CmsSection, CmsSiteContent, SectionType } from "./cmsTypes";
import { apiFetch } from "../lib/api";

interface InlineEditorBarProps {
  content: CmsSiteContent;
  isEditing: boolean;
  previewMode?: "published" | "draft";
  onToggleEdit: (editing: boolean) => void;
  onContentChange: (newContent: CmsSiteContent) => void;
  onRefresh: (mode?: "published" | "draft") => void;
  onOpenTextEditor?: (
    tab?:
      | "hero"
      | "about"
      | "contact"
      | "terms"
      | "countries"
      | "pillars"
      | "youthManifesto"
      | "images",
  ) => void;
  onTogglePreviewMode?: (mode: "published" | "draft") => void;
}

export function InlineEditorBar({
  content,
  isEditing,
  previewMode = "draft",
  onToggleEdit,
  onContentChange,
  onRefresh,
  onOpenTextEditor,
  onTogglePreviewMode,
}: InlineEditorBarProps) {
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Conflict Resolution State
  const [conflictData, setConflictData] = useState<{
    currentVersion: number;
    expectedVersion?: number;
    lastUpdatedAt?: string;
    error?: string;
  } | null>(null);

  if (!isEditing) {
    return (
      <div className="fixed top-4 left-4 z-50 animate-fadeIn flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleEdit(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xl shadow-amber-500/20 transition cursor-pointer"
        >
          <Edit3 size={14} />
          <span>تحرير نصوص الواجهة</span>
        </button>
      </div>
    );
  }

  const handleSaveDraft = async () => {
    setSaving(true);
    setMessage(null);
    try {
      try {
        localStorage.setItem(
          "ensat_cms_content_cache",
          JSON.stringify(content),
        );
      } catch (e) {
        console.warn("Failed to cache CMS content locally", e);
      }
      const res = await apiFetch("/api/admin/cms/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "تعذر حفظ المسودة");
      setMessage({
        text: "تم حفظ المسودة بنجاح! يمكنك نشرها متى شئت",
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: err.message || "خطأ أثناء الحفظ", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (force: boolean = false) => {
    if (
      !force &&
      !window.confirm(
        "هل أنت متأكد من رغبتك في نشر هذه التغييرات لجميع زوار المنصة؟",
      )
    )
      return;
    setPublishing(true);
    setMessage(null);
    setConflictData(null);

    try {
      try {
        localStorage.setItem(
          "ensat_cms_content_cache",
          JSON.stringify(content),
        );
      } catch (e) {
        console.warn("Failed to cache CMS content locally", e);
      }
      const res = await apiFetch("/api/admin/cms/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          expectedVersion: content.version,
          force,
          summary: "نشر تحديثات الواجهة العامة",
        }),
      });
      const data = await res.json();

      if (res.status === 409 || data.conflict) {
        setConflictData({
          currentVersion: data.currentVersion || content.version + 1,
          expectedVersion: data.expectedVersion || content.version,
          lastUpdatedAt: data.lastUpdatedAt,
          error: data.error,
        });
        return;
      }

      if (!res.ok || !data.success)
        throw new Error(data.error || "تعذر نشر التغييرات");
      setMessage({
        text: `تم النشر للعامة بنجاح (النسخة v${data.version})!`,
        type: "success",
      });
      onRefresh("published");
    } catch (err: any) {
      setMessage({ text: err.message || "خطأ أثناء النشر", type: "error" });
    } finally {
      setPublishing(false);
    }
  };

  const handleLoadHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await apiFetch("/api/admin/cms/history");
      const data = await res.json();
      if (data.success) {
        setHistoryList(data.versions || []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRevertVersion = async (versionNumber: number) => {
    if (!window.confirm(`هل أنت متأكد من استعادة النسخة رقم ${versionNumber}؟`))
      return;
    try {
      const res = await apiFetch(`/api/admin/cms/restore/${versionNumber}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.content) {
        onContentChange(data.content);
        setMessage({
          text: `تمت استعادة النسخة ${versionNumber}`,
          type: "success",
        });
        setShowHistory(false);
      }
    } catch (err: any) {
      setMessage({ text: err.message || "تعذر استعادة النسخة", type: "error" });
    }
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const sections = [...content.sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;
    sections.forEach((sec, i) => (sec.order = i + 1));
    onContentChange({ ...content, sections });
  };

  const handleToggleVisibility = (sectionId: string) => {
    const sections = content.sections.map((s) =>
      s.id === sectionId ? { ...s, visible: !s.visible } : s,
    );
    onContentChange({ ...content, sections });
  };

  const handleAddPresetSection = (type: SectionType, title: string) => {
    const newSection: CmsSection = {
      id: `sec-${Date.now()}`,
      type,
      title,
      subtitle: "عنوان فرعي جديد",
      description: "وصف موجز لهذا القسم",
      badge: "قسم جديد",
      order: content.sections.length + 1,
      visible: true,
    };
    onContentChange({
      ...content,
      sections: [...content.sections, newSection],
    });
    setShowAddSection(false);
    setMessage({ text: `تمت إضافة قسم: ${title}`, type: "success" });
  };

  return (
    <>
      {/* Top Floating Control Bar */}
      <div
        dir="rtl"
        className="fixed top-0 inset-x-0 z-50 bg-slate-950/95 border-b border-amber-500/30 shadow-2xl backdrop-blur-md text-slate-100 px-4 py-2.5 transition-all"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>محرر الصفحة المباشر</span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              النسخة: v{content.version} · الحالة: {content.status}
            </span>
          </div>

          {message && (
            <div
              className={`text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 ${
                message.type === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
              }`}
            >
              {message.type === "success" ? (
                <Check size={14} />
              ) : (
                <AlertCircle size={14} />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {onOpenTextEditor && (
              <button
                type="button"
                onClick={() => onOpenTextEditor("hero")}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1.5 font-bold transition cursor-pointer"
              >
                <Edit3 size={14} />
                <span>تحرير النصوص</span>
              </button>
            )}

            {onTogglePreviewMode && (
              <button
                type="button"
                onClick={() =>
                  onTogglePreviewMode(
                    previewMode === "draft" ? "published" : "draft",
                  )
                }
                className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition border ${
                  previewMode === "draft"
                    ? "bg-purple-950/40 text-purple-300 border-purple-500/30 hover:bg-purple-900/40"
                    : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40"
                }`}
                title="التبديل بين معاينة المسودة أو المنشور للعامة"
              >
                <Eye size={13} />
                <span>
                  {previewMode === "draft"
                    ? "معاينة: مسودة 📝"
                    : "معاينة: المنشور 🌐"}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAddSection(!showAddSection)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs flex items-center gap-1.5 transition"
            >
              <Plus size={14} /> إضافة قسم
            </button>

            <button
              type="button"
              onClick={handleLoadHistory}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs flex items-center gap-1.5 transition"
            >
              <History size={14} /> النسخ
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Save size={14} />
              )}
              <span>حفظ مسودة</span>
            </button>

            <button
              type="button"
              onClick={() => handlePublish(false)}
              disabled={publishing}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {publishing ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Send size={14} />
              )}
              <span>نشر للعامة</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleEdit(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="خروج من وضع التحرير"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Add Section Drawer */}
      {showAddSection && (
        <div
          dir="rtl"
          className="fixed top-16 right-4 z-50 w-72 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl text-slate-100 space-y-2 animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-amber-400">
            <span>اختر نوع القسم لإضافته:</span>
            <button
              onClick={() => setShowAddSection(false)}
              className="text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1 text-xs">
            {[
              { type: "about" as SectionType, title: "عن إنصات والرؤية" },
              { type: "library" as SectionType, title: "المكتبة الصوتية" },
              {
                type: "activities" as SectionType,
                title: "الأنشطة والفعاليات",
              },
              { type: "events" as SectionType, title: "الفعاليات القادمة" },
              { type: "sessions" as SectionType, title: "تسجيلات الجلسات" },
              { type: "journey" as SectionType, title: "رحلة العمل والمعايير" },
              {
                type: "testimonials" as SectionType,
                title: "شهادات وتجارب المتطوعين",
              },
              { type: "faq" as SectionType, title: "الأسئلة الشائعة" },
              { type: "join" as SectionType, title: "دعوة للتطوع" },
              { type: "custom" as SectionType, title: "قسم نصي مخصص" },
            ].map((preset) => (
              <button
                key={preset.type + preset.title}
                type="button"
                onClick={() =>
                  handleAddPresetSection(preset.type, preset.title)
                }
                className="w-full text-right px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-200 transition flex items-center justify-between"
              >
                <span>{preset.title}</span>
                <Plus size={14} className="text-amber-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold">
                <History size={18} className="text-amber-400" />
                <span>سجل النسخ والتعديلات</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
              {historyLoading ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  <Loader2 size={20} className="spin mx-auto mb-2" />
                  جارٍ تحميل السجل...
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  لا توجد نسخ سابقة محفوظة بعد.
                </div>
              ) : (
                historyList.map((ver) => (
                  <div
                    key={ver.id || ver.version}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">
                        النسخة v{ver.version}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {ver.summary || "تحديث محتوى"}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(ver.timestamp).toLocaleString("ar")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevertVersion(ver.version)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 flex items-center gap-1 font-medium transition"
                    >
                      <Undo2 size={12} /> استعادة
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {conflictData && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
        >
          <div className="w-full max-w-lg bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold border-b border-slate-800 pb-3">
              <AlertCircle size={22} className="text-rose-400 shrink-0" />
              <div>
                <h3 className="text-base text-white">
                  تنبيه: تعارض في حفظ وتعديل المحتوى
                </h3>
                <p className="text-xs text-rose-300/90 font-normal">
                  توجد نسخة أحدث تم نشرها أثناء قيامك بالعمل على هذا المحتوى
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">رقم نسختك المحلية:</span>
                <span className="font-mono font-bold text-amber-400">
                  v{conflictData.expectedVersion || content.version}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">النسخة الأحدث في الخادم:</span>
                <span className="font-mono font-bold text-emerald-400">
                  v{conflictData.currentVersion}
                </span>
              </div>
              {conflictData.lastUpdatedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ النشر الأخير:</span>
                  <span className="text-slate-300">
                    {new Date(conflictData.lastUpdatedAt).toLocaleString("ar")}
                  </span>
                </div>
              )}
              <p className="pt-2 text-slate-400 border-t border-slate-900">
                {conflictData.error ||
                  "تم تحديث الواجهة العامة من قبل مدير آخر، لحماية التعديلات من الضياع تم إيقاف النشر التلقائي."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConflictData(null);
                  onRefresh("published");
                  setMessage({
                    text: "تم تحديث الصفحة بالنسخة الأحدث من الخادم",
                    type: "success",
                  });
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                جلب ومراجعة النسخة الأحدث من الخادم
              </button>

              <button
                type="button"
                onClick={() => handlePublish(true)}
                disabled={publishing}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {publishing ? (
                  <Loader2 size={14} className="spin inline ml-1" />
                ) : null}
                فرض النشر واستبدال التعارض
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
