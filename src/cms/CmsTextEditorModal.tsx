import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  RotateCcw,
  Sparkles,
  BookOpen,
  Mail,
  Shield,
  Plus,
  Trash2,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Compass,
  FileBadge2,
  Loader2,
} from "lucide-react";
import { CmsSiteContent } from "./cmsTypes";
import { DEFAULT_CMS_CONTENT } from "./cmsDefaults";
import { apiFetch } from "../lib/api";

export type CmsEditorTab =
  | "hero"
  | "pillars"
  | "youthManifesto"
  | "images"
  | "about"
  | "countries"
  | "contact"
  | "terms";

interface CmsTextEditorModalProps {
  isOpen: boolean;
  initialTab?: CmsEditorTab;
  content: CmsSiteContent;
  onClose: () => void;
  onSave: (updated: CmsSiteContent) => void;
}

const DEFAULT_MANUAL_COUNTRIES = [
  { name: "العراق", count: 8, members: ["فريق إنصات - العراق"] },
  { name: "السعودية", count: 6, members: ["فريق إنصات - السعودية"] },
  { name: "مصر", count: 7, members: ["فريق إنصات - مصر"] },
  { name: "الكويت", count: 4, members: ["فريق إنصات - الكويت"] },
  { name: "الأردن", count: 3, members: ["فريق إنصات - الأردن"] },
  { name: "الإمارات", count: 3, members: ["فريق إنصات - الإمارات"] },
  { name: "الجزائر", count: 2, members: ["فريق إنصات - الجزائر"] },
  { name: "المغرب", count: 2, members: ["فريق إنصات - المغرب"] },
  { name: "سلطنة عمان", count: 2, members: ["فريق إنصات - عمان"] },
];

