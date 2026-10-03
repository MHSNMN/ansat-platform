// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import {
  TeamTask,
  TaskStatus,
  UserSession,
  TaskPriority,
  ALL_ARAB_COUNTRIES,
} from "../types";
import { DEPARTMENTS } from "../data/mockData";
import { normalizeDateForInput } from "../lib/storageService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Users,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Sparkles,
  UserCheck,
  Layers,
  ListFilter,
  Trash2,
  MessageSquare,
  Timer,
  BarChart2,
  CheckSquare,
  Square,
  Check,
  X,
  Archive,
  RotateCcw,
} from "lucide-react";

// Dynamic Deadline Countdown Bar Component (Only rendered for non-completed tasks)
const DeadlineCountdownBar: React.FC<{
  deadlineStr: string;
  isCompleted: boolean;
}> = ({ deadlineStr, isCompleted }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (isCompleted) return;
    const timer = setInterval(() => setNow(new Date()), 30000); // refresh every 30s
    return () => clearInterval(timer);
  }, [isCompleted]);

  if (isCompleted) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>تم الإنجاز بنجاح</span>
      </div>
    );
  }

  const normalized = normalizeDateForInput(deadlineStr);
  if (!normalized) {
    return null;
  }

  const deadline = new Date(`${normalized}T23:59:59`);
  if (isNaN(deadline.getTime())) {
    return null;
  }

  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return (
      <div className="space-y-1 w-full min-w-[130px]">
        <div className="flex items-center justify-between text-[10px] font-bold text-rose-400">
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-500 animate-bounce" />
            <span>متأخر عَن الموعد</span>
          </span>
          <span>0m</span>
        </div>
        <div className="w-full h-1.5 bg-rose-950/80 rounded-full overflow-hidden border border-rose-500/30">
          <div className="h-full bg-rose-500 w-full animate-pulse" />
        </div>
      </div>
    );
  }

  const minutesTotal = Math.floor(diffMs / (1000 * 60));
  const hoursTotal = Math.floor(minutesTotal / 60);
  const days = Math.floor(hoursTotal / 24);
  const hours = hoursTotal % 24;
  const mins = minutesTotal % 60;

  const isUrgent = hoursTotal < 24;

  const maxWindowMins = 7 * 24 * 60;
  const progressPercent = Math.min(
    100,
    Math.max(8, (minutesTotal / maxWindowMins) * 100),
  );

  return (
    <div className="space-y-1 w-full min-w-[130px] text-right">
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span
          className={`flex items-center gap-1 ${isUrgent ? "text-rose-400 animate-pulse" : "text-amber-300"}`}
        >
          <Timer className="w-3 h-3 shrink-0" />
          {isUrgent ? (
            <span>
              حرج! متبقي {hours}س و {mins}د
            </span>
          ) : (
            <span>
              متبقي: {days}d {hours}h
            </span>
          )}
        </span>
        <span className="text-[9px] text-slate-500 font-mono">
          {days > 0 ? `${days} يوم` : `${hours} ساعة`}
        </span>
      </div>

      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
        <div
          className={`h-full transition-all duration-500 ${
            isUrgent
              ? "bg-gradient-to-r from-rose-600 to-rose-400 animate-pulse"
              : "bg-gradient-to-r from-amber-500 to-emerald-400"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};

interface TeamDashboardProps {
  tasks: TeamTask[];
  currentUser: UserSession | null;
  onAddTaskClick: () => void;
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask?: (taskId: string) => void;
  onRestoreTask?: (taskId: string) => void;
  onBulkDeleteTasks?: (taskIds: string[]) => void;
  onBulkRestoreTasks?: (taskIds: string[]) => void;
  onBulkUpdateStatus?: (taskIds: string[], newStatus: TaskStatus) => void;
  onPermanentDeleteTask?: (taskId: string) => void;
  onBulkPermanentDeleteTasks?: (taskIds: string[]) => void;
  onEditTaskDeadline?: (taskId: string, newDeadline: string) => void;
  onStatusChangeRequest?: (task: TeamTask, newStatus: TaskStatus) => void;
  onRequestClick?: () => void;
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  tasks,
  currentUser,
  onAddTaskClick,
  onUpdateTaskStatus,
  onDeleteTask,
  onRestoreTask,
  onBulkDeleteTasks,
  onBulkRestoreTasks,
  onBulkUpdateStatus,
  onPermanentDeleteTask,
  onBulkPermanentDeleteTasks,
  onEditTaskDeadline,
  onStatusChangeRequest,
  onRequestClick,
}) => {
  const [viewTab, setViewTab] = useState<"my" | "dept" | "all">(
    currentUser?.isAdmin ? "all" : "my",
  );
  const [taskFilterMode, setTaskFilterMode] = useState<
    "active" | "completed" | "all" | "archived"
  >("active");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAnalytics, setShowAnalytics] = useState<boolean>(true);

  // Bulk Quick Actions Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // In-app modal states for safe deletion & mobile-friendly deadline picker (no window.confirm in iframe)
  const [taskToDeletePermanently, setTaskToDeletePermanently] =
    useState<TeamTask | null>(null);
  const [showBulkPermanentDeleteModal, setShowBulkPermanentDeleteModal] =
    useState<boolean>(false);
  const [editingDeadlineTask, setEditingDeadlineTask] =
    useState<TeamTask | null>(null);
  const [deadlinePickerValue, setDeadlinePickerValue] = useState<string>("");

  // Filter My & Department Tasks
  const currentUserNameLower = (currentUser?.name || "").toLowerCase();
  const myTasks = currentUser
    ? tasks.filter(
        (t) =>
          (currentUserNameLower &&
            (t.memberName || "")
              .toLowerCase()
              .includes(currentUserNameLower)) ||
          t.memberId === currentUser.id,
      )
    : [];

  const deptTasks = currentUser
    ? tasks.filter(
        (t) =>
          currentUser.departmentName &&
          ((t.departmentName || "").includes(currentUser.departmentName) ||
            currentUser.departmentName.includes(t.departmentName || "")),
      )
    : [];

  // Filter tasks based on controls & mode (Active vs Completed History vs All)
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Task State Mode (Active vs Completed History vs Archived)
      const isArch =
        Boolean(task.isArchived) ||
        task.status === "ARCHIVED" ||
        task.status === "مؤرشف";
      if (taskFilterMode === "archived" && !isArch) return false;
      if (taskFilterMode !== "archived" && isArch) return false;

      const isDone = task.status === "مكتمل" || task.status === "مكتملة";
      if (taskFilterMode === "active" && isDone) return false;
      if (taskFilterMode === "completed" && !isDone) return false;

      // 2. Privacy Scope
      const canViewAllSystemTasks = Boolean(
        currentUser?.isAdmin ||
        currentUser?.permissions?.canViewAllTasks ||
        currentUser?.actionAccess?.canViewAllTasks === "ALLOW" ||
        currentUser?.permissions?.canManageTasks ||
        currentUser?.actionAccess?.canManageTasks === "ALLOW",
      );

      if (!canViewAllSystemTasks) {
        if (!currentUser) return false;

        const isMyTask =
          (currentUserNameLower &&
            (task.memberName || "")
              .toLowerCase()
              .includes(currentUserNameLower)) ||
          task.memberId === currentUser.id;
        const isDeptTask =
          (currentUser.departmentName &&
            (task.departmentName || "").includes(currentUser.departmentName)) ||
          (currentUser.departmentName &&
            currentUser.departmentName.includes(task.departmentName || "")) ||
          task.departmentId === currentUser.departmentId;

        if (!isMyTask && !isDeptTask) return false;
        if (viewTab === "my" && !isMyTask) return false;
        if (viewTab === "dept" && !isDeptTask) return false;
      } else {
        if (viewTab === "my") {
          if (!currentUser) return false;
          if (
            !currentUserNameLower ||
            !(task.memberName || "")
              .toLowerCase()
              .includes(currentUserNameLower)
          )
            return false;
        } else if (viewTab === "dept") {
          if (!currentUser) return false;
          if (
            !task.departmentName ||
            !currentUser.departmentName ||
            (!task.departmentName.includes(currentUser.departmentName) &&
              !currentUser.departmentName.includes(task.departmentName))
          )
            return false;
        }
      }

      // 3. Dropdown filters
      const matchesDept =
        selectedDept === "all" || task.departmentId === selectedDept;
      const matchesStatus =
        selectedStatus === "all" || task.status === selectedStatus;
      const matchesPriority =
        selectedPriority === "all" || task.priority === selectedPriority;
      const matchesCountry =
        selectedCountry === "all" ||
        selectedCountry === "الوطن العربي كامل" ||
        task.country === selectedCountry;

      const q = (searchQuery || "").toLowerCase();
      const matchesSearch =
        !q ||
        (task.memberName || "").toLowerCase().includes(q) ||
        (task.title || "").toLowerCase().includes(q) ||
        (task.departmentName || "").toLowerCase().includes(q);

      return (
        matchesDept &&
        matchesStatus &&
        matchesPriority &&
        matchesCountry &&
        matchesSearch
      );
    });
  }, [
    tasks,
    currentUser,
    currentUserNameLower,
    viewTab,
    taskFilterMode,
    selectedDept,
    selectedStatus,
    selectedPriority,
    selectedCountry,
    searchQuery,
  ]);

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    }
  };

  const handleToggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const handleBulkStatusChange = (newStatus: TaskStatus) => {
    if (selectedTaskIds.length === 0) return;
    if (onBulkUpdateStatus && newStatus !== "مكتمل" && newStatus !== "مكتملة") {
      onBulkUpdateStatus(selectedTaskIds, newStatus);
    } else {
      selectedTaskIds.forEach((id) => {
        const task = tasks.find((t) => t.id === id);
        if (task) {
          if (
            (newStatus === "مكتمل" || newStatus === "مكتملة") &&
            onStatusChangeRequest
          ) {
            onStatusChangeRequest(task, newStatus);
          } else {
            onUpdateTaskStatus(task.id, newStatus);
          }
        }
      });
    }
    setSelectedTaskIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedTaskIds.length === 0) return;
    if (onBulkDeleteTasks) {
      onBulkDeleteTasks(selectedTaskIds);
    } else if (onDeleteTask) {
      selectedTaskIds.forEach((id) => onDeleteTask(id));
    }
    setSelectedTaskIds([]);
  };

  const handleBulkRestore = () => {
    if (selectedTaskIds.length === 0) return;
    if (onBulkRestoreTasks) {
      onBulkRestoreTasks(selectedTaskIds);
    } else if (onRestoreTask) {
      selectedTaskIds.forEach((id) => onRestoreTask(id));
    }
    setSelectedTaskIds([]);
  };

  const handleBulkPermanentDelete = () => {
    if (selectedTaskIds.length === 0) return;
    setShowBulkPermanentDeleteModal(true);
  };

  // Chart Data Preparation per Department using Recharts
  const departmentChartData = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const deptTasksList = tasks.filter(
        (t) =>
          t.departmentId === dept.id ||
          t.departmentName.includes(dept.name) ||
          dept.name.includes(t.departmentName),
      );
      const completed = deptTasksList.filter(
        (t) => t.status === "مكتمل" || t.status === "مكتملة",
      ).length;
      const inProgress = deptTasksList.filter(
        (t) => t.status === "قيد التنفيذ" || t.status === "بانتظار التسجيل",
      ).length;
      const overdue = deptTasksList.filter((t) => t.status === "متأخر").length;

      return {
        name: dept.name.replace("قسم ", "").replace("لجنة ", ""),
        مكتملة: completed,
        "قيد التنفيذ": inProgress,
        متأخرة: overdue,
        المجموع: deptTasksList.length,
      };
    });
  }, [tasks]);

  const priorityPieData = useMemo(() => {
    const high = tasks.filter((t) => t.priority === "عالية").length;
    const med = tasks.filter((t) => t.priority === "متوسطة").length;
    const low = tasks.filter(
      (t) => t.priority === "منخفضة" || t.priority === "عادية",
    ).length;

    return [
      { name: "أولوية عالية", value: high, color: "#ef4444" },
      { name: "أولوية متوسطة", value: med, color: "#f59e0b" },
      { name: "أولوية منخفضة/عادية", value: low, color: "#3b82f6" },
    ];
  }, [tasks]);

  const handleStatusChange = (task: TeamTask, newStatus: TaskStatus) => {
    if (
      (newStatus === "مكتمل" || newStatus === "مكتملة") &&
      onStatusChangeRequest
    ) {
      onStatusChangeRequest(task, newStatus);
    } else {
      onUpdateTaskStatus(task.id, newStatus);
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "عالية":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span>عالية</span>
          </span>
        );
      case "متوسطة":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>متوسطة</span>
          </span>
        );
      case "منخفضة":
      case "عادية":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>منخفضة</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case "مكتمل":
      case "مكتملة":
        return (
          <span
            style={{ backgroundColor: "#10b981", color: "#ffffff" }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>مكتمل</span>
          </span>
        );
      case "قيد التنفيذ":
        return (
          <span
            style={{ backgroundColor: "#f59e0b", color: "#ffffff" }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold shadow-sm"
          >
            <Clock
              className="w-3.5 h-3.5 animate-spin"
              style={{ animationDuration: "6s" }}
            />
            <span>قيد التنفيذ</span>
          </span>
        );
      case "بانتظار التسجيل":
        return (
          <span
            style={{ backgroundColor: "#3b82f6", color: "#ffffff" }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold shadow-sm"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>بانتظار التسجيل</span>
          </span>
        );
      default:
        return (
          <span
            style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold shadow-sm"
          >
            <span>متأخر</span>
          </span>
        );
    }
  };

  const activeCount = tasks.filter(
    (t) => t.status !== "مكتمل" && t.status !== "مكتملة",
  ).length;
  const completedCount = tasks.filter(
    (t) => t.status === "مكتمل" || t.status === "مكتملة",
  ).length;

  const canManageAllTasks = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManageTasks ||
    currentUser?.actionAccess?.canManageTasks === "ALLOW",
  );
  const canAddTaskForDept = Boolean(
    currentUser?.permissions?.canAddTaskForDept ||
    currentUser?.actionAccess?.canAddTaskForDept === "ALLOW",
  );
  const canDeleteTasks = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canDeleteTasks ||
    currentUser?.actionAccess?.canDeleteTasks === "ALLOW" ||
    canManageAllTasks ||
    !currentUser,
  );
  const canDelete = canDeleteTasks;
  const canBulkUpdateTasks = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canBulkUpdateTasks ||
    currentUser?.actionAccess?.canBulkUpdateTasks === "ALLOW" ||
    canManageAllTasks,
  );
  const canViewAllTasks = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewAllTasks ||
    currentUser?.actionAccess?.canViewAllTasks === "ALLOW" ||
    canManageAllTasks,
  );

  const canAddTask = canManageAllTasks || canAddTaskForDept;
  const canViewAnalytics =
    currentUser?.isAdmin ||
    currentUser?.permissions?.canViewEfficiencyTab ||
    canManageAllTasks ||
    canViewAllTasks;
  const canViewDeptTab =
    currentUser?.isAdmin ||
    canManageAllTasks ||
    canAddTaskForDept ||
    canViewAllTasks;

  return (
    <section
      id="dashboard"
      className="py-12 bg-slate-950 font-['Cairo'] relative"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header & Main Tabs Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-2">
              <Users className="w-4 h-4" />
              <span>
                جدول ومؤشرات متابعة المهام (Task Tracker & Delivery Analytics)
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              جدول المهام المركزية وأرشيف التسليم
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              متابعة المهام النشطة، أرشفة المهام المكتملة تلقائياً، والتصفية حسب
              الدول العربية واللجان
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canViewAnalytics && (
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <BarChart2 className="w-4 h-4 text-amber-400" />
                <span>
                  {showAnalytics ? "إخفاء الإحصاءات" : "عرض الإحصاءات"}
                </span>
              </button>
            )}

            {/* Mode Switcher: Active vs Completed History vs Archived */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setTaskFilterMode("active")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  taskFilterMode === "active"
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>المهام الفعالة ({activeCount})</span>
              </button>

              <button
                onClick={() => setTaskFilterMode("completed")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  taskFilterMode === "completed"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>سجل المكتملة ({completedCount})</span>
              </button>

              <button
                onClick={() => setTaskFilterMode("archived")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  taskFilterMode === "archived"
                    ? "bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>
                  الأرشيف (
                  {
                    tasks.filter(
                      (t) => Boolean(t.isArchived) || t.status === "ARCHIVED",
                    ).length
                  }
                  )
                </span>
              </button>

              <button
                onClick={() => setTaskFilterMode("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  taskFilterMode === "all"
                    ? "bg-slate-800 text-amber-300 border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>الكل ({tasks.length})</span>
              </button>
            </div>

            {/* Privacy View Tabs */}
            <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
              {currentUser && (
                <>
                  <button
                    onClick={() => setViewTab("my")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      viewTab === "my"
                        ? "bg-slate-800 text-white border border-slate-700"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>خاصتي ({myTasks.length})</span>
                  </button>

                  {canViewDeptTab && (
                    <button
                      onClick={() => setViewTab("dept")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        viewTab === "dept"
                          ? "bg-slate-800 text-white border border-slate-700"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>قسمي ({deptTasks.length})</span>
                    </button>
                  )}
                </>
              )}

              {canViewAllTasks && (
                <button
                  onClick={() => setViewTab("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewTab === "all"
                      ? "bg-slate-800 text-white border border-slate-700"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5 text-amber-400" />
                  <span>كافة النظام ({tasks.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data Visualization Section using Recharts */}
        {canViewAnalytics && showAnalytics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {/* Department Task Distribution Bar Chart */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      توزيع المهام بحسب الأقسام (Recharts Visualization)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      إحصاء شامل للمهام المكتملة والمستمرة المتأخرة بكل قسم
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-64 w-full pt-2 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "12px",
                        fontFamily: "Cairo",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "11px",
                        fontFamily: "Cairo",
                        paddingTop: "10px",
                      }}
                    />
                    <Bar
                      dataKey="مكتملة"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="قيد التنفيذ"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="متأخرة"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Task Priorities Breakdown Pie Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      توزيع مستويات الأولويات
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      نسبة المهام العالية والمتوسطة والمنخفضة
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-48 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {priorityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px] font-bold">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <span>عالية: </span>
                  <span className="text-white text-xs">
                    {priorityPieData[0].value}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <span>متوسطة: </span>
                  <span className="text-white text-xs">
                    {priorityPieData[1].value}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <span>منخفضة: </span>
                  <span className="text-white text-xs">
                    {priorityPieData[2].value}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banner Notification for Completed Tasks Mode */}
        {taskFilterMode === "completed" && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-black text-white block text-sm">
                  سجل وأرشيف المهام المكتملة
                </span>
                <span>
                  تتم أرشفة المهام المنجزة وتتبع توقيتات التسليم وملاحظات
                  الأعضاء بدقة هنا.
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs">
              {completedCount} مهمة مؤرشفة
            </span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col xl:flex-row items-center justify-between gap-4">
          {/* Real-time Search Box */}
          <div className="relative w-full xl:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث باسم العضو، عنوان المهمة، أو اسم القسم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">كافة الأولويات</option>
              <option value="عالية">🔴 أولويات عالية</option>
              <option value="متوسطة">🟡 أولويات متوسطة</option>
              <option value="منخفضة">🟢 أولويات منخفضة</option>
            </select>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">جميع الأقسام</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Country Filter (All Arab Countries) */}
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">كافة الدول العربية</option>
              {ALL_ARAB_COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">جميع الحالات</option>
              <option value="قيد التنفيذ">قيد التنفيذ</option>
              <option value="بانتظار التسجيل">بانتظار التسجيل</option>
              <option value="مكتمل">مكتملة</option>
              <option value="متأخر">متأخر</option>
            </select>

            {/* Admin Add Task Trigger */}
            {canAddTask && (
              <button
                onClick={onAddTaskClick}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">إسناد مهمة</span>
              </button>
            )}

            {/* Submit Request Trigger */}
            {currentUser && onRequestClick && (
              <button
                onClick={onRequestClick}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all shrink-0"
              >
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">الطلبات والإبلاغات</span>
              </button>
            )}
          </div>
        </div>

        {/* Tasks Data Table (Desktop) */}
        <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-950 text-slate-400 font-bold text-xs border-b border-slate-800">
              <tr>
                <th className="py-4 px-4 text-center">
                  {canBulkUpdateTasks ? (
                    <button
                      onClick={handleSelectAll}
                      className="p-1 rounded text-slate-400 hover:text-amber-400 cursor-pointer"
                      title="تحديد الكل"
                    >
                      {selectedTaskIds.length === filteredTasks.length &&
                      filteredTasks.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-600 font-normal">
                      #
                    </span>
                  )}
                </th>
                <th className="py-4 px-4">العضو المكلف</th>
                <th className="py-4 px-3">الدولة</th>
                <th className="py-4 px-3">القسم</th>
                <th className="py-4 px-3">الأولية</th>
                <th className="py-4 px-6">المهمة وملاحظة الإنجاز</th>
                <th className="py-4 px-4">
                  {taskFilterMode === "completed"
                    ? "تاريخ التسليم والسرعة"
                    : "الموعد والعداد"}
                </th>
                <th className="py-4 px-4">الحالة</th>
                <th className="py-4 px-4 text-center">التنفيذ والإجراء</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 font-medium text-xs">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => {
                  const isMyTask = Boolean(
                    currentUser &&
                    ((currentUserNameLower &&
                      (task.memberName || "")
                        .toLowerCase()
                        .includes(currentUserNameLower)) ||
                      task.memberId === currentUser.id),
                  );
                  const isDeptTask = Boolean(
                    currentUser?.departmentName &&
                    ((task.departmentName || "").includes(
                      currentUser.departmentName,
                    ) ||
                      currentUser.departmentName.includes(
                        task.departmentName || "",
                      )),
                  );
                  const canEditStatus =
                    canManageAllTasks ||
                    isMyTask ||
                    (canAddTaskForDept && isDeptTask);
                  const canEditDeadline =
                    canManageAllTasks ||
                    (canAddTaskForDept && isDeptTask) ||
                    isMyTask ||
                    !currentUser;
                  const canDelete = canDeleteTasks;
                  const isDone =
                    task.status === "مكتمل" || task.status === "مكتملة";
                  const isSelected = selectedTaskIds.includes(task.id);

                  return (
                    <tr
                      key={task.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-amber-500/10 border-r-4 border-amber-500"
                          : isMyTask
                            ? "bg-amber-500/5 hover:bg-amber-500/10"
                            : "hover:bg-slate-800/40"
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-4 px-4 text-center">
                        {canBulkUpdateTasks ? (
                          <button
                            onClick={() => handleToggleSelectTask(task.id)}
                            className="p-1 rounded text-slate-400 hover:text-amber-400 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-800 inline-block"></span>
                        )}
                      </td>

                      {/* Member Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isMyTask
                                ? "bg-amber-500 text-slate-950"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {task.memberName.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm block">
                                {task.memberName}
                              </span>
                              {isMyTask && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                                  مهمتك
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Country */}
                      <td className="py-4 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-slate-950 border border-slate-800 text-slate-300">
                          <span>{task.country}</span>
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-4 px-3 font-semibold text-slate-300">
                        {task.departmentName}
                      </td>

                      {/* Priority */}
                      <td className="py-4 px-3">
                        {getPriorityBadge(task.priority || "عادية")}
                      </td>

                      {/* Task Title & Description & Completion Note */}
                      <td className="py-4 px-6 max-w-xs space-y-1">
                        <span className="font-bold text-white text-sm block">
                          {task.title}
                        </span>
                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {task.description}
                        </p>

                        {task.completionNote && (
                          <div className="mt-1.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-start gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold block text-[10px] text-emerald-400">
                                ملاحظة التسليم:
                              </span>
                              <span>"{task.completionNote}"</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Deadline & Delivery Time Tracker */}
                      <td className="py-4 px-4 text-slate-300 font-mono space-y-1">
                        {isDone ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                {task.completedAt
                                  ? new Date(
                                      task.completedAt,
                                    ).toLocaleDateString("ar-EG")
                                  : "تم الإنجاز"}
                              </span>
                            </div>
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              ⚡ تسليم في الموعد
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDeadlineTask(task);
                                  setDeadlinePickerValue(
                                    normalizeDateForInput(task.deadline) || "",
                                  );
                                }}
                                className="p-1 rounded-md hover:bg-slate-800 text-amber-400 cursor-pointer transition-all shrink-0"
                                title="تعديل الموعد النهائي بسهولة"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                              {canEditDeadline ? (
                                <input
                                  type="date"
                                  value={normalizeDateForInput(task.deadline)}
                                  onChange={(e) => {
                                    if (onEditTaskDeadline && e.target.value) {
                                      onEditTaskDeadline(
                                        task.id,
                                        e.target.value,
                                      );
                                    }
                                  }}
                                  className="bg-slate-950/80 border border-amber-500/30 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-amber-400 cursor-pointer w-full text-amber-200 font-mono"
                                  title="تعديل الموعد النهائي للمهمة"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDeadlineTask(task);
                                    setDeadlinePickerValue(
                                      normalizeDateForInput(task.deadline) ||
                                        "",
                                    );
                                  }}
                                  className="text-xs text-amber-300 hover:underline cursor-pointer"
                                >
                                  {task.deadline || "غير محدد"}
                                </button>
                              )}
                            </div>
                            <DeadlineCountdownBar
                              deadlineStr={task.deadline}
                              isCompleted={false}
                            />
                          </>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        {getStatusBadge(task.status)}
                      </td>

                      {/* Action Status Change Toggle & Admin Delete Button */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {canEditStatus ? (
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  task,
                                  e.target.value as TaskStatus,
                                )
                              }
                              className="p-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-400 cursor-pointer shadow-sm"
                            >
                              <option value="قيد التنفيذ">قيد التنفيذ</option>
                              <option value="بانتظار التسجيل">
                                بانتظار التسجيل
                              </option>
                              <option value="مكتمل">مكتملة</option>
                              <option value="متأخر">متأخر</option>
                            </select>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-bold">
                              للعضو فقط
                            </span>
                          )}

                          {/* Archive / Restore / Permanent Delete Buttons */}
                          {Boolean(task.isArchived) ||
                          task.status === "ARCHIVED" ||
                          taskFilterMode === "archived" ? (
                            <div className="flex items-center gap-1.5">
                              {canDelete && onRestoreTask && (
                                <button
                                  onClick={() => onRestoreTask(task.id)}
                                  className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                                  title="استعادة المهمة من الأرشيف"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete &&
                                (onPermanentDeleteTask || onDeleteTask) && (
                                  <button
                                    onClick={() =>
                                      setTaskToDeletePermanently(task)
                                    }
                                    className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                    title="حذف نهائي للمهمة من قاعدة البيانات"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {canDelete && onDeleteTask && (
                                <button
                                  onClick={() => onDeleteTask(task.id)}
                                  className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                                  title="أرشفة المهمة"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && onPermanentDeleteTask && (
                                <button
                                  onClick={() =>
                                    setTaskToDeletePermanently(task)
                                  }
                                  className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                  title="حذف نهائي للمهمة"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-slate-500 font-bold"
                  >
                    لا توجد مهام تطابق البحث أو الخيارات المختارة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile & Tablet Task Cards View */}
        <div className="grid lg:hidden grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => {
              const isMyTask = Boolean(
                currentUser &&
                ((currentUserNameLower &&
                  (task.memberName || "")
                    .toLowerCase()
                    .includes(currentUserNameLower)) ||
                  task.memberId === currentUser.id),
              );
              const isDeptTask = Boolean(
                currentUser?.departmentName &&
                ((task.departmentName || "").includes(
                  currentUser.departmentName,
                ) ||
                  currentUser.departmentName.includes(
                    task.departmentName || "",
                  )),
              );
              const canEditStatus =
                canManageAllTasks ||
                isMyTask ||
                (canAddTaskForDept && isDeptTask);
              const canEditDeadline =
                canManageAllTasks ||
                (canAddTaskForDept && isDeptTask) ||
                isMyTask ||
                !currentUser;
              const canDelete = canDeleteTasks;
              const isDone =
                task.status === "مكتمل" || task.status === "مكتملة";
              const isSelected = selectedTaskIds.includes(task.id);

              return (
                <div
                  key={task.id}
                  className={`p-5 rounded-2xl bg-slate-900 border ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10"
                      : isMyTask
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-slate-800"
                  } space-y-4 shadow-lg text-xs relative`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      {canBulkUpdateTasks && (
                        <button
                          onClick={() => handleToggleSelectTask(task.id)}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      )}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          isMyTask
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {task.memberName.slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-bold text-white block text-sm">
                          {task.memberName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {task.departmentName} ({task.country})
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority || "عادية")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-white text-sm">
                      {task.title}
                    </h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      {task.description}
                    </p>

                    {task.completionNote && (
                      <div className="mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-start gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-[10px] text-emerald-400">
                            ملاحظة التسليم:
                          </span>
                          <span>"{task.completionNote}"</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="text-slate-400 font-mono text-xs">
                      {isDone ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {task.completedAt
                              ? new Date(task.completedAt).toLocaleDateString(
                                  "ar-EG",
                                )
                              : "مكتملة"}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                            <div className="flex items-center gap-2 text-amber-400 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDeadlineTask(task);
                                  setDeadlinePickerValue(
                                    normalizeDateForInput(task.deadline) || "",
                                  );
                                }}
                                className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 shrink-0 cursor-pointer flex items-center gap-1 font-bold text-xs"
                                title="تعديل الموعد النهائي للمهمة"
                              >
                                <Calendar className="w-4 h-4 shrink-0 text-amber-400" />
                                <span className="text-[11px] font-sans text-amber-300">
                                  تعديل:
                                </span>
                              </button>
                              {canEditDeadline ? (
                                <input
                                  type="date"
                                  value={normalizeDateForInput(task.deadline)}
                                  onChange={(e) => {
                                    if (onEditTaskDeadline && e.target.value) {
                                      onEditTaskDeadline(
                                        task.id,
                                        e.target.value,
                                      );
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-200 text-xs font-mono font-bold focus:outline-none focus:border-amber-400 cursor-pointer flex-1 min-w-[130px]"
                                  title="تعديل الموعد النهائي من الهاتف"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDeadlineTask(task);
                                    setDeadlinePickerValue(
                                      normalizeDateForInput(task.deadline) ||
                                        "",
                                    );
                                  }}
                                  className="font-mono text-amber-300 font-bold text-xs truncate hover:underline cursor-pointer"
                                >
                                  {task.deadline || "غير محدد (انقر للتعديل)"}
                                </button>
                              )}
                            </div>
                            <div className="w-full sm:w-auto">
                              <DeadlineCountdownBar
                                deadlineStr={task.deadline}
                                isCompleted={false}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {canEditStatus ? (
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleStatusChange(
                              task,
                              e.target.value as TaskStatus,
                            )
                          }
                          className="p-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300 text-xs font-bold"
                        >
                          <option value="قيد التنفيذ">قيد التنفيذ</option>
                          <option value="بانتظار التسجيل">
                            بانتظار التسجيل
                          </option>
                          <option value="مكتمل">مكتملة</option>
                          <option value="متأخر">متأخر</option>
                        </select>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold">
                          للعضو فقط
                        </span>
                      )}

                      {Boolean(task.isArchived) ||
                      task.status === "ARCHIVED" ||
                      taskFilterMode === "archived" ? (
                        <div className="flex items-center gap-1.5">
                          {canDelete && onRestoreTask && (
                            <button
                              onClick={() => onRestoreTask(task.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                              title="استعادة المهمة من الأرشيف"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete &&
                            (onPermanentDeleteTask || onDeleteTask) && (
                              <button
                                onClick={() => setTaskToDeletePermanently(task)}
                                className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                title="حذف نهائي للمهمة من قاعدة البيانات"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {canDelete && onDeleteTask && (
                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                              title="أرشفة المهمة"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && onPermanentDeleteTask && (
                            <button
                              onClick={() => setTaskToDeletePermanently(task)}
                              className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                              title="حذف نهائي للمهمة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-12 text-center text-slate-500 font-bold">
              لا توجد مهام مطابقة للفياد.
            </div>
          )}
        </div>

        {/* Quick Actions Floating Toolbar (Appears when tasks are selected) */}
        {selectedTaskIds.length > 0 && canBulkUpdateTasks && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md border border-amber-500/40 px-6 py-3.5 rounded-2xl shadow-2xl flex flex-wrap items-center gap-4 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-2 font-bold text-xs text-white">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
                {selectedTaskIds.length}
              </span>
              <span>مهمة محدودة</span>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkStatusChange("مكتمل")}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تعيين مكتملة</span>
              </button>

              <button
                onClick={() => handleBulkStatusChange("قيد التنفيذ")}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-amber-500/20"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>تعيين قيد التنفيذ</span>
              </button>

              <button
                onClick={() => handleBulkStatusChange("متأخر")}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-rose-500/30 transition-all"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>تعيين متأخر</span>
              </button>

              {taskFilterMode === "archived" ? (
                <>
                  {(canDeleteTasks || canDelete) &&
                    (onRestoreTask || onBulkRestoreTasks) && (
                      <button
                        onClick={handleBulkRestore}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-emerald-600/20"
                        title="استعادة كافة المهام المحددة من الأرشيف"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة المحدد</span>
                      </button>
                    )}
                  {(canDeleteTasks || canDelete) &&
                    (onPermanentDeleteTask ||
                      onBulkPermanentDeleteTasks ||
                      onDeleteTask ||
                      onBulkDeleteTasks) && (
                      <button
                        onClick={handleBulkPermanentDelete}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-rose-600/20"
                        title="حذف كافة المهام المحددة نهائياً من قاعدة البيانات"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف نهائي للمحدد</span>
                      </button>
                    )}
                </>
              ) : (
                <>
                  {(canDeleteTasks || canDelete) &&
                    (onDeleteTask || onBulkDeleteTasks) && (
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-amber-600/20"
                        title="أرشفة كافة المهام المحددة"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>أرشفة المحدد</span>
                      </button>
                    )}
                  {(canDeleteTasks || canDelete) &&
                    (onPermanentDeleteTask || onBulkPermanentDeleteTasks) && (
                      <button
                        onClick={handleBulkPermanentDelete}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-rose-600/20"
                        title="حذف كافة المهام المحددة نهائياً من قاعدة البيانات"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف نهائي للمحدد</span>
                      </button>
                    )}
                </>
              )}
            </div>

            <button
              onClick={() => setSelectedTaskIds([])}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer mr-auto"
              title="إلغاء التحديد"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Modal: Confirmation for Single Task Permanent Deletion */}
        {taskToDeletePermanently && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right font-['Cairo']">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                  <Trash2 className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    تأكيد الحذف النهائي للمهمة
                  </h3>
                  <p className="text-xs text-rose-400/80">
                    حذف نهائي من قاعدة البيانات والخادم
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف المهمة{" "}
                <span className="font-bold text-white">
                  "{taskToDeletePermanently.title}"
                </span>{" "}
                نهائياً من قاعدة البيانات (Supabase و Firestore)؟ لن تعود هذه
                المهمة بعد الحذف إطلاقاً.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTaskToDeletePermanently(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = taskToDeletePermanently.id;
                    setTaskToDeletePermanently(null);
                    if (onPermanentDeleteTask) onPermanentDeleteTask(id);
                    else if (onDeleteTask) onDeleteTask(id);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-all shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف نهائي الآن</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Modal: Confirmation for Bulk Permanent Deletion */}
        {showBulkPermanentDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right font-['Cairo']">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                  <Trash2 className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    تأكيد الحذف النهائي للمهام المحددة
                  </h3>
                  <p className="text-xs text-rose-400/80">
                    سيتم حذف {selectedTaskIds.length} مهام نهائياً
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف{" "}
                <span className="font-bold text-white">
                  ({selectedTaskIds.length})
                </span>{" "}
                مهام محددة نهائياً من قاعدة البيانات والخادم؟ لا يمكن استرجاعها
                بعد الحذف.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkPermanentDeleteModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ids = [...selectedTaskIds];
                    setShowBulkPermanentDeleteModal(false);
                    if (onBulkPermanentDeleteTasks) {
                      onBulkPermanentDeleteTasks(ids);
                    } else if (onPermanentDeleteTask) {
                      ids.forEach((id) => onPermanentDeleteTask(id));
                    } else if (onDeleteTask) {
                      ids.forEach((id) => onDeleteTask(id));
                    }
                    setSelectedTaskIds([]);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-all shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف كافة المحدد نهائياً</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Modal: Quick Mobile & Desktop Deadline Editor */}
        {editingDeadlineTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-right font-['Cairo']">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-amber-400">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-sm">
                    تعديل الديدلاين والموعد النهائي
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDeadlineTask(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 font-medium truncate">
                المهمة:{" "}
                <span className="text-amber-300 font-bold">
                  {editingDeadlineTask.title}
                </span>
              </p>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 block">
                  اختر تاريخ الديدلاين الجديد:
                </label>
                <input
                  type="date"
                  value={deadlinePickerValue}
                  onChange={(e) => setDeadlinePickerValue(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-200 text-sm font-mono font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                />
              </div>

              {/* Quick shortcuts for fast mobile entry */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-bold">
                  اختصارات سريعة للهاتف:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 3);
                      setDeadlinePickerValue(d.toISOString().split("T")[0]);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-center cursor-pointer transition-colors"
                  >
                    + 3 أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setDeadlinePickerValue(d.toISOString().split("T")[0]);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-center cursor-pointer transition-colors"
                  >
                    + أسبوع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 14);
                      setDeadlinePickerValue(d.toISOString().split("T")[0]);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-center cursor-pointer transition-colors"
                  >
                    + أسبوعين
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const endOfMonth = new Date(
                        d.getFullYear(),
                        d.getMonth() + 1,
                        0,
                      );
                      const y = endOfMonth.getFullYear();
                      const m = String(endOfMonth.getMonth() + 1).padStart(
                        2,
                        "0",
                      );
                      const day = String(endOfMonth.getDate()).padStart(2, "0");
                      setDeadlinePickerValue(`${y}-${m}-${day}`);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-center cursor-pointer transition-colors"
                  >
                    نهاية الشهر
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDeadlineTask(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deadlinePickerValue && onEditTaskDeadline) {
                      onEditTaskDeadline(
                        editingDeadlineTask.id,
                        deadlinePickerValue,
                      );
                    }
                    setEditingDeadlineTask(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>تطبيق الديدلاين</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
