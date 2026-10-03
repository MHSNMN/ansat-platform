import React, { useEffect, useState } from "react";
import {
  Loader2,
  Check,
  X,
  HeartHandshake,
  FileText,
  Inbox,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { AdminVolunteerFormsManager } from "./AdminVolunteerFormsManager";

type Application = {
  id: string;
  formName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  applicantCountry?: string;
  status: string;
  createdAt: string;
  answers: Record<string, any>;
};

export function AdminVolunteers() {
  const [subTab, setSubTab] = useState<"forms" | "applications">("forms");
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<{
    id: string;
    link: string;
  } | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/volunteer-applications");
      const data = await res.json();
      if (data.success) {
        setApps(data.applications || []);
      } else {
        setError(data.error || "خطأ في تحميل الطلبات");
      }
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, role: string) => {
    setBusy(id);
    setSuccessLink(null);
    try {
      const res = await apiFetch(
        `/api/admin/volunteer-applications/${id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setSuccessLink({ id, link: data.passwordSetupLink });
        loadApps();
      } else {
        alert(data.error);
      }
    } catch {
      alert("تعذر الاتصال");
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("سبب الرفض:");
    if (reason === null) return;
    setBusy(id);
    try {
      const res = await apiFetch(
        `/api/admin/volunteer-applications/${id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (res.ok) {
        loadApps();
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <div className="admin-empty">
        <Loader2 className="spin" /> تحميل طلبات التطوع...
      </div>
    );
  if (error) return <div className="admin-notice">{error}</div>;

  const pending = apps.filter((a) => a.status === "SUBMITTED");

  return (
    <div className="space-y-6 mt-6 text-right" dir="rtl">
      {/* Subtabs Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setSubTab("forms")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition ${
            subTab === "forms"
              ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileText size={16} />
          <span>استمارات التقديم والتطوع</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("applications")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition ${
            subTab === "applications"
              ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Inbox size={16} />
          <span>طلبات التطوع الواردة</span>
          {pending.length > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                subTab === "applications"
                  ? "bg-slate-950 text-amber-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {pending.length}
            </span>
          )}
        </button>
      </div>

      {/* Subtab Content */}
      {subTab === "forms" ? (
        <AdminVolunteerFormsManager />
      ) : (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <HeartHandshake className="text-amber-400" size={24} />
            <h2 className="text-xl font-black text-white">
              طلبات التطوع الواردة ({pending.length})
            </h2>
          </div>

          <div className="space-y-4">
            {pending.length === 0 && (
              <div className="text-slate-400 text-center py-8">
                لا توجد طلبات تطوع معلقة حالياً.
              </div>
            )}

            {pending.map((app) => (
              <div
                key={app.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row gap-6"
              >
                <div className="flex-1 space-y-2 text-sm text-slate-300">
                  <div className="flex items-center justify-between mb-2">
                    <strong className="text-amber-400 text-lg">
                      {app.applicantName}
                    </strong>
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">
                      {app.formName}
                    </span>
                  </div>
                  <p>
                    <b>البريد:</b> {app.applicantEmail}
                  </p>
                  <p>
                    <b>الهاتف:</b>{" "}
                    <span dir="ltr">{app.applicantPhone || "-"}</span>
                  </p>
                  <p>
                    <b>الدولة:</b> {app.applicantCountry || "-"}
                  </p>

                  <div className="mt-4 p-3 bg-slate-900 rounded-lg text-xs leading-relaxed">
                    <b className="block mb-2 text-slate-400">الإجابات:</b>
                    {Object.entries(app.answers || {}).map(([k, v]) => (
                      <div key={k} className="mb-1">
                        <span className="opacity-60">{k}:</span> {String(v)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full md:w-64 flex flex-col gap-2 justify-center border-t md:border-t-0 md:border-r border-slate-800 pt-4 md:pt-0 md:pr-6">
                  {successLink?.id === app.id ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg text-xs text-emerald-400 text-center">
                      تم القبول! أرسل هذا الرابط للمتطوع لتعيين كلمة المرور:
                      <input
                        readOnly
                        value={successLink.link}
                        className="w-full mt-2 p-1.5 bg-black/40 border border-emerald-500/30 rounded text-emerald-300 outline-none"
                        onClick={(e) => e.currentTarget.select()}
                      />
                    </div>
                  ) : (
                    <>
                      <label className="text-xs font-bold text-slate-400">
                        اعتماد كـ (اكتب أو اختر الدور):
                      </label>
                      <input
                        id={`role-${app.id}`}
                        defaultValue={(app as any).targetRole || "MEMBER"}
                        list="common-roles-list"
                        placeholder="اكتب الدور (مثلاً: معلق صوتي، مصمم...)"
                        className="p-2 text-sm bg-slate-900 border border-slate-700 rounded-lg outline-none focus:border-amber-500 text-white mb-2"
                      />
                      <datalist id="common-roles-list">
                        <option value="MEMBER">عضو عام</option>
                        <option value="NARRATOR">معلق صوتي</option>
                        <option value="AUDIO_ENGINEER">مهندس صوت</option>
                        <option value="QA_REVIEWER">مراجع جودة</option>
                        <option value="OPERATIONS_MANAGER">
                          إدارة العمليات والتنسيق
                        </option>
                        <option value="CONTENT_CREATOR">
                          صانع محتوى وباحث
                        </option>
                        <option value="DESIGNER">مصمم جرافيك وهوية</option>
                      </datalist>
                      <button
                        disabled={busy === app.id}
                        onClick={() =>
                          handleApprove(
                            app.id,
                            (
                              document.getElementById(
                                `role-${app.id}`,
                              ) as HTMLInputElement
                            ).value,
                          )
                        }
                        className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-lg transition"
                      >
                        {busy === app.id ? (
                          <Loader2 className="spin" size={16} />
                        ) : (
                          <Check size={16} />
                        )}
                        قبول وإنشاء حساب
                      </button>
                      <button
                        disabled={busy === app.id}
                        onClick={() => handleReject(app.id)}
                        className="flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold py-2 rounded-lg transition"
                      >
                        <X size={16} />
                        رفض الطلب
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
