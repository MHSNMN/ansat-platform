import React, { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ArrowUp,
  ArrowDown,
  X,
  FileText,
  Mic,
  Headphones,
  Briefcase,
  Clock,
  Link,
  ShieldCheck,
  Layers,
  Send,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import {
  VolunteerFormDefinition,
  FormQuestion,
  QuestionType,
  VolunteerFormStatus,
} from "../volunteer/volunteerTypes";

const ROLE_SUGGESTIONS = [
  { value: "MEMBER", label: "عضو عام" },
  { value: "NARRATOR", label: "معلق / راوٍ صوتي" },
  { value: "AUDIO_ENGINEER", label: "مهندس صوت وماسترنغ" },
  { value: "QA_REVIEWER", label: "مراجع لغوي وفني" },
  { value: "OPERATIONS_MANAGER", label: "إدارة العمليات والتنسيق" },
  { value: "CONTENT_CREATOR", label: "صانع محتوى وباحث" },
  { value: "DESIGNER", label: "مصمم جرافيك وهوية" },
  { value: "TRANSLATOR", label: "مترجم لغوي" },
];

const QUESTION_TYPES: { type: QuestionType; label: string; icon: string }[] = [
  { type: "text", label: "نص قصير", icon: "✏️" },
  { type: "textarea", label: "نص طويل / شرح وفقرة", icon: "📝" },
  { type: "email", label: "بريد إلكتروني", icon: "✉️" },
  { type: "phone", label: "رقم هاتف دولي مع الرمز", icon: "📱" },
  { type: "countries", label: "قائمة الدول العربية والعالمية", icon: "🌍" },
  { type: "select", label: "قائمة خيارات منسدلة", icon: "🔽" },
  { type: "radio", label: "اختيار واحد من متعدد (Radio)", icon: "🔘" },
  { type: "checkbox", label: "خيارات متعددة (Checkboxes)", icon: "☑️" },
  { type: "number", label: "رقم / عدد ساعات / سنوات", icon: "🔢" },
  { type: "date", label: "تاريخ / موعد", icon: "📅" },
  { type: "file", label: "رابط ملف / درايف / معرض أعمال", icon: "🔗" },
  { type: "consent", label: "إقرار وتعهد وموافقة", icon: "📜" },
];

export function AdminVolunteerFormsManager() {
  const [forms, setForms] = useState<VolunteerFormDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Editor modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingForm, setEditingForm] =
    useState<VolunteerFormDefinition | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<"builder" | "preview">(
    "builder",
  );
  const [editorError, setEditorError] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [newOptionInputs, setNewOptionInputs] = useState<
    Record<string, string>
  >({});

  // Standalone Preview modal state
  const [previewForm, setPreviewForm] =
    useState<VolunteerFormDefinition | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] =
    useState<VolunteerFormDefinition | null>(null);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/volunteer-forms");
      const data = await res.json();
      if (data.success) {
        setForms(data.forms || []);
      } else {
        setError(data.error || "تعذر تحميل استمارات التطوع");
      }
    } catch {
      setError("خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newId = `form-${Date.now()}`;
    const emptyForm: VolunteerFormDefinition = {
      id: newId,
      slug: `apply-${Date.now().toString().slice(-6)}`,
      name: "",
      description: "",
      targetRole: "عضو عام",
      status: "published",
      postSubmitMessage:
        "شكراً لتقديمك! تم استلام طلبك وسيتواصل معك فريق إدارة إنصات قريباً.",
      termsVersion: "2026.1",
      questions: [
        {
          id: `q-name-${Date.now()}`,
          key: "applicantName",
          label: "الاسم الكامل",
          type: "text",
          required: true,
          placeholder: "اكتب اسمك الثلاثي أو الثنائي كما تفضل",
          helpText: "سيظهر هذا الاسم في ملفك وسجلات فريق إنصات",
          order: 1,
        },
        {
          id: `q-email-${Date.now()}`,
          key: "applicantEmail",
          label: "البريد الإلكتروني",
          type: "email",
          required: true,
          placeholder: "name@example.com",
          helpText: "سنرسل لك رابط تفعيل الحساب وإشعارات القبول عبر هذا البريد",
          order: 2,
        },
        {
          id: `q-phone-${Date.now()}`,
          key: "applicantPhone",
          label: "رقم الهاتف / واتساب",
          type: "phone",
          required: true,
          helpText: "للتواصل السريع وتنسيق المهام الصوتية والفنية",
          order: 3,
        },
        {
          id: `q-country-${Date.now()}`,
          key: "applicantCountry",
          label: "دولة الإقامة",
          type: "countries",
          required: true,
          order: 4,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingForm(emptyForm);
    setActiveEditorTab("builder");
    setEditorError("");
    setIsEditorOpen(true);
  };

  const handleEdit = (form: VolunteerFormDefinition) => {
    setEditingForm(JSON.parse(JSON.stringify(form)));
    setActiveEditorTab("builder");
    setEditorError("");
    setIsEditorOpen(true);
  };

  const handleDuplicate = async (form: VolunteerFormDefinition) => {
    setBusyAction(`dup-${form.id}`);
    try {
      const copy: VolunteerFormDefinition = {
        ...JSON.parse(JSON.stringify(form)),
        id: `form-${Date.now()}`,
        slug: `${form.slug || "form"}-copy-${Date.now().toString().slice(-4)}`,
        name: `${form.name} (نسخة جديدة)`,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const res = await apiFetch("/api/admin/volunteer-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`تم نسخ استمارة "${form.name}" كمسودة بنجاح`);
        loadForms();
      } else {
        alert(data.error || "تعذر نسخ الاستمارة");
      }
    } catch {
      alert("خطأ في الاتصال أثناء نسخ الاستمارة");
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleStatus = async (form: VolunteerFormDefinition) => {
    const nextStatus: VolunteerFormStatus =
      form.status === "published"
        ? "closed"
        : form.status === "closed"
          ? "draft"
          : "published";
    setBusyAction(`status-${form.id}`);
    try {
      const res = await apiFetch(`/api/admin/volunteer-forms/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setForms((prev) =>
          prev.map((f) =>
            f.id === form.id ? { ...f, status: nextStatus } : f,
          ),
        );
      } else {
        alert(data.error || "تعذر تغيير حالة الاستمارة");
      }
    } catch {
      alert("خطأ في الاتصال");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSeedPresets = async () => {
    if (
      !window.confirm(
        "هل ترغب في استعادة النماذج الأساسية لمنصة إنصات إلى قاعدة البيانات؟",
      )
    ) {
      return;
    }
    setBusyAction("seed-presets");
    try {
      const res = await apiFetch("/api/admin/volunteer-forms/seed-presets", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("تمت استعادة وتحديث الاستمارات الافتراضية بنجاح");
        loadForms();
      } else {
        alert(data.error || "تعذر استعادة الاستمارات الافتراضية");
      }
    } catch {
      alert("خطأ في الاتصال");
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveForm = async () => {
    if (!editingForm) return;
    if (!editingForm.name.trim()) {
      setEditorError("يرجى إدخال عنوان للاستمارة");
      return;
    }
    if (!editingForm.questions || editingForm.questions.length === 0) {
      setEditorError("يجب أن تحتوي الاستمارة على سؤال واحد على الأقل");
      return;
    }

    setSavingForm(true);
    setEditorError("");

    const isNew = !forms.some((f) => f.id === editingForm.id);
    const endpoint = isNew
      ? "/api/admin/volunteer-forms"
      : `/api/admin/volunteer-forms/${editingForm.id}`;
    const method = isNew ? "POST" : "PUT";

    try {
      const res = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingForm),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`تم حفظ استمارة "${editingForm.name}" بنجاح`);
        setIsEditorOpen(false);
        setEditingForm(null);
        loadForms();
      } else {
        setEditorError(data.error || "تعذر حفظ الاستمارة");
      }
    } catch {
      setEditorError("خطأ في الاتصال بالسيرفر أثناء الحفظ");
    } finally {
      setSavingForm(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setBusyAction(`del-${deleteTarget.id}`);
    try {
      const res = await apiFetch(
        `/api/admin/volunteer-forms/${deleteTarget.id}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`تم حذف استمارة "${deleteTarget.name}"`);
        setDeleteTarget(null);
        loadForms();
      } else {
        alert(data.error || "تعذر حذف الاستمارة");
      }
    } catch {
      alert("خطأ في الاتصال أثناء الحذف");
    } finally {
      setBusyAction(null);
    }
  };

  // Helper to generate a slug from Arabic title
  const generateSlugFromTitle = (title: string) => {
    const ascii = title
      .toLowerCase()
      .replace(/طلب انضمام:?/g, "")
      .replace(/استمارة:?/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0621-\u064A-]/g, "");
    return `apply-${Date.now().toString().slice(-4)}`;
  };

  // Question editing helpers
  const handleAddBlankQuestion = () => {
    if (!editingForm) return;
    const newQ: FormQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key: `custom_${Date.now().toString().slice(-4)}`,
      label: "سؤال جديد",
      type: "text",
      required: false,
      placeholder: "",
      helpText: "",
      order: editingForm.questions.length + 1,
    };
    setEditingForm({
      ...editingForm,
      questions: [...editingForm.questions, newQ],
    });
  };

  // Quick preset fields
  const handleAddQuickField = (type: string) => {
    if (!editingForm) return;
    let presetQ: FormQuestion;
    const ts = Date.now().toString().slice(-4);

    switch (type) {
      case "audio_sample":
        presetQ = {
          id: `q-audio-${Date.now()}`,
          key: `voice_sample_${ts}`,
          label: "رابط عينة صوتية مسجلة حديثاً (Google Drive أو SoundCloud)",
          type: "file",
          required: true,
          placeholder: "https://drive.google.com/...",
          helpText:
            "يرجى التأكد من أن صلاحية الوصول إلى الرابط مفتوحة للعامة (Anyone with link)",
          order: editingForm.questions.length + 1,
        };
        break;
      case "equipment":
        presetQ = {
          id: `q-equip-${Date.now()}`,
          key: `equipment_${ts}`,
          label: "المعدات الصوتية وبرامج التسجيل المستخدمة",
          type: "textarea",
          required: true,
          placeholder:
            "مثال: مايك Rode NT1، كرت صوت Focusrite Scarlett، برنامج Reaper أو Audacity مع غرفة معزولة...",
          helpText: "اذكر نوع المايك ومكان التسجيل وطريقة العزل الصوتي لديك",
          order: editingForm.questions.length + 1,
        };
        break;
      case "experience":
        presetQ = {
          id: `q-exp-${Date.now()}`,
          key: `experience_years_${ts}`,
          label: "سنوات الخبرة في هذا التخصص",
          type: "select",
          required: true,
          options: [
            "مبتدئ بشغف كبير",
            "سنة إلى سنتين",
            "3 إلى 5 سنوات",
            "أكثر من 5 سنوات من الخبرة الاحترافية",
          ],
          helpText: "اختر المستوى الأقرب لخبرتك العملية",
          order: editingForm.questions.length + 1,
        };
        break;
      case "hours":
        presetQ = {
          id: `q-hours-${Date.now()}`,
          key: `weekly_hours_${ts}`,
          label: "عدد ساعات التفرغ التي يمكنك تخصيصها أسبوعياً",
          type: "select",
          required: true,
          options: [
            "أقل من 3 ساعات أسبوعياً",
            "3 إلى 5 ساعات أسبوعياً",
            "6 إلى 10 ساعات أسبوعياً",
            "أكثر من 10 ساعات",
          ],
          helpText: "يساعدنا ذلك في توزيع المهام والإنتاجات بما يتناسب مع وقتك",
          order: editingForm.questions.length + 1,
        };
        break;
      case "portfolio":
        presetQ = {
          id: `q-port-${Date.now()}`,
          key: `portfolio_url_${ts}`,
          label: "رابط معرض الأعمال أو السيرة الذاتية (Portfolio / CV)",
          type: "file",
          required: false,
          placeholder: "https://...",
          helpText: "رابط Behance، Drive، YouTube، أو موقعك الشخصي",
          order: editingForm.questions.length + 1,
        };
        break;
      case "bio":
        presetQ = {
          id: `q-bio-${Date.now()}`,
          key: `bio_motivation_${ts}`,
          label: "نبذة عنك وما الذي يحفزك للتطوع مع منصة إنصات؟",
          type: "textarea",
          required: false,
          placeholder:
            "تحدث إلينا عن اهتماماتك وتجاربك السابقة وما تتطلع لتقديمه...",
          order: editingForm.questions.length + 1,
        };
        break;
      case "pledge":
        presetQ = {
          id: `q-pledge-${Date.now()}`,
          key: `quality_pledge_${ts}`,
          label:
            "أتعهد بالالتزام بمعايير الجودة الصوتية ومواعيد تسليم المشاريع المتفق عليها",
          type: "consent",
          required: true,
          helpText:
            "الالتزام بالمعايير سر نجاح واستدامة إنتاجات إنصات الثقافية",
          order: editingForm.questions.length + 1,
        };
        break;
      default:
        handleAddBlankQuestion();
        return;
    }

    setEditingForm({
      ...editingForm,
      questions: [...editingForm.questions, presetQ],
    });
  };

  const handleUpdateQuestion = (
    idx: number,
    updates: Partial<FormQuestion>,
  ) => {
    if (!editingForm) return;
    const updated = [...editingForm.questions];
    updated[idx] = { ...updated[idx], ...updates };
    setEditingForm({ ...editingForm, questions: updated });
  };

  const handleDuplicateQuestion = (idx: number) => {
    if (!editingForm) return;
    const target = editingForm.questions[idx];
    const copyQ: FormQuestion = {
      ...JSON.parse(JSON.stringify(target)),
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key: `${target.key}_copy_${Date.now().toString().slice(-4)}`,
      label: `${target.label} (نسخة)`,
      order: editingForm.questions.length + 1,
    };
    const updated = [...editingForm.questions];
    updated.splice(idx + 1, 0, copyQ);
    setEditingForm({ ...editingForm, questions: updated });
  };

  const handleRemoveQuestion = (idx: number) => {
    if (!editingForm) return;
    const updated = editingForm.questions.filter((_, i) => i !== idx);
    setEditingForm({ ...editingForm, questions: updated });
  };

  const handleMoveQuestion = (idx: number, dir: "up" | "down") => {
    if (!editingForm) return;
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= editingForm.questions.length) return;
    const updated = [...editingForm.questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setEditingForm({ ...editingForm, questions: updated });
  };

  const handleAddOptionToQuestion = (qIdx: number, questionId: string) => {
    const text = (newOptionInputs[questionId] || "").trim();
    if (!text || !editingForm) return;
    const currentOptions = editingForm.questions[qIdx].options || [];
    if (!currentOptions.includes(text)) {
      handleUpdateQuestion(qIdx, { options: [...currentOptions, text] });
    }
    setNewOptionInputs({ ...newOptionInputs, [questionId]: "" });
  };

  const handleRemoveOptionFromQuestion = (
    qIdx: number,
    optToRemove: string,
  ) => {
    if (!editingForm) return;
    const currentOptions = editingForm.questions[qIdx].options || [];
    handleUpdateQuestion(qIdx, {
      options: currentOptions.filter((o) => o !== optToRemove),
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
        <Loader2 className="spin mb-3 text-amber-500" size={32} />
        <span className="text-sm font-bold">
          جاري تحميل استمارات التقديم والتطوع...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <FileText size={20} />
            </span>
            <h2 className="text-xl font-black text-white">
              إدارة وتعديل استمارات التقديم والتطوع
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            يمكنك تخصيص الأدوار المستهدفة كتابياً، إضافة أسئلة وحقول متقدمة،
            والتحكم الفوري بنشر وظهور الاستمارات للجمهور.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleSeedPresets}
            disabled={busyAction === "seed-presets"}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700"
            title="استعادة النماذج الأساسية للتعليق والهندسة والتدقيق والإنتاج"
          >
            {busyAction === "seed-presets" ? (
              <Loader2 className="spin" size={14} />
            ) : (
              <RotateCcw size={14} />
            )}
            استعادة النماذج الأساسية
          </button>
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} />
            استمارة تقديم جديدة
          </button>
        </div>
      </div>

      {/* Success notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage("")}
            className="hover:opacity-80"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((form) => {
          const isPublished = form.status === "published";
          const isDraft = form.status === "draft";

          return (
            <div
              key={form.id}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 transition rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-lg group relative"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        isPublished
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : isDraft
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {isPublished
                        ? "منشورة للعامة"
                        : isDraft
                          ? "مسودة داخلية"
                          : "مغلقة مؤقتاً"}
                    </span>
                    <span className="text-[11px] bg-slate-900 border border-slate-800 text-amber-400 font-bold px-2 py-0.5 rounded-lg">
                      {form.targetRole}
                    </span>
                  </div>

                  <span
                    className="text-[10px] text-slate-500 font-mono"
                    dir="ltr"
                  >
                    {form.questions?.length || 0} أسئلة
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1.5 line-clamp-1">
                  {form.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {form.description || "لا يوجد وصف مخصص لهذه الاستمارة."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(form)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 transition"
                    title="تعديل الاستمارة والأسئلة"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewForm(form)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                    title="معاينة الاستمارة"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(form)}
                    disabled={busyAction === `dup-${form.id}`}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                    title="نسخ وتكرار الاستمارة"
                  >
                    {busyAction === `dup-${form.id}` ? (
                      <Loader2 className="spin" size={15} />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(form)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-rose-400 transition"
                    title="حذف الاستمارة"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(form)}
                  disabled={busyAction === `status-${form.id}`}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                  title="تغيير حالة الاستمارة (نشر / مسودة / إغلاق)"
                >
                  {busyAction === `status-${form.id}` ? (
                    <Loader2 className="spin" size={12} />
                  ) : isPublished ? (
                    "إيقاف النشر"
                  ) : (
                    "نشر الاستمارة"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Modal */}
      {isEditorOpen && editingForm && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
        >
          <div
            className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 flex flex-col max-h-[92vh] my-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
                  <Edit2 size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {forms.some((f) => f.id === editingForm.id)
                      ? "تعديل استمارة التقديم"
                      : "إنشاء استمارة تقديم جديدة"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    تحرير كامل للبيانات، الدور المستهدف، والأسئلة التفاعلية
                  </p>
                </div>
              </div>

              {/* Tabs: Builder vs Live Preview */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab("builder")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeEditorTab === "builder"
                        ? "bg-amber-500 text-slate-950 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Layers size={14} />
                    <span>المحرر والإعدادات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab("preview")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeEditorTab === "preview"
                        ? "bg-amber-500 text-slate-950 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Eye size={14} />
                    <span>معاينة حية فورية</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {editorError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{editorError}</span>
                </div>
              )}

              {activeEditorTab === "builder" ? (
                <>
                  {/* Basic Details Section */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles size={15} />
                        البيانات الأساسية والدور المستهدف (قابل للكتابة بحرية)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          عنوان الاستمارة{" "}
                          <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={editingForm.name}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              name: e.target.value,
                            })
                          }
                          placeholder="مثال: طلب انضمام: مهندس صوت وماسترنغ"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      {/* Fully writable Target Role with suggestion chips */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-300">
                            الدور المستهدف{" "}
                            <span className="text-amber-400">
                              * (اكتب بحرية)
                            </span>
                          </label>
                          <span className="text-[10px] text-slate-400">
                            يمكنك كتابة أي مسمى تريده
                          </span>
                        </div>
                        <input
                          type="text"
                          value={editingForm.targetRole}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              targetRole: e.target.value,
                            })
                          }
                          placeholder="اكتب الدور المستهدف (مثلاً: معلق صوتي، صانع محتوى، مصمم موشن، باحث تاريخي...)"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none font-bold text-amber-300"
                        />

                        {/* Suggestion Chips */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500">
                            اقتراحات سريعة:
                          </span>
                          {ROLE_SUGGESTIONS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() =>
                                setEditingForm({
                                  ...editingForm,
                                  targetRole: s.label,
                                })
                              }
                              className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                                editingForm.targetRole === s.label
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {/* Status Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          حالة النشر والظهور
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            {
                              id: "published",
                              label: "منشورة للعامة",
                              color:
                                "border-emerald-500 text-emerald-400 bg-emerald-500/10",
                            },
                            {
                              id: "draft",
                              label: "مسودة داخلية",
                              color:
                                "border-amber-500 text-amber-400 bg-amber-500/10",
                            },
                            {
                              id: "closed",
                              label: "مغلقة مؤقتاً",
                              color:
                                "border-slate-600 text-slate-400 bg-slate-800/40",
                            },
                          ].map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() =>
                                setEditingForm({
                                  ...editingForm,
                                  status: st.id as VolunteerFormStatus,
                                })
                              }
                              className={`p-2 rounded-xl text-xs font-bold border transition text-center ${
                                editingForm.status === st.id
                                  ? st.color
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Slug with Auto Generator */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-300">
                            المعرف اللطيف (Slug)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingForm.name) {
                                setEditingForm({
                                  ...editingForm,
                                  slug: generateSlugFromTitle(editingForm.name),
                                });
                              }
                            }}
                            className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                          >
                            <Sparkles size={11} />
                            توليد تلقائي
                          </button>
                        </div>
                        <input
                          type="text"
                          dir="ltr"
                          value={editingForm.slug}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              slug: e.target.value,
                            })
                          }
                          placeholder="audio-engineer"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        مقدمة ووصف الاستمارة (تظهر للمتقدم أعلى النموذج)
                      </label>
                      <textarea
                        rows={2}
                        value={editingForm.description}
                        onChange={(e) =>
                          setEditingForm({
                            ...editingForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="مقدمة تشرح طبيعة التطوع، الأهداف، والمهام المطلوبة من المتقدم..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        رسالة الشكر والتأكيد بعد الإرسال
                      </label>
                      <input
                        type="text"
                        value={editingForm.postSubmitMessage}
                        onChange={(e) =>
                          setEditingForm({
                            ...editingForm,
                            postSubmitMessage: e.target.value,
                          })
                        }
                        placeholder="شكراً لتقديمك! تم استلام طلبك وسيتواصل معك فريق العمل قريباً."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Questions Builder Section */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div>
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                          <Layers size={15} />
                          أسئلة وحقول الاستمارة ({editingForm.questions.length})
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          يمكنك تخصيص كل سؤال كتابياً، إضافة نصوص مساعدة،
                          واختيار أنواع حقول متعددة.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddBlankQuestion}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                      >
                        <Plus size={14} />
                        إضافة سؤال مخصص
                      </button>
                    </div>

                    {/* Quick Fields Bar */}
                    <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl">
                      <span className="block text-[11px] font-bold text-slate-300 mb-2">
                        ⚡ إضافة سريعة لحقول شائعة بنقرة واحدة:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleAddQuickField("audio_sample")}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <Mic size={13} className="text-amber-400" />
                          <span>+ عينة صوتية</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuickField("equipment")}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <Headphones size={13} className="text-sky-400" />
                          <span>+ المايك والمعدات</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuickField("experience")}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <Briefcase size={13} className="text-emerald-400" />
                          <span>+ سنوات الخبرة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuickField("hours")}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <Clock size={13} className="text-purple-400" />
                          <span>+ ساعات التفرغ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuickField("portfolio")}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <Link size={13} className="text-indigo-400" />
                          <span>+ معرض الأعمال / CV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuickField("bio")}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <FileText size={13} className="text-teal-400" />
                          <span>+ نبذة ودوافع التطوع</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddQuickField("pledge")}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition"
                        >
                          <ShieldCheck size={13} className="text-amber-400" />
                          <span>+ إقرار الالتزام</span>
                        </button>
                      </div>
                    </div>

                    {/* Questions List */}
                    <div className="space-y-4">
                      {editingForm.questions.map((q, idx) => {
                        const questionId = q.id || `q-${idx}`;
                        return (
                          <div
                            key={questionId}
                            className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-2xl p-4 space-y-3 relative group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center border border-slate-700">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-white line-clamp-1">
                                  {q.label || "سؤال جديد"}
                                </span>
                                {q.required && (
                                  <span className="text-[10px] text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    إلزامي *
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveQuestion(idx, "up")}
                                  disabled={idx === 0}
                                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition"
                                  title="تحريك لأعلى"
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleMoveQuestion(idx, "down")
                                  }
                                  disabled={
                                    idx === editingForm.questions.length - 1
                                  }
                                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition"
                                  title="تحريك لأسفل"
                                >
                                  <ArrowDown size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateQuestion(idx)}
                                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                                  title="تكرار ونسخ هذا السؤال"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveQuestion(idx)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition mr-1"
                                  title="حذف هذا السؤال"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Question details grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                  نص السؤال
                                </label>
                                <input
                                  type="text"
                                  value={q.label}
                                  onChange={(e) =>
                                    handleUpdateQuestion(idx, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder="اكتب نص السؤال بوضوح..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                  نوع الحقل
                                </label>
                                <select
                                  value={q.type}
                                  onChange={(e) =>
                                    handleUpdateQuestion(idx, {
                                      type: e.target.value as QuestionType,
                                    })
                                  }
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-bold"
                                >
                                  {QUESTION_TYPES.map((t) => (
                                    <option key={t.type} value={t.type}>
                                      {t.icon} {t.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  نص إرشادي توضيحي تحت السؤال
                                </label>
                                <input
                                  type="text"
                                  value={q.helpText || ""}
                                  onChange={(e) =>
                                    handleUpdateQuestion(idx, {
                                      helpText: e.target.value,
                                    })
                                  }
                                  placeholder="ملاحظة أو تعليمات إضافية للمتقدم..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  نص التلميح (Placeholder)
                                </label>
                                <input
                                  type="text"
                                  value={q.placeholder || ""}
                                  onChange={(e) =>
                                    handleUpdateQuestion(idx, {
                                      placeholder: e.target.value,
                                    })
                                  }
                                  placeholder="نص خافت داخل المربع..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-4 pt-5">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                                  <input
                                    type="checkbox"
                                    checked={q.required}
                                    onChange={(e) =>
                                      handleUpdateQuestion(idx, {
                                        required: e.target.checked,
                                      })
                                    }
                                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                                  />
                                  <span>مطلوب وإلزامي</span>
                                </label>

                                <div
                                  className="text-[11px] text-slate-500 font-mono"
                                  dir="ltr"
                                >
                                  key: {q.key}
                                </div>
                              </div>
                            </div>

                            {/* Options manager for select, radio, checkbox */}
                            {["select", "radio", "checkbox"].includes(
                              q.type,
                            ) && (
                              <div className="pt-3 border-t border-slate-800/60 space-y-2">
                                <label className="block text-[11px] font-bold text-slate-300">
                                  خيارات الإجابة ({q.options?.length || 0}):
                                </label>

                                {/* Current options badges */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(q.options || []).map((opt) => (
                                    <span
                                      key={opt}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200"
                                    >
                                      <span>{opt}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveOptionFromQuestion(
                                            idx,
                                            opt,
                                          )
                                        }
                                        className="text-rose-400 hover:text-rose-300"
                                      >
                                        <X size={12} />
                                      </button>
                                    </span>
                                  ))}
                                  {(!q.options || q.options.length === 0) && (
                                    <span className="text-xs text-amber-400/80">
                                      لم تتم إضافة أي خيارات بعد.
                                    </span>
                                  )}
                                </div>

                                {/* Add option input */}
                                <div className="flex items-center gap-2 max-w-md pt-1">
                                  <input
                                    type="text"
                                    value={newOptionInputs[questionId] || ""}
                                    onChange={(e) =>
                                      setNewOptionInputs({
                                        ...newOptionInputs,
                                        [questionId]: e.target.value,
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddOptionToQuestion(
                                          idx,
                                          questionId,
                                        );
                                      }
                                    }}
                                    placeholder="اكتب خياراً ثم اضغط إضافة أو Enter..."
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddOptionToQuestion(idx, questionId)
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold transition border border-slate-700"
                                  >
                                    + إضافة
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* Live Interactive Preview Tab */
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6 max-w-2xl mx-auto shadow-xl">
                  <div className="text-center pb-4 border-b border-slate-800">
                    <span className="text-xs bg-amber-500/20 text-amber-400 font-bold px-3 py-1 rounded-full border border-amber-500/30">
                      الدور: {editingForm.targetRole}
                    </span>
                    <h3 className="text-xl font-black text-white mt-2">
                      {editingForm.name || "عنوان الاستمارة"}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {editingForm.description ||
                        "وصف الاستمارة التوضيحي للمتقدمين..."}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {editingForm.questions.map((q, idx) => (
                      <div key={q.id || idx} className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-300">
                          {q.label}{" "}
                          {q.required && (
                            <span className="text-amber-400">*</span>
                          )}
                        </label>
                        {q.helpText && (
                          <p className="text-[11px] text-slate-400 leading-normal">
                            {q.helpText}
                          </p>
                        )}

                        {q.type === "text" && (
                          <input
                            type="text"
                            placeholder={q.placeholder || ""}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        )}

                        {q.type === "textarea" && (
                          <textarea
                            rows={3}
                            placeholder={q.placeholder || ""}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        )}

                        {q.type === "email" && (
                          <input
                            type="email"
                            dir="ltr"
                            placeholder={q.placeholder || "name@example.com"}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        )}

                        {q.type === "phone" && (
                          <input
                            type="tel"
                            dir="ltr"
                            placeholder={q.placeholder || "+964 ..."}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        )}

                        {q.type === "countries" && (
                          <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none">
                            <option>
                              اختر الدولة (العراق، مصر، المغرب، الأردن...)
                            </option>
                          </select>
                        )}

                        {q.type === "select" && (
                          <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none">
                            <option value="">اختر إجابة...</option>
                            {q.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {q.type === "radio" && (
                          <div className="space-y-2 mt-1">
                            {q.options?.map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2 text-xs text-slate-300"
                              >
                                <input
                                  type="radio"
                                  name={q.key}
                                  className="text-amber-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {q.type === "checkbox" && (
                          <div className="space-y-2 mt-1">
                            {q.options?.map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2 text-xs text-slate-300"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded text-amber-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {q.type === "number" && (
                          <input
                            type="number"
                            placeholder={q.placeholder || "0"}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        )}

                        {q.type === "date" && (
                          <input
                            type="date"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        )}

                        {q.type === "file" && (
                          <input
                            type="url"
                            dir="ltr"
                            placeholder={
                              q.placeholder || "https://drive.google.com/..."
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                          />
                        )}

                        {q.type === "consent" && (
                          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded text-amber-500"
                            />
                            <span className="leading-relaxed">{q.label}</span>
                          </label>
                        )}
                      </div>
                    ))}

                    <div className="pt-4 border-t border-slate-800">
                      <button
                        type="button"
                        className="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                      >
                        <Send size={15} />
                        إرسال طلب التطوع (معاينة حية)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                إلغاء التعديل
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveForm}
                  disabled={savingForm}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {savingForm ? (
                    <Loader2 className="spin" size={15} />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  حفظ وتطبيق الاستمارة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Preview Modal */}
      {previewForm && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
          onClick={() => setPreviewForm(null)}
        >
          <div
            className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs bg-amber-500/20 text-amber-400 font-bold px-3 py-1 rounded-full border border-amber-500/30">
                  الدور: {previewForm.targetRole}
                </span>
                <h3 className="text-xl font-bold text-white mt-2">
                  {previewForm.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {previewForm.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewForm(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto px-1">
              {previewForm.questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">
                    {q.label}{" "}
                    {q.required && <span className="text-amber-400">*</span>}
                  </label>
                  {q.helpText && (
                    <p className="text-[11px] text-slate-400">{q.helpText}</p>
                  )}
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
                    نوع الحقل:{" "}
                    {QUESTION_TYPES.find((t) => t.type === q.type)?.label ||
                      q.type}
                    {q.placeholder && ` (تلميح: ${q.placeholder})`}
                    {q.options &&
                      q.options.length > 0 &&
                      ` - الخيارات: [${q.options.join("، ")}]`}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewForm(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <Trash2 size={24} />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">
                  تأكيد حذف الاستمارة
                </h4>
                <p className="text-xs text-slate-400">
                  هل أنت متأكد من حذف هذه الاستمارة نهائياً؟
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300">
              <b>{deleteTarget.name}</b>
              <div className="text-slate-500 mt-1">
                الدور: {deleteTarget.targetRole}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={busyAction === `del-${deleteTarget.id}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-black transition disabled:opacity-50"
              >
                {busyAction === `del-${deleteTarget.id}` ? (
                  <Loader2 className="spin" size={14} />
                ) : (
                  <Trash2 size={14} />
                )}
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
