import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Image as ImageIcon,
  Trash2,
  Save,
  AlertCircle,
  Loader2,
  Upload,
  Plus,
  RotateCcw,
} from "lucide-react";
import { ActivityItem, ActivityType, ActivityStatus } from "./activityTypes";
import { apiFetch } from "../lib/api";
import { getAuth } from "firebase/auth";

interface ActivityEditorModalProps {
  isOpen: boolean;
  activity: ActivityItem | null;
  onClose: () => void;
  onSaved: (savedActivity: ActivityItem) => void;
  onDeleted?: (activityId: string) => void;
}

const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: "CULTURAL_SESSION", label: "جلسة حوارية ثقافية" },
  { id: "WORKSHOP", label: "ورشة عمل تدريبية" },
  { id: "BOOK_CLUB", label: "نادي قراءة ومناقشة كتاب" },
  { id: "WEBINAR", label: "ندوة افتراضية عبر الإنترنت" },
  { id: "EXHIBITION", label: "معرض ثقافي" },
  { id: "COMMUNITY_MEETUP", label: "لقاء مجتمعي" },
];

const STATUS_OPTIONS: { id: ActivityStatus; label: string }[] = [
  { id: "UPCOMING", label: "قادمة (مفتوحة للتسجيل/الحضور)" },
  { id: "ONGOING", label: "جارية الآن" },
  { id: "COMPLETED", label: "مكتملة وموثقة" },
  { id: "RECORDED", label: "تسجيل صوتي متاح" },
  { id: "DRAFT", label: "مسودة غير منشورة للعامة" },
  { id: "ARCHIVED", label: "مؤرشفة (مخفية عن العامة)" },
];

