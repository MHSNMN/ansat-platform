import { useEffect, useState, useMemo } from "react";
import {
  CheckSquare,
  Plus,
  RefreshCw,
  Search,
  Kanban,
  List as ListIcon,
  Table as TableIcon,
  Clock,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { ThemeMode, User, Book } from "../types";

type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "completed"
  | "cancelled"
  | "archived";
type TaskPriority = "low" | "normal" | "high";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  assigneeUids?: string[];
  status: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  bookId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STATUS_LABELS: Record<TaskStatus, { label: string; color: string }> = {
  todo: {
    label: "جديدة",
    color: "bg-slate-700/50 text-slate-200 border-slate-600",
  },
  in_progress: {
    label: "قيد التنفيذ",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  },
  blocked: {
    label: "متوقفة",
    color: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
  in_review: {
    label: "قيد المراجعة",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  completed: {
    label: "مكتملة",
    color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  cancelled: {
    label: "ملغاة",
    color: "bg-slate-800 text-slate-400 border-slate-700",
  },
  archived: {
    label: "مؤرشفة",
    color: "bg-slate-900 text-slate-500 border-slate-800",
  },
};

const PRIORITY_LABELS: Record<TaskPriority, { label: string; color: string }> =
  {
    low: { label: "منخفضة", color: "text-slate-400" },
    normal: { label: "عادية", color: "text-amber-300" },
    high: { label: "عالية جدًا", color: "text-rose-400 font-bold" },
  };

export function TasksPlatform({
  currentUser,
  theme,
  users = [],
  books = [],
}: {
  currentUser: User;
  theme: ThemeMode;
  users?: User[];
  books?: Book[];
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "table">(
    "kanban",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Create Task Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTasks = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/tasks");
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }
    } catch {
      setMessage("تعذر تحميل المهام حالياً.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (newStatus === "archived") {
      void handleArchiveTask(taskId);
      return;
    }
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        );
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          setMessage("المهمة لم تعد متوفرة في النظام أو تمت أرشفتها مسبقاً.");
        } else {
          setMessage(data.error || "تعذر تحديث حالة المهمة.");
        }
      }
    } catch {
      setMessage("حدث خطأ أثناء الاتصال بالخادم.");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");

    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          priority: newPriority,
          dueDate: newDueDate || null,
          assigneeUids: selectedAssignees,
        }),
      });

      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setNewPriority("normal");
        setNewDueDate("");
        setSelectedAssignees([]);
        setShowCreateModal(false);
        setMessage("تم إنشاء المهمة بنجاح.");
        void loadTasks();
      } else {
        const data = await res.json();
        setMessage(data.error || "فشل في إنشاء المهمة.");
      }
    } catch {
      setMessage("تعذر الاتصال بالخادم لإنشاء المهمة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    const q = (searchQuery || "").toLowerCase();
    return tasks.filter((t) => {
      const matchesSearch =
        !q ||
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));
      // If "all" is selected, hide archived tasks by default.
      // If explicitly looking for archived tasks, show them.
      const matchesStatus =
        statusFilter === "all"
          ? t.status !== "archived"
          : t.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || t.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

  const handleArchiveTask = async (taskId: string) => {
    if (!window.confirm("هل أنت متأكد من أرشفة هذه المهمة؟")) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/archive`, {
        method: "POST",
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: "archived", isArchived: true }
              : t,
          ),
        );
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
          setMessage("المهمة لم تعد متوفرة في النظام أو تمت أرشفتها مسبقاً.");
        } else {
          setMessage(data.error || "تعذر أرشفة المهمة.");
        }
      }
    } catch {
      setMessage("حدث خطأ أثناء الاتصال بالخادم.");
    }
  };

  const kanbanColumns: TaskStatus[] = [
    "todo",
    "in_progress",
    "blocked",
    "in_review",
    "completed",
  ];

  const surface =
    theme === "dark"
      ? "bg-slate-900 border-slate-800"
      : "bg-white border-slate-200";

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header & Controls */}
      <div className={`rounded-3xl border p-6 ${surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/15 text-amber-400">
              <CheckSquare size={26} />
            </span>
            <div>
              <h1 className="text-2xl font-black">منصة المهام وإدارة الكتب</h1>
              <p className="text-sm text-slate-400">
                متابعة المهام، التعيينات، ومراحل الإنتاج الصوتي في مكان واحد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadTasks()}
              className="rounded-xl border border-white/10 p-3 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="تحديث البيانات"
            >
              <RefreshCw
                size={18}
                className={busy ? "animate-spin text-amber-400" : ""}
              />
            </button>
            {currentUser.can_manage_tasks && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
              >
                <Plus size={18} /> مهمة جديدة
              </button>
            )}
          </div>
        </div>

        {/* Filters & View Switcher */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search
                className="absolute right-3 top-3 text-slate-500"
                size={16}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في المهام..."
                className="w-48 rounded-xl border border-white/10 bg-black/20 pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([k, { label }]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            >
              <option value="all">كل الأولويات</option>
              <option value="high">عالية</option>
              <option value="normal">عادية</option>
              <option value="low">منخفضة</option>
            </select>
          </div>

          {/* View Toggles */}
          <div className="flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`rounded-lg p-2 text-sm transition ${
                viewMode === "kanban"
                  ? "bg-amber-400 font-bold text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Kanban size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-2 text-sm transition ${
                viewMode === "list"
                  ? "bg-amber-400 font-bold text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ListIcon size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded-lg p-2 text-sm transition ${
                viewMode === "table"
                  ? "bg-amber-400 font-bold text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TableIcon size={16} />
            </button>
          </div>
        </div>

        {message && (
          <p className="mt-4 text-sm text-amber-300 flex items-center gap-2">
            <AlertCircle size={16} /> {message}
          </p>
        )}
      </div>

      {/* Main Task Display */}
      {viewMode === "kanban" && (
        <div className="grid gap-4 md:grid-cols-5 overflow-x-auto pb-4">
          {kanbanColumns.map((colStatus) => {
            const colTasks = filteredTasks.filter(
              (t) => t.status === colStatus,
            );
            const { label, color } = STATUS_LABELS[colStatus];
            return (
              <div
                key={colStatus}
                className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/40 p-4 min-w-[240px]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className={`rounded-lg border px-3 py-1 text-xs font-bold ${color}`}
                  >
                    {label}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[65vh]">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-white/10 bg-slate-900 p-4 shadow-lg transition hover:border-amber-400/30"
                    >
                      <h3 className="font-bold text-slate-100">{task.title}</h3>
                      {task.description && (
                        <p className="mt-1 text-xs leading-5 text-slate-400 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                        <span
                          className={
                            PRIORITY_LABELS[task.priority || "normal"].color
                          }
                        >
                          ● {PRIORITY_LABELS[task.priority || "normal"].label}
                        </span>
                        {task.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {task.dueDate}
                          </span>
                        )}
                      </div>

                      <select
                        value={task.status}
                        onChange={(e) =>
                          void handleUpdateStatus(
                            task.id,
                            e.target.value as TaskStatus,
                          )
                        }
                        className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-1.5 text-xs text-slate-300 outline-none"
                      >
                        {Object.entries(STATUS_LABELS).map(
                          ([sk, { label: sl }]) => (
                            <option key={sk} value={sk}>
                              تغيير إلى: {sl}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <p className="py-8 text-center text-xs text-slate-600">
                      لا توجد مهام
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "list" && (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-2xl border p-5 transition ${surface} hover:border-amber-400/30`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${
                        STATUS_LABELS[task.status].color
                      }`}
                    >
                      {STATUS_LABELS[task.status].label}
                    </span>
                    <h3 className="font-bold text-lg">{task.title}</h3>
                  </div>
                  {task.description && (
                    <p className="mt-2 text-sm text-slate-400">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`text-xs ${PRIORITY_LABELS[task.priority || "normal"].color}`}
                  >
                    الأولوية: {PRIORITY_LABELS[task.priority || "normal"].label}
                  </span>
                  <select
                    value={task.status}
                    onChange={(e) =>
                      void handleUpdateStatus(
                        task.id,
                        e.target.value as TaskStatus,
                      )
                    }
                    className="rounded-xl border border-white/10 bg-black/30 p-2 text-sm outline-none"
                  >
                    {Object.entries(STATUS_LABELS).map(
                      ([sk, { label: sl }]) => (
                        <option key={sk} value={sk}>
                          {sl}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
            </div>
          ))}
          {filteredTasks.length === 0 && (
            <div
              className={`rounded-2xl border p-12 text-center text-slate-400 ${surface}`}
            >
              لا توجد مهام تطابق الفلتر الحالي.
            </div>
          )}
        </div>
      )}

      {viewMode === "table" && (
        <div className={`overflow-x-auto rounded-2xl border ${surface}`}>
          <table className="w-full text-right text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-slate-400">
              <tr>
                <th className="p-4">المهمة</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">الأولوية</th>
                <th className="p-4">تاريخ التسليم</th>
                <th className="p-4">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-white/5">
                  <td className="p-4 font-bold">{task.title}</td>
                  <td className="p-4">
                    <span
                      className={`inline-block rounded-lg border px-2.5 py-0.5 text-xs font-bold ${
                        STATUS_LABELS[task.status].color
                      }`}
                    >
                      {STATUS_LABELS[task.status].label}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={
                        PRIORITY_LABELS[task.priority || "normal"].color
                      }
                    >
                      {PRIORITY_LABELS[task.priority || "normal"].label}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400">{task.dueDate || "-"}</td>
                  <td className="p-4">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        void handleUpdateStatus(
                          task.id,
                          e.target.value as TaskStatus,
                        )
                      }
                      className="rounded-lg border border-white/10 bg-black/40 p-1.5 text-xs text-slate-300 outline-none"
                    >
                      {Object.entries(STATUS_LABELS).map(
                        ([sk, { label: sl }]) => (
                          <option key={sk} value={sk}>
                            {sl}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h3 className="text-xl font-black mb-4">إنشاء مهمة جديدة</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  عنوان المهمة
                </label>
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: تسجيل الفصل الثاني من الكتاب"
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none ring-amber-300 focus:ring-2"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  الوصف التفصيلي
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="تفاصيل التعليمات أو الملاحظات..."
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none ring-amber-300 focus:ring-2"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    الأولوية
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) =>
                      setNewPriority(e.target.value as TaskPriority)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none"
                  >
                    <option value="low">منخفضة</option>
                    <option value="normal">عادية</option>
                    <option value="high">عالية جدًا</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    تاريخ التسليم
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none"
                  />
                </div>
              </div>

              {users.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    تعيين إلى عضو
                  </label>
                  <select
                    multiple
                    value={selectedAssignees}
                    onChange={(e) =>
                      setSelectedAssignees(
                        Array.from(e.target.selectedOptions, (o) => o.value),
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none max-h-28"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role_display_ar})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/5"
                >
                  إلغاء
                </button>
                <button
                  disabled={isSubmitting}
                  className="rounded-xl bg-amber-400 px-5 py-2.5 font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                >
                  {isSubmitting ? "جارٍ الإنشاء..." : "حفظ المهمة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
