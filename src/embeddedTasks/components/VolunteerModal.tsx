// @ts-nocheck
import React, { useState } from "react";
import { X, Sparkles, CheckCircle2 } from "lucide-react";

interface VolunteerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VolunteerModal: React.FC<VolunteerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("العراق");
  const [department, setDepartment] = useState("الإنتاج الصوتي");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-right font-['Cairo']">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">
              انضم إلى مبادرة إنصات
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white">
              شكراً لرغبتك بالتطوع!
            </h4>
            <p className="text-xs text-slate-300">
              تم استلام طلب انضمامك بنجاح، وسيتواصل معك منسق القسم في العراق أو
              مصر قريباً.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                الاسم الكامل:
              </label>
              <input
                type="text"
                required
                placeholder="اكتب اسمك الثلاثي..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">
                  بلد الإقامة:
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
                >
                  <option value="العراق">🇮🇶 العراق</option>
                  <option value="مصر">🇪🇬 مصر</option>
                  <option value="أخرى">دولة أخرى</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">
                  القسم الراغب بالانضمام له:
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none"
                >
                  <option value="قسم المحتوى والحقوق">
                    قسم المحتوى والحقوق
                  </option>
                  <option value="قسم الإنتاج الصوتي">قسم الإنتاج الصوتي</option>
                  <option value="قسم التصميم والتسويق">
                    قسم التصميم والتسويق
                  </option>
                  <option value="قسم الأنظمة والبحوث الرقمية">
                    قسم الأنظمة والبحوث الرقمية
                  </option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                رقم الواتساب أو رقم التواصل:
              </label>
              <input
                type="text"
                required
                placeholder="name@example.com"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                نبذة عن خبرتك أو مهاراتك:
              </label>
              <textarea
                rows={2}
                placeholder="مثال: تعليق صوتي، إخراج، تدقيق نصوص..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:border-amber-500 focus:outline-none"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20"
            >
              إرسال طلب الانضمام
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
