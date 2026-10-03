import React, { useState, useEffect, useRef } from "react";
import {
  X,
  UploadCloud,
  Headphones,
  Save,
  AlertCircle,
  Loader2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { AudioLibraryItem, AudioPublishStatus } from "./libraryTypes";
import { apiFetch } from "../lib/api";
import { getAuth } from "firebase/auth";

interface LibraryEditorModalProps {
  isOpen: boolean;
  item: AudioLibraryItem | null;
  onClose: () => void;
  onSaved: (savedItem: AudioLibraryItem) => void;
  onDeleted?: (itemId: string) => void;
}

const CATEGORIES = [
  "الأدب والرواية",
  "الفكر والتاريخ",
  "العلوم والمعرفة",
  "التنمية والتربية",
  "الجلسات الحوارية",
];

const STATUS_OPTIONS: { id: AudioPublishStatus; label: string }[] = [
  { id: "PUBLISHED", label: "منشور للعامة" },
  { id: "DRAFT", label: "مسودة غير منشورة" },
  { id: "ARCHIVED", label: "مؤرشف" },
];

export function LibraryEditorModal({
  isOpen,
  item,
  onClose,
  onSaved,
  onDeleted,
}: LibraryEditorModalProps) {
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [category, setCategory] = useState("الأدب والرواية");
  const [authorName, setAuthorName] = useState("");
  const [narratorName, setNarratorName] = useState("");
  const [audioEngineerName, setAudioEngineerName] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [status, setStatus] = useState<AudioPublishStatus>("PUBLISHED");
  const [featured, setFeatured] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setShortDescription(item.shortDescription || "");
      setCategory(item.category || "الأدب والرواية");
      setAuthorName(item.authorName || "");
      setNarratorName(item.narratorName || "");
      setAudioEngineerName(item.audioEngineerName || "");
      setAudioUrl(item.audioUrl || "");
      setCoverUrl(item.coverUrl || "");
      setDurationSeconds(item.durationSeconds || 0);
      setStatus(item.status || "PUBLISHED");
      setFeatured(Boolean(item.featured));
    } else {
      setTitle("");
      setShortDescription("");
      setCategory("الأدب والرواية");
      setAuthorName("");
      setNarratorName("");
      setAudioEngineerName("");
      setAudioUrl("");
      setCoverUrl("");
      setDurationSeconds(0);
      setStatus("PUBLISHED");
      setFeatured(false);
    }
    setError(null);
    setShowDeleteConfirm(false);
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !file.type.startsWith("audio/") &&
      !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
    ) {
      setError("يرجى اختيار ملف صوتي صحيح (MP3, WAV, OGG, M4A, FLAC)");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "audio");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/media/upload");

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      xhr.onload = () => {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && resp.success) {
            setAudioUrl(resp.url);
            if (resp.durationSeconds) {
              setDurationSeconds(resp.durationSeconds);
            }
            setUploadProgress(100);
            setIsUploading(false);
          } else {
            setError(resp?.error || "فشل التحقق من الملف المرفوع على الخادم");
            setIsUploading(false);
          }
        } catch {
          setError("استجابة غير صالحة من خادم الوسائط");
          setIsUploading(false);
        }
      };

      xhr.onerror = () => {
        setError("تعذر الاتصال بالخادم أثناء رفع الملف الصوتي");
        setIsUploading(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ غير متوقع أثناء الرفع");
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !file.type.startsWith("image/") &&
      !/\.(jpe?g|png|webp|gif|svg)$/i.test(file.name)
    ) {
      setError("يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP, GIF, SVG)");
      return;
    }

    try {
      setIsUploadingCover(true);
      setError(null);
      setCoverUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "image");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/media/upload");

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setCoverUploadProgress(progress);
        }
      };

      xhr.onload = () => {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && resp.success) {
            setCoverUrl(resp.url);
            setCoverUploadProgress(100);
            setIsUploadingCover(false);
          } else {
            setError(resp?.error || "فشل رفع الصورة على الخادم");
            setIsUploadingCover(false);
          }
        } catch {
          setError("استجابة غير صالحة من خادم رفع الصور");
          setIsUploadingCover(false);
        }
      };

      xhr.onerror = () => {
        setError("تعذر الاتصال بالخادم أثناء رفع صورة الغلاف");
        setIsUploadingCover(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء رفع الصورة");
      setIsUploadingCover(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("يرجى إدخال عنوان التسجيل.");
      return;
    }
    if (!audioUrl.trim()) {
      setError("يرجى رفع ملف صوتي من جهازك أو إدخال رابط للتسجيل.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        category,
        authorName: authorName.trim(),
        narratorName: narratorName.trim(),
        audioEngineerName: audioEngineerName.trim(),
        audioUrl: audioUrl.trim(),
        coverUrl: coverUrl.trim(),
        durationSeconds: Number(durationSeconds) || 0,
        status,
        featured,
        publishDate: new Date().toISOString().split("T")[0],
      };

      let res: Response;
      if (item?.id) {
        res = await apiFetch(`/api/admin/content/public_library/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/api/admin/content/public_library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر حفظ التسجيل.");
      }

      onSaved(data.item);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء حفظ التسجيل.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item?.id) return;
    try {
      setDeleting(true);
      setError(null);
      const res = await apiFetch(
        `/api/admin/content/public_library/${item.id}/archive`,
        {
          method: "PATCH",
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر أرشفة التسجيل.");
      }
      if (onDeleted) onDeleted(item.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "فشل أرشفة التسجيل.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Headphones size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {item ? "تعديل التسجيل العام" : "إضافة تسجيل جديد للمكتبة"}
              </h2>
              <p className="text-xs text-slate-400">
                إدارة التسجيلات الصوتية المعروضة في المكتبة العامة
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

        <form onSubmit={handleSave} noValidate className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              عنوان التسجيل <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                التصنيف
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 text-xs cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                حالة النشر
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as AudioPublishStatus)
                }
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

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                المؤلف
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                الراوي
              </label>
              <input
                type="text"
                value={narratorName}
                onChange={(e) => setNarratorName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                مهندس الصوت
              </label>
              <input
                type="text"
                value={audioEngineerName}
                onChange={(e) => setAudioEngineerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                الملف الصوتي (رفع مباشر)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition focus:outline-none focus:border-amber-500 disabled:opacity-50"
                >
                  {isUploading ? (
                    <span>جاري الرفع {uploadProgress}%</span>
                  ) : uploadProgress === 100 ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-400" /> تم
                      الرفع بنجاح
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} /> اختر ملفاً لرفعه
                    </>
                  )}
                </button>
                {isUploading && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-amber-500 rounded-b-xl transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                رابط أو مسار الملف الصوتي{" "}
                <span className="text-slate-500 font-normal text-xs">
                  (يتم تعبئته تلقائياً عند الرفع المباشر)
                </span>
              </label>
              <input
                type="text"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://... أو /api/public-audio/... (يتم تعبئته تلقائياً عند رفع ملف)"
                disabled={isUploading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs direction-ltr disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                صورة الغلاف (رفع مباشر)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  ref={coverInputRef}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={isUploadingCover}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition focus:outline-none focus:border-amber-500 disabled:opacity-50"
                >
                  {isUploadingCover ? (
                    <span>جاري رفع الصورة {coverUploadProgress}%</span>
                  ) : coverUploadProgress === 100 ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-400" /> تم
                      رفع الصورة
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} /> رفع صورة من جهازك
                    </>
                  )}
                </button>
                {isUploadingCover && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-indigo-500 rounded-b-xl transition-all duration-300"
                    style={{ width: `${coverUploadProgress}%` }}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                رابط صورة الغلاف أو المعاينة
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://... (أو ارفع صورة مباشرة)"
                  disabled={isUploadingCover}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs direction-ltr disabled:opacity-50"
                />
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt="Cover Preview"
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              المدة (بالثواني)
            </label>
            <input
              type="number"
              min="0"
              value={durationSeconds}
              onChange={(e) =>
                setDurationSeconds(parseInt(e.target.value) || 0)
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              نبذة عن التسجيل
            </label>
            <textarea
              rows={3}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
            <input
              type="checkbox"
              id="libFeatured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="rounded text-indigo-500 focus:ring-indigo-400 w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="libFeatured"
              className="text-slate-300 cursor-pointer font-bold select-none"
            >
              تثبيت كـ "تسجيل مختار" أعلى القسم
            </label>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            {item?.id ? (
              <div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>حذف التسجيل</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {deleting ? <Loader2 size={12} className="spin" /> : null}
                      <span>تأكيد החذف</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
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
                className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs transition shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>{item ? "حفظ التعديلات" : "إضافة ونشر"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