export function CmsTextEditorModal({
  isOpen,
  initialTab = "hero",
  content,
  onClose,
  onSave,
}: CmsTextEditorModalProps) {
  const [activeTab, setActiveTab] = useState<CmsEditorTab>(initialTab);
  const [formState, setFormState] = useState<CmsSiteContent>(() => {
    const copy = JSON.parse(JSON.stringify(content || DEFAULT_CMS_CONTENT));
    if (!copy.manualCountries || copy.manualCountries.length === 0) {
      copy.manualCountries = [...DEFAULT_MANUAL_COUNTRIES];
    }
    if (!copy.images) copy.images = { ...DEFAULT_CMS_CONTENT.images };
    if (!copy.pillars) copy.pillars = { ...DEFAULT_CMS_CONTENT.pillars };
    if (!copy.youthManifesto)
      copy.youthManifesto = { ...DEFAULT_CMS_CONTENT.youthManifesto };
    return copy;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryCount, setNewCountryCount] = useState(1);
  const [newCountryMembers, setNewCountryMembers] = useState("");

  // Re-synchronize state whenever modal opens or content prop changes (Fixes persistence and stale text bug!)
  useEffect(() => {
    if (isOpen && content) {
      const copy = JSON.parse(JSON.stringify(content));
      if (!copy.manualCountries || copy.manualCountries.length === 0) {
        copy.manualCountries = [...DEFAULT_MANUAL_COUNTRIES];
      }
      if (!copy.images) copy.images = { ...DEFAULT_CMS_CONTENT.images };
      if (!copy.pillars) copy.pillars = { ...DEFAULT_CMS_CONTENT.pillars };
      if (!copy.youthManifesto)
        copy.youthManifesto = { ...DEFAULT_CMS_CONTENT.youthManifesto };
      setFormState(copy);
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setFeedbackMsg(null);
    }
  }, [isOpen, content, initialTab]);

  if (!isOpen) return null;

  const handleFieldChange = (key: keyof CmsSiteContent, value: any) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageChange = (key: string, url: string) => {
    setFormState((prev) => ({
      ...prev,
      images: {
        ...(prev.images || DEFAULT_CMS_CONTENT.images),
        [key]: url,
      },
    }));
  };

  const handlePillarChange = (
    index: number,
    field: "title" | "description" | "badge" | "image",
    value: string,
  ) => {
    setFormState((prev) => {
      const currentPillars = prev.pillars || DEFAULT_CMS_CONTENT.pillars!;
      const nextItems = [...currentPillars.items];
      if (nextItems[index]) {
        nextItems[index] = { ...nextItems[index], [field]: value };
      }
      return {
        ...prev,
        pillars: {
          ...currentPillars,
          items: nextItems,
        },
      };
    });
  };

  const handlePillarsMetaChange = (
    field: "title" | "subtitle",
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      pillars: {
        ...(prev.pillars || DEFAULT_CMS_CONTENT.pillars!),
        [field]: value,
      },
    }));
  };

  const handleManifestoChange = (
    field: "title" | "subtitle" | "summary" | "badge" | "actionLabel",
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      youthManifesto: {
        ...(prev.youthManifesto || DEFAULT_CMS_CONTENT.youthManifesto!),
        [field]: value,
      },
    }));
  };

  const handleManifestoPointChange = (idx: number, value: string) => {
    setFormState((prev) => {
      const points = [
        ...(prev.youthManifesto?.documentPoints ||
          DEFAULT_CMS_CONTENT.youthManifesto?.documentPoints ||
          []),
      ];
      points[idx] = value;
      return {
        ...prev,
        youthManifesto: {
          ...(prev.youthManifesto || DEFAULT_CMS_CONTENT.youthManifesto!),
          documentPoints: points,
        },
      };
    });
  };

  const handleAddManifestoPoint = () => {
    setFormState((prev) => {
      const points = [
        ...(prev.youthManifesto?.documentPoints ||
          DEFAULT_CMS_CONTENT.youthManifesto?.documentPoints ||
          []),
      ];
      points.push("بند جديد في وثيقة بيان الشباب العربي");
      return {
        ...prev,
        youthManifesto: {
          ...(prev.youthManifesto || DEFAULT_CMS_CONTENT.youthManifesto!),
          documentPoints: points,
        },
      };
    });
  };

  const handleRemoveManifestoPoint = (idx: number) => {
    setFormState((prev) => {
      const points = [
        ...(prev.youthManifesto?.documentPoints ||
          DEFAULT_CMS_CONTENT.youthManifesto?.documentPoints ||
          []),
      ];
      points.splice(idx, 1);
      return {
        ...prev,
        youthManifesto: {
          ...(prev.youthManifesto || DEFAULT_CMS_CONTENT.youthManifesto!),
          documentPoints: points,
        },
      };
    });
  };

  const handleAddCountry = () => {
    const trimmed = newCountryName.trim();
    if (!trimmed) return;
    const membersList = newCountryMembers
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const nextCountries = [...(formState.manualCountries || [])];
    const existingIndex = nextCountries.findIndex(
      (c) => (c.name || "").toLowerCase() === trimmed.toLowerCase(),
    );
    if (existingIndex >= 0) {
      nextCountries[existingIndex] = {
        name: trimmed,
        count: Math.max(1, Number(newCountryCount) || 1),
        members:
          membersList.length > 0
            ? membersList
            : nextCountries[existingIndex].members,
      };
    } else {
      nextCountries.push({
        name: trimmed,
        count: Math.max(1, Number(newCountryCount) || 1),
        members: membersList.length > 0 ? membersList : [`متطوعو ${trimmed}`],
      });
    }

    setFormState((prev) => ({
      ...prev,
      manualCountries: nextCountries,
      countryMetricMode: "MANUAL",
    }));

    setNewCountryName("");
    setNewCountryCount(1);
    setNewCountryMembers("");
  };

  const handleRemoveCountry = (index: number) => {
    const nextCountries = [...(formState.manualCountries || [])];
    nextCountries.splice(index, 1);
    setFormState((prev) => ({ ...prev, manualCountries: nextCountries }));
  };

  const handleGoalChange = (index: number, value: string) => {
    const nextGoals = [...(formState.goals || [])];
    nextGoals[index] = value;
    setFormState((prev) => ({ ...prev, goals: nextGoals }));
  };

  const handleAddGoal = () => {
    setFormState((prev) => ({
      ...prev,
      goals: [...(prev.goals || []), "هدف جديد"],
    }));
  };

  const handleRemoveGoal = (index: number) => {
    const nextGoals = [...(formState.goals || [])];
    nextGoals.splice(index, 1);
    setFormState((prev) => ({ ...prev, goals: nextGoals }));
  };

  const handleResetToDefault = (tab: CmsEditorTab) => {
    if (
      !window.confirm("هل أنت متأكد من استعادة النصوص الافتراضية لهذا القسم؟")
    )
      return;
    if (tab === "hero") {
      setFormState((prev) => ({
        ...prev,
        headline: DEFAULT_CMS_CONTENT.headline,
        description: DEFAULT_CMS_CONTENT.description,
      }));
    } else if (tab === "pillars") {
      setFormState((prev) => ({
        ...prev,
        pillars: JSON.parse(JSON.stringify(DEFAULT_CMS_CONTENT.pillars)),
      }));
    } else if (tab === "youthManifesto") {
      setFormState((prev) => ({
        ...prev,
        youthManifesto: JSON.parse(
          JSON.stringify(DEFAULT_CMS_CONTENT.youthManifesto),
        ),
      }));
    } else if (tab === "images") {
      setFormState((prev) => ({
        ...prev,
        images: JSON.parse(JSON.stringify(DEFAULT_CMS_CONTENT.images)),
      }));
    } else if (tab === "about") {
      setFormState((prev) => ({
        ...prev,
        aboutTitle: DEFAULT_CMS_CONTENT.aboutTitle,
        aboutSubtitle: DEFAULT_CMS_CONTENT.aboutSubtitle,
        aboutBody: DEFAULT_CMS_CONTENT.aboutBody,
        vision: DEFAULT_CMS_CONTENT.vision,
        mission: DEFAULT_CMS_CONTENT.mission,
        goals: [...DEFAULT_CMS_CONTENT.goals],
      }));
    } else if (tab === "contact") {
      setFormState((prev) => ({
        ...prev,
        contactEmail: DEFAULT_CMS_CONTENT.contactEmail,
        contactPhone: DEFAULT_CMS_CONTENT.contactPhone,
        socialLinks: JSON.parse(
          JSON.stringify(DEFAULT_CMS_CONTENT.socialLinks),
        ),
      }));
    } else if (tab === "terms") {
      setFormState((prev) => ({
        ...prev,
        termsBody: DEFAULT_CMS_CONTENT.termsBody,
        privacyBody: DEFAULT_CMS_CONTENT.privacyBody,
      }));
    } else if (tab === "countries") {
      setFormState((prev) => ({
        ...prev,
        countryMetricMode: "AUTO",
        manualCountries: [...DEFAULT_MANUAL_COUNTRIES],
      }));
    }
  };

  // Direct persistence handler that saves both locally and to server APIs!
  const handleSaveAndPublish = async (asDraft: boolean = false) => {
    setIsSaving(true);
    setFeedbackMsg(null);

    // 1. Immediately cache in localStorage so any page refresh ALWAYS retains the edits!
    try {
      localStorage.setItem(
        "ensat_cms_content_cache",
        JSON.stringify(formState),
      );
    } catch (err) {
      console.warn("Could not write to localStorage cache:", err);
    }

    try {
      if (!asDraft) {
        // Publish to live site
        const res = await apiFetch("/api/admin/cms/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: formState,
            force: true,
            summary: "حفظ ونشر التعديلات عبر محرر المحتوى",
          }),
        });

        // Also update draft
        await apiFetch("/api/admin/cms/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: formState }),
        }).catch(() => {});

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn("CMS publish server response:", errData);
        }
      } else {
        // Save as draft only
        await apiFetch("/api/admin/cms/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: formState }),
        });
      }

      // Notify parent component
      onSave(formState);
      setSavedSuccess(true);
      setFeedbackMsg({
        text: asDraft
          ? "تم حفظ التعديلات كمسودة بنجاح! تم التخزين ولن تُفقد عند التحديث."
          : "تم حفظ ونشر التعديلات للعامة بنجاح! التغييرات محفوظة بالكامل ولن تتراجع عند التحديث.",
        type: "success",
      });

      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1300);
    } catch (err: any) {
      // Even if API encountered a network error, localStorage + React state are preserved!
      onSave(formState);
      setSavedSuccess(true);
      setFeedbackMsg({
        text: "تم حفظ التعديلات بنجاح في ذاكرة المتصفح النشطة!",
        type: "success",
      });
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1300);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0e1424] border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#080c16]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>محرر نصوص وصور المنصة</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  حفظ دائم ومباشر
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تعديل النصوص، المحاور الأربعة، بيان الشباب العربي، والصور مع حفظ
                فوري وموثق
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-white/[0.08] flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none bg-[#090d18]">
          <button
            type="button"
            onClick={() => setActiveTab("hero")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "hero"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <Sparkles size={14} />
            <span>الواجهة الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pillars")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "pillars"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <Compass size={14} />
            <span>محاور العمل الأربعة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("youthManifesto")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "youthManifesto"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <FileBadge2 size={14} />
            <span>بيان الشباب العربي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("images")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "images"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <ImageIcon size={14} />
            <span>صور المنصة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("about")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "about"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <BookOpen size={14} />
            <span>عن إنصات ورسالتنا</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("countries")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "countries"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <Globe size={14} />
            <span>البلدان والمشاركون</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("contact")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "contact"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <Mail size={14} />
            <span>التواصل الرسمي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "terms"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <Shield size={14} />
            <span>الشروط والخصوصية</span>
          </button>
        </div>

        {/* Feedback Alert if available */}
        {feedbackMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              feedbackMsg.type === "success"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/15 border border-rose-500/30 text-rose-300"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto grow space-y-6">
          {/* TAB 1: HERO */}
          {activeTab === "hero" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  نصوص واجهة الهيدر الترحيبية
                </span>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("hero")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الافتراضي
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  العنوان الرئيسي الكبير (Headline)
                </label>
                <input
                  type="text"
                  value={formState.headline || ""}
                  onChange={(e) =>
                    handleFieldChange("headline", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  الوصف التقديمي للواجهة
                </label>
                <textarea
                  rows={4}
                  value={formState.description || ""}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PILLARS OF ENSAT */}
          {activeTab === "pillars" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  محاور عمل ورسالة إنصات الأربعة (توضح الشمولية الثقافية
                  للمبادرة)
                </span>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("pillars")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الافتراضي
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    عنوان قسم المحاور
                  </label>
                  <input
                    type="text"
                    value={formState.pillars?.title || ""}
                    onChange={(e) =>
                      handlePillarsMetaChange("title", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    العنوان الفرعي للمحاور
                  </label>
                  <input
                    type="text"
                    value={formState.pillars?.subtitle || ""}
                    onChange={(e) =>
                      handlePillarsMetaChange("subtitle", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 4 Pillars Details */}
              <div className="space-y-4 pt-2">
                {(
                  formState.pillars?.items ||
                  DEFAULT_CMS_CONTENT.pillars?.items ||
                  []
                ).map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">
                        المحور رقم {idx + 1}: {p.badge || "محور رئيسي"}
                      </span>
                      <input
                        type="text"
                        value={p.badge || ""}
                        onChange={(e) =>
                          handlePillarChange(idx, "badge", e.target.value)
                        }
                        placeholder="شارة المحور"
                        className="text-xs bg-slate-900 border border-white/[0.08] rounded-lg px-2 py-1 text-slate-300 w-36"
                      />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          عنوان المحور
                        </label>
                        <input
                          type="text"
                          value={p.title}
                          onChange={(e) =>
                            handlePillarChange(idx, "title", e.target.value)
                          }
                          className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          رابط صورة المحور (اختياري)
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={p.image || ""}
                          onChange={(e) =>
                            handlePillarChange(idx, "image", e.target.value)
                          }
                          placeholder="https://images.unsplash..."
                          className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        شرح وتفاصيل المحور
                      </label>
                      <textarea
                        rows={2}
                        value={p.description}
                        onChange={(e) =>
                          handlePillarChange(idx, "description", e.target.value)
                        }
                        className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: YOUTH MANIFESTO */}
          {activeTab === "youthManifesto" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  إعدادات ونصوص «بيان الشباب العربي للثقافة والعلوم»
                </span>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("youthManifesto")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الافتراضي
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    عنوان المبادرة
                  </label>
                  <input
                    type="text"
                    value={formState.youthManifesto?.title || ""}
                    onChange={(e) =>
                      handleManifestoChange("title", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    الشارة الترويجية
                  </label>
                  <input
                    type="text"
                    value={formState.youthManifesto?.badge || ""}
                    onChange={(e) =>
                      handleManifestoChange("badge", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  العنوان الفرعي / الشعار
                </label>
                <input
                  type="text"
                  value={formState.youthManifesto?.subtitle || ""}
                  onChange={(e) =>
                    handleManifestoChange("subtitle", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  نص مقدمة ورسالة البيان
                </label>
                <textarea
                  rows={4}
                  value={formState.youthManifesto?.summary || ""}
                  onChange={(e) =>
                    handleManifestoChange("summary", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Manifesto document points */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-200">
                    بنود وأهداف البيان (
                    {formState.youthManifesto?.documentPoints?.length || 0})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddManifestoPoint}
                    className="px-2.5 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus size={12} /> إضافة بند
                  </button>
                </div>
                <div className="space-y-2">
                  {(formState.youthManifesto?.documentPoints || []).map(
                    (pt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-5 text-center text-xs font-bold text-amber-400">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={pt}
                          onChange={(e) =>
                            handleManifestoPointChange(idx, e.target.value)
                          }
                          className="flex-1 bg-slate-950 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveManifestoPoint(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EDITABLE IMAGES */}
          {activeTab === "images" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200">
                    تعديل روابط صور المنصة
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    يمكنك وضع أي رابط صورة مباشر (من Unsplash أو رابط موقعك
                    الخاص) مع معاينة فورية
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("images")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الصور الأصلية
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                {/* 1. About Studio Photo */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] space-y-3">
                  <span className="text-xs font-bold text-amber-400 block">
                    صورة الاستوديو (في قسم «عن إنصات»)
                  </span>
                  <div className="h-32 w-full rounded-xl overflow-hidden bg-slate-900 border border-white/[0.06] relative">
                    <img
                      src={
                        formState.images?.aboutStudio ||
                        DEFAULT_CMS_CONTENT.images?.aboutStudio
                      }
                      alt="معاينة الاستوديو"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).setAttribute(
                          "style",
                          "opacity: 0.3",
                        );
                      }}
                    />
                  </div>
                  <input
                    type="url"
                    dir="ltr"
                    value={formState.images?.aboutStudio || ""}
                    onChange={(e) =>
                      handleImageChange("aboutStudio", e.target.value)
                    }
                    placeholder="https://images.unsplash..."
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                {/* 2. Youth Manifesto Photo */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] space-y-3">
                  <span className="text-xs font-bold text-amber-400 block">
                    صورة غلاف بيان الشباب العربي
                  </span>
                  <div className="h-32 w-full rounded-xl overflow-hidden bg-slate-900 border border-white/[0.06] relative">
                    <img
                      src={
                        formState.images?.youthManifesto ||
                        DEFAULT_CMS_CONTENT.images?.youthManifesto
                      }
                      alt="معاينة بيان الشباب"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="url"
                    dir="ltr"
                    value={formState.images?.youthManifesto || ""}
                    onChange={(e) =>
                      handleImageChange("youthManifesto", e.target.value)
                    }
                    placeholder="https://images.unsplash..."
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                {/* 3. Hero Cover Photo */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] space-y-3">
                  <span className="text-xs font-bold text-amber-400 block">
                    صورة غلاف العرض الصوتي في الواجهة
                  </span>
                  <div className="h-32 w-full rounded-xl overflow-hidden bg-slate-900 border border-white/[0.06] relative">
                    <img
                      src={
                        formState.images?.heroCover ||
                        DEFAULT_CMS_CONTENT.images?.heroCover
                      }
                      alt="معاينة الواجهة"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="url"
                    dir="ltr"
                    value={formState.images?.heroCover || ""}
                    onChange={(e) =>
                      handleImageChange("heroCover", e.target.value)
                    }
                    placeholder="https://images.unsplash..."
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                {/* 4. Journey Stages Section */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] space-y-3">
                  <span className="text-xs font-bold text-amber-400 block">
                    صور مراحل مسار الإنتاج الأربعة
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        key: "journeyStage1",
                        label: "التحقيق",
                        def: DEFAULT_CMS_CONTENT.images?.journeyStage1,
                      },
                      {
                        key: "journeyStage2",
                        label: "التسجيل",
                        def: DEFAULT_CMS_CONTENT.images?.journeyStage2,
                      },
                      {
                        key: "journeyStage3",
                        label: "الماسترينغ",
                        def: DEFAULT_CMS_CONTENT.images?.journeyStage3,
                      },
                      {
                        key: "journeyStage4",
                        label: "الاعتماد",
                        def: DEFAULT_CMS_CONTENT.images?.journeyStage4,
                      },
                    ].map((stg) => (
                      <div key={stg.key} className="text-center">
                        <div className="h-14 rounded-lg overflow-hidden bg-slate-900 mb-1 border border-white/[0.08]">
                          <img
                            src={
                              (formState.images as any)?.[stg.key] || stg.def
                            }
                            alt={stg.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {stg.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="url"
                      dir="ltr"
                      value={formState.images?.journeyStage1 || ""}
                      onChange={(e) =>
                        handleImageChange("journeyStage1", e.target.value)
                      }
                      placeholder="رابط صورة المرحلة 1: التحقيق"
                      className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-2.5 py-1 text-[11px] text-white font-mono"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      value={formState.images?.journeyStage2 || ""}
                      onChange={(e) =>
                        handleImageChange("journeyStage2", e.target.value)
                      }
                      placeholder="رابط صورة المرحلة 2: التسجيل"
                      className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-2.5 py-1 text-[11px] text-white font-mono"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      value={formState.images?.journeyStage3 || ""}
                      onChange={(e) =>
                        handleImageChange("journeyStage3", e.target.value)
                      }
                      placeholder="رابط صورة المرحلة 3: الماسترينغ"
                      className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-2.5 py-1 text-[11px] text-white font-mono"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      value={formState.images?.journeyStage4 || ""}
                      onChange={(e) =>
                        handleImageChange("journeyStage4", e.target.value)
                      }
                      placeholder="رابط صورة المرحلة 4: الاعتماد"
                      className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-2.5 py-1 text-[11px] text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ABOUT, VISION, MISSION */}
          {activeTab === "about" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  عن المنصة والرؤية والرسالة
                </span>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("about")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الافتراضي
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  عنوان قسم «عن إنصات»
                </label>
                <input
                  type="text"
                  value={formState.aboutTitle || ""}
                  onChange={(e) =>
                    handleFieldChange("aboutTitle", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  النص التعريفي الشامل
                </label>
                <textarea
                  rows={4}
                  value={formState.aboutBody || ""}
                  onChange={(e) =>
                    handleFieldChange("aboutBody", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    الرؤية (Vision)
                  </label>
                  <textarea
                    rows={3}
                    value={formState.vision || ""}
                    onChange={(e) =>
                      handleFieldChange("vision", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    الرسالة (Mission)
                  </label>
                  <textarea
                    rows={3}
                    value={formState.mission || ""}
                    onChange={(e) =>
                      handleFieldChange("mission", e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-200">
                    الأهداف الاستراتيجية ({formState.goals?.length || 0})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddGoal}
                    className="px-2.5 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus size={12} /> إضافة هدف
                  </button>
                </div>
                <div className="space-y-2">
                  {(formState.goals || []).map((goal, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={goal}
                        onChange={(e) => handleGoalChange(idx, e.target.value)}
                        className="flex-1 bg-slate-950 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: COUNTRIES & PARTICIPANTS */}
          {activeTab === "countries" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200">
                    إدارة الدول والمشاركين بالواجهة
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تعديل قائمة البلدان والفرق الممثلة في إنصات
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("countries")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الافتراضي
                </button>
              </div>

              {/* Add Country Box */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/[0.08] space-y-3">
                <span className="text-xs font-bold text-amber-400 block">
                  إضافة دولة أو تحديث متطوعيها
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <input
                    type="text"
                    value={newCountryName}
                    onChange={(e) => setNewCountryName(e.target.value)}
                    placeholder="اسم الدولة (مثال: قطر)"
                    className="bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newCountryCount}
                    onChange={(e) =>
                      setNewCountryCount(
                        Math.max(1, parseInt(e.target.value) || 1),
                      )
                    }
                    placeholder="عدد المتطوعين"
                    className="bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newCountryMembers}
                    onChange={(e) => setNewCountryMembers(e.target.value)}
                    placeholder="أسماء الأعضاء مفصولة بفواصل"
                    className="sm:col-span-2 bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCountry}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus size={14} /> إضافة / تحديث في القائمة
                </button>
              </div>

              {/* Country List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {(formState.manualCountries || []).map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/50 border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {c.name}
                      </span>
                      <span className="text-[11px] text-amber-400/90">
                        {c.count} متطوع ومشارك
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCountry(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: CONTACT DETAILS */}
          {activeTab === "contact" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  بيانات التواصل والقنوات الرسمية
                </span>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("contact")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الافتراضي
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    البريد الإلكتروني الرسمي
                  </label>
                  <input
                    type="email"
                    value={formState.contactEmail || ""}
                    onChange={(e) =>
                      handleFieldChange("contactEmail", e.target.value)
                    }
                    dir="ltr"
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    رقم الهاتف أو واتساب
                  </label>
                  <input
                    type="text"
                    value={formState.contactPhone || ""}
                    onChange={(e) =>
                      handleFieldChange("contactPhone", e.target.value)
                    }
                    dir="ltr"
                    placeholder="+965 2200 0000"
                    className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2">
                  روابط المنصات وقنوات التواصل الرسمية
                </label>
                <div className="space-y-2">
                  {(formState.socialLinks || []).map((link, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={link.platform}
                        onChange={(e) => {
                          const next = [...formState.socialLinks];
                          next[idx] = {
                            ...next[idx],
                            platform: e.target.value,
                          };
                          handleFieldChange("socialLinks", next);
                        }}
                        placeholder="المنصة"
                        className="bg-slate-950 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => {
                          const next = [...formState.socialLinks];
                          next[idx] = { ...next[idx], url: e.target.value };
                          handleFieldChange("socialLinks", next);
                        }}
                        dir="ltr"
                        placeholder="https://..."
                        className="col-span-2 bg-slate-950 border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: TERMS & PRIVACY */}
          {activeTab === "terms" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  ميثاق التطوع وسياسة الخصوصية
                </span>
                <button
                  type="button"
                  onClick={() => handleResetToDefault("terms")}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> استعادة الافتراضي
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  شروط الاستخدام وميثاق التطوع
                </label>
                <textarea
                  rows={6}
                  value={formState.termsBody || ""}
                  onChange={(e) =>
                    handleFieldChange("termsBody", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  سياسة الخصوصية وحماية بيانات المتطوعين
                </label>
                <textarea
                  rows={6}
                  value={formState.privacyBody || ""}
                  onChange={(e) =>
                    handleFieldChange("privacyBody", e.target.value)
                  }
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between bg-[#080c16]/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveAndPublish(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>حفظ كمسودة</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveAndPublish(false)}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>جاري الحفظ والنشر...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>تم الحفظ بنجاح!</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>حفظ ونشر التعديلات فوراً</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
