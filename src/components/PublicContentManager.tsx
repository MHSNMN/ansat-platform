import { useEffect, useState } from "react";
import { Save, Globe2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { ThemeMode } from "../types";

type Props = { theme: ThemeMode };

/** Small, safe CMS for the public introduction. Library and activity records use the protected API too. */
export function PublicContentManager({ theme }: Props) {
  const [form, setForm] = useState({
    aboutTitle: "",
    aboutBody: "",
    productionLabel: "",
  });
  const [state, setState] = useState<
    "loading" | "ready" | "saving" | "saved" | "error"
  >("loading");

  useEffect(() => {
    apiFetch("/api/admin/content/site")
      .then(async (response) =>
        response.ok ? response.json() : Promise.reject(),
      )
      .then((result) => {
        setForm(result.content);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("saving");
    try {
      const response = await apiFetch("/api/admin/content/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const surface =
    theme === "dark"
      ? "border-slate-800 bg-slate-900"
      : "border-slate-200 bg-white";
  return (
    <section
      dir="rtl"
      className={`mx-auto max-w-3xl rounded-2xl border p-6 ${surface}`}
    >
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-amber-400/15 p-3 text-amber-400">
          <Globe2 />
        </span>
        <div>
          <h2 className="text-xl font-black">محتوى الواجهة العامة</h2>
          <p className="mt-1 text-sm text-slate-400">
            هذه الحقول تظهر للزوار فقط. لا تُنشر بيانات أعضاء أو صلاحيات هنا.
          </p>
        </div>
      </div>
      <form className="mt-7 space-y-4" onSubmit={save}>
        <input
          required
          maxLength={180}
          value={form.aboutTitle}
          onChange={(e) => setForm({ ...form, aboutTitle: e.target.value })}
          placeholder="عنوان فقرة عن إنصات"
          className="w-full rounded-xl border border-slate-600/40 bg-transparent p-3 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <textarea
          required
          maxLength={4000}
          rows={8}
          value={form.aboutBody}
          onChange={(e) => setForm({ ...form, aboutBody: e.target.value })}
          placeholder="النص التعريفي"
          className="w-full rounded-xl border border-slate-600/40 bg-transparent p-3 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <input
          maxLength={120}
          value={form.productionLabel}
          onChange={(e) =>
            setForm({ ...form, productionLabel: e.target.value })
          }
          placeholder="وصف قصير للإنتاج"
          className="w-full rounded-xl border border-slate-600/40 bg-transparent p-3 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          disabled={state === "loading" || state === "saving"}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
        >
          <Save size={17} />
          {state === "saving" ? "جارٍ الحفظ…" : "حفظ التعديل"}
        </button>
        {state === "saved" && (
          <p className="text-sm text-emerald-500">
            تم الحفظ، وسيظهر للزوار بعد تحديث الصفحة.
          </p>
        )}
        {state === "error" && (
          <p className="text-sm text-rose-500">
            تعذر تحميل أو حفظ المحتوى. تحقق من Firebase Admin وصلاحية حسابك.
          </p>
        )}
      </form>
    </section>
  );
}
