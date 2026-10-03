import React, { useState } from "react";
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Headphones,
  Mic,
  BookOpen,
  Calendar,
} from "lucide-react";
import { VolunteerFormDefinition } from "./volunteerTypes";
import { PRESET_VOLUNTEER_FORMS } from "./volunteerPresets";
import { apiFetch } from "../lib/api";
import { PhoneInput } from "../shared/components/PhoneInput";

const ARAB_COUNTRIES = [
  "الكويت",
  "السعودية",
  "الإمارات",
  "قطر",
  "البحرين",
  "عمان",
  "مصر",
  "الأردن",
  "العراق",
  "لبنان",
  "فلسطين",
  "سوريا",
  "اليمن",
  "المغرب",
  "الجزائر",
  "تونس",
  "ليبيا",
  "السودان",
  "موريتانيا",
  "الصومال",
];

interface VolunteerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableForms?: VolunteerFormDefinition[];
  initialFormId?: string;
}

export function VolunteerFormModal({
  isOpen,
  onClose,
  availableForms = PRESET_VOLUNTEER_FORMS,
  initialFormId,
}: VolunteerFormModalProps) {
  const forms =
    availableForms.length > 0 ? availableForms : PRESET_VOLUNTEER_FORMS;
  const [selectedFormId, setSelectedFormId] = useState<string>(
    initialFormId || forms[0]?.id || "form-general",
  );
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [postSubmitMessage, setPostSubmitMessage] = useState("");

  if (!isOpen) return null;

  const currentForm = forms.find((f) => f.id === selectedFormId) || forms[0];

  const handleInputChange = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate required questions
    for (const q of currentForm.questions) {
      const val = answers[q.key];
      if (q.required) {
        if (
          val === undefined ||
          val === null ||
          (typeof val === "string" && val.trim() === "") ||
          (Array.isArray(val) && val.length === 0) ||
          (typeof val === "boolean" && !val)
        ) {
          setError(`يرجى الإجابة على الحقل الإلزامي: ${q.label}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const nameQ =
        currentForm.questions.find(
          (q) =>
            q.key === "name" ||
            q.key === "applicantName" ||
            q.label.includes("الاسم"),
        ) || currentForm.questions[0];
      const emailQ = currentForm.questions.find(
        (q) =>
          q.type === "email" || q.key === "email" || q.key === "applicantEmail",
      );
      const phoneQ = currentForm.questions.find(
        (q) =>
          q.type === "phone" || q.key === "phone" || q.key === "applicantPhone",
      );
      const countryQ = currentForm.questions.find(
        (q) =>
          q.type === "countries" ||
          q.key === "country" ||
          q.key === "applicantCountry",
      );

      const applicantName =
        (nameQ && answers[nameQ.key]) ||
        answers.name ||
        answers.applicantName ||
        "متقدم جديد";
      const applicantEmail =
        (emailQ && answers[emailQ.key]) ||
        answers.email ||
        answers.applicantEmail ||
        "";
      const applicantPhone =
        (phoneQ && answers[phoneQ.key]) ||
        answers.phone ||
        answers.applicantPhone ||
        "";
      const applicantCountry =
        (countryQ && answers[countryQ.key]) ||
        answers.country ||
        answers.applicantCountry ||
        "";

      const res = await apiFetch("/api/public/volunteer-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: currentForm.id,
          formName: currentForm.name,
          targetRole: currentForm.targetRole,
          applicantName,
          applicantUsername:
            answers.username ||
            (applicantEmail ? applicantEmail.split("@")[0] : ""),
          applicantEmail,
          applicantPhone,
          applicantCountry,
          answers,
          termsAccepted: true,
          publicProfileConsent: !!answers.publicConsent || true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إرسال طلب التطوع.");
      }

      setPostSubmitMessage(
        currentForm.postSubmitMessage ||
          "تم استلام طلبك بنجاح وسيتواصل معك فريق إنصات قريباً.",
      );
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء إرسال الطلب.");
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "NARRATOR":
        return <Mic size={16} />;
      case "AUDIO_ENGINEER":
        return <Headphones size={16} />;
      case "QA_REVIEWER":
        return <BookOpen size={16} />;
      case "OPERATIONS_MANAGER":
        return <Calendar size={16} />;
      default:
        return <User size={16} />;
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-5 border-b border-slate-800">
          <div>
            <span className="text-xs bg-amber-500/20 text-amber-400 font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/30">
              انضم إلى فريق إنصات
            </span>
            <h2 className="text-xl font-bold text-white mt-1">
              {currentForm?.name}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {currentForm?.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="mt-8 text-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-bold text-white">
              تم استلام طلبك بنجاح!
            </h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              {postSubmitMessage}
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Form Selector Tabs */}
            <div className="mt-5 flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
              {forms.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedFormId(f.id);
                    setError("");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition ${
                    selectedFormId === f.id
                      ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {getRoleIcon(f.targetRole)}
                  <span>
                    {f.name.replace("طلب انضمام: ", "").replace("طلب ", "")}
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Dynamic Questions Form */}
            <form
              onSubmit={handleSubmit}
              className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto px-1"
            >
              {currentForm.questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {q.label}{" "}
                    {q.required && <span className="text-amber-400">*</span>}
                  </label>
                  {q.helpText && (
                    <p className="text-[11px] text-slate-400 mb-1.5 leading-relaxed">
                      {q.helpText}
                    </p>
                  )}

                  {q.type === "text" && (
                    <input
                      type="text"
                      required={q.required}
                      placeholder={q.placeholder || ""}
                      value={answers[q.key] || ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}

                  {q.type === "number" && (
                    <input
                      type="number"
                      required={q.required}
                      placeholder={q.placeholder || "0"}
                      value={answers[q.key] ?? ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}

                  {q.type === "date" && (
                    <input
                      type="date"
                      required={q.required}
                      value={answers[q.key] || ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}

                  {q.type === "file" && (
                    <input
                      type="url"
                      dir="ltr"
                      required={q.required}
                      placeholder={
                        q.placeholder || "https://drive.google.com/..."
                      }
                      value={answers[q.key] || ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}

                  {q.type === "textarea" && (
                    <textarea
                      required={q.required}
                      rows={3}
                      placeholder={q.placeholder || ""}
                      value={answers[q.key] || ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}

                  {q.type === "email" && (
                    <input
                      type="email"
                      required={q.required}
                      dir="ltr"
                      placeholder={q.placeholder || "name@example.com"}
                      value={answers[q.key] || ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  )}

                  {q.type === "phone" && (
                    <PhoneInput
                      required={q.required}
                      value={answers[q.key] || ""}
                      onChange={(e164) => handleInputChange(q.key, e164)}
                      placeholder={q.placeholder || "5X XXX XXXX"}
                      theme="dark"
                    />
                  )}

                  {q.type === "countries" && (
                    <select
                      required={q.required}
                      value={answers[q.key] || ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">اختر الدولة...</option>
                      {ARAB_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="أخرى">أخرى / مغترب</option>
                    </select>
                  )}

                  {q.type === "select" && (
                    <select
                      required={q.required}
                      value={answers[q.key] || ""}
                      onChange={(e) => handleInputChange(q.key, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">اختر إجابة...</option>
                      {q.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {q.type === "radio" && (
                    <div className="space-y-2 mt-2">
                      {q.options?.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs hover:text-white transition"
                        >
                          <input
                            type="radio"
                            name={q.key}
                            value={opt}
                            checked={answers[q.key] === opt}
                            onChange={() => handleInputChange(q.key, opt)}
                            className="text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-700"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === "checkbox" && (
                    <div className="space-y-2 mt-2">
                      {q.options?.map((opt) => {
                        const currentList: string[] = Array.isArray(
                          answers[q.key],
                        )
                          ? answers[q.key]
                          : [];
                        const checked = currentList.includes(opt);
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs hover:text-white transition"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleInputChange(q.key, [
                                    ...currentList,
                                    opt,
                                  ]);
                                } else {
                                  handleInputChange(
                                    q.key,
                                    currentList.filter((item) => item !== opt),
                                  );
                                }
                              }}
                              className="rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-700"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "consent" && (
                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-300 text-xs p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <input
                        type="checkbox"
                        checked={!!answers[q.key]}
                        onChange={(e) =>
                          handleInputChange(q.key, e.target.checked)
                        }
                        className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="leading-relaxed">{q.label}</span>
                    </label>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="spin" /> جارٍ إرسال الطلب...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> إرسال طلب التطوع
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
