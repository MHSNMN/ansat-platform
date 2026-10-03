import React, { useState } from "react";
import {
  X,
  Save,
  Key,
  User as UserIcon,
  Loader2,
  Mail,
  AtSign,
  Eye,
  EyeOff,
  Briefcase,
  Globe,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Sparkles,
  Info,
} from "lucide-react";
import { User, ThemeMode } from "../types";
import { apiFetch } from "../lib/api";
import { PhoneInput } from "../shared/components/PhoneInput";
import { ARAB_COUNTRIES } from "../lib/phoneUtils";

const DEPARTMENT_SUGGESTIONS = [
  "التعليق الصوتي",
  "هندسة الصوت والمكساج",
  "التدقيق اللغوي والجودة",
  "إدارة المحتوى والمهام",
  "المونتاج والتصميم",
  "العلاقات والتنسيق",
  "التطوير التقني",
];

export function UserProfileModal({
  currentUser,
  isOpen,
  onClose,
  theme = "dark",
  onUpdated,
}: {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  theme?: ThemeMode;
  onUpdated?: (updatedUser: any) => void;
}) {
  const [name, setName] = useState(
    currentUser.name || currentUser.fullName || "",
  );
  const [email, setEmail] = useState(currentUser.email || "");
  const [username, setUsername] = useState(currentUser.username || "");
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [country, setCountry] = useState(currentUser.country || "الكويت");
  const [department, setDepartment] = useState(
    currentUser.department || currentUser.field || "",
  );
  const [bio, setBio] = useState(currentUser.bio || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validation
    if (!name.trim()) {
      setMessage({ text: "يرجى إدخال الاسم الكامل", type: "error" });
      return;
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setMessage({ text: "صيغة البريد الإلكتروني غير صالحة", type: "error" });
        return;
      }
    }

    if (username.trim()) {
      const cleanUser = username.trim().replace(/^@+/, "");
      if (cleanUser.length < 2) {
        setMessage({
          text: "اسم المستخدم يجب ألا يقل عن حرفين",
          type: "error",
        });
        return;
      }
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        setMessage({
          text: "كلمة المرور يجب أن تتكون من 8 خانات على الأقل",
          type: "error",
        });
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage({ text: "كلمتا المرور غير متطابقتين", type: "error" });
        return;
      }
    }

    setBusy(true);

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        fullName: name.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim().replace(/^@+/, ""),
        country: country.trim(),
        department: department.trim(),
        field: department.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
      };

      if (newPassword) {
        payload.newPassword = newPassword;
      }

      const res = await apiFetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل تحديث البيانات");
      }

      setMessage({
        text: data.message || "تم حفظ بيانات ملفك الشخصي بنجاح",
        type: "success",
      });
      if (newPassword) {
        setNewPassword("");
        setConfirmPassword("");
      }

      if (onUpdated) {
        onUpdated(data.user || payload);
      }

      // Automatically close after a short delay on success
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setMessage({
        text: err.message || "حدث خطأ أثناء حفظ التعديلات",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const isDark = theme === "dark";
  const bg = isDark
    ? "bg-slate-900 border-slate-800 text-slate-100"
    : "bg-white border-slate-200 text-slate-800";
  const inputBg = isDark
    ? "bg-slate-950/70 border-slate-800 text-white placeholder-slate-500"
    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400";
  const sectionBg = isDark
    ? "bg-slate-950/40 border-slate-800/80"
    : "bg-slate-50/80 border-slate-200/80";

  return (
    <div
      dir="rtl"
      id="user-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="user-profile-modal-dialog"
        className={`w-full max-w-2xl rounded-3xl border shadow-2xl p-6 sm:p-8 my-8 ${bg} transition-all max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shadow-sm">
              <UserIcon size={24} />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tight flex items-center gap-2">
                <span>الملف الشخصي والحساب</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  متاح لكافة الأعضاء
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                تعديل الاسم، اسم المستخدم، البريد، الدولة، القسم، رقم الهاتف،
                والنبذة
              </p>
            </div>
          </div>
          <button
            id="btn-close-profile-modal"
            onClick={onClose}
            className="p-2.5 rounded-xl hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition"
            title="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Role & Notice Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-indigo-300 font-semibold">
            <ShieldCheck size={18} className="text-indigo-400 shrink-0" />
            <div>
              <span className="opacity-80">الدور والصلاحيات: </span>
              <strong className="text-white font-bold">
                {currentUser.role_display_ar ||
                  currentUser.role ||
                  "عضو مبادرة إنصات"}
              </strong>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Info size={14} className="text-slate-400 shrink-0" />
            <span>
              تعديل بيانات الملف الشخصي متاح لجميع الأعضاء بحرية دون التأثير على
              صلاحياتك المعتمدة.
            </span>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-3 border ${
              message.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/15 border-rose-500/30 text-rose-400"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 size={18} className="shrink-0" />
            ) : (
              <AlertCircle size={18} className="shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Basic Identity */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border ${sectionBg} space-y-4`}
          >
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-1">
              <Sparkles size={16} />
              <span>البيانات الشخصية</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 opacity-80">
                  الاسم الكامل *
                </label>
                <input
                  id="profile-input-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="مثال: أحمد عبد الله"
                  className={`w-full rounded-xl p-3 text-sm outline-none border transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${inputBg}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 opacity-80 flex items-center gap-1">
                  <AtSign size={13} className="text-indigo-400" />
                  <span>اسم المستخدم (اليوزر)</span>
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-3 text-sm font-bold text-slate-400 dir-ltr">
                    @
                  </span>
                  <input
                    id="profile-input-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className={`w-full rounded-xl p-3 pr-8 text-sm outline-none border transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dir-ltr text-right ${inputBg}`}
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 opacity-80 flex items-center gap-1">
                  <Mail size={13} className="text-indigo-400" />
                  <span>البريد الإلكتروني</span>
                </label>
                <input
                  id="profile-input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@ensat.org"
                  className={`w-full rounded-xl p-3 text-sm outline-none border transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dir-ltr text-right ${inputBg}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 opacity-80 flex items-center gap-1">
                  <Globe size={13} className="text-indigo-400" />
                  <span>الدولة</span>
                </label>
                <select
                  id="profile-select-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={`w-full rounded-xl p-3 text-sm outline-none border transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${inputBg}`}
                >
                  {ARAB_COUNTRIES.map((c) => (
                    <option
                      key={c.code}
                      value={c.nameAr}
                      className={
                        isDark
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-900"
                      }
                    >
                      {c.flag} {c.nameAr}
                    </option>
                  ))}
                  <option
                    value="دولة أخرى"
                    className={
                      isDark
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-900"
                    }
                  >
                    🌍 دولة أخرى
                  </option>
                </select>
              </div>
            </div>

            <div>
              <PhoneInput
                label="رقم الهاتف (مع مفتاح الدولة)"
                value={phone}
                onChange={(val) => setPhone(val)}
                theme={theme}
                placeholder="5X XXX XXXX"
              />
            </div>

            {/* Department / Field with Suggestions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold opacity-80 flex items-center gap-1">
                  <Briefcase size={13} className="text-indigo-400" />
                  <span>القسم / التخصص الوصفي</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  (مسمى وصفي لملفك دون تغيير الصلاحيات)
                </span>
              </div>
              <input
                id="profile-input-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="مثال: التعليق الصوتي، التدقيق، المونتاج، إدارة المهام"
                className={`w-full rounded-xl p-3 text-sm outline-none border transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${inputBg}`}
              />

              {/* Suggestion Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DEPARTMENT_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setDepartment(sug)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                      department === sug
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : isDark
                          ? "bg-slate-800/70 text-slate-300 border-slate-700 hover:border-indigo-500/50"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:border-indigo-400"
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio / About */}
            <div>
              <label className="block text-xs font-bold mb-1.5 opacity-80 flex items-center gap-1">
                <FileText size={13} className="text-indigo-400" />
                <span>نبذة تعريفية (Bio)</span>
              </label>
              <textarea
                id="profile-input-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                placeholder="اكتب نبذة قصيرة عن مهاراتك أو اهتماماتك التطوعية في إنصات..."
                className={`w-full rounded-xl p-3 text-sm outline-none border transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none ${inputBg}`}
              />
            </div>
          </div>

          {/* 2. Password Management */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border ${sectionBg} space-y-3`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-2 text-amber-500">
                <Key size={16} />
                <span>تغيير كلمة المرور</span>
              </h4>
              <span className="text-xs text-slate-400">اختياري</span>
            </div>
            <p className="text-xs text-slate-400">
              اترك الحقلين فارغين إذا كنت لا ترغب بتغيير كلمة مرورك الحالية.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div className="relative">
                <input
                  id="profile-input-new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="كلمة المرور الجديدة (8 خانات على الأقل)"
                  className={`w-full rounded-xl p-3 pr-10 text-sm outline-none border transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dir-ltr text-right ${inputBg}`}
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-200"
                  title={
                    showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                  }
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="relative">
                <input
                  id="profile-input-confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تأكيد كلمة المرور الجديدة"
                  className={`w-full rounded-xl p-3 text-sm outline-none border transition focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dir-ltr text-right ${inputBg}`}
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              id="btn-cancel-profile"
              onClick={onClose}
              disabled={busy}
              className="px-6 py-3 rounded-xl font-bold text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              id="btn-save-profile"
              disabled={busy}
              className="flex items-center gap-2 px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer"
            >
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Save size={17} />
              )}
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
