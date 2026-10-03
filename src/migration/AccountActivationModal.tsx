import React, { useState } from "react";
import {
  X,
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { PhoneInput } from "../shared/components/PhoneInput";
import { ARAB_COUNTRIES } from "../lib/phoneUtils";

export interface AccountActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin?: () => void;
}

export function AccountActivationModal({
  isOpen,
  onClose,
  onSuccessLogin,
}: AccountActivationModalProps) {
  const [activeTab, setActiveTab] = useState<"activate" | "reset">("activate");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [maskedName, setMaskedName] = useState("");
  const [isNewInvite, setIsNewInvite] = useState(false);
  const [isResetFlow, setIsResetFlow] = useState(false);
  const [legacyId, setLegacyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Code Request state
  const [codeRequested, setCodeRequested] = useState(false);
  const [codeRequestLoading, setCodeRequestLoading] = useState(false);
  const [codeRequestMsg, setCodeRequestMsg] = useState<string | null>(null);

  // Step 2 Form
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("العراق");
  const [field, setField] = useState("");
  const [publicConsent, setPublicConsent] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(true);

  if (!isOpen) return null;

  const handleRequestCode = async () => {
    if (!identifier.trim()) {
      setError(
        "يرجى إدخال البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم لطلب كود التحقق.",
      );
      return;
    }
    setCodeRequestLoading(true);
    setError("");
    setCodeRequestMsg(null);
    try {
      const res = await apiFetch("/api/auth/request-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إرسال كود التحقق.");
      }
      setCodeRequested(true);
      if (data.code) {
        setPin(data.code);
      }
      const targetStr = data.maskedContact
        ? ` إلى (${data.maskedContact})`
        : "";
      setCodeRequestMsg(
        `تم إرسال كود التحقق بنجاح${targetStr}. صالح لمدة 15 دقيقة.`,
      );
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء طلب كود التحقق.");
    } finally {
      setCodeRequestLoading(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !pin.trim()) {
      setError("يرجى إدخال البريد أو رقم الهاتف وكود التحقق/PIN المستلم.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/public/verify-legacy-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          pin: pin.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "تعذر التحقق من كود التفعيل أو البيانات المدخلة.",
        );
      }

      setMaskedName(data.maskedName || "عضو إنصات");
      setIsNewInvite(Boolean(data.isNewInvite));
      setLegacyId(data.legacyId || "");

      // If user came through reset tab or the account is already active / eligible for password reset
      if (
        activeTab === "reset" ||
        data.isAlreadyActive ||
        data.canResetPassword
      ) {
        setIsResetFlow(true);
      } else {
        setIsResetFlow(false);
      }

      if (data.rawName) setFullName(data.rawName);
      if (data.prefill) {
        if (data.prefill.name && !data.rawName) setFullName(data.prefill.name);
        if (data.prefill.username) setUsername(data.prefill.username);
        if (data.prefill.email) setEmail(data.prefill.email);
        if (data.prefill.phone) setPhone(data.prefill.phone);
        if (data.prefill.country) setCountry(data.prefill.country);
        if (data.prefill.department) setField(data.prefill.department);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء فحص البيانات.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isResetFlow) {
      if (!password || password.length < 6) {
        setError("كلمة المرور يجب أن تتكون من 6 خانات على الأقل.");
        return;
      }
      if (password !== confirmPassword) {
        setError("كلمتا المرور غير متطابقتين، يرجى إعادة التحقق منهما.");
        return;
      }
      setLoading(true);
      try {
        const res = await apiFetch("/api/auth/reset-password-with-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: identifier.trim(),
            code: pin.trim(),
            newPassword: password,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "فشل إعادة تعيين كلمة المرور.");
        }
        if (data.customToken) {
          try {
            const { auth } = await import("../lib/firebaseClient");
            const { signInWithCustomToken } = await import("firebase/auth");
            if (auth) {
              await signInWithCustomToken(auth, data.customToken);
            }
          } catch (tokenErr) {
            console.warn("[AccountActivation] Auto sign-in skipped:", tokenErr);
          }
        }
        setStep(3);
      } catch (err: any) {
        setError(err.message || "حدث خطأ أثناء إعادة تعيين كلمة المرور.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!termsAccepted) {
      setError("يجب الموافقة على شروط الاستخدام وميثاق التطوع للاستمرار.");
      return;
    }

    const cleanFullName = fullName.trim();
    if (!cleanFullName) {
      setError("يرجى إدخال الاسم الكامل الثلاثي الخاص بك.");
      return;
    }

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError("يرجى إدخال اسم المستخدم المطلوب لحسابك باللغة الإنجليزية.");
      return;
    }

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanEmail && !cleanPhone) {
      setError(
        "يجب إدخال بريد إلكتروني أو رقم هاتف على الأقل للتواصل واستعادة الحساب.",
      );
      return;
    }

    if (cleanEmail && !cleanEmail.includes("@")) {
      setError("يرجى إدخال بريد إلكتروني صالح يحتوي على @.");
      return;
    }

    if (!password || password.length < 6) {
      setError(
        "كلمة المرور يجب أن تتكون من 6 خانات على الأقل (أحرف أو أرقام).",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين، يرجى إعادة التحقق منهما.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/public/migrate-legacy-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legacyId,
          pin: pin.trim(),
          name: cleanFullName,
          username: cleanUsername,
          email: cleanEmail,
          phone: cleanPhone,
          password,
          country: country.trim() || "العراق",
          field: field.trim(),
          publicProfileConsent: publicConsent,
          termsAccepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "تعذر إكمال تفعيل الحساب. يرجى المحاولة لاحقاً.",
        );
      }

      // Auto sign-in if customToken is provided
      if (data.customToken) {
        try {
          const { auth } = await import("../lib/firebaseClient");
          const { signInWithCustomToken } = await import("firebase/auth");
          if (auth) {
            await signInWithCustomToken(auth, data.customToken);
          }
        } catch (tokenErr) {
          console.warn("[AccountActivation] Auto sign-in skipped:", tokenErr);
        }
      }

      setStep(3);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تفعيل الحساب.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              {activeTab === "reset" ? (
                <RotateCcw size={20} />
              ) : (
                <KeyRound size={20} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>
                  {activeTab === "reset"
                    ? "استعادة وتعيين كلمة المرور"
                    : "تفعيل العضوية وتأكيد الحساب"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                  {activeTab === "reset"
                    ? "كود التحقق OTP"
                    : "كود الانضمام أو PIN"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {activeTab === "reset"
                  ? "إعادة تعيين كلمة المرور بواسطة رمز التحقق أو كود العضوية"
                  : "للأعضاء الجدد والأعضاء السابقين بكود تفعيل"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {step === 1 && (
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mt-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab("activate");
                setError("");
                setCodeRequestMsg(null);
              }}
              className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all cursor-pointer ${activeTab === "activate" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
            >
              تفعيل عضوية جديدة / PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("reset");
                setError("");
                setCodeRequestMsg(null);
              }}
              className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all cursor-pointer ${activeTab === "reset" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
            >
              نسيت كلمة المرور (تغيير بالكود)
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {codeRequestMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{codeRequestMsg}</span>
          </div>
        )}

        {/* STEP 1: Verify Identifier and Code */}
        {step === 1 && (
          <form
            onSubmit={handleVerifyPin}
            noValidate
            className="mt-5 space-y-4"
          >
            <p className="text-xs text-slate-300 leading-relaxed">
              {activeTab === "reset"
                ? "أدخل بريدك الإلكتروني، رقم هاتفك، أو اسم المستخدم لطلب كود التحقق وتغيير كلمة المرور الخاصة بعضويتك مباشرة."
                : "أدخل بريدك الإلكتروني أو رقم هاتفك أو اسمك مع كود التفعيل / الانضمام (PIN) المستلم من إدارة إنصات للتحقق والبدء بإنشاء وتأكيد حسابك."}
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                البريد الإلكتروني، رقم الهاتف، أو اسم المستخدم
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="مثال: name@example.com أو 0773... أو المعرف"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  {activeTab === "reset"
                    ? "كود التحقق (OTP) أو PIN العضوية"
                    : "كود الانضمام أو رمز التفعيل (PIN)"}
                </label>
                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={codeRequestLoading || !identifier.trim()}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  {codeRequestLoading ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> إرسال
                      الكود...
                    </>
                  ) : (
                    <>
                      <Send size={12} />{" "}
                      {codeRequested ? "إعادة طلب كود" : "طلب كود تحقق"}
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="أدخل كود التحقق المكون من 6 أرقام أو PIN"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none tracking-widest text-center font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> جارٍ التحقق
                    من الكود...
                  </>
                ) : (
                  <>
                    {activeTab === "reset"
                      ? "التحقق ومتابعة تغيير كلمة المرور"
                      : "التحقق والمتابعة"}{" "}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Password Reset Flow */}
        {step === 2 && isResetFlow && (
          <form
            onSubmit={handleCompleteMigration}
            noValidate
            className="mt-6 space-y-4"
          >
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-amber-400" />
                <span>تم تأكيد كود التحقق بنجاح</span>
              </div>
              <span className="font-bold text-white">
                {fullName || maskedName}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              يرجى تعيين كلمة المرور الجديدة لحسابك. بعد الحفظ، سيتم تسجيل دخولك
              مباشرة بالصلاحيات المعتمدة.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                كلمة المرور الجديدة (6 خانات على الأقل) *
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none text-left dir-ltr"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                تأكيد كلمة المرور الجديدة *
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none text-left dir-ltr"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={
                  loading ||
                  !password ||
                  password.length < 6 ||
                  password !== confirmPassword
                }
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> جارٍ تحديث
                    كلمة المرور...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> حفظ وتعيين كلمة المرور الآن
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Complete and Secure Profile (Normal Migration) */}
        {step === 2 && !isResetFlow && (
          <form
            onSubmit={handleCompleteMigration}
            noValidate
            className="mt-6 space-y-4"
          >
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>
                  {isNewInvite
                    ? "تم التحقق من كود الانضمام الجديد"
                    : "تم التحقق من كود العضوية"}
                </span>
              </div>
              <span className="font-bold text-white">
                {fullName || maskedName}
              </span>
            </div>

            <p className="text-xs text-slate-300">
              {isNewInvite
                ? "أهلاً بك في إنصات! يرجى إكمال إعداد حسابك وكلمة المرور الخاصة بك للانطلاق في المنصة."
                : "أكمل بيانات حسابك الموحد الجديد لتعيين كلمة مرور وتأكيد صلاحياتك وأعمالك."}
            </p>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                الاسم الكامل (الاسم الثلاثي أو المعرف الرسمي) *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="اكتب اسمك الكامل"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  اسم المستخدم المطلوب (English) *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                  placeholder="e.g. ahmed_99"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  الدولة
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  {ARAB_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.nameAr}>
                      {c.flag} {c.nameAr}
                    </option>
                  ))}
                  <option value="دولة أخرى">🌍 دولة أخرى</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  placeholder="yourname@domain.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <PhoneInput
                  label="رقم الهاتف / واتساب"
                  value={phone}
                  onChange={(e164) => setPhone(e164)}
                  placeholder="5X XXX XXXX"
                  theme="dark"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 خانات على الأقل"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  تأكيد كلمة المرور *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                المجال / التخصص في المبادرة
              </label>
              <input
                type="text"
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="مثال: هندسة صوت، قراءة أدبية، تدقيق لغوي، إدارة محتوى..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <label className="flex items-start gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={publicConsent}
                  onChange={(e) => setPublicConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <span>
                  أوافق على ظهور اسمي وبلدي في إحصاءات مجتمع المتطوعين العامة.
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="font-semibold text-white">
                  أوافق على شروط الاستخدام وميثاق التطوع في منصة إنصات.
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> جارٍ تفعيل
                    وتأكيد الحساب...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> إنشاء وتفعيل الحساب الآن
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Complete Success */}
        {step === 3 && (
          <div className="mt-6 text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <ShieldCheck size={36} />
            </div>
            <h3 className="text-xl font-bold text-white">
              تم تفعيل وتأكيد حسابك بنجاح! 🎉
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              مرحباً بك في أسرة ومبادرة إنصات. تم تسجيل وتوثيق حسابك بنجاح،
              ويمكنك الآن الدخول مباشرة للمنصة واستخدام حسابك وكلمة المرور
              الجديدة في أي وقت.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onSuccessLogin) {
                    onSuccessLogin();
                  } else {
                    window.location.href = "/portal";
                  }
                }}
                className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <span>الدخول إلى المنصة مباشرة</span>
                <ArrowRight size={16} className="rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.href = "/login";
                }}
                className="px-5 py-3.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-sm transition cursor-pointer"
              >
                صفحة تسجيل الدخول
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const PinMigrationModal = AccountActivationModal;
export default AccountActivationModal;
