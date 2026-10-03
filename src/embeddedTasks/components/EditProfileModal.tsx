import React, { useState } from "react";
import {
  X,
  Save,
  User as UserIcon,
  Phone,
  Globe,
  Briefcase,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { UserSession, Country } from "../types";

interface EditProfileModalProps {
  currentUser: UserSession;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: UserSession) => void;
}

const ARAB_COUNTRIES: Country[] = [
  "العراق",
  "الكويت",
  "السعودية",
  "الإمارات",
  "مصر",
  "الأردن",
  "سوريا",
  "لبنان",
  "فلسطين",
  "اليمن",
  "سلطنة عمان",
  "قطر",
  "البحرين",
  "الجزائر",
  "المغرب",
  "تونس",
  "ليبيا",
  "السودان",
];

const COMMON_DEPARTMENTS = [
  "التعليق الصوتي",
  "هندسة الصوت والمكساج",
  "التدقيق اللغوي والجودة",
  "إدارة المحتوى والمهام",
  "المونتاج والتصميم",
  "العلاقات والتنسيق",
  "التطوير التقني",
  "admin - إنصات",
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(currentUser.name || "");
  const [whatsapp, setWhatsapp] = useState(
    currentUser.whatsapp || currentUser.phone || "",
  );
  const [country, setCountry] = useState<Country>(
    currentUser.country || "العراق",
  );
  const [departmentName, setDepartmentName] = useState(
    currentUser.departmentName || "التعليق الصوتي",
  );
  const [roleName, setRoleName] = useState(currentUser.roleName || "عضو");
  const [code, setCode] = useState(currentUser.code || "");
  const [bio, setBio] = useState(currentUser.bio || "");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!name.trim()) {
      setMsg({ text: "يرجى كتابة الاسم الكامل", type: "error" });
      return;
    }

    setBusy(true);

    try {
      const updatedUser: UserSession = {
        ...currentUser,
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        phone: whatsapp.trim(),
        country,
        departmentName: departmentName.trim(),
        roleName: roleName.trim(),
        code: code.trim(),
        bio: bio.trim(),
      };

      onSave(updatedUser);

      setMsg({
        text: "تم حفظ وتحديث بيانات ملفك الشخصي بنجاح!",
        type: "success",
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setMsg({ text: err?.message || "تعذر حفظ التعديلات", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto font-['Cairo'] text-right">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                تعديل الملف الشخصي (Profile)
              </h3>
              <p className="text-[11px] text-amber-400 font-medium">
                متاح لكافة أعضاء المنظومة دون قيود
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Banner */}
        {msg && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
              msg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
            }`}
          >
            {msg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Full Name */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>الاسم الكامل</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-all font-medium text-xs"
              placeholder="مثال: أحمد عبد الله"
            />
          </div>

          {/* WhatsApp / Phone */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>رقم الهاتف / الواتساب / البريد</span>
            </label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-all font-medium text-xs dir-ltr text-right"
              placeholder="مثال: +9647700000000 أو بريدك"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Country */}
            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>الدولة</span>
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as Country)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-all text-xs"
              >
                {ARAB_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>القسم / التخصص</span>
              </label>
              <select
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-all text-xs"
              >
                {COMMON_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Name */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              المسمى أو الوصف الوظيفي
            </label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-all text-xs"
              placeholder="مثال: معلق صوتي معتمد / مهندس صوت"
            />
          </div>

          {/* Access Code / PIN */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>رمز الدخول السريع (PIN / Code)</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500 transition-all text-xs dir-ltr text-right"
              placeholder="6 أرقام لرمز الدخول"
            />
          </div>

          {/* Bio / About */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>نبذة تعريفية (اختياري)</span>
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-all text-xs resize-none"
              placeholder="اكتب نبذة موجزة عن خبراتك ومشاركتك..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{busy ? "جارِ الحفظ..." : "حفظ بيانات الملف الشخصي"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
