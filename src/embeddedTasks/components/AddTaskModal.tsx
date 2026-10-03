// @ts-nocheck
import React, { useState } from "react";
import {
  TeamTask,
  TaskStatus,
  UserSession,
  DepartmentId,
  TaskPriority,
} from "../types";
import { AUTHORIZED_USERS } from "../data/mockData";
import { X, Plus } from "lucide-react";

interface AddTaskModalProps {
  isOpen: boolean;
  users?: UserSession[];
  currentUser?: UserSession | null;
  onClose: () => void;
  onAddTask: (task: TeamTask) => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  users = AUTHORIZED_USERS,
  currentUser,
  onClose,
  onAddTask,
}) => {
  const canManageAll = Boolean(
    currentUser?.isAdmin ||
    currentUser?.permissions?.canManageTasks ||
    currentUser?.actionAccess?.canManageTasks === "ALLOW",
  );

  // If user doesn't have system-wide manage tasks, but has canAddTaskForDept, restrict users list to their department
  const filteredUsers =
    !canManageAll && currentUser?.departmentName
      ? users.filter(
          (u) =>
            u.departmentName &&
            (u.departmentName.includes(currentUser.departmentName) ||
              currentUser.departmentName.includes(u.departmentName)),
        )
      : users;

  const selectableUsers = filteredUsers.length > 0 ? filteredUsers : users;

  const getDefaultDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [memberId, setMemberId] = useState<string>(
    selectableUsers[0]?.id || users[0]?.id || "",
  );
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [deadline, setDeadline] = useState<string>(getDefaultDeadline);
  const [priority, setPriority] = useState<TaskPriority>("عالية");
  const [status, setStatus] = useState<TaskStatus>("قيد التنفيذ");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedMember =
      selectableUsers.find((m) => m.id === memberId) ||
      selectableUsers[0] ||
      users[0];
    if (!selectedMember) return;

    const deptName = selectedMember.departmentName;
    const deptId: DepartmentId = deptName.includes("صوت")
      ? "audio"
      : deptName.includes("محتوى")
        ? "content"
        : deptName.includes("تصميم") || deptName.includes("فعاليات")
          ? "design"
          : "tech";

    const newTask: TeamTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      country: selectedMember.country,
      departmentId: deptId,
      departmentName: selectedMember.departmentName,
      title,
      description,
      deadline,
      status,
      progress: status === "مكتملة" || status === "مكتمل" ? 100 : 25,
      priority,
    };

    onAddTask(newTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-right font-['Cairo']">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">
              إسناد مهمة جديدة للوحة العمل
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Member Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">
              العضو المكلَّف بالعمل:
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              {users.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.country}) - {m.departmentName}
                </option>
              ))}
            </select>
          </div>

          {/* Task Title */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">
              عنوان المهمة:
            </label>
            <input
              type="text"
              required
              placeholder="مثال: تسجيل القراءة الصوتية للفصل الثالث..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">
              تفاصيل المهمة والشروط:
            </label>
            <textarea
              rows={3}
              placeholder="اكتب التوجيهات الفنية أو التواريخ المرتبطة بهذه المهمة..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium placeholder:text-slate-600 focus:border-amber-500 focus:outline-none resize-none"
            ></textarea>
          </div>

          {/* Grid: Priority & Status & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Priority */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                أولوية المهمة:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="عالية">🔴 عالية (High)</option>
                <option value="متوسطة">🟡 متوسطة (Medium)</option>
                <option value="منخفضة">🟢 منخفضة (Low)</option>
                <option value="عادية">⚪ عادية (Normal)</option>
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                حالة المهمة:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="قيد التنفيذ">قيد التنفيذ</option>
                <option value="بانتظار التسجيل">بانتظار التسجيل</option>
                <option value="مكتمل">مكتملة</option>
              </select>
            </div>

            {/* Deadline */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                الموعد النهائي:
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold focus:border-amber-500 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              إضافة المهمة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
