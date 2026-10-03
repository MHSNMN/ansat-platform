import { useEffect, useState } from "react";
import { CheckSquare, Coins, Plus, RefreshCw } from "lucide-react";
import { apiFetch } from "../lib/api";
import { ThemeMode, User } from "../types";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
};
export function OperationsHub({
  currentUser,
  theme,
}: {
  currentUser: User;
  theme: ThemeMode;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [points, setPoints] = useState(0);
  const [gems, setGems] = useState(0);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      const [taskResponse, rewardResponse] = await Promise.all([
        apiFetch("/api/tasks"),
        apiFetch("/api/rewards/me"),
      ]);
      const taskData = await taskResponse.json();
      const rewardData = await rewardResponse.json();
      setTasks(taskData.tasks || []);
      setPoints(rewardData.points || 0);
      setGems(rewardData.gems || 0);
    } catch {
      setMessage("تعذر تحميل المهام والنقاط حالياً.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const updateStatus = async (task: Task, status: string) => {
    const response = await apiFetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok)
      setTasks((items) =>
        items.map((item) => (item.id === task.id ? { ...item, status } : item)),
      );
  };
  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const response = await apiFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (response.ok) {
      setTitle("");
      setMessage("تم إنشاء المهمة.");
      void load();
    } else setMessage("لا تملك صلاحية إنشاء المهام أو الخدمة غير مهيأة.");
  };
  const surface =
    theme === "dark"
      ? "bg-slate-900 border-slate-800"
      : "bg-white border-slate-200";
  return (
    <div dir="rtl" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`rounded-2xl border p-5 ${surface}`}>
          <Coins className="text-amber-400" />
          <p className="mt-3 text-sm text-slate-400">رصيد النقاط</p>
          <strong className="text-3xl">{points}</strong>
        </div>
        <div className={`rounded-2xl border p-5 ${surface}`}>
          <Coins className="text-indigo-400" />
          <p className="mt-3 text-sm text-slate-400">الجواهر المستلمة</p>
          <strong className="text-3xl">{gems}</strong>
        </div>
      </div>
      <section className={`rounded-2xl border p-6 ${surface}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="text-amber-400" />
            <h2 className="text-xl font-black">منصة المهام</h2>
          </div>
          <button
            onClick={() => void load()}
            className="rounded-lg p-2 hover:bg-slate-700/40"
            aria-label="تحديث"
          >
            <RefreshCw size={17} className={busy ? "animate-spin" : ""} />
          </button>
        </div>
        {currentUser.can_manage_tasks && (
          <form onSubmit={createTask} className="mt-5 flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان مهمة جديدة"
              className="min-w-0 flex-1 rounded-xl border border-slate-600/40 bg-transparent p-3"
            />
            <button className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-4 font-bold text-slate-950">
              <Plus size={16} />
              إضافة
            </button>
          </form>
        )}
        <div className="mt-5 space-y-3">
          {tasks.length ? (
            tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-xl border border-slate-700/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{task.title}</h3>
                    {task.description && (
                      <p className="mt-1 text-sm text-slate-400">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <select
                    value={task.status}
                    onChange={(e) => void updateStatus(task, e.target.value)}
                    className="rounded-lg border border-slate-600/40 bg-transparent p-2 text-sm"
                  >
                    <option value="todo">جديدة</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="blocked">متوقفة</option>
                    <option value="in_review">مراجعة</option>
                    <option value="completed">مكتملة</option>
                  </select>
                </div>
              </article>
            ))
          ) : (
            <p className="py-8 text-center text-slate-400">
              لا توجد مهام مخصصة لك حالياً.
            </p>
          )}
        </div>
        {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}
      </section>
    </div>
  );
}