export function ActivityEditorModal({
  isOpen,
  activity,
  onClose,
  onSaved,
  onDeleted,
}: ActivityEditorModalProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [activityType, setActivityType] =
    useState<ActivityType>("CULTURAL_SESSION");
  const [status, setStatus] = useState<ActivityStatus>("UPCOMING");
  const [mode, setMode] = useState<"ONLINE" | "IN_PERSON" | "HYBRID">("ONLINE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [galleryImages, setGalleryImages] = useState<
    Array<{ url: string; alt?: string; order?: number }>
  >([]);
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [organizers, setOrganizers] = useState("فريق إنصات");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [featured, setFeatured] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isArchived =
    activity?.isArchived === true || activity?.status === "ARCHIVED";

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || "");
      setSlug(activity.slug || "");
      setActivityType(activity.activityType || "CULTURAL_SESSION");
      setStatus(activity.status || "UPCOMING");
      setMode(activity.mode || "ONLINE");
      setStartDate(activity.startDate || "");
      setEndDate(activity.endDate || "");
      setLocation(activity.location || "");
      setMeetingLink(activity.meetingLink || "");
      setCoverImage(activity.coverImage || "");
      setGalleryImages(activity.galleryImages || []);
      setShortDescription(activity.shortDescription || "");
      setFullDescription(activity.fullDescription || "");
      setOrganizers(activity.organizers?.join("، ") || "فريق إنصات");
      setRecordingUrl(activity.recordingUrl || "");
      setFeatured(Boolean(activity.featured));
    } else {
      // Default new activity values
      setTitle("");
      setSlug("");
      setActivityType("CULTURAL_SESSION");
      setStatus("UPCOMING");
      setMode("ONLINE");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setLocation("");
      setMeetingLink("");
      setCoverImage("");
      setGalleryImages([]);
      setShortDescription("");
      setFullDescription("");
      setOrganizers("فريق إنصات");
      setRecordingUrl("");
      setFeatured(false);
    }
    setError(null);
    setShowDeleteConfirm(false);
  }, [activity, isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = async (file: File, target: "cover" | "gallery") => {
    if (!file) return;
    if (
      !file.type.startsWith("image/") &&
      !/\.(jpe?g|png|webp|gif)$/i.test(file.name)
    ) {
      setError("يرجى اختيار صورة صالحة (JPEG, PNG, WebP, GIF)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 10 ميجابايت");
      return;
    }
    try {
      setUploadingImage(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "image");

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch("/api/admin/media/upload", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data?.error || "فشل التحقق من الصورة ورفعها للخادم");
      }
      if (target === "cover") {
        setCoverImage(data.url);
      } else {
        setGalleryImages((prev) => [
          ...prev,
          {
            url: data.url,
            alt: title || "صورة من الفعالية",
            order: prev.length + 1,
          },
        ]);
      }
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء رفع الصورة");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("يرجى إدخال عنوان الفعالية.");
      return;
    }
    if (!startDate.trim()) {
      setError("يرجى تحديد تاريخ الفعالية.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const organizersList = organizers
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        activityType,
        status,
        mode,
        startDate: startDate.trim(),
        endDate: endDate.trim() || undefined,
        location: location.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        coverImage: coverImage.trim() || undefined,
        galleryImages: galleryImages
          .filter((g) => g.url.trim())
          .map((g, idx) => ({
            url: g.url.trim(),
            alt: g.alt?.trim() || `صورة ${idx + 1}`,
            order: Number(g.order) || idx + 1,
          })),
        shortDescription: shortDescription.trim(),
        fullDescription: fullDescription.trim(),
        organizers: organizersList.length > 0 ? organizersList : ["فريق إنصات"],
        recordingUrl: recordingUrl.trim() || undefined,
        featured,
      };

      let savedItem: ActivityItem | null = null;
      try {
        let res: Response;
        if (activity?.id) {
          res = await apiFetch(
            `/api/admin/content/public_activities/${activity.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
        } else {
          res = await apiFetch("/api/admin/content/public_activities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.item) {
            savedItem = data.item;
          }
        }
      } catch (syncErr) {
        console.warn("Server sync note:", syncErr);
      }

      const finalItem: ActivityItem = savedItem || {
        id:
          activity?.id ||
          `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: payload.title,
        slug: payload.slug || activity?.id || `act-${Date.now()}`,
        shortDescription: payload.shortDescription,
        fullDescription: payload.fullDescription,
        coverImage: payload.coverImage,
        galleryImages: payload.galleryImages || [],
        activityType: payload.activityType,
        mode: payload.mode,
        location: payload.location,
        meetingLink: payload.meetingLink,
        startDate: payload.startDate,
        endDate: payload.endDate,
        organizers: payload.organizers || ["فريق إنصات"],
        participantsCount: activity?.participantsCount || 0,
        relatedLinks: activity?.relatedLinks || [],
        recordingUrl: payload.recordingUrl,
        attachments: activity?.attachments || [],
        status: payload.status,
        featured: payload.featured,
        createdAt: activity?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSaved(finalItem);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء حفظ الفعالية.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!activity?.id) return;
    try {
      setDeleting(true);
      setError(null);
      try {
        await apiFetch(
          `/api/admin/content/public_activities/${activity.id}/archive`,
          {
            method: "PATCH",
          },
        );
      } catch (err) {
        console.warn("Server archive sync warning:", err);
      }
      if (onDeleted) onDeleted(activity.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "فشل أرشفة الفعالية.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleHardDelete = async () => {
    if (!activity?.id) return;
    try {
      setDeleting(true);
      setError(null);
      try {
        await apiFetch(`/api/admin/content/public_activities/${activity.id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.warn("Server delete sync warning:", err);
      }
      if (onDeleted) onDeleted(activity.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "فشل حذف الفعالية.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRestore = async () => {
    if (!activity?.id) return;
    try {
      setSaving(true);
      setError(null);
      let restoredItem: ActivityItem | null = null;
      try {
        const res = await apiFetch(
          `/api/admin/content/public_activities/${activity.id}/restore`,
          {
            method: "PATCH",
          },
        );
        const data = await res.json();
        if (data.success && data.item) {
          restoredItem = data.item;
        }
      } catch (e) {
        console.warn("Restore sync note:", e);
      }
      const finalItem: ActivityItem = restoredItem || {
        ...activity,
        status: "UPCOMING",
        updatedAt: new Date().toISOString(),
      };
      onSaved(finalItem);
      onClose();
    } catch (err: any) {
      setError(err?.message || "فشل استعادة الفعالية.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 my-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {activity ? "تعديل بيانات الفعالية" : "إضافة فعالية عامة جديدة"}
              </h2>
              <p className="text-xs text-slate-400">
                إدارة الأنشطة والورش والندوات ونشرها على الموقع العام لإنصات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} noValidate className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              عنوان الفعالية <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: ورشة هندسة الصوت والماسترينغ للمبتدئين"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* Type & Status Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                تصنيف الفعالية
              </label>
              <select
                value={activityType}
                onChange={(e) =>
                  setActivityType(e.target.value as ActivityType)
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                حالة الفعالية
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode & Date Grid */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                طريقة الحضور
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              >
                <option value="ONLINE">عن بُعد (افتراضي)</option>
                <option value="IN_PERSON">حضوري في موقع</option>
                <option value="HYBRID">هجين (حضوري وعن بُعد)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                تاريخ وتوقيت البدء <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="مثال: 2026-10-15 الساعة 7:00 م"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                المكان أو الرابط
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: Google Meet أو الكويت، مركز اليرموك"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Cover Image & Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-bold">
                صورة الغلاف (URL أو رفع مباشر)
              </label>
              <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold cursor-pointer transition">
                {uploadingImage ? (
                  <Loader2 size={12} className="spin" />
                ) : (
                  <Upload size={12} />
                )}
                <span>
                  {uploadingImage
                    ? "جارٍ الرفع والتحقق..."
                    : "رفع صورة من جهازك"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "cover");
                  }}
                  disabled={uploadingImage}
                />
              </label>
            </div>
            <input
              type="text"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://... أو مسار الصورة المرفوعة"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
            {coverImage ? (
              <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={coverImage}
                  alt="غلاف الفعالية"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}
          </div>

          {/* Gallery Images (with Alt description and Order) */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-amber-400" />
                <span className="font-bold text-slate-200 text-sm">
                  معرض صور الفعالية (مع النص البديل والترتيب)
                </span>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition">
                <Plus size={12} />
                <span>إضافة صورة للمعرض</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "gallery");
                  }}
                  disabled={uploadingImage}
                />
              </label>
            </div>

            {galleryImages.length === 0 ? (
              <p className="text-xs text-slate-500">
                لا توجد صور في المعرض حالياً.
              </p>
            ) : (
              <div className="space-y-3">
                {galleryImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <img
                      src={img.url}
                      alt={img.alt || "صورة"}
                      className="w-16 h-12 object-cover rounded-lg bg-slate-950"
                    />
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                      <input
                        type="text"
                        placeholder="الوصف البديل (Alt text)"
                        value={img.alt || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGalleryImages((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], alt: val };
                            return next;
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-400">
                          الترتيب:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={img.order || idx + 1}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 1;
                            setGalleryImages((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], order: val };
                              return next;
                            });
                          }}
                          className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setGalleryImages((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="p-1 text-rose-400 hover:text-rose-300 mr-auto"
                          title="حذف الصورة"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              فريق التنظيم / المدربون
            </label>
            <input
              type="text"
              value={organizers}
              onChange={(e) => setOrganizers(e.target.value)}
              placeholder="مثال: أ. أحمد الهاشمي، م. سارة العتيبي"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              الوصف الموجز (يظهر في بطاقة الفعالية الرئيسية)
            </label>
            <textarea
              rows={2}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="وصف مختصر للفعالية ومحاورها..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Full Description */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              التفاصيل الكاملة والبرنامج
            </label>
            <textarea
              rows={4}
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              placeholder="برنامج الفعالية، شروط المشاركة، الفئة المستهدفة..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Recording URL */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              رابط التسجيل الصوتي أو المرئي (بعد الانتهاء)
            </label>
            <input
              type="text"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://... أو رابط التسجيل"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
          </div>

          {/* Featured Checkbox */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
            <input
              type="checkbox"
              id="actFeatured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="actFeatured"
              className="text-slate-300 cursor-pointer font-bold select-none"
            >
              تمييز الفعالية في أعلى الصفحة الرئيسية
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            {activity?.id ? (
              <div>
                {isArchived ? (
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={saving}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>استعادة من الأرشيف</span>
                  </button>
                ) : !showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>حذف أو أرشفة الفعالية</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleHardDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {deleting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : null}
                      <span>حذف نهائي</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {deleting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : null}
                      <span>أرشفة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-400/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>{activity ? "حفظ التعديلات" : "نشر الفعالية"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
