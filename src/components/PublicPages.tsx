import React from "react";
import { BookOpen, Shield, ScrollText, Headphones } from "lucide-react";
import { ThemeMode } from "../types";

interface PublicPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const PageContainer: React.FC<{
  children: React.ReactNode;
  theme: ThemeMode;
  title: string;
}> = ({ children, theme, title }) => (
  <div
    className={`min-h-screen rtl font-sans transition-colors durationSeconds-300 ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}
  >
    <nav
      className={`border-b ${theme === "dark" ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white/50"} backdrop-blur-md sticky top-0 z-50`}
    >
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="w-6 h-6 text-amber-500" />
          <span className="font-bold text-lg tracking-wide">إنصات</span>
        </div>
        <div className="flex gap-4 text-sm font-medium">
          <a href="/about" className="hover:text-amber-500 transition-colors">
            عن المنصة
          </a>
          <a href="/privacy" className="hover:text-amber-500 transition-colors">
            الخصوصية
          </a>
          <a href="/terms" className="hover:text-amber-500 transition-colors">
            الشروط
          </a>
          <a href="/support" className="hover:text-amber-500 transition-colors">
            الدعم
          </a>
        </div>
      </div>
    </nav>
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-8 text-amber-500">
        {title}
      </h1>
      <div
        className={`prose prose-lg max-w-none ${theme === "dark" ? "prose-invert prose-p:text-slate-300 prose-headings:text-slate-100" : "prose-p:text-slate-600 prose-headings:text-slate-900"}`}
      >
        {children}
      </div>
    </main>
  </div>
);

export const AboutPage: React.FC<PublicPageProps> = ({ theme }) => (
  <PageContainer theme={theme} title="منصة إنصات المركزية للإنتاج الصوتي">
    <div className="flex items-center gap-4 mb-6">
      <BookOpen className="w-8 h-8 text-amber-500" />
      <h2 className="text-2xl font-bold m-0">عن المنصة</h2>
    </div>
    <p>
      منصة إنصات هي نظام تنظيمي داخلي مخصص لإدارة وتنسيق الإنتاج الصوتي للكتب
      والمواد المسموعة. تهدف المنصة إلى تسهيل سير العمل بين فرق العمل المختلفة
      من معلقين صوتيين، مهندسي صوت، ومراجعي جودة.
    </p>
    <p>
      توفر المنصة بيئة منظمة لتسجيل، رفع، ومراجعة المواد الصوتية ضمن مسار عمل
      واضح يضمن جودة المخرجات، مع الاعتماد على حلول التخزين السحابي الآمنة.
    </p>
  </PageContainer>
);

export const PrivacyPage: React.FC<PublicPageProps> = ({ theme }) => (
  <PageContainer theme={theme} title="سياسة الخصوصية">
    <div className="flex items-center gap-4 mb-6">
      <Shield className="w-8 h-8 text-amber-500" />
      <h2 className="text-2xl font-bold m-0">كيف نتعامل مع البيانات</h2>
    </div>
    <p>
      نحن نولي أهمية بالغة لخصوصية أعضاء المنصة وعملية الإنتاج. توضح هذه الصفحة
      كيفية تعاملنا مع البيانات:
    </p>
    <ul>
      <li>
        <strong>بيانات الحساب:</strong> قد نقوم بحفظ بيانات الحساب الأساسية
        والصلاحيات الإدارية للأعضاء لضمان الوصول الآمن.
      </li>
      <li>
        <strong>البيانات الوصفية (Metadata):</strong> نستخدم قاعدة بيانات لتخزين
        المعلومات الوصفية للكتب، التسجيلات، وحالة تقدم العمل (مثل المرحلة
        الحالية للتسجيل).
      </li>
      <li>
        <strong>تخزين الملفات:</strong> تُحفظ الملفات الصوتية الفعلية والمستندات
        في مساحة Google Drive مخصصة للمبادرة، ولا تُخزن في قاعدة البيانات
        التشغيلية.
      </li>
      <li>
        <strong>ربط Google OAuth:</strong> نستخدم خدمات Google OAuth حصرياً
        لتفويض المنصة للوصول إلى Google Drive المخصص على مستوى الخادم لغرض رفع
        وإدارة الملفات المتعلقة بالعمل.
      </li>
    </ul>
    <p>
      يقتصر الوصول إلى البيانات والملفات على الأعضاء المصرح لهم بناءً على
      أدوارهم في فريق العمل.
    </p>
  </PageContainer>
);

export const TermsPage: React.FC<PublicPageProps> = ({ theme }) => (
  <PageContainer theme={theme} title="شروط الاستخدام">
    <div className="flex items-center gap-4 mb-6">
      <ScrollText className="w-8 h-8 text-amber-500" />
      <h2 className="text-2xl font-bold m-0">شروط الاستخدام</h2>
    </div>
    <p>باستخدامك لمنصة إنصات، فإنك توافق على الالتزام بالشروط التالية:</p>
    <ul>
      <li>
        <strong>صلاحية الوصول:</strong> استخدام هذه المنصة مخصص حصرياً لأعضاء
        مبادرة إنصات المخولين. يمنع منعاً باتاً مشاركة بيانات الدخول أو الحسابات
        مع أطراف غير مصرح لها.
      </li>
      <li>
        <strong>الاستخدام المقبول:</strong> يمنع رفع أو مشاركة أي مواد غير
        متعلقة بمهام الإنتاج المحددة، أو محاولة الوصول إلى صلاحيات أو بيانات غير
        مصرح لك بها.
      </li>
      <li>
        <strong>المسؤولية وحقوق النشر:</strong> جميع الملفات المرفوعة وحقوق
        النشر المتعلقة بها هي مسؤولية العضو والمبادرة. يجب الالتزام بحقوق
        الملكية الفكرية للمواد المرفوعة.
      </li>
      <li>
        <strong>الإجراءات الإدارية:</strong> تحتفظ إدارة المنصة بحق تعليق أو
        إلغاء وصول أي حساب في حال إساءة الاستخدام أو مخالفة الشروط المنصوص
        عليها.
      </li>
    </ul>
  </PageContainer>
);

export const SupportPage: React.FC<PublicPageProps> = ({ theme }) => (
  <PageContainer theme={theme} title="الدعم والمساعدة">
    <p>
      إذا كنت تواجه أي مشكلة تقنية أثناء استخدام المنصة، أو لديك استفسار يخص
      صلاحياتك والمهام الموكلة إليك، يرجى التواصل مع إدارة المبادرة أو الدعم
      الفني من خلال قنوات التواصل الرسمية المعتمدة.
    </p>
    <div
      className={`mt-8 p-6 rounded-xl border ${theme === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}
    >
      <h3 className="text-lg font-bold mb-2">للتواصل:</h3>
      <p className="text-slate-500 italic">
        (سيتم إضافة وسائل التواصل الرسمية - البريد الإلكتروني أو رقم الدعم - هنا
        لاحقاً)
      </p>
    </div>
  </PageContainer>
);
