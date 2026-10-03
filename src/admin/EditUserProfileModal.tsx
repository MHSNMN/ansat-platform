import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  Globe,
  Briefcase,
  Shield,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Edit3,
} from "lucide-react";
import { apiFetch, safeJson } from "../lib/api";
import { PhoneInput } from "../shared/components/PhoneInput";
import { ARAB_COUNTRIES } from "../lib/phoneUtils";

export interface AdminEditUserProps {
  member: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedUser: any) => void;
  currentAdminRole?: string;
}

export const EditUserProfileModal: React.FC<AdminEditUserProps> = ({
  member,
  isOpen,
  onClose,
  onSaved,
  currentAdminRole,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    phone: "",
    country: "الكويت",
    nationality: "",
    department: "",
    role: "MEMBER",
    status: "active",
    bio: "",
    age: "",
    field: "",
    publicProfileConsent: false,
  });

  const [customCountryMode, setCustomCountryMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Extract all country options and ensure the member's current country is always present
  const countryOptions = useMemo(() => {
    const list = [...ARAB_COUNTRIES];
    if (member?.country) {
      const exists = list.some(
        (c) =>
          c.nameAr === member.country ||
          member.country.includes(c.nameAr) ||
          c.nameAr.includes(member.country),
      );
      if (!exists && member.country.trim()) {
        list.push({
          code: "CUSTOM" as any,
          dialCode: "",
          nameAr: member.country.trim(),
          flag: "🌍",
        });
      }
    }
    return list;
  }, [member?.country]);

  useEffect(() => {
    if (member) {
      const initialCountry = member.country || "الكويت";
      setFormData({
        name: member.name || "",
        username: member.username || member.usernameNormalized || "",
        email: member.email || "",
        password: "",
        phone: member.phone || "",
        country: initialCountry,
        nationality: member.nationality || "",
        department: member.department || "",
        role: member.role || "MEMBER",
        status: member.status || member.accountStatus || "active",
        bio: member.bio || "",
        age: member.age ? String(member.age) : "",
        field: member.field || "",
        publicProfileConsent: Boolean(member.publicProfileConsent),
      });
      setCustomCountryMode(false);
      setError("");
      setSuccessMsg("");
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccessMsg("");

    try {
      const payload: any = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        country: formData.country.trim(),
        nationality: formData.nationality.trim(),
        department: formData.department.trim(),
        role: formData.role,
        status: formData.status,
        bio: formData.bio.trim(),
        age: formData.age.trim(),
        field: formData.field.trim(),
        publicProfileConsent: formData.publicProfileConsent,
      };

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const targetUid = member?.uid || member?.id;
      if (!targetUid) {
        throw new Error("معرّف العضو غير متوفر");
      }

      const res = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await safeJson<{
        success?: boolean;
        user?: any;
        error?: string;
        message?: string;
      }>(res, {
        success: false,
        error: res.ok
          ? "تعذر حفظ بيانات العضو"
          : `تعذر الاتصال بالخادم لحفظ بيانات العضو (رمز: ${res.status})`,
      });

      if (!res.ok || !data.success) {
        const errorDetail =
          data?.error ||
          (res.status === 403
            ? "غير مصرح لك بتعديل بيانات هذا العضو (403)"
            : res.status === 404
              ? "العضو غير موجود في النظام (404)"
              : res.status === 409
                ? "اسم المستخدم أو البريد الإلكتروني محجوز لعضو آخر (409)"
                : `تعذر حفظ بيانات العضو من الخادم (رمز: ${res.status})`);
        throw new Error(errorDetail);
      }

      const updatedUser = data.user || { ...member, ...payload };
      setSuccessMsg("تم حفظ وتحديث الملف الشخصي بنجاح!");
      setTimeout(() => {
        onSaved(updatedUser);
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setBusy(false);
    }
  };

  const isSuperAdmin = currentAdminRole === "SUPER_ADMIN";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      id="edit-profile-modal-backdrop"
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8"
        id="edit-profile-modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-lg">
              {formData.name.trim().charAt(0) || "ع"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                تعديل الملف الشخصي والحساب
              </h2>
              <p className="text-xs text-slate-400">
                المعرف:{" "}
                <code className="text-amber-300 font-mono">
                  {member.uid || member.id}
                </code>
                {formData.country && (
                  <span className="mr-2 text-amber-300 font-medium">
                    📍 {formData.country}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            id="btn-close-edit-modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 max-h-[75vh] overflow-y-auto"
          noValidate
        >
          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center gap-3 text-red-300 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-300 text-sm">
              <Check size={18} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Identity */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 pb-1 border-b border-slate-800">
              <UserIcon size={16} /> البيانات الأساسية وحساب الدخول
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                  placeholder="الاسم الثلاثي أو الرباعي"
                  id="input-edit-name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  اسم المستخدم (Username)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition text-left"
                  placeholder="username_123 (اختياري)"
                  id="input-edit-username"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    type="email"
                    dir="ltr"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 pl-10 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition text-left"
                    placeholder="user@ensat.org"
                    id="input-edit-email"
                  />
                  <Mail
                    size={16}
                    className="absolute left-3 top-3 text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  تعيين كلمة مرور جديدة (اختياري)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 pl-10 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition text-left"
                    placeholder="اتركه فارغاً للإبقاء على الحالية"
                    id="input-edit-password"
                  />
                  <Lock
                    size={16}
                    className="absolute right-3 top-3 text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-white p-0.5"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small className="text-[11px] text-slate-500">
                  6 أحرف/أرقام على الأقل إن رغبت بالتغيير
                </small>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Location */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 pb-1 border-b border-slate-800">
              <Globe size={16} /> معلومات الدولة والاتصال والقسم
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    الدولة
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomCountryMode(!customCountryMode)}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    {customCountryMode
                      ? "اختيار من القائمة"
                      : "كتابة دولة أخرى يدوياً"}
                  </button>
                </div>

                {customCountryMode ? (
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-amber-400/50 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                    placeholder="اكتب اسم الدولة هنا (مثال: العراق، ألمانيا...)"
                    id="input-edit-custom-country"
                  />
                ) : (
                  <select
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                    id="select-edit-country"
                  >
                    {countryOptions.map((c, index) => (
                      <option key={`${c.code}-${index}`} value={c.nameAr}>
                        {c.flag} {c.nameAr}
                      </option>
                    ))}
                    <option value="دولة أخرى">🌍 دولة أخرى</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  الجنسية
                </label>
                <input
                  type="text"
                  value={formData.nationality}
                  onChange={(e) =>
                    setFormData({ ...formData, nationality: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                  placeholder="مثال: عراقي، كويتي، سعودي..."
                  id="input-edit-nationality"
                />
              </div>

              <div>
                <PhoneInput
                  label="رقم الهاتف (مع الرمز الدولي)"
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                  placeholder="5X XXX XXXX"
                  theme="dark"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  القسم / فريق العمل
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                  placeholder="مثال: التدقيق اللغوي، الهندسة، الرواية..."
                  id="input-edit-department"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Role and Account Status */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 pb-1 border-b border-slate-800">
              <Shield size={16} /> الدور الوظيفي وحالة الحساب
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  الدور الوظيفي الأساسي
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                  id="select-edit-role"
                >
                  <option value="MEMBER">عضو متطوع (MEMBER)</option>
                  <option value="NARRATOR">راوي وقارئ صوتي (NARRATOR)</option>
                  <option value="AUDIO_ENGINEER">
                    مهندس صوت وماسترينغ (AUDIO_ENGINEER)
                  </option>
                  <option value="QA_REVIEWER">
                    مراجع جودة وتدقيق (QA_REVIEWER)
                  </option>
                  <option value="OPERATIONS_MANAGER">
                    مدير عمليات وتسجيل (OPERATIONS_MANAGER)
                  </option>
                  <option value="CONTENT_MANAGER">
                    مدير محتوى ومكتبة (CONTENT_MANAGER)
                  </option>
                  <option value="MEMBERS_MANAGER">
                    مدير أعضاء وتطوع (MEMBERS_MANAGER)
                  </option>
                  <option value="REWARDS_MANAGER">
                    مدير مكافآت ونقاط (REWARDS_MANAGER)
                  </option>
                  <option value="CERTIFICATE_MANAGER">
                    مدير شهادات (CERTIFICATE_MANAGER)
                  </option>
                  <option value="ADMIN">مدير منصة ونظام (ADMIN)</option>
                  {isSuperAdmin && (
                    <option value="SUPER_ADMIN">
                      مدير عام للنظام (SUPER_ADMIN)
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  حالة الحساب
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                  id="select-edit-status"
                >
                  <option value="active">🟢 نشط (Active) - مفعل بالكامل</option>
                  <option value="pending">
                    🟡 قيد المراجعة (Pending) - بانتظار التفعيل
                  </option>
                  <option value="disabled">
                    🔴 موقوف (Disabled) - معلق عن الدخول
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Extra Profile & Bio */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 pb-1 border-b border-slate-800">
              <Briefcase size={16} /> النبذة والاهتمامات وظهور الملف
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  المجال / التخصص
                </label>
                <input
                  type="text"
                  value={formData.field}
                  onChange={(e) =>
                    setFormData({ ...formData, field: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                  placeholder="مثال: هندسة صوتية، لغة عربية، إعلام..."
                  id="input-edit-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  العمر / السن
                </label>
                <input
                  type="text"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition"
                  placeholder="مثال: 26"
                  id="input-edit-age"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  النبذة التعريفية (Bio)
                </label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400 transition resize-none"
                  placeholder="نبذة موجزة عن خبرات العضو ومساهماته..."
                  id="textarea-edit-bio"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={formData.publicProfileConsent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        publicProfileConsent: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-amber-400 focus:ring-amber-400 border-slate-700 bg-slate-900"
                    id="checkbox-public-consent"
                  />
                  <span className="text-xs text-slate-300">
                    إظهار الملف الشخصي في قائمة المتطوعين العامة على الواجهة
                    الرئيسية (وفق الموافقة).
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
              id="btn-cancel-edit"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-amber-400/20"
              id="btn-save-profile"
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}
              حفظ وتطبيق التغييرات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
