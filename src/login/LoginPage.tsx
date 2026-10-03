import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { authService } from "../services/authService";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import {
  ArrowLeft,
  Headphones,
  LockKeyhole,
  UserRound,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Send,
  RefreshCw,
} from "lucide-react";
import { PhoneInput } from "../shared/components/PhoneInput";
import { motion, AnimatePresence } from "framer-motion";
import "./styles/login.css";

const LOGIN_DESTINATIONS = new Set([
  "/portal",
  "/recording",
  "/tasks",
  "/rewards",
  "/admin",
  "/workspace",
]);

export function getSafeLoginDestination(rawNext: string | null): string {
  if (!rawNext) return "/portal";
  try {
    const decoded = decodeURIComponent(rawNext);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("\\")
    )
      return "/portal";
    const parsed = new URL(decoded, window.location.origin);
    if (
      parsed.origin !== window.location.origin ||
      !LOGIN_DESTINATIONS.has(parsed.pathname)
    )
      return "/portal";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/portal";
  }
}

export function LoginPage() {
  const { user } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"text" | "phone">("text");

  // Reset Password State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const [codeRequestLoading, setCodeRequestLoading] = useState(false);
  const [codeRequestSuccessMsg, setCodeRequestSuccessMsg] = useState<
    string | null
  >(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Migration State
  const [migrationLegacyId, setMigrationLegacyId] = useState<string | null>(
    null,
  );
  const [newPassword, setNewPassword] = useState("");
  const [migrationEmail, setMigrationEmail] = useState("");
  const [migrationPhone, setMigrationPhone] = useState("");
  const [migrationSuccess, setMigrationSuccess] = useState(false);

  // Random particles for background effect
  const [particles, setParticles] = useState<any[]>([]);
  useEffect(() => {
    const arr = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      scale: Math.random() * 0.8 + 0.2,
      duration: Math.random() * 20 + 10,
    }));
    setParticles(arr);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1" || params.get("forgot") === "1") {
      setIsResetMode(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    window.location.replace(getSafeLoginDestination(params.get("next")));
  }, [user]);

  if (user) return null;

  const handleRequestCode = async () => {
    if (!identifier.trim()) {
      setError(
        "يرجى كتابة البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم أولاً لطلب كود التحقق.",
      );
      return;
    }
    setCodeRequestLoading(true);
    setError(null);
    setCodeRequestSuccessMsg(null);
    try {
      const res = await authService.requestResetCode(identifier.trim());
      setCodeRequested(true);
      setCodeRequestSuccessMsg(
        res.message ||
          "إذا كان حسابك مرتبطاً ببريد، راجع صندوق الوارد لفتح رابط الاستعادة.",
      );
    } catch (err: any) {
      setError(
        err?.message || "تعذر إرسال كود التحقق. يرجى التأكد من صحة الحساب.",
      );
    } finally {
      setCodeRequestLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleRequestCode();
  };

  const handleMigrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 خانات على الأقل.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!migrationEmail.trim() && !migrationPhone.trim()) {
        setError("يرجى إدخال البريد الإلكتروني أو رقم الهاتف");
        setLoading(false);
        return;
      }
      await authService.migratePin(
        migrationLegacyId!,
        password,
        newPassword,
        migrationEmail.trim(),
        migrationPhone.trim(),
      );
      setMigrationSuccess(true);
      // Auto-login with the new password
      await authService.loginWithIdentifier(identifier.trim(), newPassword);
      const params = new URLSearchParams(window.location.search);
      window.location.replace(getSafeLoginDestination(params.get("next")));
    } catch (err: any) {
      setError(err?.message || "فشل إنشاء الحساب بكلمة المرور الجديدة.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("يرجى ملء جميع الحقول");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.loginWithIdentifier(identifier.trim(), password);
      const params = new URLSearchParams(window.location.search);
      window.location.replace(getSafeLoginDestination(params.get("next")));
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "PIN_MIGRATION_REQUIRED") {
        setMigrationLegacyId(err.legacyId);
        if (loginMethod === "text" && identifier.includes("@")) {
          setMigrationEmail(identifier.trim());
        } else if (loginMethod === "phone") {
          setMigrationPhone(identifier.trim());
        }
        setError(null);
      } else if (msg === "ACCOUNT_DISABLED") {
        setError("تم تعطيل هذا الحساب. يرجى مراجعة الإدارة.");
      } else if (msg === "ACCOUNT_PENDING") {
        setError("الحساب قيد المراجعة والموافقة من قبل الإدارة.");
      } else if (
        msg.includes("user-not-found") ||
        msg.includes("wrong-password") ||
        msg.includes("invalid-credential") ||
        msg === "INVALID_CREDENTIALS"
      ) {
        setError("بيانات الدخول غير صحيحة، يرجى التحقق وإعادة المحاولة.");
      } else {
        setError("حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.");
      }
    } finally {
      setLoading(false);
    }
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.6, staggerChildren: 0.1 },
    },
  };
  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <ErrorBoundary>
      <div className="login-shell overflow-hidden relative min-h-screen grid md:grid-cols-[0.86fr_1.14fr] bg-slate-950 text-slate-200">
        {/* Animated Background Particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute w-2 h-2 rounded-full bg-amber-500/20"
              initial={{
                x: `${p.x}vw`,
                y: `${p.y}vh`,
                scale: p.scale,
                opacity: 0,
              }}
              animate={{
                y: [`${p.y}vh`, `${p.y - 20}vh`, `${p.y}vh`],
                opacity: [0, 0.5, 0],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: "linear",
                delay: p.id * 0.5,
              }}
            />
          ))}
        </div>

        {/* Aside Section */}
        <div className="login-aside relative flex flex-col justify-end p-8 md:p-16 lg:p-24 overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 hidden md:flex">
          {/* Decorative Elements */}
          <div className="absolute top-[-5%] left-[-5%] text-[15rem] lg:text-[25rem] font-black text-white/10 leading-none select-none">
            إنصات
          </div>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            className="absolute top-[20%] -right-16 w-64 h-64 lg:w-96 lg:h-96 rounded-full border-[40px] lg:border-[60px] border-slate-950/90"
          />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10"
          >
            <motion.span
              variants={itemVariants}
              className="text-xs font-black tracking-widest uppercase mb-4 block text-slate-900/70"
            >
              مساحة فريق إنصات
            </motion.span>
            <motion.h2
              variants={itemVariants}
              className="text-4xl lg:text-6xl font-black mb-6 leading-tight tracking-tight"
            >
              صوتٌ واحد،
              <br />
              وأثرٌ يتّسع.
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="max-w-md text-lg leading-relaxed text-slate-900/80 mb-8"
            >
              من التسجيل إلى المهام والتقدير، جلسة واحدة تربط عمل الفريق بدون
              تسجيل متكرر.
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="text-slate-950 font-mono text-xl tracking-widest opacity-60"
            >
              ▂ ▅ ▃ ▇ ▄ ▆ ▂ ▅ ▇ ▃ ▆ ▂
            </motion.div>
          </motion.div>
        </div>

        {/* Main Login Card Section */}
        <div className="flex items-center justify-center p-6 sm:p-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
          >
            {/* Inner Glow */}
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full" />

            <div className="text-right mb-8 relative">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 shadow-[4px_4px_0_theme(colors.slate.800)] mb-5 border border-slate-800">
                {isResetMode ? (
                  <KeyRound size={28} />
                ) : (
                  <Headphones size={28} />
                )}
              </div>
              <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
                {isResetMode
                  ? "إعادة تعيين كلمة المرور"
                  : "تسجيل الدخول الموحد"}
              </h1>
              <p className="text-slate-400 text-sm">
                {isResetMode
                  ? "تغيير كلمة المرور وتأكيد الدخول بكود التحقق"
                  : "دخول واحد لجميع منصات إنصات المتكاملة"}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-6 text-sm flex items-start gap-3"
                >
                  <span className="text-lg">⚠️</span>
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {isResetMode ? (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="bg-amber-500/10 text-amber-200 text-xs p-3.5 rounded-xl border border-amber-500/20 leading-relaxed">
                  <div className="font-bold text-sm mb-1 flex items-center gap-1.5 text-amber-400">
                    <KeyRound size={16} /> استعادة الحساب وتعيين كلمة المرور
                  </div>
                  أدخل بريدك أو اسم المستخدم أو الهاتف. إذا كان الحساب مرتبطاً
                  ببريد، ستصلك رسالة رسمية فيها رابط تغيير كلمة المرور. لا نعرض
                  رموز الاستعادة على الشاشة.
                </div>

                {codeRequestSuccessMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{codeRequestSuccessMsg}</span>
                  </motion.div>
                )}

                <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("text");
                    }}
                    className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${loginMethod === "text" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    البريد / اسم المستخدم
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("phone");
                    }}
                    className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${loginMethod === "phone" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    رقم الهاتف
                  </button>
                </div>

                {loginMethod === "text" ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      البريد الإلكتروني أو اسم المستخدم
                    </label>
                    <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                      <UserRound
                        size={16}
                        className="text-slate-500 ml-2.5 shrink-0"
                      />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="البريد أو اسم المستخدم"
                        disabled={loading}
                        className="w-full bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5" dir="rtl">
                    <PhoneInput
                      label="رقم الهاتف"
                      value={identifier}
                      onChange={(val) => setIdentifier(val)}
                      placeholder="5X XXX XXXX"
                      theme="dark"
                    />
                  </div>
                )}

                <div className="space-y-1.5 hidden">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-300">
                      كود التحقق (OTP) أو PIN العضوية
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
                  <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                    <KeyRound
                      size={16}
                      className="text-slate-500 ml-2.5 shrink-0"
                    />
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="أدخل كود التحقق المكون من 6 أرقام أو PIN"
                      disabled={loading}
                      className="w-full bg-transparent border-none outline-none text-white text-sm font-mono tracking-widest text-center placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 hidden">
                  <label className="block text-xs font-bold text-slate-300">
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                    <LockKeyhole
                      size={16}
                      className="text-slate-500 ml-2.5 shrink-0"
                    />
                    <input
                      type={showResetPassword ? "text" : "password"}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="•••••••• (6 خانات على الأقل)"
                      disabled={loading}
                      className="w-full bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600 text-left dir-ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                    >
                      {showResetPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 hidden">
                  <label className="block text-xs font-bold text-slate-300">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                    <LockKeyhole
                      size={16}
                      className="text-slate-500 ml-2.5 shrink-0"
                    />
                    <input
                      type={showResetPassword ? "text" : "password"}
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full bg-transparent border-none outline-none text-white text-sm placeholder:text-slate-600 text-left dir-ltr"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={codeRequestLoading || !identifier.trim()}
                  className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-black tracking-wide shadow-[0_4px_0_theme(colors.slate.800)] hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {codeRequestLoading
                    ? "جارٍ إرسال الرابط..."
                    : codeRequested
                      ? "إعادة إرسال رابط الاستعادة"
                      : "إرسال رابط الاستعادة"}
                </motion.button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      setError(null);
                      setCodeRequestSuccessMsg(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    ← العودة لتسجيل الدخول المباشر
                  </button>
                </div>
              </form>
            ) : migrationLegacyId ? (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleMigrationSubmit}
                className="space-y-5"
              >
                <div className="bg-amber-500/10 text-amber-200 text-sm p-4 rounded-xl border border-amber-500/20">
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <Sparkles size={16} /> حماية حسابك
                  </h4>
                  <p className="opacity-90 leading-relaxed">
                    مرحباً! لقد قمنا بتحديث نظام تسجيل الدخول. يرجى إنشاء{" "}
                    <strong>كلمة مرور قوية وموحدة</strong> لحسابك بدلاً من رمز
                    PIN القديم (مكونة من 8 أحرف وأرقام على الأقل).
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">
                      البريد الإلكتروني
                    </label>
                    <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                      <input
                        type="email"
                        value={migrationEmail}
                        onChange={(e) => setMigrationEmail(e.target.value)}
                        placeholder="your@email.com"
                        disabled={loading || migrationSuccess}
                        className="w-full bg-transparent border-none outline-none text-white text-left dir-ltr placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <div dir="rtl">
                    <PhoneInput
                      label="رقم الهاتف"
                      value={migrationPhone}
                      onChange={(val) => setMigrationPhone(val)}
                      placeholder="5X XXX XXXX"
                      theme="dark"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                    <LockKeyhole size={18} className="text-slate-500 mr-3" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading || migrationSuccess}
                      className="w-full bg-transparent border-none outline-none text-white text-left dir-ltr placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={
                    loading ||
                    migrationSuccess ||
                    (newPassword.length > 0 && newPassword.length < 6)
                  }
                  className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-black tracking-wide shadow-[0_4px_0_theme(colors.slate.800)] hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading
                    ? "جارٍ التحديث..."
                    : migrationSuccess
                      ? "تم التحديث بنجاح!"
                      : "تأكيد وتحديث الحساب"}
                </motion.button>
              </motion.form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800 relative z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("text");
                      setIdentifier("");
                    }}
                    className={`flex-1 text-xs py-2.5 rounded-lg font-bold transition-all duration-300 ${loginMethod === "text" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    البريد / اسم المستخدم
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMethod("phone");
                      setIdentifier("");
                    }}
                    className={`flex-1 text-xs py-2.5 rounded-lg font-bold transition-all duration-300 ${loginMethod === "phone" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    رقم الهاتف
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={loginMethod}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {loginMethod === "text" ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-300">
                          البريد الإلكتروني أو اسم المستخدم
                        </label>
                        <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                          <UserRound
                            size={18}
                            className="text-slate-500 ml-3"
                          />
                          <input
                            type="text"
                            autoComplete="username"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="البريد أو اسم المستخدم"
                            disabled={loading}
                            className="w-full bg-transparent border-none outline-none text-white placeholder:text-slate-600"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2" dir="rtl">
                        <PhoneInput
                          label="رقم الهاتف"
                          value={identifier}
                          onChange={(val) => setIdentifier(val)}
                          placeholder="5X XXX XXXX"
                          theme="dark"
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-300">
                    كلمة المرور
                  </label>
                  <div className="relative flex items-center bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all">
                    <LockKeyhole size={18} className="text-slate-500 ml-3" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full bg-transparent border-none outline-none text-white placeholder:text-slate-600 text-left dir-ltr"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setError(null);
                      setCodeRequestSuccessMsg(null);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-bold hover:underline transition-colors cursor-pointer"
                  >
                    نسيت كلمة المرور؟ تغييرها بكود التحقق
                  </button>
                  <a
                    href="/#activate"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = "/?activate=1";
                    }}
                    className="text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    تفعيل كود العضوية
                  </a>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-amber-500 text-slate-950 font-black tracking-wide shadow-[0_4px_0_theme(colors.slate.800)] hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
                </motion.button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-sm">
              <a
                href="/"
                className="flex items-center gap-2 text-amber-500 font-bold hover:text-amber-400 transition-colors"
              >
                <ArrowLeft size={16} /> العودة للموقع العام
              </a>
              <span className="text-slate-500">جلسة آمنة ومحفوظة</span>
            </div>
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default LoginPage;
